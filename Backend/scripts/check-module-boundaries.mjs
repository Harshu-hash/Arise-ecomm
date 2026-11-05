import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/modules/', import.meta.url));
const sourceExtensions = new Set(['.js', '.mjs', '.cjs']);
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await walk(root);
for (const file of files) {
  const parts = relative(root, file).split(sep);
  const owner = parts[0];
  const source = await readFile(file, 'utf8');
  const imports = source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g);

  for (const [, specifier] of imports) {
    const match = specifier.match(/modules[\\/]([^\\/]+)[\\/](.+)/);
    if (!match) continue;
    const [, target, targetPath] = match;
    if (target !== owner && !targetPath.startsWith('public/')) {
      violations.push(`${relative(root, file)} imports private internals from ${target}: ${specifier}`);
    }
  }
}

if (violations.length) {
  console.error(['Module boundary violations:', ...violations.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}

console.log(`Module boundary check passed (${files.length} source files).`);

