'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { validateCredential, validatePassword } from '../utils/validation';
import { authApi } from '../api/authApi';
import { LoginFormValues, LoginResultData } from '../types';

interface UseLoginFormProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
}

export function useLoginForm({ onSuccess, onError }: UseLoginFormProps = {}) {
  const [formData, setFormData] = useState<LoginFormValues>({
    credential: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ credential?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

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
      const response = await authApi.login(formData);
      if (response.success && response.data) {
        onSuccess?.(response.data);
      }
    } catch (err: any) {
      const message = err.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
      setErrors((prev) => ({ ...prev, general: message }));
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    showPassword,
    errors,
    isLoading,
    togglePasswordVisibility,
    handleInputChange,
    handleSubmit,
  };
}
