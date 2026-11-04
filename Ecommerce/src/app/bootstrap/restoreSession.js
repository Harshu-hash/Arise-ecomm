import { refreshClient } from '@core/api/axiosInstance';
import { secureSessionStorage } from '@core/storage/secureSessionStorage';
import { mapSession } from '@features/auth/api/auth.mapper';
import {
  sessionAuthenticated,
  sessionCleared,
  sessionRestored,
} from '@features/auth/redux/auth.slice';

export const restoreCustomerSession = async (
  dispatch,
  { storage = secureSessionStorage, client = refreshClient } = {},
) => {
  try {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      dispatch(sessionRestored(null));
      return false;
    }

    const response = await client.post('/auth/refresh', { refreshToken });
    const session = mapSession(response.data);
    await storage.saveRefreshToken(session.refreshToken ?? refreshToken);
    dispatch(
      sessionAuthenticated({ ...session, refreshToken: session.refreshToken ?? refreshToken }),
    );
    return true;
  } catch {
    try {
      await storage.clear();
    } catch {
      // A platform keystore failure must not block anonymous app startup.
    }
    dispatch(sessionCleared());
    return false;
  }
};
