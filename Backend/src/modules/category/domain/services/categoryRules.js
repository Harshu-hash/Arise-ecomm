export const MAX_CATEGORY_LEVEL = 3;

export function categoryNameKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
}

export function categorySlug(name) {
  const slug = name
    .normalize('NFKC')
    .toLocaleLowerCase('en-IN')
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || Array.from(name.trim(), (character) => character.codePointAt(0).toString(16)).join('-');
}

export function inheritedCategoryValues(parent, input) {
  const value = (key, fallback) => input[key] ?? parent?.[key] ?? fallback;
  const returnWindowDays = value('returnWindowDays', 7);
  return {
    returnWindowDays,
    returnTypes: returnWindowDays === 0 ? [] : value('returnTypes', ['REFUND', 'REPLACEMENT']),
    gated: value('gated', false),
    codAllowed: value('codAllowed', true),
    gstRate: value('gstRate', 18),
    commissionPct: input.commissionPct ?? null, // never copied from the parent: unset means "inherit", resolved on read
    hsnCode: value('hsnCode', null),
    attributeSetId: value('attributeSetId', null),
  };
}

export function categoryTree(rows, serialize) {
  const children = new Map();
  for (const row of rows) {
    const key = row.parentId ? String(row.parentId) : null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(row);
  }
  const build = (parentId) => (children.get(parentId) ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((row) => ({ ...serialize(row), children: build(String(row._id)) }));
  return build(null);
}
