export const HOME_ENDPOINTS = Object.freeze({
  feed: '/home',
  sectionItems: sectionId => `/home/sections/${sectionId}/items`,
  appConfig: '/app-config',
  featureFlags: '/feature-flags',
});
