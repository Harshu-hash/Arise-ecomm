import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  completed: false,
  restored: false,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    onboardingRestored: (state, action) => {
      state.completed = Boolean(action.payload);
      state.restored = true;
    },
    onboardingCompleted: state => {
      state.completed = true;
      state.restored = true;
    },
  },
});

export const { onboardingCompleted, onboardingRestored } = onboardingSlice.actions;
export default onboardingSlice.reducer;
