/// Mô hình dữ liệu gửi lên API đăng ký tài khoản
class RegisterRequest {
  final String email;
  final String password;
  final String fullName;
  final String? phone;
  final String role; // 'TRAVELER' hoặc 'TOUR_GUIDE'

  const RegisterRequest({
    required this.email,
    required this.password,
    required this.fullName,
    this.phone,
    required this.role,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'email': email.trim().toLowerCase(),
      'password': password,
      'fullName': fullName.trim(),
      'role': role,
    };
    if (phone != null && phone!.trim().isNotEmpty) {
      map['phone'] = phone!.trim();
    }
    return map;
  }
}
