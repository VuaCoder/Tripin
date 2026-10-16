import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/home' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

import { RoutePreloader } from '../RoutePreloader';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  route.pathname = '/home';
});

describe('automatic branded navigation', () => {
  it('does not cover a fast Guest transition', () => {
    vi.useFakeTimers();
    const view = render(<><RoutePreloader /><a href="/tours" onClick={(event) => event.preventDefault()}>Tours</a></>);
    fireEvent.click(screen.getByText('Tours'));
    route.pathname = '/tours';
    view.rerender(<><RoutePreloader /><a href="/tours" onClick={(event) => event.preventDefault()}>Tours</a></>);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows on a slow Traveler transition and exits without a 380ms hold after commit', () => {
    vi.useFakeTimers();
    const view = render(<><RoutePreloader /><a href="/settings/history" onClick={(event) => event.preventDefault()}>History</a></>);
    fireEvent.click(screen.getByText('History'));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.getByRole('status')).toBeDefined();
    route.pathname = '/settings/history';
    view.rerender(<><RoutePreloader /><a href="/settings/history" onClick={(event) => event.preventDefault()}>History</a></>);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('recovers after a failed or aborted slow transition', () => {
    vi.useFakeTimers();
    render(<><RoutePreloader /><a href="/tours" onClick={(event) => event.preventDefault()}>Tours</a></>);
    fireEvent.click(screen.getByText('Tours'));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.getByRole('status')).toBeDefined();
    act(() => vi.advanceTimersByTime(5000));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never covers Agency navigation', () => {
    vi.useFakeTimers();
    render(<><RoutePreloader /><a href="/agency/bookings" onClick={(event) => event.preventDefault()}>Agency</a></>);
    fireEvent.click(screen.getByText('Agency'));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('handles Back/Forward without showing the boat for a quick commit', () => {
    vi.useFakeTimers();
    const view = render(<RoutePreloader />);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    route.pathname = '/tours';
    view.rerender(<RoutePreloader />);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the boat for a slow Back/Forward route change', () => {
    vi.useFakeTimers();
    const previousUrl = window.location.href;
    render(<RoutePreloader />);
    window.history.pushState({}, '', '/tours');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.getByRole('status')).toBeDefined();
    window.history.replaceState({}, '', previousUrl);
  });

  it('ignores query-only navigation', () => {
    vi.useFakeTimers();
    const previousUrl = window.location.href;
    window.history.replaceState({}, '', '/home');
    render(<><RoutePreloader /><a href="/home?q=beach" onClick={(event) => event.preventDefault()}>Filter</a></>);
    fireEvent.click(screen.getByText('Filter'));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
    window.history.replaceState({}, '', previousUrl);
  });
});
