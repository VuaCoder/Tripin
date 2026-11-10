'use client';

import React from 'react';
import { ConfigProvider, Select } from 'antd';

export interface AntSelectOption<T = string | number> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface AntSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  onOpen?: () => void;
  options: AntSelectOption<T>[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  prefix?: React.ReactNode;
  allowClear?: boolean;
  id?: string;
  'aria-label'?: string;
  placement?: 'left' | 'right';
}

export function AntSelect<T extends string | number = string>({
  value, onChange, onOpen, options, placeholder = 'Chọn một mục',
  className = '', triggerClassName = '', dropdownClassName = '',
  size = 'middle', disabled = false, prefix, allowClear = false,
  id, 'aria-label': ariaLabel, placement = 'left',
}: AntSelectProps<T>) {
  return (
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#087e8b',
        fontFamily: 'inherit',
        borderRadius: 12,
        borderRadiusLG: 12,
        borderRadiusSM: 8,
        colorText: '#0f172a',
        colorBorder: '#e2e8f0',
        controlHeight: 40,
        controlHeightLG: 44,
      },
      components: {
        Select: {
          optionSelectedBg: '#f0fdfa',
          optionSelectedColor: '#087e8b',
          optionActiveBg: '#f8fafc',
          borderRadius: 12,
          colorBorder: '#e2e8f0',
          hoverBorderColor: '#087e8b',
          activeBorderColor: '#087e8b',
        },
      },
    }}>
      <Select<T>
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(next) => onChange(next === undefined ? '' as T : next)}
        onOpenChange={(open) => { if (open) onOpen?.(); }}
        options={options}
        placeholder={placeholder}
        className={`tripri-select ${className} ${triggerClassName}`}
        classNames={{ popup: { root: dropdownClassName } }}
        style={{ minWidth: 120, maxWidth: '100%' }}
        size={size}
        disabled={disabled}
        prefix={prefix}
        allowClear={allowClear}
        placement={placement === 'right' ? 'bottomRight' : 'bottomLeft'}
      />
    </ConfigProvider>
  );
}
