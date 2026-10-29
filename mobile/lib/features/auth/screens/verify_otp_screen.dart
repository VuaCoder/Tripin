import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/otp_bloc.dart';
import '../bloc/otp_event.dart';
import '../bloc/otp_state.dart';
import '../widgets/otp_input_field.dart';
import '../../navigation/guide_main_navigation_screen.dart';
import '../../navigation/traveler_main_navigation_screen.dart';

/// Màn hình nhập mã xác thực OTP 6 số (AC3, AC4, AC5)
class VerifyOtpScreen extends StatelessWidget {
  final String email;
  final String role;
  final bool returnOnSuccess;

  const VerifyOtpScreen({
    super.key,
    required this.email,
    required this.role,
    this.returnOnSuccess = false,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => OtpBloc()..add(const OtpStarted(duration: 60)),
      child: _VerifyOtpView(
        email: email,
        role: role,
        returnOnSuccess: returnOnSuccess,
      ),
    );
  }
}

class _VerifyOtpView extends StatefulWidget {
  final String email;
  final String role;
  final bool returnOnSuccess;

  const _VerifyOtpView({
    required this.email,
    required this.role,
    this.returnOnSuccess = false,
  });

  @override
  State<_VerifyOtpView> createState() => _VerifyOtpViewState();
}

class _VerifyOtpViewState extends State<_VerifyOtpView> {
  String _currentCode = '';

  void _onOtpCompleted(String code) {
    setState(() => _currentCode = code);
    context.read<OtpBloc>().add(
          OtpSubmitted(
            email: widget.email,
            code: code,
            purpose: 'REGISTER',
          ),
        );
  }

  void _onResendPressed() {
    context.read<OtpBloc>().add(
          OtpResendRequested(
            email: widget.email,
            purpose: 'REGISTER',
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<OtpBloc, OtpState>(
      listener: (context, state) {
        if (state.isSuccess) {
          final targetRole = state.userRole ?? widget.role;
          final userName = state.userName ?? 'Người dùng Tripri';

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Xác thực thành công! Chào mừng $userName đến với Tripri.'),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );

          if (widget.returnOnSuccess) {
            Navigator.of(context).pop(true);
            return;
          }

          if (targetRole == 'TOUR_GUIDE') {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const GuideMainNavigationScreen()),
              (route) => false,
            );
          } else {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const TravelerMainNavigationScreen()),
              (route) => false,
            );
          }
        }

        if (state.lastResentMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.lastResentMessage!),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      builder: (context, state) {
        final hasError = state.errorMessage != null;

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
          ),
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Icon bảo mật
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primaryLight.withValues(alpha: 0.3), width: 1.5),
                    ),
                    child: const Icon(
                      Icons.mark_email_read_outlined,
                      size: 36,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Tiêu đề
                  const Text(
                    'Xác thực tài khoản',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Mô tả email
                  Text(
                    'Mã kích hoạt 6 chữ số đã được gửi đến email:',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      widget.email,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // 6 ô nhập mã OTP
                  OtpInputField(
                    length: 6,
                    hasError: hasError,
                    onCompleted: _onOtpCompleted,
                    onChanged: (val) => setState(() => _currentCode = val),
                  ),
                  const SizedBox(height: 16),

                  // Hiển thị lỗi nếu có (AC5)
                  if (hasError)
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
                              state.errorMessage!,
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

                  const SizedBox(height: 24),

                  // Nút Xác thực thủ công (khi đã nhập đủ 6 số)
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: (_currentCode.length == 6 && !state.isSubmitting)
                          ? () => _onOtpCompleted(_currentCode)
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: state.isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              'Xác thực và kích hoạt',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Đồng hồ đếm lùi và nút Gửi lại mã (AC3)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Chưa nhận được mã? ',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (state.remainingSeconds > 0)
                        Text(
                          'Gửi lại sau (${state.remainingSeconds}s)',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textMuted,
                          ),
                        )
                      else
                        TextButton(
                          onPressed: state.isResending ? null : _onResendPressed,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(50, 30),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: state.isResending
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text(
                                  'Gửi lại mã OTP',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primaryLight,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
