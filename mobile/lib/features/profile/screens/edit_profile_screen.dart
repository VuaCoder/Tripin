import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../auth/screens/verify_otp_screen.dart';
import '../../auth/widgets/auth_text_field.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../models/user_profile_model.dart';

class EditProfileScreen extends StatefulWidget {
  final UserProfileModel initialUser;

  const EditProfileScreen({super.key, required this.initialUser});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  final ImagePicker _picker = ImagePicker();
  bool _isSendingOtp = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialUser.fullName);
    _phoneController = TextEditingController(text: widget.initialUser.phone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _startVerification(UserProfileModel user) async {
    setState(() => _isSendingOtp = true);
    try {
      final apiClient = ApiClient();
      await apiClient.post(
        ApiEndpoints.resendOtp,
        data: {
          'email': user.email.trim().toLowerCase(),
          'purpose': 'REGISTER',
        },
      );
      if (!mounted) return;
      setState(() => _isSendingOtp = false);

      final result = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => VerifyOtpScreen(
            email: user.email,
            role: user.role,
            returnOnSuccess: true,
          ),
        ),
      );

      if (result == true && mounted) {
        context.read<ProfileBloc>().add(const ProfileLoadRequested());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Xác thực tài khoản thành công!'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSendingOtp = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể gửi mã xác thực: $e'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _pickAvatar() async {
    final pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1024,
    );
    if (pickedFile != null && mounted) {
      context.read<ProfileBloc>().add(AvatarUploadRequested(File(pickedFile.path)));
    }
  }

  void _submitUpdate() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<ProfileBloc>().add(
            ProfileUpdateRequested(
              fullName: _nameController.text.trim(),
              phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Chỉnh sửa thông tin',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: BlocConsumer<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileUpdateSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: AppColors.success,
                behavior: SnackBarBehavior.floating,
              ),
            );
          } else if (state is ProfileFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.error),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          final isLoading = state is ProfileLoading;
          final user = (state is ProfileLoaded)
              ? state.user
              : (state is ProfileUpdateSuccess)
                  ? state.user
                  : widget.initialUser;

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  // Avatar with edit badge
                  Center(
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 54,
                          backgroundColor: AppColors.primarySurface,
                          child: ClipOval(
                            child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: user.avatarUrl!,
                                    width: 108,
                                    height: 108,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => const CircularProgressIndicator(strokeWidth: 2),
                                    errorWidget: (context, url, error) => const Icon(
                                      Icons.person,
                                      size: 54,
                                      color: AppColors.primary,
                                    ),
                                  )
                                : const Icon(
                                    Icons.person,
                                    size: 54,
                                    color: AppColors.primary,
                                  ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: InkWell(
                            onTap: isLoading ? null : _pickAvatar,
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2.5),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.15),
                                    blurRadius: 6,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.camera_alt,
                                size: 18,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: isLoading ? null : _pickAvatar,
                    icon: const Icon(Icons.photo_library_outlined, size: 18, color: AppColors.primary),
                    label: const Text(
                      'Đổi ảnh đại diện',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Verification Status Banner
                  if (user.isVerified == true)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFA7F3D0), width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF64748B).withValues(alpha: 0.08),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.verified_user_rounded, color: AppColors.success, size: 22),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Tài khoản đã xác thực',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF065F46),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Email của bạn đã được xác thực an toàn.',
                                  style: TextStyle(fontSize: 12, color: Color(0xFF047857)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFDE68A), width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF64748B).withValues(alpha: 0.10),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFEF3C7),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.shield_outlined, color: Color(0xFFD97706), size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Tài khoản chưa xác thực',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF92400E),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Xác thực email để bảo vệ tài khoản và mở khóa đầy đủ tính năng.',
                                      style: const TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            height: 44,
                            child: ElevatedButton.icon(
                              onPressed: _isSendingOtp ? null : () => _startVerification(user),
                              icon: _isSendingOtp
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Icon(Icons.verified_rounded, size: 18, color: Colors.white),
                              label: Text(
                                _isSendingOtp ? 'Đang gửi mã...' : 'Xác thực tài khoản',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Colors.white,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFD97706),
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 24),

                  // Họ và tên
                  AuthTextField(
                    controller: _nameController,
                    label: 'Họ và tên',
                    hintText: 'Nhập họ và tên đầy đủ',
                    prefixIcon: Icons.badge_outlined,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Vui lòng nhập họ và tên';
                      }
                      if (val.trim().length < 2) {
                        return 'Họ tên tối thiểu 2 ký tự';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Email (Read-only)
                  AuthTextField(
                    controller: TextEditingController(text: user.email),
                    label: 'Địa chỉ Email (Không thể thay đổi)',
                    hintText: user.email,
                    prefixIcon: Icons.email_outlined,
                    enabled: false,
                  ),
                  const SizedBox(height: 16),

                  // Số điện thoại
                  AuthTextField(
                    controller: _phoneController,
                    label: 'Số điện thoại',
                    hintText: 'Ví dụ: 0912345678',
                    keyboardType: TextInputType.phone,
                    prefixIcon: Icons.phone_outlined,
                    validator: (val) {
                      if (val != null && val.trim().isNotEmpty) {
                        final regex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
                        if (!regex.hasMatch(val.trim())) {
                          return 'Số điện thoại không hợp lệ';
                        }
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 32),

                  // Nút Lưu thay đổi
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _submitUpdate,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Lưu thay đổi',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}