export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateCredential = (value: string): ValidationResult => {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Vui lòng nhập email hoặc số điện thoại.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;

  if (!emailRegex.test(value.trim()) && !phoneRegex.test(value.trim())) {
    return {
      isValid: false,
      error: 'Vui lòng nhập email hợp lệ hoặc số điện thoại 10 chữ số.',
    };
  }

  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Vui lòng nhập mật khẩu.' };
  }
  if (password.length < 8) {
    return { isValid: false, error: 'Mật khẩu phải có ít nhất 8 ký tự.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Mật khẩu phải bao gồm ít nhất 1 chữ cái và 1 chữ số.',
    };
  }
  return { isValid: true };
};
