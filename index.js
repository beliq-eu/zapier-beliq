// Zapier's runtime wrapper requires `index.js` at the deploy root (it ignores
// package.json "main"). The TypeScript app compiles to dist/, so this re-exports
// the built entry point.
module.exports = require('./dist/index.js');
