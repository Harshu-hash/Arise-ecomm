/**
 * SPF claim reasons shown on the "file a claim" form. Mirrors the mock
 * backend's reason list (`@seller/mocks/engine/sellerPerformance`) so the
 * labels match what comes back on a claim, but kept as its own small
 * constant here rather than importing mock-layer code into the UI.
 */
export const CLAIM_TYPE_OPTIONS = [
  { value: 'RETURN_DAMAGED', label: 'Return received damaged or used' },
  { value: 'WRONG_ITEM_RETURNED', label: 'Customer returned a different item' },
  { value: 'LOST_IN_TRANSIT', label: 'Shipment lost by the courier' },
  { value: 'LOST_IN_WAREHOUSE', label: 'Lost or damaged in an Arise warehouse' },
  { value: 'WEIGHT_DISPUTE', label: 'Courier charged for a higher weight' },
];
