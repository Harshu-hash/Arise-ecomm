import { restoreCustomerSession } from './restoreSession';

describe('restoreCustomerSession', () => {
  const validEnvelope = {
    data: {
      user: { id: 'cus_1', phone: '+919876543210', status: 'ACTIVE' },
      accessToken: 'access_2',
      refreshToken: 'refresh_2',
    },
  };

  it('restores and rotates a persisted refresh token', async () => {
    const dispatch = jest.fn();
    const storage = {
      getRefreshToken: jest.fn().mockResolvedValue('refresh_1'),
      saveRefreshToken: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    const client = { post: jest.fn().mockResolvedValue({ data: validEnvelope }) };

    await expect(restoreCustomerSession(dispatch, { storage, client })).resolves.toBe(true);
    expect(client.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh_1' });
    expect(storage.saveRefreshToken).toHaveBeenCalledWith('refresh_2');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth/sessionAuthenticated' }),
    );
  });

  it('restores an anonymous session when no token exists', async () => {
    const dispatch = jest.fn();
    const storage = {
      getRefreshToken: jest.fn().mockResolvedValue(null),
      saveRefreshToken: jest.fn(),
      clear: jest.fn(),
    };

    await expect(
      restoreCustomerSession(dispatch, { storage, client: { post: jest.fn() } }),
    ).resolves.toBe(false);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth/sessionRestored' }),
    );
  });

  it('clears invalid secure credentials when refresh fails', async () => {
    const dispatch = jest.fn();
    const storage = {
      getRefreshToken: jest.fn().mockResolvedValue('expired'),
      saveRefreshToken: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const client = { post: jest.fn().mockRejectedValue(new Error('401')) };

    await expect(restoreCustomerSession(dispatch, { storage, client })).resolves.toBe(false);
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/sessionCleared' }));
  });

  it('still completes anonymous startup when the platform keystore cannot be cleared', async () => {
    const dispatch = jest.fn();
    const storage = {
      getRefreshToken: jest.fn().mockRejectedValue(new Error('keystore unavailable')),
      clear: jest.fn().mockRejectedValue(new Error('keystore unavailable')),
    };

    await expect(
      restoreCustomerSession(dispatch, { storage, client: { post: jest.fn() } }),
    ).resolves.toBe(false);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth/sessionCleared' }));
  });
});
