import * as Keychain from 'react-native-keychain';

const SESSION_SERVICE = 'com.arise.customer.session';
const SESSION_USERNAME = 'refresh-token';

const options = {
  service: SESSION_SERVICE,
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
};

export const secureSessionStorage = {
  async getRefreshToken() {
    const credentials = await Keychain.getGenericPassword({ service: SESSION_SERVICE });
    return credentials ? credentials.password : null;
  },

  async saveRefreshToken(refreshToken) {
    if (!refreshToken) {
      await this.clear();
      return;
    }
    const result = await Keychain.setGenericPassword(SESSION_USERNAME, refreshToken, options);
    if (!result) throw new Error('Secure session storage is unavailable');
  },

  async clear() {
    await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
  },
};
