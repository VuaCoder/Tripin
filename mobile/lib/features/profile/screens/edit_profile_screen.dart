import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/app_colors.dart';
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