import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(cleanup);

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Xóa mục này?"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, description and action buttons when open', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Xóa Danh sách yêu thích này?"
        description="Dữ liệu sẽ bị xóa vĩnh viễn."
        cancelText="Hủy"
        confirmText="Xóa"
        variant="danger"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Xóa Danh sách yêu thích này?')).toBeTruthy();
    expect(screen.getByText('Dữ liệu sẽ bị xóa vĩnh viễn.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeTruthy();
    
    const confirmBtn = screen.getByRole('button', { name: 'Xóa' });
    expect(confirmBtn).toBeTruthy();
    // Verify red background styling for danger variant
    expect(confirmBtn.className).toContain('bg-rose-600');
  });

  it('triggers onConfirm when confirm button is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Xóa mục này?"
        confirmText="Xóa"
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when cancel or close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Xác nhận?"
        cancelText="Hủy"
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('renders loading indicator and disables actions when isLoading is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Xóa mục này?"
        confirmText="Xóa"
        isLoading={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Đang xử lý...')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Đang xử lý...' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

