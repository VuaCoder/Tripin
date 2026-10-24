'use client';

import React from 'react';
import { Dropdown as AntdDropdown, ConfigProvider } from 'antd';
import type { DropdownProps as AntdDropdownProps, MenuProps } from 'antd';
import { cn } from '../ui/cn';

export type DropdownMenuItem = Required<MenuProps>['items'][number];

// Polyfill ResizeObserver in test/SSR environments if absent
if (typeof window !== 'undefined' && !(window as any).ResizeObserver) {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

export interface DropdownProps extends Omit<AntdDropdownProps, 'overlay'> {
  /** Menu items for standard Ant Design dropdown menu */
  items?: MenuProps['items'];
  /** Custom content rendered inside the dropdown popup (e.g. custom card, notifications panel) */
  popupContent?: React.ReactNode;
  /** Menu item click handler when using `items` */
  onItemClick?: MenuProps['onClick'];
  /** Trigger element */
  children: React.ReactElement;
  /** Custom class for popup overlay */
  popupClassName?: string;
}

/**
 * Universal Dropdown Component using Ant Design.
 * Features Tripri brand tokens (teal palette, rounded corners, clean shadows).
 * Supports both standard item menus and rich custom popup panels.
 */
export function Dropdown({
  items,
  popupContent,
  onItemClick,
  children,
  trigger = ['click'],
  placement = 'bottomRight',
  popupClassName,
  className,
  ...restProps
}: DropdownProps) {
  const menuConfig: MenuProps = {
    items: items ?? [],
    onClick: onItemClick,
    className: cn('rounded-2xl p-1.5 shadow-xl border border-slate-100', className),
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#087e8b',
          colorText: '#1e293b',
          colorBgElevated: '#ffffff',
          borderRadius: 16,
          borderRadiusLG: 16,
          borderRadiusSM: 10,
          fontFamily: 'inherit',
          boxShadowSecondary: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
        },
        components: {
          Dropdown: {
            paddingBlock: 6,
          },
        },
      }}
    >
      <AntdDropdown
        menu={items && items.length > 0 ? menuConfig : { items: [] }}
        popupRender={popupContent ? () => <>{popupContent}</> : undefined}
        trigger={trigger}
        placement={placement}
        rootClassName={cn('ant-dropdown-tripri z-50', popupClassName)}
        {...restProps}
      >
        {children}
      </AntdDropdown>
    </ConfigProvider>
  );
}

export default Dropdown;
