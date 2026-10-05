import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-container text-on-surface',
  primary: 'bg-primary-container/15 text-primary-container font-bold',
  secondary: 'bg-secondary-container/60 text-secondary-fixed-dim',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-primary-fixed text-on-primary-fixed',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
