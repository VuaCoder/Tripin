import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

import gsap from 'gsap';
import { BoatIllustration } from '../BoatIllustration';
import { BoatPreloader } from '../BoatPreloader';
import { RoutePreloader } from '../RoutePreloader';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
});

describe('BoatIllustration', () => {
  it('renders SVG with boat group, mast, sails, and 3 wave layers', () => {
    const boatRef = createRef<SVGGElement>();
    const flagRef = createRef<SVGPathElement>();
    const waveBackRef = createRef<SVGPathElement>();
    const waveMidRef = createRef<SVGPathElement>();
    const waveFrontRef = createRef<SVGPathElement>();

    const { container } = render(
      <BoatIllustration
        boatRef={boatRef}
        flagRef={flagRef}
        waveBackRef={waveBackRef}
        waveMidRef={waveMidRef}
        waveFrontRef={waveFrontRef}
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');

    // Boat group exists
    const boatGroup = container.querySelector('#tripri-boat-group');
    expect(boatGroup).toBeDefined();

    // 3 wave layers exist
    expect(waveBackRef.current).toBeDefined();
    expect(waveMidRef.current).toBeDefined();
    expect(waveFrontRef.current).toBeDefined();
  });
});

describe('BoatPreloader', () => {
  it('renders with role="status" and accessible label', () => {
    render(<BoatPreloader active={true} accessibleLabel="Đang tải dữ liệu..." />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(statusEl.getAttribute('aria-label')).toBe('Đang tải dữ liệu...');
    expect(screen.getByText(/Loading/i)).toBeDefined();
  });

  it('renders three distinct loading dots', () => {
    const { container } = render(<BoatPreloader active={true} />);
    const dotSpans = container.querySelectorAll('.font-vietnam span span');
    expect(dotSpans.length).toBe(3);
  });

  it('renders custom subtitle when provided', () => {
    render(<BoatPreloader active={true} subtitle="Đang đối chiếu" />);
    expect(screen.getByText('Đang đối chiếu')).toBeDefined();
  });

  it('calls onExited after exit transition completes when active turns false', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const { rerender } = render(<BoatPreloader active={true} onExited={onExited} />);

    rerender(<BoatPreloader active={false} onExited={onExited} />);

    act(() => {
      vi.advanceTimersByTime(500);
      gsap.ticker.tick();
      gsap.globalTimeline.seek(100);
    });

    expect(onExited).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('exits promptly with reduced motion enabled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const onExited = vi.fn();
    const { rerender } = render(<BoatPreloader active={true} onExited={onExited} />);
    rerender(<BoatPreloader active={false} onExited={onExited} />);
    act(() => vi.advanceTimersByTime(250));
    expect(onExited).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('RoutePreloader', () => {
  it('does not cover normal Agency links or Agency history navigation', () => {
    const previousUrl = window.location.href;
    window.history.pushState({}, '', '/agency');
    try {
      render(<><RoutePreloader /><a href="/agency/bookings">Đơn đặt chỗ Agency</a></>);
      fireEvent.click(screen.getByText('Đơn đặt chỗ Agency'));
      expect(screen.queryByRole('status')).toBeNull();
      act(() => window.dispatchEvent(new PopStateEvent('popstate')));
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousUrl);
    }
  });

  it('does not cover AI, person chat, or chat browser history with a preloader', () => {
    const previousUrl = window.location.href;
    window.history.replaceState({}, '', '/conversations');
    try {
      render(<><RoutePreloader /><a href="/conversations/ai">AI chat</a><a href="/conversations/person">Person chat</a></>);
      fireEvent.click(screen.getByText('AI chat'));
      expect(screen.queryByRole('status')).toBeNull();
      fireEvent.click(screen.getByText('Person chat'));
      expect(screen.queryByRole('status')).toBeNull();
      window.history.pushState({}, '', '/conversations/ai');
      fireEvent.popState(window);
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousUrl);
    }
  });

  it('keeps Agency links lightweight even if an old opt-in attribute remains', () => {
    render(<><RoutePreloader /><a href="/agency/tours" data-route-preloader="true">Quản lý tour Agency</a><a href="/agency/notifications" data-no-preloader="true">Mở thông báo</a></>);
    fireEvent.click(screen.getByText('Mở thông báo'));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('Quản lý tour Agency'));
    expect(screen.queryByRole('status')).toBeNull();
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not trigger a preloader between account sections', () => {
    window.history.replaceState({}, '', '/settings/profile');
    render(
      <div>
        <RoutePreloader />
        <a href="/settings/wishlist">Danh sách yêu thích</a>
      </div>,
    );

    const link = screen.getByText('Danh sách yêu thích');
    fireEvent.click(link);

    // Preloader should not mount on settings link clicks
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['/', '/home'],
    ['/home', '/'],
    ['/home', '/login'],
    ['/home', '/register'],
    ['/login', '/register'],
    ['/home', '/tours'],
    ['/tours', '/traveler'],
  ])('does not cover ordinary navigation from %s to %s', (from, to) => {
    const previousUrl = window.location.href;
    window.history.pushState({}, '', from);
    try {
      render(<><RoutePreloader /><a href={to}>Đi tới trang</a></>);
      fireEvent.click(screen.getByRole('link', { name: 'Đi tới trang' }));
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousUrl);
    }
  });

  it('does not cover ordinary Back/Forward history navigation', () => {
    render(<RoutePreloader />);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not mount overlapping overlays during rapid ordinary navigation', () => {
    render(<><RoutePreloader /><a href="/home">Home</a><a href="/login">Login</a></>);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not activate the boat for public tour links', () => {
    render(
      <div>
        <RoutePreloader />
        <a href="/tours">Khám phá tour</a>
      </div>,
    );

    const link = screen.getByText('Khám phá tour');
    fireEvent.click(link);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('responds to programmatic navigation events tripri:navigation-start', () => {
    render(<RoutePreloader />);

    act(() => {
      window.dispatchEvent(new Event('tripri:navigation-start'));
    });

    expect(screen.getByRole('status')).toBeDefined();

    act(() => {
      window.dispatchEvent(new Event('tripri:navigation-end'));
      vi.advanceTimersByTime(500);
    });

    act(() => {
      vi.advanceTimersByTime(500);
      gsap.ticker.tick();
      gsap.globalTimeline.seek(gsap.globalTimeline.time() + 10);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cleans up a superseded branded transition and its safety timeout', () => {
    render(<RoutePreloader />);
    act(() => window.dispatchEvent(new Event('tripri:route-navigation-start')));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    act(() => window.dispatchEvent(new Event('tripri:navigation-end')));
    act(() => vi.advanceTimersByTime(380));
    act(() => window.dispatchEvent(new Event('tripri:route-navigation-start')));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(5000));
    act(() => {
      vi.advanceTimersByTime(500);
      gsap.ticker.tick();
      gsap.globalTimeline.seek(gsap.globalTimeline.time() + 10);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
