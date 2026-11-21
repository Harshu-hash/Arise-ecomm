import { CUSTOMER_SECTION_FOR, MAX_HOME_SECTIONS, MAX_ITEMS_RANGE, PER_CAMPAIGN_SECTION_TYPES, SECTIONS_WITH_MAX_ITEMS } from '../constants/cms.js';

/** Keeps only the settings a section type supports, so old or foreign keys never reach the database. */
export function cleanConfig(type, config) {
  const maxItems = config?.maxItems;
  return SECTIONS_WITH_MAX_ITEMS.includes(type) && maxItems !== undefined && maxItems !== null ? { maxItems } : {};
}

/** Field errors for a list of home sections (after shape validation and cleanConfig), or null when it is fine. */
export function sectionErrors(sections) {
  if (sections.length > MAX_HOME_SECTIONS) return { sections: [`A layout can have at most ${MAX_HOME_SECTIONS} sections.`] };
  const seen = new Set();
  for (const { type, campaignId, config } of sections) {
    if (PER_CAMPAIGN_SECTION_TYPES.includes(type) !== Boolean(campaignId)) {
      return { sections: [`${type} ${campaignId ? 'is not tied to a campaign' : 'needs the campaign it shows'}.`] };
    }
    const key = `${type}:${campaignId ?? ''}`;
    if (seen.has(key)) return { sections: [`${type} can only be added once${campaignId ? ' per campaign' : ''}.`] };
    seen.add(key);
    const { maxItems } = config ?? {};
    if (maxItems !== undefined && !(Number.isInteger(maxItems) && maxItems >= MAX_ITEMS_RANGE.min && maxItems <= MAX_ITEMS_RANGE.max)) {
      return { sections: [`Items to show must be a whole number from ${MAX_ITEMS_RANGE.min} to ${MAX_ITEMS_RANGE.max}.`] };
    }
  }
  return null;
}

export const enabledSections = (sections) => sections.filter((section) => section.visibility?.enabled !== false);

// The customer section type a console row type fills (FLASH_SALE_BANNER -> FLASH_SALE).
const customerTypeOf = (type) => Object.keys(CUSTOMER_SECTION_FOR).find((key) => CUSTOMER_SECTION_FOR[key].includes(type));
const isLegacyCampaignRow = (entry) => PER_CAMPAIGN_SECTION_TYPES.includes(entry.type) && !entry.campaignId;
const limited = (section, limit) => (limit && Array.isArray(section.items) ? { ...section, items: section.items.slice(0, limit) } : section);

/** Puts `item` right after the last element of its kind, or at the end when there is none. Mutates `list`. */
export function insertByKind(list, item, isSameKind) {
  const at = list.findLastIndex(isSameKind);
  list.splice(at === -1 ? list.length : at + 1, 0, item);
}

/**
 * Applies a published layout to the sections the customer home screen built: the layout decides which appear,
 * in what order, and how many items each shows. Flash sales and deals are placed one campaign at a time; a campaign
 * put on the home page after the layout was published shows after the last one of its kind until it is placed.
 * Without a layout the built sections are returned untouched.
 */
export function arrangeHomeSections(built, layout) {
  if (!layout) return built;
  const placed = new Set(layout.filter((entry) => entry.campaignId).map((entry) => `${customerTypeOf(entry.type)}:${entry.campaignId}`));
  const legacyKinds = new Set(layout.filter(isLegacyCampaignRow).map((entry) => customerTypeOf(entry.type)));
  const used = new Set();
  const fits = (section, entry) =>
    !used.has(section) &&
    CUSTOMER_SECTION_FOR[section.type]?.includes(entry.type) &&
    (entry.campaignId ? section.campaignId === entry.campaignId : !placed.has(`${section.type}:${section.campaignId}`));

  const arranged = enabledSections(layout).flatMap((entry) => {
    // A row saved before campaigns were placed one by one stands for every campaign of its kind.
    const matches = isLegacyCampaignRow(entry) ? built.filter((section) => fits(section, entry)) : [built.find((section) => fits(section, entry))].filter(Boolean);
    matches.forEach((section) => used.add(section));
    return matches.map((section) => limited(section, entry.config?.maxItems));
  });

  for (const section of built) {
    if (!section.campaignId || used.has(section) || placed.has(`${section.type}:${section.campaignId}`) || legacyKinds.has(section.type)) continue;
    insertByKind(arranged, section, (other) => other.type === section.type);
  }
  return arranged;
}

/**
 * The console's rows with the campaigns currently placed on the home page: rows for campaigns that left are dropped,
 * a pre-placement single row is expanded in place, and campaigns not yet placed are added after the last of their kind.
 * `campaigns` are `{ id, kind, ... }` where `kind` is the row type; each row gets its campaign attached for display.
 */
export function withCampaignRows(sections, campaigns) {
  const byKey = new Map(campaigns.map((campaign) => [`${campaign.kind}:${campaign.id}`, campaign]));
  const placed = new Set(sections.filter((section) => section.campaignId).map((section) => `${section.type}:${section.campaignId}`));
  const row = (campaign, visibility = { enabled: true }) => {
    placed.add(`${campaign.kind}:${campaign.id}`);
    return { type: campaign.kind, campaignId: campaign.id, config: {}, visibility, campaign };
  };

  const rows = sections.flatMap((section) => {
    if (!PER_CAMPAIGN_SECTION_TYPES.includes(section.type)) return [section];
    if (!section.campaignId) return campaigns.filter((c) => c.kind === section.type && !placed.has(`${c.kind}:${c.id}`)).map((c) => row(c, section.visibility));
    const campaign = byKey.get(`${section.type}:${section.campaignId}`);
    return campaign ? [{ ...section, campaign }] : [];
  });
  for (const campaign of campaigns) {
    if (!placed.has(`${campaign.kind}:${campaign.id}`)) insertByKind(rows, row(campaign), (other) => other.type === campaign.kind);
  }
  return rows;
}
