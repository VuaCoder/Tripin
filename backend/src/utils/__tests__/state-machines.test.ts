import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENCY_VERIFICATION_STATUS, BOOKING_STATUS, GUIDE_ASSIGNMENT_STATUS, PAYMENT_STATUS, TOUR_STATUS, USER_STATUS } from '@travel-platform/constants';
import { BOOKING_TRANSITIONS } from '../../modules/bookings/bookings.policy';
import { PAYMENT_TRANSITIONS } from '../../modules/payments/payments.types';
import { REPORT_STATUS, REPORT_TRANSITIONS } from '../../modules/reports/reports.types';
import { REVIEW_STATUS, REVIEW_TRANSITIONS } from '../../modules/reviews/reviews.types';
import { SUBSCRIPTION_STATUS, SUBSCRIPTION_TRANSITIONS } from '../../modules/subscriptions/subscriptions.types';
import { TICKET_STATUS, TICKET_TRANSITIONS } from '../../modules/support/support.types';
import { GUIDE_ASSIGNMENT_TRANSITIONS, TOUR_TRANSITIONS } from '../../modules/tours/tours.types';
import { AGENCY_VERIFICATION_TRANSITIONS, USER_STATUS_TRANSITIONS } from '../../modules/users/users.types';
import { AppError } from '../app-error';
import { assertTransition, canTransition, type TransitionMap } from '../state-machine';

// Every status machine of the platform, checked exhaustively: legal pairs pass, every other pair is refused with 409,
// nothing is unreachable, and the terminal states are exactly the ones the design says.
interface Machine {
  name: string;
  readme: string;
  map: TransitionMap<string>;
  statuses: string[];
  initial: string;
  /** Exported name of the map; some service must actually use it (a map nobody consults protects nothing). */
  mapName: string;
  /** States that, by design, have no exit (pinned so changing the design is a conscious test edit). */
  terminal: string[];
}
const values = (o: Record<string, string>) => Object.values(o);

const MACHINES: Machine[] = [
  { name: 'booking', mapName: 'BOOKING_TRANSITIONS', readme: 'bookings', map: BOOKING_TRANSITIONS, statuses: values(BOOKING_STATUS), initial: 'PENDING', terminal: ['COMPLETED', 'CANCELLED'] },
  { name: 'payment', mapName: 'PAYMENT_TRANSITIONS', readme: 'payments', map: PAYMENT_TRANSITIONS, statuses: values(PAYMENT_STATUS), initial: 'PENDING', terminal: ['PAID'] },
  { name: 'report', mapName: 'REPORT_TRANSITIONS', readme: 'reports', map: REPORT_TRANSITIONS, statuses: values(REPORT_STATUS), initial: 'OPEN', terminal: ['RESOLVED', 'REJECTED'] },
  { name: 'review', mapName: 'REVIEW_TRANSITIONS', readme: 'reviews', map: REVIEW_TRANSITIONS, statuses: values(REVIEW_STATUS), initial: 'VISIBLE', terminal: [] },
  { name: 'subscription', mapName: 'SUBSCRIPTION_TRANSITIONS', readme: 'subscriptions', map: SUBSCRIPTION_TRANSITIONS, statuses: values(SUBSCRIPTION_STATUS), initial: 'PENDING_PAYMENT', terminal: ['EXPIRED'] },
  { name: 'support ticket', mapName: 'TICKET_TRANSITIONS', readme: 'support', map: TICKET_TRANSITIONS, statuses: values(TICKET_STATUS), initial: 'OPEN', terminal: ['CLOSED'] },
  { name: 'tour', mapName: 'TOUR_TRANSITIONS', readme: 'tours', map: TOUR_TRANSITIONS, statuses: values(TOUR_STATUS), initial: 'DRAFT', terminal: ['ARCHIVED'] },
  { name: 'guide assignment', mapName: 'GUIDE_ASSIGNMENT_TRANSITIONS', readme: 'tours', map: GUIDE_ASSIGNMENT_TRANSITIONS, statuses: values(GUIDE_ASSIGNMENT_STATUS), initial: 'PENDING', terminal: ['ACCEPTED', 'DECLINED'] },
  { name: 'agency verification', mapName: 'AGENCY_VERIFICATION_TRANSITIONS', readme: 'users', map: AGENCY_VERIFICATION_TRANSITIONS, statuses: values(AGENCY_VERIFICATION_STATUS), initial: 'UNVERIFIED', terminal: ['VERIFIED'] },
  // PENDING_VERIFICATION -> ACTIVE belongs to the register OTP; ACTIVE <-> BANNED to moderation.
  { name: 'account', mapName: 'USER_STATUS_TRANSITIONS', readme: 'users', map: USER_STATUS_TRANSITIONS, statuses: values(USER_STATUS), initial: 'PENDING_VERIFICATION', terminal: [] },
];

