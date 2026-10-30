/// Mô hình dữ liệu gửi lên API xác thực OTP
class VerifyOtpRequest {
  final String email;
  final String code;
  final String purpose; // 'REGISTER' hoặc 'LOGIN_2FA'

  const VerifyOtpRequest({
    required this.email,
    required this.code,
    this.purpose = 'REGISTER',
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email.trim().toLowerCase(),
      'code': code.trim(),
      'purpose': purpose,
    };
  }
}
