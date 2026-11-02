'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

// Sky behind the transparent WebGL canvas. The --sky/--hy/--sx/--sy/--glow variables are updated by the scene each
// frame so the horizon and the sun glow follow the camera (same CSS as the TRIPRI v5 prototype).
const STAGE_STYLE = {
  '--sky-top': '#cfe3e1',
  '--sky-hor': '#f3f6f4',
  '--hy': '55%',
  '--sx': '25%',
  '--sy': '45%',
  '--glow': '.45',
  background:
    'radial-gradient(ellipse 36% 28% at var(--sx) var(--sy), rgba(255,226,180,calc(var(--glow)*.9)), transparent 70%),' +
    'linear-gradient(to bottom, var(--sky-top) 0, var(--sky-hor) var(--hy), var(--sky-hor) 100%)',
} as CSSProperties;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** The 3D scene is an enhancement: skip it when the user or the network asks for less. */
export function canRunHeroScene(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return false;
  if (/^(slow-)?2g$/.test(connection?.effectiveType ?? '')) return false;
  return true;
}

interface HeroSceneProps {
  /** The hero section that scrolls away; its height maps the scroll position to the boat's departure. */
  sectionRef: React.RefObject<HTMLElement>;
  /** Called when WebGL (or the scene bundle) is unavailable, so the page can show its static hero instead. */
  onUnavailable: () => void;
  className?: string;
}

/**
 * Decorative TRIPRI scene (boat moored at the departure pier, limestone islands, gulls) drawn with three.js over a CSS
 * sky. The sky paints immediately; three.js and the models (~1.6 MB) load after first paint and the canvas fades in.
 * While the hero scrolls away the boat casts off (first stretch of the journey timeline).
 */
export function HeroScene({ sectionRef, onUnavailable, className = '' }: HeroSceneProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    let progress = 0;
    const readScroll = () => {
      // 0 at the top, 1 once ~60% of the hero has scrolled away (the boat has cast off by then)
      progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, section.offsetHeight * 0.6)));
    };
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', readScroll);

    let cancelled = false;
    let scene: { dispose: () => void } | null = null;
    const start = async () => {
      try {
        const { createHeroScene } = await import('./scene/createHeroScene');
        if (cancelled) return;
        scene = createHeroScene(stage, { getProgress: () => progress, onFail: onUnavailable });
      } catch (error) {
        console.warn('[landing-hero] 3D scene unavailable, using the static hero:', error);
        if (!cancelled) onUnavailable();
      }
    };

    // Let the headline paint first; the three.js chunk and models are not needed for LCP.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const handle = hasIdle
      ? window.requestIdleCallback(() => void start(), { timeout: 1500 })
      : window.setTimeout(() => void start(), 300);

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', readScroll);
      scene?.dispose();
    };
  }, [sectionRef, onUnavailable]);

  return <div ref={stageRef} aria-hidden="true" className={className} style={STAGE_STYLE} />;
}
