import type React from 'react';

/**
 * Normalizes promotion code:
 * - Converts all spaces/whitespace to underscores ('_')
 * - Converts characters to uppercase
 */
export function formatPromotionCode(value: string): string {
  return value.replace(/\s/g, '_').toUpperCase();
}

/**
 * Handles KeyDown event on promotion code input fields:
 * When the user presses the spacebar, prevent space and insert '_'
 * while advancing cursor position cleanly.
 */
export function handlePromotionCodeKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  onChange: (value: string) => void,
): void {
  if (e.key === ' ') {
    e.preventDefault();
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const current = input.value;
    const nextVal = formatPromotionCode(current.slice(0, start) + '_' + current.slice(end));
    onChange(nextVal);
    requestAnimationFrame(() => {
      input.setSelectionRange(start + 1, start + 1);
    });
  }
}

/**
 * Handles Change event on promotion code input fields:
 * Converts any spaces (including pasted text) to '_' and uppercases.
 */
export function handlePromotionCodeChange(
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
): void {
  const input = e.target;
  const cursor = input.selectionStart;
  const nextVal = formatPromotionCode(input.value);
  onChange(nextVal);
  if (cursor !== null) {
    requestAnimationFrame(() => {
      input.setSelectionRange(cursor, cursor);
    });
  }
}
