// The notifier has no GUI bundle; opencode 2's Host.resolve probes
// `./gui-experimental` eagerly and a missing export fails the whole package
// load. The desktop evaluates this file as CommonJS text, so keep it
// CommonJS-compatible; as an ES module the line is a harmless free-variable
// expression.
module.exports = {}
