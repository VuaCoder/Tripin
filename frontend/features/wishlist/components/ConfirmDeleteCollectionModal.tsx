'use client';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export interface ConfirmDeleteCollectionModalProps {
  isOpen: boolean;
  collectionName: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a wishlist collection/folder.
 * Uses shared ConfirmDialog with red "Xóa" button.
 */
export function ConfirmDeleteCollectionModal({
  isOpen,
  collectionName,
  onClose,
  onConfirm,
}: ConfirmDeleteCollectionModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        onConfirm();
        onClose();
      }}
      title="Xóa danh sách yêu thích này?"
      description={
        <>
          Danh sách <strong className="font-bold text-slate-900 break-words">{collectionName}</strong> sẽ bị xóa.
          {' '}Bạn có thể tạo danh sách mới và lưu lại các tour bất cứ lúc nào.
        </>
      }
      cancelText="Hủy"
      confirmText="Xóa"
      variant="danger"
    />
  );
}

export default ConfirmDeleteCollectionModal;
