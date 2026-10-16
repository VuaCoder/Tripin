'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BoatPreloader } from './BoatPreloader';

const MIN_DISPLAY_MS = 380;
const MAX_SAFETY_TIMEOUT_MS = 4500;
const AUTOMATIC_DELAY_MS = 180;

function isAgencyPath(pathname: string) {
  return pathname === '/agency' || pathname.startsWith('/agency/');
}

/**
 * Inner component wrapped in Suspense that monitors App Router URL mutations.
 * The URL commit is the earliest reliable completion signal for a route transition.
 */
function RouteChangeWatcher({ onRouteSettled }: { onRouteSettled: (pathname: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isInitialMount = useRef(true);
  const previousUrlRef = useRef<string>('');

  useEffect(() => {
    const currentUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Skip the very first initial mount of the application
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousUrlRef.current = currentUrl;
      return;
    }

    // URL has changed; this does not imply client-side data has finished loading.
    if (previousUrlRef.current !== currentUrl) {
      previousUrlRef.current = currentUrl;
      onRouteSettled(pathname);
    }
  }, [pathname, searchParams, onRouteSettled]);

  return null;
}

/**
 * Fast Guest/Traveler transitions stay unobstructed. On a slower transition,
 * show the branded boat after navigation has already been dispatched.
 */
export function RoutePreloader() {
  const [isMounted, setIsMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [overlayId, setOverlayId] = useState(0);
  const mountedRef = useRef(false);
  const activeRef = useRef(false);
  const overlayIdRef = useRef(0);
  const modeRef = useRef<'automatic' | 'explicit'>('explicit');
  const automaticDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedPathRef = useRef(typeof window === 'undefined' ? '' : window.location.pathname);

  const startTimeRef = useRef<number>(0);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timers
  const clearTimers = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (minDurationTimerRef.current) {
      clearTimeout(minDurationTimerRef.current);
      minDurationTimerRef.current = null;
    }
  }, []);

  const clearAutomaticDelay = useCallback(() => {
    if (automaticDelayRef.current) {
      clearTimeout(automaticDelayRef.current);
      automaticDelayRef.current = null;
    }
  }, []);

  // Trigger preloader start
  const triggerStart = useCallback((mode: 'automatic' | 'explicit' = 'explicit') => {
    clearTimers();
    modeRef.current = mode;
    if (!mountedRef.current || !activeRef.current) {
      overlayIdRef.current += 1;
      setOverlayId(overlayIdRef.current);
    }
    startTimeRef.current = Date.now();
    mountedRef.current = true;
    activeRef.current = true;
    setIsMounted(true);
    setIsActive(true);

    // Safety recovery timeout: ensures preloader never gets stuck on network failures or aborted transitions
    safetyTimeoutRef.current = setTimeout(() => {
      manualHoldRef.current = false;
      activeRef.current = false;
      setIsActive(false);
    }, MAX_SAFETY_TIMEOUT_MS);
  }, [clearTimers]);

  const manualHoldRef = useRef(false);

  // Trigger preloader exit
  const triggerFinish = useCallback((skipMinimum = false) => {
    if (!activeRef.current) return;
    if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = skipMinimum ? 0 : Math.max(0, MIN_DISPLAY_MS - elapsed);

    if (remaining > 0) {
      minDurationTimerRef.current = setTimeout(() => {
        activeRef.current = false;
        setIsActive(false);
      }, remaining);
    } else {
      activeRef.current = false;
      setIsActive(false);
    }
  }, []);

  const handleRouteSettled = useCallback(
    (pathname: string) => {
      lastCommittedPathRef.current = pathname;
      clearAutomaticDelay();
      // If manualHoldRef is active (e.g. post-payment custom reconciliation flow), do not auto dismiss!
      if (manualHoldRef.current) {
        return;
      }
      triggerFinish(modeRef.current === 'automatic');
    },
    [clearAutomaticDelay, triggerFinish],
  );

  useEffect(() => {
    const scheduleAutomaticStart = () => {
      clearAutomaticDelay();
      if (activeRef.current || manualHoldRef.current) return;
      automaticDelayRef.current = setTimeout(() => {
        automaticDelayRef.current = null;
        triggerStart('automatic');
      }, AUTOMATIC_DELAY_MS);
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.closest('[data-no-preloader="true"]') || link.rel.includes('external') || (link.target && link.target !== '_self')) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || isAgencyPath(window.location.pathname) || isAgencyPath(url.pathname)) return;
      if (url.pathname === window.location.pathname) return;
      scheduleAutomaticStart();
    };
    const handlePopState = () => {
      if (!isAgencyPath(lastCommittedPathRef.current) && !isAgencyPath(window.location.pathname) && lastCommittedPathRef.current !== window.location.pathname) scheduleAutomaticStart();
    };
    // Custom events for intentional branded flows (e.g. post-payment reconciliation).
    const handleCustomStart = () => {
      clearAutomaticDelay();
      manualHoldRef.current = true;
      triggerStart();
    };
    const handleCustomEnd = () => {
      manualHoldRef.current = false;
      triggerFinish();
    };
    const handleRouteNavigation = () => { clearAutomaticDelay(); manualHoldRef.current = false; triggerStart(); };

    document.addEventListener('click', handleLinkClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('tripri:navigation-start', handleCustomStart);
    window.addEventListener('tripri:route-navigation-start', handleRouteNavigation);
    window.addEventListener('tripri:navigation-end', handleCustomEnd);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('tripri:navigation-start', handleCustomStart);
      window.removeEventListener('tripri:route-navigation-start', handleRouteNavigation);
      window.removeEventListener('tripri:navigation-end', handleCustomEnd);
      clearTimers();
      clearAutomaticDelay();
    };
  }, [triggerStart, triggerFinish, clearTimers, clearAutomaticDelay]);

  // Invoked when GSAP exit fade-out completes
  const handleExited = useCallback((id: number) => {
    if (id !== overlayIdRef.current) return;
    mountedRef.current = false;
    setIsMounted(false);
    manualHoldRef.current = false;
    clearTimers();
  }, [clearTimers]);

  return (
    <>
      <Suspense fallback={null}>
        <RouteChangeWatcher onRouteSettled={handleRouteSettled} />
      </Suspense>

      {isMounted && (
        <BoatPreloader
          key={overlayId}
          active={isActive}
          onExited={() => handleExited(overlayId)}
        />
      )}
    </>
  );
}

/** Hook for programmatic preloader control if needed by forms, checkout or auth flows */
export function usePreloader() {
  const start = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tripri:navigation-start'));
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tripri:navigation-end'));
    }
  }, []);

  return { start, stop };
}
