'use client';

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '../utils/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
  maxValue?: number;
};

export function VndPriceInput({ value, onValueChange, maxValue, onFocus, onBlur, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caretDigits.current === null || !inputRef.current) return;
    const input = inputRef.current;
    const digits = caretDigits.current;
    caretDigits.current = null;
    let position = 0;
    let count = 0;
    while (position < input.value.length && count < digits) {
      if (/\d/.test(input.value[position])) count++;
      position++;
    }
    // Keep the caret after any separator inserted at this boundary.
    if (input.value[position] === '.') position++;
    input.setSelectionRange(position, position);
  }, [draft]);

  const accept = (raw: string, caretPosition?: number) => {
    const parsed = parseCurrencyVndInput(raw);
    if (maxValue !== undefined && parsed > maxValue) return;
    if (caretPosition !== undefined) {
      caretDigits.current = raw.slice(0, caretPosition).replace(/\D/g, '').length;
    }
    setDraft(formatCurrencyVndInput(parsed));
    onValueChange(parsed);
  };

  return (
    <input
      ref={inputRef}
      {...props}
      type="text"
      inputMode="numeric"
      value={draft ?? formatCurrencyVndInput(value)}
      onFocus={(event) => {
        setDraft(event.currentTarget.value);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        if (composing.current || (event.nativeEvent as InputEvent).isComposing) {
          setDraft(raw);
        } else {
          accept(raw, event.currentTarget.selectionStart ?? raw.length);
        }
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(event) => {
        composing.current = false;
        accept(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length);
      }}
      onBlur={(event) => {
        composing.current = false;
        accept(event.currentTarget.value);
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
