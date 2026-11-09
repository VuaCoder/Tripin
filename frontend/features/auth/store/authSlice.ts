import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { AuthState, UserProfile } from '../types';

const STORAGE_KEY = 'tripri_auth_session';

// Keep the server and first client render identical. AuthBootstrap restores
// the persisted session in an effect after hydration.
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
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
        } catch {
          // Ignore quota issues
        }
      }
    },
    setUser(state, action: PayloadAction<UserProfile>) {
      state.user = action.payload;
      if (typeof window !== 'undefined' && state.accessToken) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ user: action.payload, accessToken: state.accessToken })
          );
        } catch {}
      }
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
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
