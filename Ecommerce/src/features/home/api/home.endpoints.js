export const HOME_ENDPOINTS = Object.freeze({
  feed: '/home',
  feedPage: '/home/feed',
  sectionItems: sectionId => `/home/sections/${sectionId}/items`,
  appConfig: '/app-config',
  featureFlags: '/feature-flags',
});
