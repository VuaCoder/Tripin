import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/register_bloc.dart';
import '../bloc/register_event.dart';
import '../bloc/register_state.dart';
import '../models/register_request.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/password_strength_bar.dart';
import 'verify_otp_screen.dart';

/// [FLOW-01] Màn hình Đăng ký Hướng dẫn viên chuyên nghiệp theo từng bước (Multi-step Wizard)
class RegisterGuideScreen extends StatelessWidget {
  const RegisterGuideScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => RegisterBloc(),
      child: const _RegisterGuideView(),
    );
  }
}

class _RegisterGuideView extends StatefulWidget {
  const _RegisterGuideView();

  @override
  State<_RegisterGuideView> createState() => _RegisterGuideViewState();
}

class _RegisterGuideViewState extends State<_RegisterGuideView> {
  final _formKey = GlobalKey<FormState>();

  int _currentStep = 0;

  // --- BƯỚC 1: TÀI KHOẢN & LIÊN HỆ ---
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String _currentPassword = '';

  // --- BƯỚC 2: GIẤY PHÉP & KINH NGHIỆM ---
  final _licenseNumberController = TextEditingController();
  String _selectedLicenseType = 'QUOC_TE';
  int _selectedExperienceYears = 2;
  File? _licenseImageFile;

  // --- BƯỚC 3: NGÔN NGỮ & CHUYÊN MÔN ---
  final List<String> _selectedLanguages = ['Tiếng Việt', 'Tiếng Anh'];
  final List<String> _selectedSpecialties = ['Tour văn hóa lịch sử'];
  final _bioController = TextEditingController();

  // --- BƯỚC 4: CAM KẾT ---
  bool _agreedToTerms = true;

  final List<String> _stepTitles = [
    'Tài khoản',
    'Giấy phép',
    'Chuyên môn',
    'Xác nhận',
  ];

  final List<String> _availableLanguages = [
    'Tiếng Việt',
    'Tiếng Anh',
    'Tiếng Pháp',
    'Tiếng Trung',
    'Tiếng Hàn',
    'Tiếng Nhật',
    'Tiếng Đức',
    'Tiếng Nga',
    'Tiếng Tây Ban Nha',
  ];

