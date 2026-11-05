import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CONTRACT = path.join(ROOT, 'docs/api/seller-v1.openapi.yaml');

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['mocks', 'node_modules'].includes(entry.name)) return [];
      return filesBelow(target);
    }
    if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return [];
    return [target];
  });
}

function normalizeClientPath(value) {
  return value.replace(/\$\{([^}]+)\}/g, '{$1}');
}

function clientOperations() {
  const files = [
    ...filesBelow(path.join(ROOT, 'src/seller')),
    path.join(ROOT, 'src/shared/core/auth/authApi.js'),
    path.join(ROOT, 'src/shared/core/api/foundationApi.js'),
  ];
  const operations = new Map();
  const call = /api\.(get|post|put|patch|delete)\(\s*([`'"])(\/[^`'"]+)\2/g;
  const listUrl = /url:\s*['"](\/[^'"]+)['"]/g;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(call)) {
      const operation = `${match[1].toUpperCase()} ${normalizeClientPath(match[3])}`;
      operations.set(operation, path.relative(ROOT, file));
    }
    for (const match of source.matchAll(listUrl)) {
      operations.set(`GET ${match[1]}`, path.relative(ROOT, file));
    }
  }
  return operations;
}

function contractOperations() {
  const lines = readFileSync(CONTRACT, 'utf8').split(/\r?\n/);
  const operations = [];
  let currentPath;
  let current;

  const finish = () => {
    if (current) operations.push(current);
    current = null;
  };

  for (const line of lines) {
    const pathMatch = line.match(/^ {2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      finish();
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (methodMatch && currentPath) {
      finish();
      current = { method: methodMatch[1].toUpperCase(), path: currentPath, source: '' };
      continue;
    }
    if (current) {
      if (/^ {4}\S/.test(line) || /^components:/.test(line)) finish();
      else current.source += `${line}\n`;
    }
  }
  finish();
  return operations;
}

function samePath(clientPath, contractPath) {
  const client = clientPath.split('/');
  const contract = contractPath.split('/');
  return client.length === contract.length && client.every((part, index) => (
    part === contract[index] || /^\{.+\}$/.test(part) || /^\{.+\}$/.test(contract[index])
  ));
}

describe('seller OpenAPI handoff gate', () => {
  const client = clientOperations();
  const contract = contractOperations();

  it('covers every production seller HTTP operation', () => {
    const missing = [...client].filter(([key]) => {
      const [method, ...pathParts] = key.split(' ');
      const clientPath = pathParts.join(' ');
      return !contract.some((operation) => (
        operation.method === method && samePath(clientPath, operation.path)
      ));
    });
    expect(missing).toEqual([]);
  });

  it('uses unique operation IDs and declares authorization policy', () => {
    const source = readFileSync(CONTRACT, 'utf8');
    const declaredPaths = [...source.matchAll(/^ {2}(\/[^:]+):\s*$/gm)].map((match) => match[1]);
    expect(new Set(declaredPaths).size).toBe(declaredPaths.length);

    const ids = contract.map((operation) => operation.source.match(/operationId:\s*(\S+)/)?.[1]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    const missingPolicy = contract.filter((operation) => (
      !operation.path.startsWith('/auth/')
      && !/x-permission:\s*\S+/.test(operation.source)
    ));
    expect(missingPolicy.map(({ method, path: value }) => `${method} ${value}`)).toEqual([]);
  });

  it('marks every authenticated mutation as idempotent', () => {
    const unsafe = contract.filter((operation) => (
      operation.method !== 'GET'
      && !operation.path.startsWith('/auth/')
      && !/x-idempotent:\s*true/.test(operation.source)
    ));
    expect(unsafe.map(({ method, path: value }) => `${method} ${value}`)).toEqual([]);
  });
});
