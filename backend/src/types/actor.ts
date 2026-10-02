import type { Permission, PersistedRole } from '@travel-platform/constants';

/** Unauthenticated visitor. Never persisted. */
export interface GuestActor {
  kind: 'guest';
  role: 'GUEST';
  permissions: readonly [];
}

export interface UserActor {
  kind: 'user';
  userId: string;
  email: string;
  role: PersistedRole;
  permissions: readonly Permission[];
}

/** Who is performing the request. Always set by the `authenticate` middleware, never taken from client input. */
export type Actor = GuestActor | UserActor;

export const GUEST_ACTOR: GuestActor = Object.freeze<GuestActor>({ kind: 'guest', role: 'GUEST', permissions: [] });
