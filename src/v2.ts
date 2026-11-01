// opencode 2.x server plugin adapter.
//
// opencode 2 loads the `./server` entry and calls `setup(ctx)` with its plugin
// Context. This adapter feeds the shared v1 notifier (src/index.ts) from the
// v2 event stream and hooks, translating v2 events into the v1 event shape the
// notifier already understands. Deliberately dependency-free: nothing from
// @opencode/plugin is imported, so the package keeps building against the v1
// SDK alone and the host never has to provide v2 SDK modules.
import { NotifierPlugin } from "./index"

type AnyRecord = Record<string, any>

interface V1Hooks {
  event?: (input: { event: unknown }) => Promise<void>
  "permission.ask"?: () => Promise<void>
  "tool.execute.before"?: (input: { tool: string }) => Promise<void>
}

// v2 events carry their payload under `data`; the v1 notifier reads
// `properties`. Fields that do not exist in v2 are simply absent and the
// notifier's null-tolerant getters degrade gracefully.
function translate(event: AnyRecord): AnyRecord | undefined {
  const data = (event.data ?? {}) as AnyRecord
  switch (event.type) {
    case "session.created":
      return {
        type: "session.created",
        properties: { info: { id: data.sessionID ?? data.id, parentID: data.parentID, title: data.title } },
      }
    case "session.deleted":
      return { type: "session.deleted", properties: { info: { id: data.sessionID ?? data.id } } }
    case "session.idle":
      return { type: "session.idle", properties: { sessionID: data.sessionID } }
    case "session.status":
      return { type: "session.status", properties: { sessionID: data.sessionID, status: data.status } }
    case "permission.asked":
      return { type: "permission.asked", properties: { sessionID: data.sessionID } }
    // v2 has no session.error; a failed execution is the closest signal.
    case "session.execution.failed":
      return { type: "session.error", properties: { sessionID: data.sessionID, error: data.error } }
    // v2 has no message.updated; a user message entering the inbox is the
    // moment a user prompt is submitted.
    case "session.inbox.enqueued":
      return { type: "message.updated", properties: { info: { role: "user", sessionID: data.sessionID } } }
  }
  return undefined
}

export async function v2Setup(ctx: AnyRecord): Promise<(() => void) | undefined> {
  // The v1 notifier only calls client.session.get (session title / parent)
  // and client.session.messages (elapsed time). v2's plugin API exposes the
  // former; the latter is unavailable, and the notifier already falls back
  // to null elapsed time when the call fails.
  const client = {
    session: {
      get: async (req: AnyRecord) => ({ data: await ctx.session.get({ sessionID: req.path.id }) }),
      messages: async () => {
        throw new Error("session.messages is not available under opencode 2")
      },
    },
  }

  const start = NotifierPlugin as unknown as (input: AnyRecord) => Promise<V1Hooks>
  const hooks = await start({ client, directory: ctx.location?.directory ?? "" })
  if (!hooks.event) return undefined

  const controller = new AbortController()
  void (async () => {
    for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
      const v1Event = translate(event as AnyRecord)
      if (!v1Event) continue
      // A notifier bug must never break the host's event stream.
      try {
        await hooks.event!({ event: v1Event })
      } catch {}
    }
  })().catch(() => {})

  // question / plan_exit tool alerts, mirroring the v1 tool hook
  await ctx.tool.hook("execute.before", async (input: AnyRecord) => {
    try {
      await hooks["tool.execute.before"]?.(input)
    } catch {}
  })

  // v2 permission evaluations that require a user decision; mirrors the v1
  // permission.ask hook for requests that carry no session context.
  await ctx.permission.hook("evaluate", async (evaluation: AnyRecord) => {
    if (evaluation?.effect !== "ask") return
    try {
      await hooks["permission.ask"]?.()
    } catch {}
  })

  return () => controller.abort()
}
