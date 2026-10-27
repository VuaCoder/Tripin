import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/register_bloc.dart';
import '../bloc/register_event.dart';
import '../bloc/register_state.dart';
import '../models/register_request.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/password_strength_bar.dart';
import 'verify_otp_screen.dart';

/// [FLOW-01] Luồng 1A: Màn hình Đăng ký Du khách (Traveler)
class RegisterTravelerScreen extends StatelessWidget {
  const RegisterTravelerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => RegisterBloc(),
      child: const _RegisterTravelerView(),
    );
  }
}

class _RegisterTravelerView extends StatefulWidget {
  const _RegisterTravelerView();

  @override
  State<_RegisterTravelerView> createState() => _RegisterTravelerViewState();
}

class _RegisterTravelerViewState extends State<_RegisterTravelerView> {
  final _formKey = GlobalKey<FormState>();

  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String _currentPassword = '';

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onRegisterPressed() {
    if (!_formKey.currentState!.validate()) return;

    final request = RegisterRequest(
      fullName: _fullNameController.text,
      email: _emailController.text,
      phone: _phoneController.text.isNotEmpty ? _phoneController.text : null,
      password: _passwordController.text,
      role: 'TRAVELER',
    );

    context.read<RegisterBloc>().add(RegisterSubmitted(request));
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<RegisterBloc, RegisterState>(
      listener: (context, state) {
        if (state is RegisterSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => VerifyOtpScreen(
                email: state.email,
                role: state.role,
              ),
            ),
          );
        }
      },
      builder: (context, state) {
        final isLoading = state is RegisterLoading;
        final errorMessage = state is RegisterFailure ? state.errorMessage : null;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, size: 20),
              color: AppColors.textPrimary,
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: const Text(
              'Đăng ký Du khách',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tiêu đề & mô tả
                    const Text(
                      'Tạo tài khoản Tripri',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Khám phá hàng trăm tour du lịch hấp dẫn và quản lý chuyến đi dễ dàng.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Banner thông báo lỗi nếu có
                    if (errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.errorSurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                errorMessage,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.error,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Họ và tên
                    AuthTextField(
                      controller: _fullNameController,
                      label: 'Họ và tên',
                      hintText: 'Nhập họ và tên đầy đủ',
                      prefixIcon: Icons.person_outline,
                      enabled: !isLoading,
                      validator: (val) {
                        if (val == null || val.trim().length < 2) {
                          return 'Vui lòng nhập họ và tên tối thiểu 2 ký tự';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Email
                    AuthTextField(
                      controller: _emailController,
                      label: 'Địa chỉ Email',
                      hintText: 'example@email.com',
                      prefixIcon: Icons.mail_outline,
                      keyboardType: TextInputType.emailAddress,
                      enabled: !isLoading,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Vui lòng nhập địa chỉ email';
                        }
                        final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                        if (!emailRegex.hasMatch(val.trim())) {
                          return 'Định dạng email không hợp lệ';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Số điện thoại
                    AuthTextField(
                      controller: _phoneController,
                      label: 'Số điện thoại',
                      hintText: 'Nhập số điện thoại liên hệ',
                      prefixIcon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                      enabled: !isLoading,
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty) {
                          final phoneRegex = RegExp(r'^\+?[0-9 ().-]{9,15}$');
                          if (!phoneRegex.hasMatch(val.trim())) {
                            return 'Số điện thoại không hợp lệ (từ 9-15 chữ số)';
                          }
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Mật khẩu
                    AuthTextField(
                      controller: _passwordController,
                      label: 'Mật khẩu',
                      hintText: 'Tối thiểu 8 ký tự (gồm chữ và số)',
                      prefixIcon: Icons.lock_outline,
                      obscureText: _obscurePassword,
                      enabled: !isLoading,
                      onChanged: (val) => setState(() => _currentPassword = val),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      validator: (val) {
                        if (val == null || val.length < 8) {
                          return 'Mật khẩu phải có tối thiểu 8 ký tự';
                        }
                        if (!RegExp(r'[A-Za-z]').hasMatch(val)) {
                          return 'Mật khẩu phải chứa ít nhất 1 chữ cái';
                        }
                        if (!RegExp(r'\d').hasMatch(val)) {
                          return 'Mật khẩu phải chứa ít nhất 1 chữ số';
                        }
                        return null;
                      },
                    ),

                    // Thanh đo độ mạnh mật khẩu (AC1)
                    PasswordStrengthBar(password: _currentPassword),
                    const SizedBox(height: 16),

                    // Xác nhận mật khẩu
                    AuthTextField(
                      controller: _confirmPasswordController,
                      label: 'Xác nhận mật khẩu',
                      hintText: 'Nhập lại mật khẩu vừa tạo',
                      prefixIcon: Icons.lock_reset_outlined,
                      obscureText: _obscureConfirmPassword,
                      enabled: !isLoading,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) {
                          return 'Vui lòng xác nhận lại mật khẩu';
                        }
                        if (val != _passwordController.text) {
                          return 'Mật khẩu xác nhận không trùng khớp';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 28),

                    // Nút Đăng ký
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: isLoading ? null : _onRegisterPressed,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text(
                                'Đăng ký tài khoản',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Chuyển sang đăng nhập
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Đã có tài khoản? ',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: const Text(
                            'Đăng nhập ngay',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primaryLight,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
