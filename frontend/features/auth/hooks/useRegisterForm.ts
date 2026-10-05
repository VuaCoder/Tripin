'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import {
  validateFullName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
} from '../utils/validation';
import { useRegisterMutation } from '../api/authApi';
import { getApiErrorCode, getApiErrorMessage } from '../utils/apiError';
import { RegisterableRole, RegisterFormValues, RegisterResultData } from '../types';

interface UseRegisterFormProps {
  role?: RegisterableRole;
  onSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
}

const DEFAULT_ERROR_MESSAGE = 'Đăng ký tài khoản không thành công. Vui lòng thử lại.';

const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.';

/** Vietnamese copy for the backend error codes this form knows how to place. */
const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Dữ liệu đăng ký không hợp lệ. Vui lòng kiểm tra lại thông tin.',
  OTP_RESEND_TOO_SOON: 'Bạn vừa yêu cầu mã xác thực. Vui lòng đợi khoảng 1 phút rồi thử lại.',
  ACCOUNT_BANNED: 'Tài khoản này đã bị khoá. Vui lòng liên hệ bộ phận hỗ trợ.',
};

export function useRegisterForm({ role = 'TRAVELER', onSuccess, onError }: UseRegisterFormProps = {}) {
  const [formData, setFormData] = useState<RegisterFormValues>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [register] = useRegisterMutation();

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear validation error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const fullNameVal = validateFullName(formData.fullName);
    const emailVal = validateEmail(formData.email);
    const phoneVal = validatePhone(formData.phone);
    const passVal = validatePassword(formData.password);
    const confirmPassVal = validateConfirmPassword(formData.password, formData.confirmPassword);

    const newErrors: typeof errors = {};
    if (!fullNameVal.isValid) newErrors.fullName = fullNameVal.error;
    if (!emailVal.isValid) newErrors.email = emailVal.error;
    if (!phoneVal.isValid) newErrors.phone = phoneVal.error;
    if (!passVal.isValid) newErrors.password = passVal.error;
    if (!confirmPassVal.isValid) newErrors.confirmPassword = confirmPassVal.error;

    setErrors(newErrors);
    return Boolean(
      fullNameVal.isValid &&
        emailVal.isValid &&
        phoneVal.isValid &&
        passVal.isValid &&
        confirmPassVal.isValid
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const data = await register({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role ?? role,
      }).unwrap();

      onSuccess?.(data);
    } catch (err) {
      const code = getApiErrorCode(err);

      // A taken email belongs on the email field so the user sees exactly what to fix.
      if (code === 'EMAIL_ALREADY_REGISTERED') {
        setErrors((prev) => ({ ...prev, email: EMAIL_ALREADY_REGISTERED_MESSAGE }));
        onError?.(EMAIL_ALREADY_REGISTERED_MESSAGE);
        return;
      }

      const message =
        (code && REGISTER_ERROR_MESSAGES[code]) || getApiErrorMessage(err, DEFAULT_ERROR_MESSAGE);
      setErrors((prev) => ({ ...prev, general: message }));
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    // Tích hợp Google OAuth Register / Sign up (chưa có client ID).
    // Role được giữ sẵn để luồng Google thật gửi kèm khi tài khoản được tạo mới.
    console.log('Initiating Google Register...', { role: formData.role ?? role });
  };

  return {
    formData,
    showPassword,
    showConfirmPassword,
    errors,
    isLoading,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    handleInputChange,
    handleSubmit,
    handleGoogleRegister,
  };
}
