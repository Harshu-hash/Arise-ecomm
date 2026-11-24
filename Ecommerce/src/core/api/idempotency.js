// The server accepts an Idempotency-Key of 8-128 characters from [A-Za-z0-9_.:-]. Keys here are built from things like a variant name
// ("8/128", "Red, M"), so make them fit: replace other characters, and if too long keep a short fingerprint of the whole text so
// two different long keys stay different. The same input always gives the same key (that is what makes a retry safe).
const MAX = 128;
const KEEP = 100;

const fingerprint = text => {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
};

export const safeIdempotencyKey = raw => {
  const text = String(raw ?? '');
  const clean = text.replace(/[^A-Za-z0-9_.:-]/g, '_');
  const padded = clean.length < 8 ? `${clean}:key-${fingerprint(text)}` : clean;
  return padded.length <= MAX ? padded : `${padded.slice(0, KEEP)}:${fingerprint(text)}`;
};
