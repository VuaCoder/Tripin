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

export const validateFullName = (fullName: string): ValidationResult => {
  if (!fullName || !fullName.trim()) {
    return { isValid: false, error: 'Vui lòng nhập họ và tên.' };
  }
  if (fullName.trim().length < 2) {
    return { isValid: false, error: 'Họ và tên phải có ít nhất 2 ký tự.' };
  }
  return { isValid: true };
};

export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Vui lòng nhập địa chỉ email.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Địa chỉ email không hợp lệ.' };
  }
  return { isValid: true };
};

export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Vui lòng nhập số điện thoại.' };
  }
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!phoneRegex.test(phone.trim())) {
    return { isValid: false, error: 'Số điện thoại 10 chữ số không hợp lệ.' };
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

export const validateConfirmPassword = (password: string, confirmPassword: string): ValidationResult => {
  if (!confirmPassword) {
    return { isValid: false, error: 'Vui lòng xác nhận lại mật khẩu.' };
  }
  if (password !== confirmPassword) {
    return { isValid: false, error: 'Mật khẩu xác nhận không trùng khớp.' };
  }
  return { isValid: true };
};
