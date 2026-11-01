// The notifier has no RPC part; opencode 2's Host.resolve probes `./rpc`
// eagerly and a missing export fails the whole package load, so it must
// resolve to a valid module.
export default {}
