'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
}

/**
 * Easing function: easeOutExpo
 * Fast start and gentle deceleration to target.
 */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Custom hook for smooth Counter-up / Count-up animation using requestAnimationFrame.
 * Animates from the current displayed value to the new target value whenever target changes.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 800, decimals = 0 } = options;
  const [currentValue, setCurrentValue] = useState<number>(target);
  const startValRef = useRef<number>(target);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If target hasn't changed or reduced motion is preferred, jump straight to target
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setCurrentValue(target);
      startValRef.current = target;
      return;
    }

    const startValue = startValRef.current;
    if (startValue === target) return;

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / Math.max(duration, 1), 1);
      const eased = easeOutExpo(progress);

      const nextVal = startValue + (target - startValue) * eased;
      const factor = Math.pow(10, decimals);
      const rounded = Math.round(nextVal * factor) / factor;

      setCurrentValue(rounded);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentValue(target);
        startValRef.current = target;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [target, duration, decimals]);

  return currentValue;
}

export interface CounterUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (val: number) => string;
  className?: string;
}

/**
 * Reusable CounterUp Component
 * Displays animated numbers with smooth transitions, prefixes, suffixes, or custom formatters.
 */
export function CounterUp({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  formatter,
  className = '',
}: CounterUpProps) {
  const animatedValue = useCountUp(value, { duration, decimals });

  const formatted = formatter
    ? formatter(animatedValue)
    : decimals > 0
      ? animatedValue.toFixed(decimals)
      : new Intl.NumberFormat('vi-VN').format(Math.round(animatedValue));

  return (
    <span
      className={`tabular-nums transition-colors duration-150 ${className}`}
      aria-live="polite"
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
