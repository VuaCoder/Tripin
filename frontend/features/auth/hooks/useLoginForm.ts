'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateCredential, validatePassword } from '../utils/validation';
import { useLoginMutation } from '../api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '../store/authSlice';
import { getApiErrorCode, getApiErrorMessage } from '../utils/apiError';
import { LoginFormValues, LoginResultData } from '../types';

interface UseLoginFormProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
}

export function useLoginForm({ onSuccess, onError }: UseLoginFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<LoginFormValues>({
    credential: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ credential?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useAppDispatch();
  const [login] = useLoginMutation();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setFormData((prev) => ({ ...prev, credential: emailParam }));
    }
  }, [searchParams]);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear validation error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const credValidation = validateCredential(formData.credential);
    const passValidation = validatePassword(formData.password);

    const newErrors: { credential?: string; password?: string } = {};
    if (!credValidation.isValid) {
      newErrors.credential = credValidation.error;
    }
    if (!passValidation.isValid) {
      newErrors.password = passValidation.error;
    }

    setErrors(newErrors);
    return credValidation.isValid && passValidation.isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const data = await login({ email: formData.credential, password: formData.password }).unwrap();
      if (!data.twoFactorRequired) {
        dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      }
      onSuccess?.(data);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Đăng nhập không thành công. Vui lòng thử lại.');

      // Tài khoản chưa xác thực email → đưa sang trang OTP (giữ hành vi từ main)
      if (getApiErrorCode(err) === 'ACCOUNT_NOT_VERIFIED') {
        router.push(`/verify-otp?email=${encodeURIComponent(formData.credential)}&purpose=REGISTER`);
        return;
      }
      setErrors((prev) => ({ ...prev, general: message }));
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Tích hợp Google OAuth Client ID Token
    console.log('Initiating Google Login...');
  };

  return {
    formData,
    showPassword,
    errors,
    isLoading,
    togglePasswordVisibility,
    handleInputChange,
    handleSubmit,
    handleGoogleLogin,
    searchParams,
  };
}
