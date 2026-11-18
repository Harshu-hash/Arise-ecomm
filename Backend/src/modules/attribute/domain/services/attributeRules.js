export const ATTRIBUTE_TYPES = [
  'TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOUR', 'SIZE', 'DATE',
];

export const OPTION_TYPES = new Set(['SINGLE_SELECT', 'MULTI_SELECT', 'COLOUR', 'SIZE']);
export const VARIANT_TYPES = new Set(['SINGLE_SELECT', 'COLOUR', 'SIZE']);

export const attributeNameKey = (value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
export const attributeCode = (value) => value.trim().toLowerCase();

export function normalizeAttributeValues(values, existing = [], preserveRemoved = false) {
  const current = new Map(existing.map((item) => [attributeNameKey(item.value), item]));
  const seen = new Set();
  const normalized = [];
  for (const input of values) {
    const value = String(typeof input === 'string' ? input : input?.value ?? '').trim().replace(/\s+/g, ' ');
    const key = attributeNameKey(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    const previous = current.get(key);
    normalized.push({ value, active: true, synonyms: previous?.synonyms ?? [] });
  }
  if (preserveRemoved) {
    for (const [key, previous] of current) {
      if (!seen.has(key)) normalized.push({ value: previous.value, active: false, synonyms: previous.synonyms ?? [] });
    }
  }
  return normalized;
}

export function validateAttributeShape({ type, values, variantDefining }) {
  const errors = {};
  if (OPTION_TYPES.has(type) && !values.some((value) => value.active)) {
    errors.values = ['Add at least one value for this attribute type.'];
  }
  if (!OPTION_TYPES.has(type) && values.length) {
    errors.values = ['This attribute type cannot have predefined values.'];
  }
  if (variantDefining && !VARIANT_TYPES.has(type)) {
    errors.variantDefining = ['Only single-select, colour, and size attributes can define variants.'];
  }
  return errors;
}
