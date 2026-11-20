import { CUSTOMER_SECTION_FOR, MAX_HOME_SECTIONS, MAX_ITEMS_RANGE, REPEATABLE_SECTION_TYPES, SECTIONS_WITH_MAX_ITEMS } from '../constants/cms.js';

/** Keeps only the settings a section type supports, so old or foreign keys never reach the database. */
export function cleanConfig(type, config) {
  const maxItems = config?.maxItems;
  return SECTIONS_WITH_MAX_ITEMS.includes(type) && maxItems !== undefined && maxItems !== null ? { maxItems } : {};
}

/** Field errors for a list of home sections (after shape validation and cleanConfig), or null when it is fine. */
export function sectionErrors(sections) {
  if (sections.length > MAX_HOME_SECTIONS) return { sections: [`A layout can have at most ${MAX_HOME_SECTIONS} sections.`] };
  const seen = new Set();
  for (const { type, config } of sections) {
    if (!REPEATABLE_SECTION_TYPES.includes(type)) {
      if (seen.has(type)) return { sections: [`${type} can only be added once.`] };
      seen.add(type);
    }
    const { maxItems } = config ?? {};
    if (maxItems !== undefined && !(Number.isInteger(maxItems) && maxItems >= MAX_ITEMS_RANGE.min && maxItems <= MAX_ITEMS_RANGE.max)) {
      return { sections: [`Items to show must be a whole number from ${MAX_ITEMS_RANGE.min} to ${MAX_ITEMS_RANGE.max}.`] };
    }
  }
  return null;
}

export const enabledSections = (sections) => sections.filter((section) => section.visibility?.enabled !== false);

/**
 * Applies a published layout to the sections the customer home screen already built: the layout decides which
 * appear, in what order, and how many items each shows. A built section missing from the layout (or switched off in it)
 * is dropped. Without a layout the built sections are returned untouched.
 */
export function arrangeHomeSections(built, layout) {
  if (!layout) return built;
  const used = new Set();
  return enabledSections(layout).flatMap(({ type, config }) => {
    const match = built.find((section) => !used.has(section) && CUSTOMER_SECTION_FOR[section.type]?.includes(type));
    if (!match) return [];
    used.add(match);
    const limit = config?.maxItems;
    return [limit && Array.isArray(match.items) ? { ...match, items: match.items.slice(0, limit) } : match];
  });
}
