import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../ui/cn';

export type ContainerSize = 'default' | 'narrow' | 'wide' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  size?: ContainerSize;
  noPadding?: boolean;
  children: ReactNode;
}

const sizeClasses: Record<ContainerSize, string> = {
  narrow: 'max-w-5xl',
  default: 'max-w-[1440px]',
  wide: 'max-w-[1600px]',
  full: 'w-full',
};

export function Container({
  as: Component = 'div',
  size = 'default',
  noPadding = false,
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Component
      className={cn(
        'mx-auto w-full',
        sizeClasses[size],
        !noPadding && 'px-4 sm:px-6 lg:px-8',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
