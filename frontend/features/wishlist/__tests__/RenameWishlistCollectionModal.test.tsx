import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RenameWishlistCollectionModal } from '../components/RenameWishlistCollectionModal';

describe('RenameWishlistCollectionModal', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders correctly with current name and character counter', () => {
    render(
      <RenameWishlistCollectionModal
        isOpen={true}
        currentName="aaa"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Đổi tên Danh sách yêu thích')).toBeTruthy();
    const input = screen.getByDisplayValue('aaa');
    expect(input).toBeTruthy();
    expect(screen.getByText('3/50 ký tự')).toBeTruthy();
  });

  it('calls onSave with trimmed new name when valid and changed', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <RenameWishlistCollectionModal
        isOpen={true}
        currentName="aaa"
        onClose={handleClose}
        onSave={handleSave}
      />,
    );

    const input = screen.getByDisplayValue('aaa');
    fireEvent.change(input, { target: { value: 'Du lịch hè' } });

    const saveButton = screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);

    expect(handleSave).toHaveBeenCalledWith('Du lịch hè');
    expect(handleClose).toHaveBeenCalled();
  });

  it('disables save button when name is unchanged or empty', () => {
    render(
      <RenameWishlistCollectionModal
        isOpen={true}
        currentName="aaa"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const input = screen.getByDisplayValue('aaa');
    fireEvent.change(input, { target: { value: '' } });
    expect(saveButton.disabled).toBe(true);
  });

  it('clears input when clicking clear button', () => {
    render(
      <RenameWishlistCollectionModal
        isOpen={true}
        currentName="aaa"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const clearButton = screen.getByRole('button', { name: 'Xóa nội dung' });
    fireEvent.click(clearButton);

    const input = screen.getByPlaceholderText('Tên danh sách') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText('0/50 ký tự')).toBeTruthy();
  });
});
