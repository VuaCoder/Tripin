'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import {
  validateFullName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
} from '../utils/validation';
import { authApi } from '../api/authApi';
import { RegisterFormValues, RegisterResultData } from '../types';

interface UseRegisterFormProps {
  onSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
}

export function useRegisterForm({ onSuccess, onError }: UseRegisterFormProps = {}) {
  const [formData, setFormData] = useState<RegisterFormValues>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'TRAVELER',
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
    if (isLoading) return;
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await authApi.register({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: 'TRAVELER',
      });

      if (response.success && response.data) {
        onSuccess?.(response.data);
      }
    } catch (err: any) {
      let message = err.message || 'Đăng ký tài khoản không thành công. Vui lòng thử lại.';
      if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
        message = 'Bạn đã thực hiện quá nhiều thao tác trong thời gian ngắn. Vui lòng đợi ít phút rồi thử lại.';
      }
      setErrors((prev) => ({ ...prev, general: message }));
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    // Tích hợp Google OAuth Register / Sign up
    console.log('Initiating Google Register...');
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
