'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { BoatIllustration } from './BoatIllustration';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface BoatPreloaderProps {
  /** Whether the preloader is currently requested to be visible. */
  active: boolean;
  /** Callback invoked after the exit animation completes and the overlay can be unmounted/hidden. */
  onExited?: () => void;
  /** Optional custom accessible label. */
  accessibleLabel?: string;
}

/**
 * Fullscreen GSAP 2D Boat Preloader for tripRI.
 * Features a minimalist 2D sailing boat floating organically on multi-layer animated sea waves.
 */
export function BoatPreloader({
  active,
  onExited,
  accessibleLabel = 'Đang tải nội dung chuyến đi...',
}: BoatPreloaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG element refs for GSAP
  const boatRef = useRef<SVGGElement>(null);
  const flagRef = useRef<SVGPathElement>(null);
  const waveBackRef = useRef<SVGPathElement>(null);
  const waveMidRef = useRef<SVGPathElement>(null);
  const waveFrontRef = useRef<SVGPathElement>(null);

  // Text dot refs
  const dot1Ref = useRef<HTMLSpanElement>(null);
  const dot2Ref = useRef<HTMLSpanElement>(null);
  const dot3Ref = useRef<HTMLSpanElement>(null);

  // Keep track of active state in a ref for callbacks
  const activeRef = useRef(active);
  activeRef.current = active;

  useIsomorphicLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scope all GSAP animations to overlayRef using gsap.context
    const ctx = gsap.context(() => {
      // Set initial styles
      gsap.set(overlay, { opacity: 0, pointerEvents: 'auto' });
      if (cardRef.current) gsap.set(cardRef.current, { scale: 0.94, opacity: 0.8 });

      // Entrance animation
      gsap.to(overlay, {
        opacity: 1,
        duration: prefersReducedMotion ? 0.15 : 0.28,
        ease: 'power2.out',
      });

      if (cardRef.current && !prefersReducedMotion) {
        gsap.to(cardRef.current, {
          scale: 1,
          opacity: 1,
          duration: 0.35,
          ease: 'back.out(1.2)',
        });
      } else if (cardRef.current) {
        gsap.set(cardRef.current, { scale: 1, opacity: 1 });
      }

      // If user prefers reduced motion, skip infinite physics loops
      if (prefersReducedMotion) {
        return;
      }

      // 1. Boat bobbing (vertical flotation)
      if (boatRef.current) {
        gsap.to(boatRef.current, {
          y: -5,
          duration: 1.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        // 2. Boat rotational sway (rocking on waves)
        // Transform origin corresponds to the boat hull center (x: 130px, y: 115px)
        gsap.to(boatRef.current, {
          rotation: 3.2,
          transformOrigin: '130px 115px',
          duration: 2.1,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      // 3. Pennant flag flutter in the oceanic breeze
      if (flagRef.current) {
        gsap.to(flagRef.current, {
          scaleX: 0.82,
          skewY: 3,
          transformOrigin: '125px 33px',
          duration: 0.42,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      // 4. Multi-layer continuous wave flow
      // Wavelength is exactly 130px. Translating by -130px with linear ease creates a 100% seamless loop.
      if (waveBackRef.current) {
        gsap.to(waveBackRef.current, {
          x: -130,
          duration: 4.4,
          ease: 'none',
          repeat: -1,
        });
      }

      if (waveMidRef.current) {
        gsap.to(waveMidRef.current, {
          x: -130,
          duration: 3.3,
          ease: 'none',
          repeat: -1,
        });
      }

      if (waveFrontRef.current) {
        gsap.to(waveFrontRef.current, {
          x: -130,
          duration: 2.4,
          ease: 'none',
          repeat: -1,
        });
      }

      // 5. Staggered vertical pulse for loading dots
      const dots = [dot1Ref.current, dot2Ref.current, dot3Ref.current].filter(Boolean);
      if (dots.length > 0) {
        gsap.set(dots, { y: 0, opacity: 0.35 });
        gsap.to(dots, {
          y: -5.5,
          opacity: 1,
          duration: 0.38,
          stagger: 0.14,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
    }, overlayRef);

    return () => {
      ctx.revert();
    };
  }, []);

  // Watch for active -> inactive transition to execute exit fade-out
  useEffect(() => {
    if (active) return;

    const overlay = overlayRef.current;
    if (!overlay) {
      onExited?.();
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let isExited = false;
    const safeExited = () => {
      if (isExited) return;
      isExited = true;
      onExited?.();
    };

    // Smooth exit timeline
    gsap.to(overlay, {
      opacity: 0,
      duration: prefersReducedMotion ? 0.15 : 0.3,
      ease: 'power2.inOut',
      onComplete: safeExited,
    });

    // Fallback timer guarantees overlay cleanly dismisses even if rAF is throttled in background tabs
    const fallbackTimer = setTimeout(safeExited, prefersReducedMotion ? 250 : 450);
    return () => clearTimeout(fallbackTimer);
  }, [active, onExited]);

  return (
    <div
      ref={overlayRef}
      role="status"
      aria-live="polite"
      aria-label={accessibleLabel}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F5F0]/92 backdrop-blur-md select-none cursor-wait overflow-hidden transition-none"
    >
      <div
        ref={cardRef}
        className="flex flex-col items-center justify-center p-6 sm:p-10 md:p-12 max-w-xl sm:max-w-2xl"
      >
        {/* Animated Sailing Boat & Multi-layer Water */}
        <BoatIllustration
          ref={svgRef}
          boatRef={boatRef}
          flagRef={flagRef}
          waveBackRef={waveBackRef}
          waveMidRef={waveMidRef}
          waveFrontRef={waveFrontRef}
        />

        {/* Brand wordmark / Loading Typography */}
        <div className="mt-6 sm:mt-7 flex flex-col items-center">
          <div className="flex items-center text-sm sm:text-base md:text-lg font-bold tracking-[0.26em] text-[#004F57] uppercase font-vietnam">
            <span>Loading</span>
            {/* Dedicated fixed-width container for the 3 dots prevents text width jitter */}
            <span className="inline-flex w-7 sm:w-8 justify-start text-lg sm:text-xl md:text-2xl leading-none">
              <span ref={dot1Ref} className="inline-block w-2 sm:w-2.5 text-center">.</span>
              <span ref={dot2Ref} className="inline-block w-2 sm:w-2.5 text-center">.</span>
              <span ref={dot3Ref} className="inline-block w-2 sm:w-2.5 text-center">.</span>
            </span>
          </div>

          <p className="mt-1.5 text-xs sm:text-sm font-medium tracking-wide text-slate-500 font-vietnam">
            Khám phá hành trình cùng Tripri
          </p>
        </div>

        {/* Accessible screen-reader text */}
        <span className="sr-only">{accessibleLabel}</span>
      </div>
    </div>
  );
}
