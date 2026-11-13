import { ROLES, type PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import type { ChatSide } from './chat.types';

/**
 * THE one place that decides who may talk to whom. Today: a TRAVELER with a TOUR_GUIDE (use case "Make a conservation").
 * Allowing agencies later (custom tours) means changing only this function.
 */
export function canConverse(a: PersistedRole, b: PersistedRole): boolean {
  const isOperator = (r: PersistedRole) => r === ROLES.TOUR_GUIDE || r === ROLES.AGENCY;
  return (a === ROLES.TRAVELER && isOperator(b)) || (isOperator(a) && b === ROLES.TRAVELER) ||
    (a === ROLES.SUPER_ADMIN && b === ROLES.AGENCY) || (a === ROLES.AGENCY && b === ROLES.SUPER_ADMIN);
}

/** Maps two users to the traveler / guide slots of a conversation, or 403 when the roles may not chat. */
export function assignSides(
  me: { id: string; role: PersistedRole },
  other: { id: string; role: PersistedRole },
): { travelerId: string; guideId: string } {
  if (me.id === other.id) throw AppError.badRequest('You cannot start a conversation with yourself');
  if (!canConverse(me.role, other.role)) {
    throw AppError.forbidden('Conversations are only possible between a traveler and an agency or tour guide');
  }
  return me.role === ROLES.TRAVELER || me.role === ROLES.SUPER_ADMIN
    ? { travelerId: me.id, guideId: other.id }
    : { travelerId: other.id, guideId: me.id };
}

export const otherSide = (side: ChatSide): ChatSide => (side === 'traveler' ? 'guide' : 'traveler');
