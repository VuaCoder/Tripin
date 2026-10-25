import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/features/auth/types';
vi.mock('@/features/premium/api', () => ({ useMyPremiumQuery: () => ({currentData:{active:false,endsAt:null,expired:false},refetch:vi.fn()}) }));

const mockUseGetMeQuery = vi.fn();
const mockUpdateMe = vi.fn();
const mockCreateLicenseSignature = vi.fn();
const mockCompleteLicenseUpload = vi.fn();
const mockUploadImage = vi.fn();

vi.mock('@/features/traveler-account/api/profileApi', () => ({
  useGetMeQuery: () => mockUseGetMeQuery(),
  useUpdateMeMutation: () => [mockUpdateMe, { isLoading: false }],
  useCreateLicenseUploadSignatureMutation: () => [mockCreateLicenseSignature, { isLoading: false }],
  useCompleteLicenseUploadMutation: () => [mockCompleteLicenseUpload, { isLoading: false }],
}));

vi.mock('@/features/traveler-account/api/avatarUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/traveler-account/api/avatarUpload')>()),
  uploadImageToCloudinary: (...args: unknown[]) => mockUploadImage(...args),
}));

vi.mock('@/features/traveler-account/components', () => ({
  ProfileSkeleton: () => <div>Đang tải...</div>,
  AvatarPreview: () => <div data-testid="guide-avatar" />,
}));

import { GuideProfilePage } from '../components/GuideProfilePage';
import authReducer from '@/features/auth/store/authSlice';

const guide: UserProfile = {
  id: 'guide-1',
  email: 'guide@tripri.vn',
  fullName: 'Trần Hướng Dẫn',
  phone: '0901234567',
  role: 'TOUR_GUIDE',
  status: 'ACTIVE',
  permissions: [],
  extraPermissions: [],
  twoFactorEnabled: false,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  guideProfile: {
    bio: 'Xin chào',
    languages: ['Tiếng Việt'],
    specialties: ['Trekking'],
    experienceYears: 5,
    licenseNumber: 'GPL-123',
  },
};

const renderPage = (ui: ReactElement) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(<Provider store={store}>{ui}</Provider>);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GuideProfilePage', () => {
  it('shows the signed-in guide profile', () => {
    mockUseGetMeQuery.mockReturnValue({ data: { success: true, data: guide }, isLoading: false, isError: false, refetch: vi.fn() });

    renderPage(<GuideProfilePage />);

    expect(screen.getByText('Hồ sơ Hướng dẫn viên')).toBeTruthy();
    expect(screen.getByText('Trần Hướng Dẫn')).toBeTruthy();
    expect(screen.getByText('guide@tripri.vn')).toBeTruthy();
    expect(screen.getByText('5 năm')).toBeTruthy();
  });

  it('shows an error state when the profile cannot be loaded', () => {
    const refetch = vi.fn();
    mockUseGetMeQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });

    renderPage(<GuideProfilePage />);

    expect(screen.getByText('Không thể tải hồ sơ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('saves only the edited fields, including the guide profile section', async () => {
    mockUseGetMeQuery.mockReturnValue({ data: { success: true, data: guide }, isLoading: false, isError: false, refetch: vi.fn() });
    mockUpdateMe.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: { ...guide, guideProfile: { ...guide.guideProfile, bio: 'Rất vui được đồng hành' } } }),
    });

    renderPage(<GuideProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh sửa/ }));
    fireEvent.change(screen.getByLabelText('Giới thiệu'), { target: { value: 'Rất vui được đồng hành' } });
    fireEvent.change(screen.getByLabelText('Ngôn ngữ'), { target: { value: 'Tiếng Việt, English' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(mockUpdateMe).toHaveBeenCalledWith({
        guideProfile: { bio: 'Rất vui được đồng hành', languages: ['Tiếng Việt', 'English'] },
      }),
    );
    expect(await screen.findByText('Thông tin hồ sơ đã được cập nhật.')).toBeTruthy();
  });

  it('refuses a name that is too short without calling the API', () => {
    mockUseGetMeQuery.mockReturnValue({ data: { success: true, data: guide }, isLoading: false, isError: false, refetch: vi.fn() });

    renderPage(<GuideProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /Chỉnh sửa/ }));
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(screen.getByText('Họ tên phải từ 2 đến 120 ký tự.')).toBeTruthy();
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('saves a pasted license image link and refuses a non-http one', () => {
    mockUseGetMeQuery.mockReturnValue({ data: { success: true, data: guide }, isLoading: false, isError: false, refetch: vi.fn() });
    mockUpdateMe.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, data: guide }) });

    renderPage(<GuideProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: /Chỉnh sửa/ }));

    fireEvent.change(screen.getByLabelText('Hoặc dán link ảnh'), { target: { value: 'not-a-link' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByText('Link ảnh phải bắt đầu bằng http:// hoặc https://.')).toBeTruthy();
    expect(mockUpdateMe).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Hoặc dán link ảnh'), { target: { value: 'https://example.com/gp.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    return waitFor(() =>
      expect(mockUpdateMe).toHaveBeenCalledWith({ guideProfile: { licenseImageUrl: 'https://example.com/gp.jpg' } }),
    );
  });

  it('uploads a chosen license image and stores the verified url', async () => {
    mockUseGetMeQuery.mockReturnValue({ data: { success: true, data: guide }, isLoading: false, isError: false, refetch: vi.fn() });
    mockCreateLicenseSignature.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: { publicId: 'tripin/guides/licenses/guide-1' } }),
    });
    mockUploadImage.mockResolvedValue({ publicId: 'tripin/guides/licenses/guide-1' });
    mockCompleteLicenseUpload.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { ...guide, guideProfile: { ...guide.guideProfile, licenseImageUrl: 'https://res.cloudinary.com/demo/gp.jpg' } } }),
    });
    // jsdom has no object-URL support, and the form previews the chosen file with one.
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });

    renderPage(<GuideProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: /Chỉnh sửa/ }));

    const file = new File(['x'], 'gp.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Ảnh giấy phép hành nghề'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(mockCompleteLicenseUpload).toHaveBeenCalledWith({ publicId: 'tripin/guides/licenses/guide-1' }));
    expect(mockUploadImage).toHaveBeenCalledWith(file, expect.anything());
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });
});
