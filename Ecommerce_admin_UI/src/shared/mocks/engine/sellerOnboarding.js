import { db, filter, find, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';

export const ONBOARDING_SECTIONS = [
  { key: 'business', label: 'Business identity' },
  { key: 'tax', label: 'Tax and registrations' },
  { key: 'signatory', label: 'Authorized signatory' },
  { key: 'bank', label: 'Bank account' },
  { key: 'pickup', label: 'Pickup address' },
  { key: 'agreement', label: 'Seller agreement' },
];

export const AGREEMENT = {
  id: 'SELLER_AGREEMENT',
  version: '2026.11',
  effectiveAt: '2026-11-01T00:00:00.000Z',
  title: 'Arise Marketplace Seller Agreement',
};

export const DOCUMENT_SECTION = {
  GST_CERTIFICATE: 'tax',
  PAN_CARD: 'tax',
  CANCELLED_CHEQUE: 'bank',
  ADDRESS_PROOF: 'pickup',
  SIGNATORY_ID: 'signatory',
  CATEGORY_LICENSE: 'tax',
};

export const REQUIRED_DOCUMENTS = ['GST_CERTIFICATE', 'PAN_CARD', 'CANCELLED_CHEQUE', 'ADDRESS_PROOF', 'SIGNATORY_ID'];

export function applicationFor(sellerId) {
  return find('sellerOnboarding', (row) => row.sellerId === sellerId);
}

export function ensureSections(application) {
  const existing = filter('sellerApplicationSections', (row) => row.applicationId === application.id);
  if (existing.length) return existing;
  return ONBOARDING_SECTIONS.map((definition, index) => insert('sellerApplicationSections', {
    id: id('ONSEC', 5),
    applicationId: application.id,
    sellerId: application.sellerId,
    key: definition.key,
    label: definition.label,
    state: application.status === 'APPROVED' ? 'APPROVED' : 'DRAFT',
    adminReason: null,
    correctiveAction: null,
    submittedAt: null,
    decidedAt: null,
    order: index,
    version: 1,
  }));
}

export function sectionFor(application, key) {
  return ensureSections(application).find((section) => section.key === key);
}

export function documentsFor(sellerId) {
  return filter('kycDocuments', (document) => document.sellerId === sellerId);
}

export function upsertDocument(application, type, media) {
  if (!media?.mediaId && !media?.id) return null;
  const mediaId = media.mediaId ?? media.id;
  const resource = findById('mediaResources', mediaId);
  const current = find('kycDocuments', (document) => document.sellerId === application.sellerId && document.type === type);
  const payload = {
    sellerId: application.sellerId,
    applicationId: application.id,
    sectionKey: DOCUMENT_SECTION[type],
    type,
    label: type.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' '),
    mediaId,
    fileName: resource?.fileName ?? media.fileName ?? `${type.toLowerCase()}.pdf`,
    mimeType: resource?.mimeType ?? media.mimeType ?? 'application/pdf',
    previewUrl: resource?.previewUrl ?? media.previewUrl,
    downloadUrl: resource?.downloadUrl ?? media.downloadUrl,
    uploadedAt: mockNowIso(),
    status: 'PENDING',
    rejectionReason: null,
    expiresAt: media.expiresAt ?? current?.expiresAt ?? null,
  };
  if (!current) return insert('kycDocuments', { id: id('DOC', 6), ...payload, previousVersions: [], version: 1 });
  const previousVersions = [...(current.previousVersions ?? []), {
    mediaId: current.mediaId,
    fileName: current.fileName,
    uploadedAt: current.uploadedAt,
    status: current.status,
    version: current.version,
  }];
  update('kycDocuments', current.id, { ...payload, previousVersions, version: (current.version ?? 1) + 1 });
  return findById('kycDocuments', current.id);
}

export function acceptAgreement(application, user) {
  const existing = find('sellerAgreementAcceptances', (row) => row.sellerId === application.sellerId && row.agreementVersion === AGREEMENT.version);
  if (existing) return existing;
  return insert('sellerAgreementAcceptances', {
    id: id('AGR', 6),
    sellerId: application.sellerId,
    applicationId: application.id,
    agreementId: AGREEMENT.id,
    agreementVersion: AGREEMENT.version,
    effectiveAt: AGREEMENT.effectiveAt,
    acceptedAt: mockNowIso(),
    acceptedBy: { id: user.id, name: user.name, email: user.email },
    receiptNumber: id('AGRRCP', 8),
  });
}

export function applicationProjection(application) {
  const sections = ensureSections(application).sort((a, b) => a.order - b.order);
  const documents = documentsFor(application.sellerId);
  const acceptance = [...db.sellerAgreementAcceptances]
    .filter((row) => row.applicationId === application.id)
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0] ?? null;
  const events = db.auditEvents
    .filter((event) => event.entityId === application.sellerId && (event.action?.includes('application') || event.action?.includes('kyc') || event.action?.includes('onboarding')))
    .sort((a, b) => (b.at ?? b.createdAt).localeCompare(a.at ?? a.createdAt));
  return {
    ...application,
    sections,
    documents,
    agreement: AGREEMENT,
    agreementAcceptance: acceptance,
    slaDueAt: application.submittedAt ? new Date(new Date(application.submittedAt).getTime() + 48 * 3600_000).toISOString() : null,
    events,
  };
}

export function markSection(application, key, state, patch = {}) {
  const section = sectionFor(application, key);
  update('sellerApplicationSections', section.id, { state, ...patch, version: (section.version ?? 1) + 1 });
  return findById('sellerApplicationSections', section.id);
}

export function expiredDocumentsFor(sellerId) {
  return documentsFor(sellerId).filter((document) => document.expiresAt && new Date(document.expiresAt).getTime() <= mockNow());
}
