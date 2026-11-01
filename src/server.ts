// Dual-host entry: opencode 1 reads `{ id, server }` and calls
// `server(input)` with the v1 PluginInput; opencode 2 reads `{ id, setup }`
// and calls `setup(ctx)` with the v2 plugin Context (extra keys are ignored
// by both hosts). opencode 2's Host.resolve probes the `<name>/server`,
// `<name>/tui`, `<name>/rpc` and `<name>/gui-experimental` subpaths through
// the package `exports` map and fails the whole load when one is missing
// (Bun's ResolveMessage is not an Error instance, so a missing export is
// rethrown instead of swallowed), so all of them must be listed.
import { NotifierPlugin } from "./index"
import { v2Setup } from "./v2"

export { v2Setup }
export default { id: "opencode-notifier", server: NotifierPlugin, setup: v2Setup }
