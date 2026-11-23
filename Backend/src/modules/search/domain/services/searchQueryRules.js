// Which typed searches are worth remembering. Pure.

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;

/** The query tidied for storing and comparing ({ key, text }), or null when it should not be kept (too short or long, a phone number or email, only symbols). */
export function cleanQuery(raw) {
  const text = String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) return null;
  if (!/[\p{L}\p{N}]/u.test(text)) return null;
  if (/\b\d{10}\b|@/.test(text)) return null; // never keep what looks like contact details
  return { key: text.toLowerCase(), text };
}
