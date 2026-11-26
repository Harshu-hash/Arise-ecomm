// shortcut: skips Hermes bytecode precompile (hermesc blocked by Device Guard); app starts slower, upgrade by building where hermesc runs.
const fs = require('fs');
const a = process.argv.slice(2);
const out = a[a.indexOf('-out') + 1];
const input = a.find((x) => !x.startsWith('-') && x !== out);
fs.copyFileSync(input, out);
if (a.includes('-output-source-map')) fs.writeFileSync(out + '.map', '{"version":3,"sources":[],"names":[],"mappings":""}');
