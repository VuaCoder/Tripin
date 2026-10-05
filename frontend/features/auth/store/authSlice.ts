import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { AuthState, UserProfile } from '../types';

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'idle',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: UserProfile; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
    },
    setUser(state, action: PayloadAction<UserProfile>) {
      state.user = action.payload;
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
    },
  },
});

export const { setCredentials, setUser, clearCredentials } = authSlice.actions;

export const selectUser = (state: RootState) => state.auth.user;
export const selectRole = (state: RootState) => state.auth.user?.role ?? null;
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.accessToken);
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectAuthStatus = (state: RootState) => state.auth.status;

export default authSlice.reducer;
