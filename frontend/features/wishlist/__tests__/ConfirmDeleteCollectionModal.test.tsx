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

    expect(screen.getByText('Xóa Danh sách yêu thích này?')).toBeDefined();
    expect(
      screen.getByText(
        'Danh sách "HUẾ" cũng sẽ bị xóa vĩnh viễn đối với tất cả những người mà bạn đã chia sẻ danh sách này.',
      ),
    ).toBeDefined();

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

    expect(screen.getByText('Xóa Danh sách yêu thích này?')).toBeDefined();
    expect(
      screen.getByText(
        'Danh sách "ĐÀ NẴNG" cũng sẽ bị xóa vĩnh viễn đối với tất cả những người mà bạn đã chia sẻ danh sách này.',
      ),
    ).toBeDefined();
  });
});
