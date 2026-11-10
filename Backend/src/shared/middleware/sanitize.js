// Strips MongoDB operator keys ($where, $ne ...) and dotted keys from user input to block NoSQL injection.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = clean(item);
    }
    return out;
  }
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  // Express 5 makes req.query a read-only getter, so redefine it instead of assigning.
  Object.defineProperty(req, 'query', { value: clean(req.query), writable: true, configurable: true });
  next();
}
