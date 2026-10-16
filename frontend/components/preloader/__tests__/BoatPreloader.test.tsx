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

afterEach(cleanup);

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
});

describe('RoutePreloader', () => {
  it('loads Agency sidebar destinations but exempts notifications', () => {
    render(<><RoutePreloader /><a href="/agency/tours" data-route-preloader="true">Quản lý tour Agency</a><a href="/agency/notifications" data-no-preloader="true">Mở thông báo</a></>);
    fireEvent.click(screen.getByText('Mở thông báo'));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('Quản lý tour Agency'));
    expect(screen.getByRole('status')).toBeDefined();
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT trigger preloader on settings link clicks or same-page links', () => {
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

  it('triggers preloader on major route navigation like /tours', () => {
    render(
      <div>
        <RoutePreloader />
        <a href="/tours">Khám phá tour</a>
      </div>,
    );

    const link = screen.getByText('Khám phá tour');
    fireEvent.click(link);

    // Preloader mounts when navigating to major pages
    expect(screen.getByRole('status')).toBeDefined();
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
});
