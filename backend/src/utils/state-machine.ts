import { AppError } from './app-error';

/** Allowed transitions of a status enum: `{ FROM: [TO, ...] }`. Missing key = terminal state. */
export type TransitionMap<S extends string> = Partial<Record<S, readonly S[]>>;

export function canTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): boolean {
  return map[from]?.includes(to) ?? false;
}

/** Throws 409 INVALID_STATE_TRANSITION. Every status change in a service must go through this. */
export function assertTransition<S extends string>(map: TransitionMap<S>, from: S, to: S, entity: string): void {
  if (!canTransition(map, from, to)) {
    throw AppError.invalidTransition(from, to, entity);
  }
}
