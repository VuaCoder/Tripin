import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { AgencyMembership, AuthState, SessionData, UserProfile } from '../types';

const STORAGE_KEY = 'tripri_auth_session';

function persistSession(session: SessionData & { activeAgencyId?: string | null }, rememberMe?: boolean) {
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
  agencies: [],
  activeAgencyId: null,
  membershipsReady: false,
  agencyEpoch: 0,
};

function replaceMemberships(state: AuthState, agencies: AgencyMembership[], selected = state.activeAgencyId) {
  const activeAgencyId = agencies.some(a => a.agencyId === selected) ? selected : agencies.length === 1 ? agencies[0].agencyId : null;
  const signature = (rows: AgencyMembership[]) => JSON.stringify(rows.map(a => [a.agencyId, a.memberId, a.memberRole, a.verificationStatus, [...a.permissions].sort()]));
  if (state.activeAgencyId !== activeAgencyId || signature(state.agencies) !== signature(agencies) || !state.membershipsReady) state.agencyEpoch++;
  state.agencies = agencies;
  state.activeAgencyId = activeAgencyId;
  state.membershipsReady = true;
}

function persistState(state: AuthState, rememberMe?: boolean) {
  if (state.user && state.accessToken) persistSession({ user: state.user, accessToken: state.accessToken, activeAgencyId: state.activeAgencyId }, rememberMe);
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<SessionData & { rememberMe?: boolean }>) {
      const sameUser = state.user?.id === action.payload.user.id;
      if (!sameUser) { state.activeAgencyId = null; state.agencies = []; state.agencyEpoch++; }
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
      if (Array.isArray(action.payload.agencies)) replaceMemberships(state, action.payload.agencies);
      else {
        // Legacy personal sessions omit memberships. Rotating their token must
        // not reset an in-flight personal query; only discard real agency authority.
        if (state.agencies.length > 0) state.agencyEpoch++;
        state.agencies = [];
        state.membershipsReady = false;
      }
      persistState(state, action.payload.rememberMe);
    },
    restoreCredentials(state, action: PayloadAction<SessionData & { activeAgencyId?: string | null }>) {
      // Browser storage restores identity/selection hints, never trusted memberships.
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
      state.agencies = [];
      state.activeAgencyId = action.payload.activeAgencyId ?? null;
      state.membershipsReady = false;
      state.agencyEpoch++;
    },
    setAgencyMemberships(state, action: PayloadAction<{ userId: string; agencies: AgencyMembership[] }>) {
      if (state.user?.id !== action.payload.userId) return;
      replaceMemberships(state, action.payload.agencies);
      persistState(state);
    },
    selectAgency(state, action: PayloadAction<string>) {
      if (!state.membershipsReady || !state.agencies.some(a => a.agencyId === action.payload)) return;
      if (state.activeAgencyId !== action.payload) state.agencyEpoch++;
      state.activeAgencyId = action.payload;
      persistState(state);
    },
    setUser(state, action: PayloadAction<UserProfile>) {
      state.user = action.payload;
      if (state.accessToken) {
        persistState(state);
      }
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
      state.agencies = [];
      state.activeAgencyId = null;
      state.membershipsReady = false;
      state.agencyEpoch++;
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    },
  },
});

export const { setCredentials, restoreCredentials, setAgencyMemberships, selectAgency, setUser, clearCredentials } = authSlice.actions;

export const selectUser = (state: RootState) => state.auth.user;
export const selectRole = (state: RootState) => state.auth.user?.role ?? null;
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.accessToken);
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAgencies = (state: RootState) => state.auth.agencies;
export const selectActiveAgency = (state: RootState) => state.auth.membershipsReady
  ? state.auth.agencies.find(a => a.agencyId === state.auth.activeAgencyId) ?? null : null;

export default authSlice.reducer;
