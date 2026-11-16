import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ConfirmDeleteCollectionModal } from '../components/ConfirmDeleteCollectionModal';
import DefaultConfirmDeleteCollectionModal from '../components/ConfirmDeleteCollectionModal';

describe('ConfirmDeleteCollectionModal', () => {
  afterEach(cleanup);

  it('renders title, collection name, and actions properly', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteCollectionModal
        isOpen={true}
        collectionName="HUẾ"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Xóa danh sách yêu thích này?')).toBeDefined();
    const name = screen.getByText('HUẾ');
    expect(name.tagName).toBe('STRONG');
    expect(name.parentElement?.textContent).toBe(
      'Danh sách HUẾ sẽ bị xóa. Bạn có thể tạo danh sách mới và lưu lại các tour bất cứ lúc nào.',
    );
    expect(screen.queryByText(/đã chia sẻ/)).toBeNull();

    const cancelButton = screen.getByRole('button', { name: 'Hủy' });
    expect(cancelButton).toBeDefined();

    const deleteButton = screen.getByRole('button', { name: 'Xóa' });
    expect(deleteButton).toBeDefined();
    // Verify it uses red styling
    expect(deleteButton.className).toContain('bg-rose-600');

    fireEvent.click(deleteButton);
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('works with default import as well', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DefaultConfirmDeleteCollectionModal
        isOpen={true}
        collectionName="ĐÀ NẴNG"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Xóa danh sách yêu thích này?')).toBeDefined();
    expect(screen.getByText('ĐÀ NẴNG').tagName).toBe('STRONG');
  });
});
