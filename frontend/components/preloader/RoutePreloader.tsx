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

    // URL has changed: destination page is mounted and ready!
    if (previousUrlRef.current !== currentUrl) {
      previousUrlRef.current = currentUrl;
      onRouteSettled(pathname);
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
      manualHoldRef.current = false;
      setIsActive(false);
    }, MAX_SAFETY_TIMEOUT_MS);
  }, [clearTimers]);

  const manualHoldRef = useRef(false);

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

  const handleRouteSettled = useCallback(
    () => {
      // If manualHoldRef is active (e.g. post-payment custom reconciliation flow), do not auto dismiss!
      if (manualHoldRef.current) {
        return;
      }
      triggerFinish();
    },
    [triggerFinish],
  );

  // Link click interceptor and history listener
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      // Find nearest anchor
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (!anchor) return;

      // Ignore special clicks (new tab, modifiers, download, external)
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('rel')?.includes('external')) return;
      if (anchor.dataset.noPreloader === 'true' || anchor.closest('[data-no-preloader="true"]')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;

      // Ignore hash links, javascript:, mailto:, tel:
      if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }

      // Check URL
      try {
        const url = new URL(anchor.href, window.location.href);

        // Ignore different origins
        if (url.origin !== window.location.origin) return;

        // 1. DO NOT show preloader when navigating inside settings or traveler profile pages
        if (url.pathname.startsWith('/settings') || url.pathname.startsWith('/traveler')) {
          return;
        }

        // 2. DO NOT show preloader for query-only / in-page changes on the same route
        // (e.g. changing tabs on /home or typing/filtering search on /tours)
        if (url.pathname === window.location.pathname) {
          return;
        }

        // 3. For navigation between major routes (e.g. / <-> /home <-> /tours <-> /tours/:id), trigger preloader!
        triggerStart();
      } catch {
        // invalid URL: ignore
      }
    };

    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/settings') || currentPath.startsWith('/traveler')) return;
      triggerStart();
    };

    // Custom events for programmatic navigation (e.g. post-payment reconciliation)
    const handleCustomStart = () => {
      manualHoldRef.current = true;
      triggerStart();
    };
    const handleCustomEnd = () => {
      manualHoldRef.current = false;
      triggerFinish();
    };

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
