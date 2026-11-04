import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'anonymous',
  user: null,
  accessToken: null,
  refreshToken: null,
  restored: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionRestored: (state, action) => {
      const session = action.payload;
      state.status = session?.accessToken ? 'authenticated' : 'anonymous';
      state.user = session?.user ?? null;
      state.accessToken = session?.accessToken ?? null;
      state.refreshToken = session?.refreshToken ?? null;
      state.restored = true;
    },
    sessionAuthenticated: (state, action) => {
      state.status = 'authenticated';
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      state.restored = true;
    },
    tokensRefreshed: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      if (action.payload.user) {
        state.user = action.payload.user;
      }
    },
    sessionCleared: () => ({ ...initialState, restored: true }),
  },
});

export const { sessionRestored, sessionAuthenticated, tokensRefreshed, sessionCleared } =
  authSlice.actions;
export default authSlice.reducer;