  final List<String> _availableSpecialties = [
    'Tour văn hóa lịch sử',
    'Tour mạo hiểm & trekking',
    'Tour biển đảo',
    'Tour ẩm thực địa phương',
    'Tour sinh thái & thiên nhiên',
    'Tour nghỉ dưỡng cao cấp',
    'Tour trải nghiệm cộng đồng',
  ];

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _licenseNumberController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickLicenseImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (picked != null) {
        setState(() => _licenseImageFile = File(picked.path));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi chọn ảnh: $e')),
      );
    }
  }

  bool _validateStep(int step) {
    if (step == 0) {
      if (_fullNameController.text.trim().length < 2) {
        _showErrorSnackBar('Vui lòng nhập họ và tên tối thiểu 2 ký tự');
        return false;
      }
      final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
      if (!emailRegex.hasMatch(_emailController.text.trim())) {
        _showErrorSnackBar('Địa chỉ email không đúng định dạng');
        return false;
      }
      final phoneRegex = RegExp(r'^\+?[0-9 ().-]{9,15}$');
      if (!phoneRegex.hasMatch(_phoneController.text.trim())) {
        _showErrorSnackBar('Vui lòng nhập số điện thoại hợp lệ (9-15 số)');
        return false;
      }
      if (_passwordController.text.length < 8) {
        _showErrorSnackBar('Mật khẩu phải có tối thiểu 8 ký tự');
        return false;
      }
      if (!RegExp(r'[A-Za-z]').hasMatch(_passwordController.text) ||
          !RegExp(r'\d').hasMatch(_passwordController.text)) {
        _showErrorSnackBar('Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số');
        return false;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        _showErrorSnackBar('Mật khẩu xác nhận không trùng khớp');
        return false;
      }
      return true;
    }

    if (step == 1) {
      if (_licenseNumberController.text.trim().isEmpty) {
        _showErrorSnackBar('Vui lòng nhập số thẻ Hướng dẫn viên du lịch');
        return false;
      }
      return true;
    }

    if (step == 2) {
      if (_selectedLanguages.isEmpty) {
        _showErrorSnackBar('Vui lòng chọn ít nhất 1 ngôn ngữ thành thạo');
        return false;
      }
      if (_selectedSpecialties.isEmpty) {
        _showErrorSnackBar('Vui lòng chọn ít nhất 1 tuyến điểm/chuyên môn thế mạnh');
        return false;
      }
      return true;
    }

    if (step == 3) {
      if (!_agreedToTerms) {
        _showErrorSnackBar('Vui lòng xác nhận cam kết điều khoản đối tác HDV');
        return false;
      }
      return true;
    }

    return true;
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _onRegisterPressed() async {
    if (!_validateStep(3)) return;

    // Lưu tạm thông tin hồ sơ HDV vào SharedPreferences để đồng bộ sau khi đăng nhập
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pending_guide_license', _licenseNumberController.text.trim());
      await prefs.setInt('pending_guide_exp', _selectedExperienceYears);
      await prefs.setStringList('pending_guide_langs', _selectedLanguages);
      await prefs.setStringList('pending_guide_specialties', _selectedSpecialties);
      await prefs.setString('pending_guide_bio', _bioController.text.trim());
    } catch (_) {}

    final request = RegisterRequest(
      fullName: _fullNameController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      password: _passwordController.text,
      role: 'TOUR_GUIDE',
    );

    if (!mounted) return;
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
            backgroundColor: Colors.white,
            elevation: 0.5,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, size: 20),
              color: AppColors.textPrimary,
              onPressed: () {
                if (_currentStep > 0) {
                  setState(() => _currentStep--);
                } else {
                  Navigator.of(context).pop();
                }
              },
            ),
            title: Text(
              'Đăng ký Hướng dẫn viên (${_currentStep + 1}/4)',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            centerTitle: true,
          ),
          body: SafeArea(
            child: Column(
              children: [
                // Thanh Step Indicator
                _buildStepsProgress(),

                // Nội dung form cuộn được
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
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

                          // Nội dung theo từng bước
                          IndexedStack(
                            index: _currentStep,
                            children: [
                              _buildStep0Account(isLoading),
                              _buildStep1License(isLoading),
                              _buildStep2Skills(isLoading),
                              _buildStep3Review(isLoading),
                            ],
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                ),

                // Bottom Navigation Bar (Quay lại / Tiếp tục)
                _buildBottomNav(isLoading),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Step Indicator có vạch nối và số bước tròn
  Widget _buildStepsProgress() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: List.generate(_stepTitles.length * 2 - 1, (index) {
          if (index.isOdd) {
            final stepIndex = index ~/ 2;
            final isPassed = stepIndex < _currentStep;
            return Expanded(
              child: Container(
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: isPassed ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }

          final step = index ~/ 2;
          final isCompleted = step < _currentStep;
          final isCurrent = step == _currentStep;

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCurrent
                      ? const Color(0xFF0F766E)
                      : (isCompleted ? const Color(0xFFD1FAE5) : const Color(0xFFF1F5F9)),
                  border: Border.all(
                    color: isCurrent
                        ? const Color(0xFF0F766E)
                        : (isCompleted ? const Color(0xFF10B981) : const Color(0xFFCBD5E1)),
                    width: 1.5,
                  ),
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(Icons.check, size: 16, color: Color(0xFF059669))
                      : Text(
                          '${step + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isCurrent ? Colors.white : const Color(0xFF64748B),
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _stepTitles[step],
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                  color: isCurrent ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  /// BƯỚC 1: TÀI KHOẢN & THÔNG TIN LIÊN HỆ
  Widget _buildStep0Account(bool isLoading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('1. Thông tin tài khoản & Liên hệ', 'Điền thông tin đăng nhập và số điện thoại điều tour'),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _fullNameController,
          label: 'Họ và tên (theo CCCD/Thẻ HDV) *',
          hintText: 'VD: Nguyễn Văn An',
          prefixIcon: Icons.person_outline,
          enabled: !isLoading,
        ),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _emailController,
          label: 'Địa chỉ Email làm việc *',
          hintText: 'guide@example.com',
          prefixIcon: Icons.mail_outline,
          keyboardType: TextInputType.emailAddress,
          enabled: !isLoading,
        ),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _phoneController,
          label: 'Số điện thoại nhận điều tour *',
          hintText: 'VD: 0912345678',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          enabled: !isLoading,
        ),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _passwordController,
          label: 'Mật khẩu *',
          hintText: 'Tối thiểu 8 ký tự (chữ & số)',
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
        ),
        PasswordStrengthBar(password: _currentPassword),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _confirmPasswordController,
          label: 'Xác nhận lại mật khẩu *',
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
        ),
      ],
    );
  }

  /// BƯỚC 2: GIẤY PHÉP & KINH NGHIỆM DẪN TOUR
  Widget _buildStep1License(bool isLoading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('2. Giấy phép & Kinh nghiệm dẫn tour', 'Thông tin xác minh chứng chỉ hành nghề của bạn'),
        const SizedBox(height: 14),

        AuthTextField(
          controller: _licenseNumberController,
          label: 'Số thẻ Hướng dẫn viên du lịch *',
          hintText: 'VD: 10118-HDVQT-0029',
          prefixIcon: Icons.badge_outlined,
          enabled: !isLoading,
        ),
        const SizedBox(height: 14),

        const Text(
          'Loại thẻ hướng dẫn viên:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _buildRadioCard('QUOC_TE', 'Quốc tế', Icons.public_rounded)),
            const SizedBox(width: 8),
            Expanded(child: _buildRadioCard('NOI_DIA', 'Nội địa', Icons.map_rounded)),
            const SizedBox(width: 8),
            Expanded(child: _buildRadioCard('TAI_DIEM', 'Tại điểm', Icons.place_rounded)),
          ],
        ),
        const SizedBox(height: 16),

        const Text(
          'Kinh nghiệm dẫn tour thực tế:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              isExpanded: true,
              value: _selectedExperienceYears,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF0F766E)),
              items: const [
                DropdownMenuItem(value: 1, child: Text('Dưới 1 năm kinh nghiệm')),
                DropdownMenuItem(value: 2, child: Text('1 – 2 năm kinh nghiệm')),
                DropdownMenuItem(value: 3, child: Text('3 – 5 năm kinh nghiệm')),
                DropdownMenuItem(value: 5, child: Text('Trên 5 năm kinh nghiệm')),
                DropdownMenuItem(value: 10, child: Text('Trên 10 năm (Chuyên gia dẫn đoàn)')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _selectedExperienceYears = val);
              },
            ),
          ),
        ),
        const SizedBox(height: 18),

        const Text(
          'Ảnh chụp thẻ Hướng dẫn viên / Chứng chỉ:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: _pickLicenseImage,
          child: Container(
            width: double.infinity,
            height: 160,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
            ),
            child: _licenseImageFile != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(13),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.file(_licenseImageFile!, fit: BoxFit.cover),
                        Positioned(
                          right: 8,
                          bottom: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.65),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.edit, color: Colors.white, size: 14),
                                SizedBox(width: 4),
                                Text('Đổi ảnh', style: TextStyle(color: Colors.white, fontSize: 11)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo_outlined, size: 36, color: Color(0xFF0F766E)),
                      SizedBox(height: 8),
                      Text(
                        'Chạm để tải ảnh thẻ HDV hoặc giấy chứng nhận',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F766E)),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Hỗ trợ JPG, PNG rõ nét 2 mặt',
                        style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  /// BƯỚC 3: KỸ NĂNG & CHUYÊN MÔN
  Widget _buildStep2Skills(bool isLoading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('3. Ngôn ngữ & Chuyên môn thế mạnh', 'Chọn những kỹ năng tốt nhất của bạn khi phục vụ khách'),
        const SizedBox(height: 14),

        const Text(
          'Ngôn ngữ thành thạo (chọn các ngôn ngữ bạn tự tin):',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _availableLanguages.map((lang) {
            final isSelected = _selectedLanguages.contains(lang);
            return FilterChip(
              label: Text(lang),
              selected: isSelected,
              selectedColor: const Color(0xFFCCFBF1),
              backgroundColor: Colors.white,
              checkmarkColor: const Color(0xFF0F766E),
              labelStyle: TextStyle(
                color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF475569),
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 12.5,
              ),
              side: BorderSide(
                color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
              ),
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedLanguages.add(lang);
                  } else {
                    _selectedLanguages.remove(lang);
                  }
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 18),

        const Text(
          'Tuyến điểm & Thể loại tour thế mạnh:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _availableSpecialties.map((spec) {
            final isSelected = _selectedSpecialties.contains(spec);
            return FilterChip(
              label: Text(spec),
              selected: isSelected,
              selectedColor: const Color(0xFFE0F2FE),
              backgroundColor: Colors.white,
              checkmarkColor: const Color(0xFF0369A1),
              labelStyle: TextStyle(
                color: isSelected ? const Color(0xFF0369A1) : const Color(0xFF475569),
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 12.5,
              ),
              side: BorderSide(
                color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFE2E8F0),
              ),
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedSpecialties.add(spec);
                  } else {
                    _selectedSpecialties.remove(spec);
                  }
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 18),

        const Text(
          'Giới thiệu bản thân & cam kết dịch vụ:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              TextFormField(
                controller: _bioController,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Mô tả ngắn về phong cách dẫn đoàn, sự tận tâm và những tuyến điểm du lịch bạn hiểu rõ nhất...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                ),
              ),
              const Align(
                alignment: Alignment.centerRight,
                child: Text('Tối đa 500 ký tự', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// BƯỚC 4: XEM LẠI & XÁC NHẬN NỘP HỒ SƠ
  Widget _buildStep3Review(bool isLoading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('4. Xác nhận hồ sơ Hướng dẫn viên', 'Kiểm tra lại toàn bộ thông tin trước khi nộp xét duyệt'),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildReviewRow('Họ và tên:', _fullNameController.text.trim()),
              const Divider(height: 16),
              _buildReviewRow('Email:', _emailController.text.trim()),
              const Divider(height: 16),
              _buildReviewRow('Số điện thoại:', _phoneController.text.trim()),
              const Divider(height: 16),
              _buildReviewRow('Số thẻ HDV:', _licenseNumberController.text.trim()),
              const Divider(height: 16),
              _buildReviewRow('Kinh nghiệm:', '$_selectedExperienceYears năm kinh nghiệm'),
              const Divider(height: 16),
              _buildReviewRow('Ngôn ngữ:', _selectedLanguages.join(', ')),
              const Divider(height: 16),
              _buildReviewRow('Tuyến điểm:', _selectedSpecialties.join(', ')),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Cam kết điều khoản đối tác
        InkWell(
          onTap: () => setState(() => _agreedToTerms = !_agreedToTerms),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _agreedToTerms ? const Color(0xFF0F766E) : const Color(0xFFCBD5E1),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _agreedToTerms,
                  activeColor: const Color(0xFF0F766E),
                  onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
                ),
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Tôi cam kết các thông tin khai báo trên là trung thực và tuân thủ bộ Quy tắc ứng xử Hướng dẫn viên của Tripri Travel.',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF334155), height: 1.4),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRadioCard(String val, String label, IconData icon) {
    final isSelected = _selectedLicenseType == val;
    return InkWell(
      onTap: () => setState(() => _selectedLicenseType = val),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFCCFBF1) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF64748B)),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 105,
          child: Text(
            label,
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
          ),
        ),
        Expanded(
          child: Text(
            value.isEmpty ? 'Chưa điền' : value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
      ],
    );
  }

  /// Bottom Navigation Bar: Nút Quay lại và Nút Tiếp tục / Đăng ký
  Widget _buildBottomNav(bool isLoading) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Row(
        children: [
          if (_currentStep > 0) ...[
            Expanded(
              flex: 1,
              child: OutlinedButton(
                onPressed: isLoading ? null : () => setState(() => _currentStep--),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF334155),
                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Quay lại', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: isLoading
                  ? null
                  : () {
                      if (_currentStep < 3) {
                        if (_validateStep(_currentStep)) {
                          setState(() => _currentStep++);
                        }
                      } else {
                        _onRegisterPressed();
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 2,
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _currentStep == 3 ? 'Hoàn tất đăng ký HDV' : 'Tiếp tục',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(width: 6),
                        Icon(_currentStep == 3 ? Icons.check_circle_outline : Icons.arrow_forward_rounded, size: 18),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