const repoRoot = path.resolve(process.cwd(), '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'test') sourceFiles(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}
const sources = sourceFiles(path.resolve(process.cwd(), 'src')).map((file) => readFileSync(file, 'utf-8'));

function reachable(machine: Machine): Set<string> {
  const seen = new Set([machine.initial]);
  const queue = [machine.initial];
  while (queue.length) {
    for (const next of machine.map[queue.shift()!] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe.each(MACHINES)('state machine: $name', (machine) => {
  it('only mentions statuses of its enum, has no self-loops and no duplicate edges', () => {
    for (const [from, targets] of Object.entries(machine.map)) {
      expect(machine.statuses, `from ${from}`).toContain(from);
      expect(new Set(targets).size, `duplicates leaving ${from}`).toBe(targets!.length);
      for (const to of targets!) {
        expect(machine.statuses, `${from} -> ${to}`).toContain(to);
        expect(to, `self-loop on ${from}`).not.toBe(from);
      }
    }
  });

  it('every status is reachable from the initial one', () => {
    const unreachable = machine.statuses.filter((status) => !reachable(machine).has(status));
    expect(unreachable).toEqual([]);
  });

  it('terminal states are exactly the designed ones', () => {
    const terminal = machine.statuses.filter((status) => (machine.map[status]?.length ?? 0) === 0);
    expect(terminal.sort()).toEqual([...machine.terminal].sort());
  });

  it('assertTransition passes for every legal pair and answers 409 INVALID_STATE_TRANSITION for every other pair', () => {
    for (const from of machine.statuses) {
      for (const to of machine.statuses) {
        const legal = machine.map[from]?.includes(to) ?? false;
        expect(canTransition(machine.map, from, to)).toBe(legal);
        if (legal) {
          expect(() => assertTransition(machine.map, from, to, machine.name)).not.toThrow();
        } else {
          try {
            assertTransition(machine.map, from, to, machine.name);
            throw new Error(`${from} -> ${to} should have been refused`);
          } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).statusCode).toBe(409);
            expect((error as AppError).code).toBe('INVALID_STATE_TRANSITION');
          }
        }
      }
    }
  });

  it('an unknown status never transitions anywhere', () => {
    expect(canTransition(machine.map, 'NOT_A_STATUS', machine.initial)).toBe(false);
    expect(() => assertTransition(machine.map, machine.initial, 'NOT_A_STATUS', machine.name)).toThrow(AppError);
  });

  it('is consulted by production code through assertTransition / canTransition', () => {
    const pattern = new RegExp('(assertTransition|canTransition)'+'\\('+'\\s*' + machine.mapName + '\\b');
    const users = sources.filter((text) => pattern.test(text));
    expect(users.length, `${machine.mapName} is never passed to assertTransition/canTransition`).toBeGreaterThan(0);
  });

  it("its module README mentions every status of the machine", () => {
    const readme = readFileSync(path.join(repoRoot, 'backend/src/modules', machine.readme, 'README.md'), 'utf-8');
    const missing = machine.statuses.filter((status) => !readme.includes(status));
    expect(missing).toEqual([]);
  });
});
