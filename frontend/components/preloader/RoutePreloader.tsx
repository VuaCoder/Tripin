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

/**
 * Inner component wrapped in Suspense that monitors App Router URL mutations.
 * When pathname or searchParams changes, notifies RoutePreloader that destination page is ready.
 */
function RouteChangeWatcher({ onRouteSettled }: { onRouteSettled: () => void }) {
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

    // URL has changed: destination page is mounted and ready!
    if (previousUrlRef.current !== currentUrl) {
      previousUrlRef.current = currentUrl;
      onRouteSettled();
    }
  }, [pathname, searchParams, onRouteSettled]);

  return null;
}

/**
 * Global App Router Preloader for tripRI.
 * Intercepts internal link clicks, browser history (popstate), and programmatic route changes,
 * managing the GSAP Boat Preloader lifecycle with anti-flicker minimum duration & safety fallback.
 */
export function RoutePreloader() {
  const [isMounted, setIsMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);

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

  // Trigger preloader start
  const triggerStart = useCallback(() => {
    clearTimers();
    startTimeRef.current = Date.now();
    setIsMounted(true);
    setIsActive(true);

    // Safety recovery timeout: ensures preloader never gets stuck on network failures or aborted transitions
    safetyTimeoutRef.current = setTimeout(() => {
      setIsActive(false);
    }, MAX_SAFETY_TIMEOUT_MS);
  }, [clearTimers]);

  // Trigger preloader exit
  const triggerFinish = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    if (remaining > 0) {
      minDurationTimerRef.current = setTimeout(() => {
        setIsActive(false);
      }, remaining);
    } else {
      setIsActive(false);
    }
  }, []);

  // Link click interceptor
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      // Ignore prevented clicks
      if (event.defaultPrevented) return;
      // Primary button only
      if (event.button !== 0) return;
      // Modifier keys (Cmd, Ctrl, Shift, Alt) open in new tabs/windows
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      // Ignore external targets, downloads, or custom protocols
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('rel')?.includes('external')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;
      if (
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:') ||
        rawHref.startsWith('javascript:')
      ) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.href);

        // Cross-origin: let standard browser navigation handle it
        if (dest.origin !== window.location.origin) return;

        // Hash jump on the current page: ignore
        if (
          dest.pathname === window.location.pathname &&
          dest.search === window.location.search &&
          dest.hash
        ) {
          return;
        }

        // Exact same URL: ignore
        if (
          dest.pathname === window.location.pathname &&
          dest.search === window.location.search
        ) {
          return;
        }

        // Legitimate client-side navigation!
        triggerStart();
      } catch {
        // Invalid URL, no-op
      }
    };

    // Popstate (browser back/forward button)
    const handlePopState = () => {
      triggerStart();
    };

    // Custom events for programmatic navigation
    const handleCustomStart = () => triggerStart();
    const handleCustomEnd = () => triggerFinish();

    document.addEventListener('click', handleDocumentClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('tripri:navigation-start', handleCustomStart);
    window.addEventListener('tripri:navigation-end', handleCustomEnd);

    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('tripri:navigation-start', handleCustomStart);
      window.removeEventListener('tripri:navigation-end', handleCustomEnd);
      clearTimers();
    };
  }, [triggerStart, triggerFinish, clearTimers]);

  // Invoked when GSAP exit fade-out completes
  const handleExited = useCallback(() => {
    setIsMounted(false);
    clearTimers();
  }, [clearTimers]);

  return (
    <>
      <Suspense fallback={null}>
        <RouteChangeWatcher onRouteSettled={triggerFinish} />
      </Suspense>

      {isMounted && (
        <BoatPreloader
          active={isActive}
          onExited={handleExited}
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
