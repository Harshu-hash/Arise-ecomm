import { ROLES } from './roles.js';

export const FILE_KIND = Object.freeze({ IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' });
export const VISIBILITY = Object.freeze({ PUBLIC: 'public', PRIVATE: 'private' });

const { IMAGE, VIDEO, DOCUMENT } = FILE_KIND;
const SELLER_SIDE = [ROLES.SELLER, ROLES.SELLER_STAFF];

// Every upload declares WHY it is uploaded; that decides who may upload, what types, and public vs private.
// Files land in <visibility>/<folder>/<ownerId>/<uuid>.<ext>, where ownerId comes from the JWT, not the request.
export const UPLOAD_PURPOSES = Object.freeze({
  PRODUCT_MEDIA: { folder: 'products', roles: [...SELLER_SIDE, ROLES.ADMIN], kinds: [IMAGE, VIDEO], visibility: VISIBILITY.PUBLIC },
  SELLER_KYC: { folder: 'kyc', roles: SELLER_SIDE, kinds: [IMAGE, DOCUMENT], visibility: VISIBILITY.PRIVATE },
  RETURN_PROOF: { folder: 'returns', roles: [ROLES.CUSTOMER], kinds: [IMAGE, VIDEO], visibility: VISIBILITY.PRIVATE },
  REVIEW_MEDIA: { folder: 'reviews', roles: [ROLES.CUSTOMER], kinds: [IMAGE, VIDEO], visibility: VISIBILITY.PUBLIC },
  CMS_MEDIA: { folder: 'cms', roles: [ROLES.ADMIN], kinds: [IMAGE, VIDEO], visibility: VISIBILITY.PUBLIC },
});

export const PRIVATE_FOLDERS = Object.values(UPLOAD_PURPOSES)
  .filter((purpose) => purpose.visibility === VISIBILITY.PRIVATE)
  .map((purpose) => purpose.folder);
