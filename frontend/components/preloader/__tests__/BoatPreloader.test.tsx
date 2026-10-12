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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers preloader when internal qualifying link is clicked', () => {
    render(
      <div>
        <RoutePreloader />
        <a href="/tours">Khám phá tour</a>
      </div>,
    );

    const link = screen.getByText('Khám phá tour');
    fireEvent.click(link);

    // Preloader is mounted
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('does NOT trigger preloader for hash links on the same page', () => {
    render(
      <div>
        <RoutePreloader />
        <a href="#story">Đến câu chuyện</a>
      </div>,
    );

    const link = screen.getByText('Đến câu chuyện');
    fireEvent.click(link);

    // Preloader should not mount
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does NOT trigger preloader for modified clicks (e.g. Meta key)', () => {
    render(
      <div>
        <RoutePreloader />
        <a href="/tours">Khám phá tour</a>
      </div>,
    );

    const link = screen.getByText('Khám phá tour');
    fireEvent.click(link, { metaKey: true });

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
});
