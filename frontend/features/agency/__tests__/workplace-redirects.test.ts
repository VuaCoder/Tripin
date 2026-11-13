import { beforeEach, expect, it, vi } from 'vitest';
import StartPage from '@/app/workplaces/start/page';
import JoinPage from '@/app/workplaces/join/page';

const nav = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));
vi.mock('next/navigation', () => ({ redirect: nav.redirect }));
beforeEach(() => { nav.redirect.mockClear(); });

it('retired start screen redirects to workplace selection', () => {
  expect(() => StartPage({})).toThrow('REDIRECT');
  expect(nav.redirect).toHaveBeenCalledWith('/workplaces');
});
it('retired join screen opens the code dialog on workplace selection', () => {
  expect(() => JoinPage({})).toThrow('REDIRECT');
  expect(nav.redirect).toHaveBeenCalledWith('/workplaces?join=1');
});
it('preserves a local continuation on either compatibility route', () => {
  const next = '/agency/work/tours';
  expect(() => StartPage({ searchParams: { next } })).toThrow('REDIRECT');
  expect(nav.redirect).toHaveBeenLastCalledWith('/workplaces?next=' + encodeURIComponent(next));
  expect(() => JoinPage({ searchParams: { next } })).toThrow('REDIRECT');
  expect(nav.redirect).toHaveBeenLastCalledWith('/workplaces?join=1&next=' + encodeURIComponent(next));
});
it('discards external continuation targets', () => {
  expect(() => JoinPage({ searchParams: { next: 'https://example.test' } })).toThrow('REDIRECT');
  expect(nav.redirect).toHaveBeenCalledWith('/workplaces?join=1');
});
