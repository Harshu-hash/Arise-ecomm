export const BRAND_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'BLOCKED'];
export const BRAND_OWNER_TYPES = ['BRAND_OWNER', 'RESELLER_AUTHORISED'];

export function brandNameKey(name) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
}
