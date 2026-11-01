// Dual-host TUI entry. The notifier has no TUI component; opencode 2's
// Host.resolve probes `./tui` eagerly and a missing export fails the whole
// package load, so it must resolve. opencode 1's TUI reads `{ id, tui }`,
// opencode 2's TUI reads `{ id, setup }`; extra keys are ignored by both.
export default { id: "opencode-notifier", tui: async () => {}, setup: async () => {} }
