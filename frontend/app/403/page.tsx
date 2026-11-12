import { ForbiddenPage } from '@/components/shared';

export const metadata = {
  title: '403 - Quyền truy cập bị từ chối | Tripri',
  description: 'Bạn không có quyền truy cập khu vực này trên hệ thống Tripri.',
};

export default function Page() {
  return <ForbiddenPage />;
}

