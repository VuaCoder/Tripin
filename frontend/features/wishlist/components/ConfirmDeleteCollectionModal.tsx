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
      title="Xóa Danh sách yêu thích này?"
      description={`Danh sách "${collectionName}" cũng sẽ bị xóa vĩnh viễn đối với tất cả những người mà bạn đã chia sẻ danh sách này.`}
      cancelText="Hủy"
      confirmText="Xóa"
      variant="danger"
    />
  );
}

export default ConfirmDeleteCollectionModal;
