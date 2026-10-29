import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../models/user_profile_model.dart';

class EditProfileScreen extends StatefulWidget {
  final UserProfileModel initialUser;
  final bool openChangePasswordDirectly;

  const EditProfileScreen({
    super.key,
    required this.initialUser,
    this.openChangePasswordDirectly = false,
  });

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _dreamDestinationController;
  late final TextEditingController _workController;
  late final TextEditingController _skillController;
  late final TextEditingController _petsController;
  late final TextEditingController _bioController;

  // Password change controllers
  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  final ImagePicker _picker = ImagePicker();
  bool _showPasswordSection = false;
  bool _obscureCurrentPassword = true;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _showPasswordSection = widget.openChangePasswordDirectly;
    _nameController = TextEditingController(text: widget.initialUser.fullName);
    _phoneController = TextEditingController(text: widget.initialUser.phone ?? '');
    _dreamDestinationController = TextEditingController(text: widget.initialUser.dreamDestination ?? '');
    _workController = TextEditingController(text: widget.initialUser.work ?? '');
    _skillController = TextEditingController(text: widget.initialUser.skill ?? '');
    _petsController = TextEditingController(text: widget.initialUser.pets ?? '');
    _bioController = TextEditingController(text: widget.initialUser.bio ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _dreamDestinationController.dispose();
    _workController.dispose();
    _skillController.dispose();
    _petsController.dispose();
    _bioController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
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

  void _submitProfileUpdate() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<ProfileBloc>().add(
            ProfileUpdateRequested(
              fullName: _nameController.text.trim(),
              phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
              dreamDestination: _dreamDestinationController.text.trim().isEmpty ? null : _dreamDestinationController.text.trim(),
              work: _workController.text.trim().isEmpty ? null : _workController.text.trim(),
              skill: _skillController.text.trim().isEmpty ? null : _skillController.text.trim(),
              pets: _petsController.text.trim().isEmpty ? null : _petsController.text.trim(),
              bio: _bioController.text.trim().isEmpty ? null : _bioController.text.trim(),
            ),
          );
    }
  }

  void _submitPasswordChange() {
    if (_passwordFormKey.currentState?.validate() ?? false) {
      context.read<ProfileBloc>().add(
            ChangePasswordRequested(
              currentPassword: _currentPasswordController.text,
              newPassword: _newPasswordController.text,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileUpdateSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          if (_currentPasswordController.text.isNotEmpty) {
            _currentPasswordController.clear();
            _newPasswordController.clear();
            _confirmPasswordController.clear();
            setState(() => _showPasswordSection = false);
          }
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

        return Scaffold(
          backgroundColor: Colors.white,
          // Airbnb Modal Header
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            leading: const SizedBox.shrink(),
            title: const Text(
              'Chỉnh sửa hồ sơ',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
            centerTitle: true,
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: InkWell(
                  onTap: () => Navigator.of(context).pop(),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF222222)),
                  ),
                ),
              ),
            ],
          ),
          body: SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 1. Airbnb Avatar with Bottom "+ Thêm" Pill
                          Center(
                            child: Stack(
                              alignment: Alignment.bottomCenter,
                              clipBehavior: Clip.none,
                              children: [
                                CircleAvatar(
                                  radius: 56,
                                  backgroundColor: const Color(0xFFDCFCE7),
                                  child: ClipOval(
                                    child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: user.avatarUrl!,
                                            width: 112,
                                            height: 112,
                                            fit: BoxFit.cover,
                                            placeholder: (context, url) =>
                                                const CircularProgressIndicator(strokeWidth: 2),
                                            errorWidget: (context, url, error) => _buildInitialAvatar(user),
                                          )
                                        : _buildInitialAvatar(user),
                                  ),
                                ),
                                Positioned(
                                  bottom: -10,
                                  child: Material(
                                    color: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(24),
                                      side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                                    ),
                                    elevation: 2,
                                    shadowColor: Colors.black.withValues(alpha: 0.15),
                                    child: InkWell(
                                      onTap: isLoading ? null : _pickAvatar,
                                      borderRadius: BorderRadius.circular(24),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.camera_alt_outlined, size: 16, color: Color(0xFF222222)),
                                            const SizedBox(width: 6),
                                            Text(
                                              user.avatarUrl != null && user.avatarUrl!.isNotEmpty ? 'Đổi ảnh' : 'Thêm',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF222222),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 36),

                          // 2. Section "Hồ sơ của tôi" (Airbnb Style Heading & Explanation)
                          const Text(
                            'Hồ sơ của tôi',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF222222),
                              letterSpacing: -0.4,
                            ),
                          ),
                          const SizedBox(height: 6),
                          RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF717171),
                                height: 1.45,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Chủ nhà và du khách có thể thấy hồ sơ của bạn và hồ sơ này có thể xuất hiện trên Tripri để giúp xây dựng lòng tin trong cộng đồng. ',
                                ),
                                TextSpan(
                                  text: 'Tìm hiểu thêm',
                                  style: TextStyle(
                                    decoration: TextDecoration.underline,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF222222),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 28),

                          // 3. Form Fields (Airbnb Style)
                          _buildAirbnbInputField(
                            icon: Icons.person_outline_rounded,
                            label: 'Họ và tên *',
                            hint: 'Nhập họ và tên đầy đủ',
                            controller: _nameController,
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) return 'Vui lòng nhập họ và tên';
                              if (val.trim().length < 2) return 'Họ tên tối thiểu 2 ký tự';
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.phone_outlined,
                            label: 'Số điện thoại',
                            hint: 'Ví dụ: 0912345678',
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            validator: (val) {
                              if (val != null && val.trim().isNotEmpty) {
                                final regex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
                                if (!regex.hasMatch(val.trim())) return 'Số điện thoại không hợp lệ';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.public_rounded,
                            label: 'Điểm đến mơ ước',
                            hint: 'Nơi tôi luôn muốn đặt chân đến',
                            controller: _dreamDestinationController,
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.work_outline_rounded,
                            label: 'Công việc / Nghề nghiệp',
                            hint: 'Công việc hoặc chuyên môn của bạn',
                            controller: _workController,
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.auto_awesome_outlined,
                            label: 'Kỹ năng đặc biệt / Sở thích',
                            hint: 'Kỹ năng vô dụng nhất hoặc sở thích thú vị',
                            controller: _skillController,
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.pets_outlined,
                            label: 'Thú cưng / Phong cách',
                            hint: 'Thú cưng hoặc bạn đồng hành của bạn',
                            controller: _petsController,
                          ),
                          const SizedBox(height: 20),

                          _buildAirbnbInputField(
                            icon: Icons.notes_rounded,
                            label: 'Giới thiệu bản thân (Bio)',
                            hint: 'Chia sẻ ngắn gọn về sở thích du lịch của bạn...',
                            controller: _bioController,
                            maxLines: 3,
                          ),

                          const SizedBox(height: 32),
                          const Divider(height: 1, color: Color(0xFFE2E8F0)),
                          const SizedBox(height: 24),

                          // 4. Section: "Đổi mật khẩu" (Change Password)
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Column(
                                children: [
                                  InkWell(
                                    onTap: () {
                                      setState(() {
                                        _showPasswordSection = !_showPasswordSection;
                                      });
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                                      child: Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: AppColors.primary.withValues(alpha: 0.1),
                                              shape: BoxShape.circle,
                                            ),
                                            child: const Icon(
                                              Icons.lock_reset_rounded,
                                              size: 20,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          const Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Đổi mật khẩu',
                                                  style: TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w700,
                                                    color: Color(0xFF222222),
                                                  ),
                                                ),
                                                SizedBox(height: 2),
                                                Text(
                                                  'Cập nhật mật khẩu bảo vệ tài khoản',
                                                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Icon(
                                            _showPasswordSection
                                                ? Icons.keyboard_arrow_up_rounded
                                                : Icons.keyboard_arrow_down_rounded,
                                            color: const Color(0xFF64748B),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  if (_showPasswordSection)
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
                                      child: Form(
                                        key: _passwordFormKey,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Divider(height: 1, color: Color(0xFFE2E8F0)),
                                            const SizedBox(height: 16),

                                            // Mật khẩu hiện tại
                                            _buildPasswordField(
                                              controller: _currentPasswordController,
                                              label: 'Mật khẩu hiện tại',
                                              obscureText: _obscureCurrentPassword,
                                              onToggleObscure: () => setState(() => _obscureCurrentPassword = !_obscureCurrentPassword),
                                              validator: (val) {
                                                if (val == null || val.isEmpty) return 'Vui lòng nhập mật khẩu hiện tại';
                                                return null;
                                              },
                                            ),
                                            const SizedBox(height: 14),

                                            // Mật khẩu mới
                                            _buildPasswordField(
                                              controller: _newPasswordController,
                                              label: 'Mật khẩu mới (tối thiểu 8 ký tự, có chữ và số)',
                                              obscureText: _obscureNewPassword,
                                              onToggleObscure: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                                              validator: (val) {
                                                if (val == null || val.isEmpty) return 'Vui lòng nhập mật khẩu mới';
                                                if (val.length < 8) return 'Mật khẩu phải từ 8 ký tự trở lên';
                                                if (!RegExp(r'[A-Za-z]').hasMatch(val) || !RegExp(r'\d').hasMatch(val)) {
                                                  return 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số';
                                                }
                                                return null;
                                              },
                                            ),
                                            const SizedBox(height: 14),

                                            // Xác nhận mật khẩu mới
                                            _buildPasswordField(
                                              controller: _confirmPasswordController,
                                              label: 'Xác nhận mật khẩu mới',
                                              obscureText: _obscureConfirmPassword,
                                              onToggleObscure: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                                              validator: (val) {
                                                if (val != _newPasswordController.text) return 'Mật khẩu xác nhận không khớp';
                                                return null;
                                              },
                                            ),
                                            const SizedBox(height: 16),

                                            SizedBox(
                                              width: double.infinity,
                                              height: 44,
                                              child: ElevatedButton(
                                                onPressed: isLoading ? null : _submitPasswordChange,
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: AppColors.primary,
                                                  foregroundColor: Colors.white,
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                  elevation: 0,
                                                ),
                                                child: isLoading
                                                    ? const SizedBox(
                                                        width: 18,
                                                        height: 18,
                                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                                      )
                                                    : const Text(
                                                        'Cập nhật mật khẩu',
                                                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                                      ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                ),

                // 5. Sticky Bottom Action Bar (Image 4 "Done" Button Style)
                Container(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _submitProfileUpdate,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF222222),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : const Text(
                              'Lưu thay đổi',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildInitialAvatar(UserProfileModel user) {
    final initial = user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : 'H';
    return Container(
      width: 112,
      height: 112,
      alignment: Alignment.center,
      color: const Color(0xFFDCFCE7),
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 48,
          fontWeight: FontWeight.w700,
          color: Color(0xFF166534),
        ),
      ),
    );
  }

  Widget _buildAirbnbInputField({
    required IconData icon,
    required String label,
    required String hint,
    required TextEditingController controller,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Padding(
            padding: EdgeInsets.only(top: maxLines > 1 ? 10 : 0),
            child: Icon(icon, size: 22, color: const Color(0xFF475569)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: TextFormField(
              controller: controller,
              maxLines: maxLines,
              keyboardType: keyboardType,
              validator: validator,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B),
              ),
              decoration: InputDecoration(
                border: InputBorder.none,
                isDense: true,
                labelText: label,
                labelStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
                hintText: hint,
                hintStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String label,
    required bool obscureText,
    required VoidCallback onToggleObscure,
    required String? Function(String?) validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        suffixIcon: IconButton(
          icon: Icon(
            obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
            size: 18,
            color: const Color(0xFF64748B),
          ),
          onPressed: onToggleObscure,
        ),
      ),
    );
  }
}