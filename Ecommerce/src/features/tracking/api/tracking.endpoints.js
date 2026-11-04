export const TRACKING_ENDPOINTS = {
  detail: shipmentId => `/shipments/${encodeURIComponent(shipmentId)}/tracking`,
};
