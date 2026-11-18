import { env } from '../../../../config/env.js';
import { FILE_KIND, UPLOAD_PURPOSES, VISIBILITY } from '../../../../shared/constants/uploadPurposes.js';

/**
 * What the seller "Add product" form's upload widgets declare as `kind`. Each maps onto
 * an existing upload purpose (folder/roles/visibility) plus the one file kind that specific
 * widget actually accepts — images and videos share a purpose but not a file type.
 *
 * Only the kinds this form actually sends are supported; a widget elsewhere in the admin UI
 * using a kind not listed here gets a clear 400, not a silent wrong upload.
 */
export const MEDIA_KINDS = Object.freeze({
  PRODUCT_IMAGE: { purpose: UPLOAD_PURPOSES.PRODUCT_MEDIA, expect: FILE_KIND.IMAGE, maxBytes: env.MAX_UPLOAD_BYTES },
  PRODUCT_VIDEO: { purpose: UPLOAD_PURPOSES.PRODUCT_MEDIA, expect: FILE_KIND.VIDEO, maxBytes: env.MAX_VIDEO_BYTES },
  PRODUCT_COMPLIANCE: { purpose: UPLOAD_PURPOSES.PRODUCT_COMPLIANCE, expect: null, maxBytes: env.MAX_UPLOAD_BYTES },
});

export function resolveMediaKind(kind, role) {
  const rule = MEDIA_KINDS[kind];
  if (!rule || !rule.purpose.roles.includes(role)) return null;
  return rule;
}

export const CROP_ASPECTS = ['original', 'square', '4:3', '16:9'];

export const isPublic = (rule) => rule.purpose.visibility === VISIBILITY.PUBLIC;
