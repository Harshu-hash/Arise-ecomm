export const selectAuth = state => state.auth;
export const selectCurrentUser = state => state.auth.user;
export const selectAccessToken = state => state.auth.accessToken;
export const selectRefreshToken = state => state.auth.refreshToken;
export const selectIsAuthenticated = state => state.auth.status === 'authenticated';
export const selectSessionRestored = state => state.auth.restored;
