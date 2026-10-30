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

class GuideProfileScreen extends StatefulWidget {
  final UserProfileModel user;

  const GuideProfileScreen({super.key, required this.user});

  @override
  State<GuideProfileScreen> createState() => _GuideProfileScreenState();
}

class _GuideProfileScreenState extends State<GuideProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _licenseNumberController;
  late final TextEditingController _yearsController;
  late final TextEditingController _bioController;
  late final TextEditingController _languageInputController;

  final List<String> _languages = [];
  final ImagePicker _picker = ImagePicker();

  final List<String> _commonLanguages = [
    'Tiếng Việt',
    'Tiếng Anh',
    'Tiếng Pháp',
    'Tiếng Trung',
    'Tiếng Hàn',
    'Tiếng Nhật',
    'Tiếng Đức',
  ];

  @override
  void initState() {
    super.initState();
    final guide = widget.user.guideProfile;
    _licenseNumberController = TextEditingController(text: guide?.licenseNumber ?? '');
    _yearsController = TextEditingController(text: guide?.experienceYears?.toString() ?? '');
    _bioController = TextEditingController(text: guide?.bio ?? '');
    _languageInputController = TextEditingController();

    if (guide?.languages != null) {
      _languages.addAll(guide!.languages);
    }
    if (_languages.isEmpty) {
      _languages.add('Tiếng Việt');
    }
  }

  @override
  void dispose() {
    _licenseNumberController.dispose();
    _yearsController.dispose();
    _bioController.dispose();
    _languageInputController.dispose();
    super.dispose();
  }

  Future<void> _pickLicenseImage() async {
    final pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (pickedFile != null && mounted) {
      context.read<ProfileBloc>().add(LicenseImageUploadRequested(File(pickedFile.path)));
    }
  }

  void _addLanguage(String lang) {
    final clean = lang.trim();
    if (clean.isNotEmpty && !_languages.contains(clean)) {
      setState(() {
        _languages.add(clean);
        _languageInputController.clear();
      });
    }
  }

  void _removeLanguage(String lang) {
    setState(() {
      _languages.remove(lang);
    });
  }

  void _submitGuideProfile() {
    if (_formKey.currentState?.validate() ?? false) {
      final years = int.tryParse(_yearsController.text.trim()) ?? 0;
      final guideData = GuideProfileData(
        licenseNumber: _licenseNumberController.text.trim(),
        experienceYears: years,
        languages: _languages,
        bio: _bioController.text.trim(),
        licenseImageUrl: widget.user.guideProfile?.licenseImageUrl,
      );

      context.read<ProfileBloc>().add(GuideProfileUpdateRequested(guideData));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Hồ sơ chuyên môn Hướng dẫn viên',
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
                  : widget.user;
          final licenseUrl = user.guideProfile?.licenseImageUrl;

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Banner thông báo vai trò
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primaryLight.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.verified_user, color: AppColors.primary, size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Tài khoản Hướng dẫn viên Tripri',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryDark,
                                  fontSize: 15,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Hồ sơ chuyên môn đầy đủ sẽ giúp du khách và công ty lữ hành tin tưởng khi phân công tour.',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13,
                                  height: 1.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Số thẻ hành nghề
                  AuthTextField(
                    controller: _licenseNumberController,
                    label: 'Số thẻ Hướng dẫn viên (License Number)',
                    hintText: 'Ví dụ: 10118/HDVDL-QT',
                    prefixIcon: Icons.badge_outlined,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Vui lòng nhập số thẻ hành nghề';
                      }
                      if (val.trim().length < 3) {
                        return 'Số thẻ tối thiểu 3 ký tự';
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 16),

                  // Số năm kinh nghiệm
                  AuthTextField(
                    controller: _yearsController,
                    label: 'Số năm kinh nghiệm',
                    hintText: 'Ví dụ: 3',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icons.history_edu_outlined,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Vui lòng nhập số năm kinh nghiệm';
                      }
                      final n = int.tryParse(val.trim());
                      if (n == null || n < 0 || n > 80) {
                        return 'Số năm không hợp lệ (0 - 80)';
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 20),

                  // Ngôn ngữ thành thạo
                  const Text(
                    'Ngôn ngữ thành thạo',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),

                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _languages.map((lang) {
                      return Chip(
                        label: Text(lang, style: const TextStyle(fontSize: 13, color: AppColors.primaryDark)),
                        backgroundColor: AppColors.primarySurface,
                        deleteIcon: const Icon(Icons.close, size: 16, color: AppColors.primary),
                        onDeleted: () => _removeLanguage(lang),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        side: BorderSide(color: AppColors.primaryLight.withValues(alpha: 0.3)),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 8),

                  // Gợi ý chọn nhanh ngôn ngữ
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _commonLanguages
                        .where((lang) => !_languages.contains(lang))
                        .map((lang) {
                      return ActionChip(
                        label: Text('+ $lang', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        backgroundColor: AppColors.surface,
                        onPressed: () => _addLanguage(lang),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        side: const BorderSide(color: AppColors.border),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 20),

                  // Tiểu sử giới thiệu
                  const Text(
                    'Tiểu sử & Giới thiệu bản thân',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _bioController,
                    maxLines: 4,
                    maxLength: 1000,
                    style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Mô tả ngắn gọn về tính cách, thế mạnh tuyến điểm, văn hóa vùng miền bạn phụ trách...',
                      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Ảnh thẻ Hướng dẫn viên
                  const Text(
                    'Ảnh chụp thẻ Hướng dẫn viên (Mặt trước)',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),

                  GestureDetector(
                    onTap: isLoading ? null : _pickLicenseImage,
                    child: Container(
                      width: double.infinity,
                      height: 180,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: licenseUrl != null ? AppColors.primary : AppColors.border,
                          width: 1.5,
                        ),
                      ),
                      child: licenseUrl != null && licenseUrl.isNotEmpty
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(15),
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CachedNetworkImage(
                                    imageUrl: licenseUrl,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => const Center(
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    ),
                                    errorWidget: (context, url, error) => const Icon(
                                      Icons.broken_image_outlined,
                                      size: 48,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 12,
                                    right: 12,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.7),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.camera_alt, color: Colors.white, size: 14),
                                          SizedBox(width: 4),
                                          Text(
                                            'Đổi ảnh',
                                            style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.add_a_photo_outlined, size: 40, color: AppColors.primary),
                                SizedBox(height: 8),
                                Text(
                                  'Chạm để tải ảnh chụp thẻ HDV',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                    fontSize: 14,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Định dạng JPG, PNG (Tối đa 5MB)',
                                  style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                                ),
                              ],
                            ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Nút Lưu thông tin chuyên môn
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _submitGuideProfile,
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
                              'Lưu hồ sơ chuyên môn',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}