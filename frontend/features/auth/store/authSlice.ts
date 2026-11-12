import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { AuthState, UserProfile } from '../types';

const STORAGE_KEY = 'tripri_auth_session';

function persistSession(session: { user: UserProfile; accessToken: string }, rememberMe?: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(session);
    if (rememberMe === false) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(STORAGE_KEY, serialized);
      return;
    }
    if (rememberMe === true) {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, serialized);
      return;
    }
    if (sessionStorage.getItem(STORAGE_KEY) && !localStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, serialized);
    } else {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // Ignore quota issues
  }
}

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
    setCredentials(state, action: PayloadAction<{ user: UserProfile; accessToken: string; rememberMe?: boolean }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
      persistSession({ user: action.payload.user, accessToken: action.payload.accessToken }, action.payload.rememberMe);
    },
    setUser(state, action: PayloadAction<UserProfile>) {
      state.user = action.payload;
      if (state.accessToken) {
        persistSession({ user: action.payload, accessToken: state.accessToken });
      }
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
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
