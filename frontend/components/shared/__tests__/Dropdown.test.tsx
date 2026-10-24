import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dropdown } from '../Dropdown';

describe('Shared Ant Design Dropdown Component', () => {
  beforeAll(() => {
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(cleanup);

  it('renders trigger element properly', () => {
    render(
      <Dropdown items={[{ key: '1', label: 'Tùy chọn 1' }]}>
        <button type="button">Mở Menu</button>
      </Dropdown>,
    );

    expect(screen.getByRole('button', { name: 'Mở Menu' })).toBeTruthy();
  });

  it('opens and renders menu items when trigger is clicked', async () => {
    const handleClick = vi.fn();
    const items = [
      { key: 'profile', label: 'Hồ sơ cá nhân' },
      { key: 'logout', label: 'Đăng xuất' },
    ];

    render(
      <Dropdown items={items} onItemClick={handleClick} trigger={['click']}>
        <button type="button">Tài khoản</button>
      </Dropdown>,
    );

    const trigger = screen.getByRole('button', { name: 'Tài khoản' });
    fireEvent.click(trigger);

    const profileItem = await screen.findByText('Hồ sơ cá nhân');
    expect(profileItem).toBeTruthy();
    expect(screen.getByText('Đăng xuất')).toBeTruthy();

    fireEvent.click(profileItem);
    expect(handleClick).toHaveBeenCalled();
  });

  it('renders custom popupContent properly when trigger is clicked', async () => {
    const customContent = (
      <div id="custom-popup" className="p-4">
        <h4>Nội dung tùy chỉnh</h4>
        <p>Thông tin chi tiết trong dropdown popup</p>
      </div>
    );

    render(
      <Dropdown popupContent={customContent} trigger={['click']}>
        <button type="button">Thông báo</button>
      </Dropdown>,
    );

    const trigger = screen.getByRole('button', { name: 'Thông báo' });
    fireEvent.click(trigger);

    expect(await screen.findByText('Nội dung tùy chỉnh')).toBeTruthy();
    expect(screen.getByText('Thông tin chi tiết trong dropdown popup')).toBeTruthy();
  });
});
