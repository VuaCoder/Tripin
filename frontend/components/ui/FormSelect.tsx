'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AntSelect, type AntSelectOption } from './AntSelect';

type FormSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'>;

function textContent(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child)
    ? textContent(child.props.children) : String(child)).join('');
}

function collectOptions(children: React.ReactNode): AntSelectOption<string>[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type === 'option') return [{
      value: String(child.props.value ?? textContent(child.props.children)),
      label: child.props.children,
      disabled: child.props.disabled,
    }];
    return collectOptions(child.props.children);
  });
}

/** Ant Design control with a native form field for FormData and change handlers. */
export function FormSelect({ children, className, style, id, value, defaultValue, ...props }: FormSelectProps) {
  const nativeRef = useRef<HTMLSelectElement>(null);
  const options = collectOptions(children);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const selected = value === undefined ? localValue : String(value);
  useEffect(() => {
    const form = nativeRef.current?.form;
    const reset = () => setLocalValue(String(defaultValue ?? options[0]?.value ?? ''));
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue, options[0]?.value]);


  return <span className={`tripri-form-select ${className ?? ''}`} style={style}>
    <AntSelect
      id={id}
      aria-label={props['aria-label']}
      value={selected}
      options={options}
      disabled={props.disabled}
      className="w-full"
      onChange={next => {
        setLocalValue(next);
        const field = nativeRef.current;
        if (field) {
          field.value = next;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }}
    />
    <select {...props} ref={nativeRef} value={selected} className="sr-only" tabIndex={-1} aria-hidden="true">
      {children}
    </select>
  </span>;
}
