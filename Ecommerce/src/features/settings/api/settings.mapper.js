import { adPreferencesResponseSchema } from './settings.schemas';

const definitions = [
  {
    id: 'personalizedAds',
    label: 'Personalized Ads',
    subtitle: 'Use browsing and purchase activity to select relevant ads',
  },
  {
    id: 'thirdPartyDataSharing',
    label: 'Third-Party Data Sharing',
    subtitle: 'Allow approved advertising partners to process pseudonymous data',
  },
  {
    id: 'locationBasedAds',
    label: 'Location-Based Ads',
    subtitle: 'Use approximate location for locally relevant offers',
  },
];

export const mapAdPreferences = payload => {
  const value = adPreferencesResponseSchema.parse(payload).data;
  return {
    ...value,
    items: definitions.map(item => ({ ...item, enabled: value[item.id] })),
  };
};
