'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectUser } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';
import { navigationByRole } from '@/components/layout/navigation-config';
import { STORY_CHAPTERS, STORY_FINAL, STORY_INTRO } from './story-content';
import './journey.css';

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** The 3D journey is an enhancement: skip it when the user or the network asks for less. */
export function canRunJourney(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return false;
  if (/^(slow-)?2g$/.test(connection?.effectiveType ?? '')) return false;
  return true;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Scroll-to-journey map. The v5 timeline spends a lot of progress on stretches with no copy (the boat casting off and the
 * camera tilting, then the swing back and the arrival), so scroll is spent unevenly: each pair is [journey progress, scroll
 * distance in viewport heights from the start]. Every story block gets the same 1.1 viewport heights; the stretches in
 * between are compressed. (v5 itself used 5.4 viewport heights with a linear map and four short wave texts.)
 */
const JOURNEY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.04, 0.12], [0.22, 1.1],                        // hero copy fades, boat casts off, camera tilts down
  [0.31, 2.2], [0.41, 3.3], [0.51, 4.4], [0.61, 5.5], [0.71, 6.6],        // intro + 4 chapters
  [0.93, 7.5], [1, 8.2],                                    // camera swings back, arrival, final CTA
];
const JOURNEY_SCROLL_VH = JOURNEY_STOPS[JOURNEY_STOPS.length - 1][1];
const V5_SCROLL_VH = 5.4;

/** Pin progress (0..1, linear in scroll) -> journey progress (0..1, the v5 timeline). */
function scrollToJourney(s: number): number {
  const vh = Math.min(1, Math.max(0, s)) * JOURNEY_SCROLL_VH;
  for (let i = 1; i < JOURNEY_STOPS.length; i++) {
    const [p1, v1] = JOURNEY_STOPS[i];
    if (vh <= v1) {
      const [p0, v0] = JOURNEY_STOPS[i - 1];
      return p0 + ((vh - v0) / (v1 - v0)) * (p1 - p0);
    }
  }
  return 1;
}

// Story blocks shown beside the boat while the camera looks down on the bay (journey progress 0..1, inside v5's top-down
// stretch .13-.70). The intro comes first, then the four chapters; text and image alternate sides.
interface StoryBlock { key: string; start: number; end: number; textSide: 'l' | 'r'; kicker: string; title: string; body: string; note?: string; image: string; imageAlt: string }
const WINDOWS: Array<[number, number]> = [[0.22, 0.31], [0.31, 0.41], [0.41, 0.51], [0.51, 0.61], [0.61, 0.71]];
const BLOCKS: StoryBlock[] = [
  { key: 'intro', ...STORY_INTRO, note: undefined, imageAlt: STORY_INTRO.imageAlt, start: WINDOWS[0][0], end: WINDOWS[0][1], textSide: 'l' },
  ...STORY_CHAPTERS.map((c, i): StoryBlock => ({
    key: c.number, kicker: `${c.number} — ${c.kicker}`, title: c.title, body: c.body, note: c.side, image: c.image, imageAlt: c.kicker,
    start: WINDOWS[i + 1][0], end: WINDOWS[i + 1][1], textSide: i % 2 === 0 ? 'r' : 'l',
  })),
];

interface JourneyHeroProps {
  /** Called when WebGL (or the scene bundle) is unavailable, so the page can show its static hero instead. */
  onUnavailable: () => void;
}

/**
 * Landing hero = the TRIPRI journey from tripri-hero v5/v6: the boat leaves the departure pier, the camera turns top-down
 * along the bay, then side-on again for the arrival at Ha Long. The stage is pinned with a GSAP ScrollTrigger (sticky
 * does not work inside ScrollSmoother's transformed content) and its progress drives the scene.
 * The copy and the nav paint first; three.js and the models (~2.1 MB) load after first paint and the canvas fades in.
 */
export function JourneyHero({ onUnavailable }: JourneyHeroProps) {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<ScrollTrigger | null>(null);

  // GSAP wraps the pinned section in a pin-spacer. It must be unwrapped before React removes the section, otherwise
  // React throws "removeChild: node is not a child" (e.g. when the page swaps to the static hero). Layout-effect
  // cleanups run before React detaches DOM nodes; passive-effect cleanups run after.
  useIsomorphicLayoutEffect(() => () => {
    pinRef.current?.kill(true);
    pinRef.current = null;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;

    // Created in useEffect (after the page's layout effect has created ScrollSmoother), as GSAP requires for pins.
    gsap.registerPlugin(ScrollTrigger);
    let progress = 0;
    const pin = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * JOURNEY_SCROLL_VH)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => { progress = scrollToJourney(self.progress); },
      onRefresh: (self) => { progress = scrollToJourney(self.progress); },
    });
    pinRef.current = pin;
    ScrollTrigger.refresh();

    let cancelled = false;
    let scene: { dispose: () => void } | null = null;
    const start = async () => {
      try {
        const { createJourneyScene } = await import('./scene/createJourneyScene');
        if (cancelled) return;
        scene = createJourneyScene({
          stage,
          getProgress: () => progress,
          speedScale: JOURNEY_SCROLL_VH / V5_SCROLL_VH,
          dom: {
            copy: copyRef.current,
            hint: hintRef.current,
            fin: finRef.current,
            vig: vigRef.current,
            getNav: () => null,
          },
          onFail: onUnavailable,
        });
      } catch (error) {
        console.warn('[landing-hero] 3D journey unavailable, using the static hero:', error);
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
      scene?.dispose();
      pin.kill(true);
      pinRef.current = null;
    };
  }, [onUnavailable]);

  return (
    <section ref={trackRef} className="tj-track">
      <div ref={stageRef} className="tj-stage">
        <div ref={vigRef} className="tj-vig" />

        {/* HERO: boat moored on the left, copy top right */}
        <div ref={copyRef} className="tj-copy">
          <div className="tj-eyebrow"><i />Một cách khác để đi</div>
          <h1>Đi gần hơn.<br />Sống sâu hơn.</h1>
          <h2>Tìm điểm đến. Chọn tour. Đặt chỗ. Thanh toán. Nhận e-ticket.</h2>
          <p>TRIPRI gom cả hành trình vào một nơi rõ ràng — để bạn dành nhiều thời gian hơn cho trải nghiệm đang chờ phía trước.</p>
          <div className="tj-scroll-guide">
            <div className="tj-scroll-mouse">
              <span className="tj-scroll-wheel" />
            </div>
            <div className="tj-scroll-info">
              <span>Cuộn chuột để bắt đầu hành trình</span>
              <span className="material-symbols-outlined tj-scroll-arrow">keyboard_arrow_down</span>
            </div>
          </div>
        </div>

        {/* Story: each block fades in beside the boat; the scene drives opacity / transform / word reveal. */}
        {BLOCKS.map((b) => (
          <div key={b.key} className="tj-chapter" data-chapter data-start={b.start} data-end={b.end} data-text-side={b.textSide}>
            <div className={`tj-ch-text tj-${b.textSide}`} data-ch-text>
              <p className="tj-ch-kicker">{b.kicker}</p>
              <h2 className="tj-ch-title">
                {b.title.split(' ').map((word, i) => (
                  <Fragment key={i}>
                    <span className="tj-ch-word" data-ch-word>{word}</span>{' '}
                  </Fragment>
                ))}
              </h2>
              <p className="tj-ch-body">{b.body}</p>
              {b.note ? <p className="tj-ch-note">{b.note}</p> : null}
            </div>
            <figure className={`tj-ch-media tj-${b.textSide === 'l' ? 'r' : 'l'}`} data-ch-media>
              <Image src={b.image} alt={b.imageAlt} fill sizes="(max-width: 900px) 62vw, 30vw" />
            </figure>
          </div>
        ))}

        {/* END: arrival at Ha Long; CTA on the left, the pier is on the right */}
        <div ref={finRef} className="tj-final">
          <div className="tj-step">{STORY_FINAL.kicker.toUpperCase()}</div>
          <h3>{STORY_FINAL.title}</h3>
          <p>{STORY_FINAL.cta}.</p>
          <div className="tj-cta-row">
            <Link className="tj-btn" href="/home">Khám phá ngay</Link>
          </div>
        </div>
        <div ref={hintRef} className="tj-hint">CUỘN ĐỂ KHỞI HÀNH</div>
      </div>
    </section>
  );
}
