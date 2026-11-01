import 'dart:async';
import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../models/user_profile_model.dart';
import 'guide_profile_screen.dart';

class BecomeGuideScreen extends StatefulWidget {
  final UserProfileModel user;
  final String? initialStatus;

  const BecomeGuideScreen({super.key, required this.user, this.initialStatus});

  @override
  State<BecomeGuideScreen> createState() => _BecomeGuideScreenState();
}

class _BecomeGuideScreenState extends State<BecomeGuideScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiClient _apiClient = ApiClient();
  final ImagePicker _picker = ImagePicker();

  late final TextEditingController _fullNameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _licenseNumberController;
  late final TextEditingController _bioController;

  int _selectedExperienceYears = 2;
  final List<String> _selectedLanguages = ['Tiếng Việt'];
  final List<String> _selectedSpecialties = ['Tour văn hóa lịch sử'];
  File? _licenseImageFile;
  String? _licenseImageUrl;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String _applicationStatus = 'NOT_SUBMITTED'; // NOT_SUBMITTED, PENDING, APPROVED, REJECTED
  Map<String, dynamic>? _applicationData;
  Timer? _realtimeTimer;

  // Zero-based index quản lý 4 bước đăng ký
  int _activeStep = 0;
  bool _isLangDropdownOpen = false;
  bool _isSpecialtyDropdownOpen = false;

  static const _storagePrefix = 'tripri_guide_app_';

  final List<String> _defaultLanguages = [
    'Tiếng Việt',
    'Tiếng Anh',
    'Tiếng Pháp',
    'Tiếng Trung',
    'Tiếng Hàn',
    'Tiếng Nhật',
    'Tiếng Đức',
    'Tiếng Tây Ban Nha',
  ];

  final List<String> _defaultSpecialties = [
    'Tour văn hóa lịch sử',
    'Tour mạo hiểm & trekking',
    'Tour biển đảo',
    'Tour ẩm thực địa phương',
    'Tour sinh thái & thiên nhiên',
    'Tour nghỉ dưỡng cao cấp',
    'Tour nhiếp ảnh & trải nghiệm',
  ];

  final List<String> _stageLabels = [
    'Cá nhân',
    'Giấy phép',
    'Chuyên môn',
    'Xem lại',
  ];

  @override
  void initState() {
    super.initState();
    _fullNameController = TextEditingController(text: widget.user.fullName);
    _phoneController = TextEditingController(text: widget.user.phone ?? '');
    _licenseNumberController = TextEditingController();
    _bioController = TextEditingController();

    if (widget.initialStatus != null) {
      _applicationStatus = widget.initialStatus!;
      _isLoading = false;
    } else if (widget.user.isGuide) {
      _applicationStatus = 'APPROVED';
      _isLoading = false;
    } else {
      _fetchApplicationStatus();
    }
  }

  @override
  void dispose() {
    _realtimeTimer?.cancel();
    _fullNameController.dispose();
    _phoneController.dispose();
    _licenseNumberController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _fetchApplicationStatus() async {
    try {
      final res = await _apiClient.get(ApiEndpoints.guideApplication);
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
        final status = data['status'] as String? ?? 'NOT_SUBMITTED';
        final app = data['application'] as Map<String, dynamic>?;

        if (mounted) {
          setState(() {
            _applicationStatus = status;
            _applicationData = app;
            _isLoading = false;
          });

          if (_applicationStatus == 'PENDING') {
            _startRealtimePolling();
          }
        }
        return;
      }
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      final localStatus = prefs.getString('${_storagePrefix}${widget.user.id}_status');
      if (localStatus != null && mounted) {
        setState(() {
          _applicationStatus = localStatus;
          _isLoading = false;
        });
        if (_applicationStatus == 'PENDING') {
          _startRealtimePolling();
        }
        return;
      }
    }

    if (mounted) {
      setState(() {
        _applicationStatus = 'NOT_SUBMITTED';
        _isLoading = false;
      });
    }
  }

  void _startRealtimePolling() {
    _realtimeTimer?.cancel();
    _realtimeTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      try {
        final res = await _apiClient.get(ApiEndpoints.guideApplication);
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
          final status = data['status'] as String? ?? 'PENDING';
          final app = data['application'] as Map<String, dynamic>?;

          if (mounted && status != _applicationStatus) {
            setState(() {
              _applicationStatus = status;
              _applicationData = app;
            });

            if (status == 'APPROVED') {
              timer.cancel();
              context.read<ProfileBloc>().add(const ProfileLoadRequested());
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('🎉 Chúc mừng! Hồ sơ của bạn đã được Admin phê duyệt thời gian thực!'),
                  backgroundColor: Color(0xFF0F766E),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            } else if (status == 'REJECTED') {
              timer.cancel();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Hồ sơ đã được kiểm tra và cần chỉnh sửa thêm.'),
                  backgroundColor: AppColors.error,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          }
        }
      } catch (_) {}
    });
  }

  Future<void> _pickLicenseImage() async {
    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
      if (picked != null) {
        setState(() {
          _licenseImageFile = File(picked.path);
          _licenseImageUrl = 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600';
        });
      }
    } catch (_) {}
  }

  bool _validateCurrentStep() {
    if (_activeStep == 0) {
      if (_fullNameController.text.trim().isEmpty) {
        _showError('Vui lòng nhập họ và tên');
        return false;
      }
      if (_phoneController.text.trim().isEmpty) {
        _showError('Vui lòng nhập số điện thoại liên hệ');
        return false;
      }
      return true;
    }

    if (_activeStep == 1) {
      if (_licenseNumberController.text.trim().isEmpty) {
        _showError('Vui lòng nhập số thẻ Hướng dẫn viên du lịch');
        return false;
      }
      return true;
    }

    if (_activeStep == 2) {
      if (_selectedLanguages.isEmpty) {
        _showError('Vui lòng chọn ít nhất 1 ngôn ngữ thành thạo');
        return false;
      }
      if (_selectedSpecialties.isEmpty) {
        _showError('Vui lòng chọn ít nhất 1 chuyên môn dẫn tour');
        return false;
      }
      return true;
    }

    return true;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _submitApplication() async {
    setState(() => _isSubmitting = true);

    final payload = {
      'fullName': _fullNameController.text.trim(),
      'phone': _phoneController.text.trim(),
      'licenseNumber': _licenseNumberController.text.trim(),
      'experienceYears': _selectedExperienceYears,
      'languages': _selectedLanguages,
      'specialties': _selectedSpecialties,
      'bio': _bioController.text.trim(),
      'licenseImageUrl': _licenseImageUrl ?? 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600',
    };

    try {
      final res = await _apiClient.post(ApiEndpoints.guideApplication, data: payload);
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
        final app = data['application'] as Map<String, dynamic>? ?? payload;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('${_storagePrefix}${widget.user.id}_status', 'PENDING');

        if (mounted) {
          setState(() {
            _applicationStatus = 'PENDING';
            _applicationData = app;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Đã gửi hồ sơ thành công! Vui lòng chờ Admin xét duyệt theo thời gian thực.'),
              backgroundColor: Color(0xFF0F766E),
              behavior: SnackBarBehavior.floating,
            ),
          );
          _startRealtimePolling();
        }
      }
    } on DioException catch (e) {
      final msg = e.response?.data is Map && (e.response?.data['error']?['message'] != null)
          ? e.response?.data['error']['message'] as String
          : 'Lỗi gửi hồ sơ. Vui lòng thử lại sau.';
      if (mounted) {
        _showError(msg);
      }
    } catch (e) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('${_storagePrefix}${widget.user.id}_status', 'PENDING');
      if (mounted) {
        setState(() {
          _applicationStatus = 'PENDING';
          _applicationData = payload;
        });
        _startRealtimePolling();
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _devAcceptApplication() async {
    setState(() => _isSubmitting = true);
    try {
      final res = await _apiClient.post(ApiEndpoints.guideApplicationDevAccept);
      if (res.statusCode == 200) {
        _realtimeTimer?.cancel();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('${_storagePrefix}${widget.user.id}_status', 'APPROVED');

        if (mounted) {
          setState(() {
            _applicationStatus = 'APPROVED';
          });
          context.read<ProfileBloc>().add(const ProfileLoadRequested());
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚡ [Admin Real-time] Đã phê duyệt hồ sơ! Bạn đã trở thành Hướng dẫn viên.'),
              backgroundColor: Color(0xFF0F766E),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      _realtimeTimer?.cancel();
      if (mounted) {
        setState(() => _applicationStatus = 'APPROVED');
        context.read<ProfileBloc>().add(const ProfileLoadRequested());
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _devRejectApplication() async {
    final reasonController = TextEditingController(text: 'Ảnh chụp thẻ hành nghề bị mờ, không đối chiếu được mã số thẻ với Cục Du lịch.');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Admin từ chối hồ sơ (Test)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nhập lý do từ chối để gửi cho Hướng dẫn viên:'),
            const SizedBox(height: 10),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xác nhận từ chối', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isSubmitting = true);
      try {
        final res = await _apiClient.post(
          ApiEndpoints.guideApplicationDevReject,
          data: {'reason': reasonController.text.trim()},
        );
        if (res.statusCode == 200) {
          _realtimeTimer?.cancel();
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('${_storagePrefix}${widget.user.id}_status', 'REJECTED');

          if (mounted) {
            setState(() {
              _applicationStatus = 'REJECTED';
              _applicationData = {
                ...?_applicationData,
                'verificationNote': reasonController.text.trim(),
              };
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('⚡ [Admin Real-time] Đã từ chối hồ sơ. Người dùng có thể chỉnh sửa lại.'),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _applicationStatus = 'REJECTED';
            _applicationData = {
              ...?_applicationData,
              'verificationNote': reasonController.text.trim(),
            };
          });
        }
      } finally {
        if (mounted) setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Header thiết kế sang trọng thay thế AppBar mặc định (Khắc phục Ảnh 2)
            _buildCustomHeader(),

            // Thân trang
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      child: _buildBodyContent(),
                    ),
            ),

            // Thanh nút điều hướng các bước (chỉ hiện khi chưa nộp)
            if (_applicationStatus == 'NOT_SUBMITTED')
              _buildStepBottomBar(),
          ],
        ),
      ),
    );
  }

  /// Header thiết kế sang trọng theo phong cách cao cấp (Ảnh 2)
  Widget _buildCustomHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
      ),
      child: Row(
        children: [
          // Nút quay lại tròn thanh lịch
          InkWell(
            onTap: () => Navigator.of(context).pop(),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF8FAFC),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B), size: 20),
            ),
          ),
          const SizedBox(width: 14),
          // Tiêu đề và phụ đề trang nhã
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Trở thành Hướng dẫn viên',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.4,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Gia nhập đội ngũ dẫn tour chuyên nghiệp cùng Tripin',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBodyContent() {
    switch (_applicationStatus) {
      case 'APPROVED':
        return _buildApprovedView();
      case 'PENDING':
        return _buildPendingRealtimeView();
      case 'REJECTED':
        return _buildRejectedView();
      case 'NOT_SUBMITTED':
      default:
        return _buildApplicationForm();
    }
  }

  /// GIAO DIỆN FORM ĐĂNG KÝ THEO BƯỚC (STEPS INDICATOR)
  Widget _buildApplicationForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner giới thiệu quyền lợi HDV
          _buildOpportunityBanner(),
          const SizedBox(height: 20),

          // Steps Indicator chuẩn MUI StepIcon / Ant Design Steps
          _buildStepsIndicator(),
          const SizedBox(height: 24),

          // Nội dung theo bước đang kích hoạt (_activeStep)
          IndexedStack(
            index: _activeStep,
            children: [
              _buildStep0Personal(),
              _buildStep1License(),
              _buildStep2Skills(),
              _buildStep3Review(),
            ],
          ),

          const SizedBox(height: 24),
        ],
      ),
    );
  }

  /// Steps Indicator:
  /// - Numbered circular indicator (replace completed numbers with checkmarks)
  /// - StepConnector (Steps.Separator) between adjacent stages
  /// - Future stages muted
  /// - Zero-based index drive
  Widget _buildStepsIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: List.generate(_stageLabels.length * 2 - 1, (index) {
          if (index.isOdd) {
            // StepConnector nối giữa 2 bước
            final stepBefore = index ~/ 2;
            final isCompleted = stepBefore < _activeStep;
            return Expanded(
              child: Container(
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: isCompleted ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }

          final stageIndex = index ~/ 2;
          final isCompleted = stageIndex < _activeStep;
          final isCurrent = stageIndex == _activeStep;
          final isUpcoming = stageIndex > _activeStep;

          return InkWell(
            onTap: () {
              if (stageIndex <= _activeStep) {
                setState(() => _activeStep = stageIndex);
              }
            },
            borderRadius: BorderRadius.circular(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Vòng tròn Steps.Indicator
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted
                        ? const Color(0xFF0F766E)
                        : (isCurrent ? const Color(0xFF0F766E) : const Color(0xFFF1F5F9)),
                    border: Border.all(
                      color: isCurrent
                          ? const Color(0xFF0F766E)
                          : (isCompleted ? const Color(0xFF0F766E) : const Color(0xFFCBD5E1)),
                      width: isCurrent ? 2.5 : 1.5,
                    ),
                    boxShadow: isCurrent
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0F766E).withValues(alpha: 0.28),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Center(
                    child: isCompleted
                        ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
                        : Text(
                            '${stageIndex + 1}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: isCurrent ? Colors.white : const Color(0xFF94A3B8),
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 6),
                // Nhãn mô tả giai đoạn
                Text(
                  _stageLabels[stageIndex],
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                    color: isCurrent
                        ? const Color(0xFF0F766E)
                        : (isCompleted ? const Color(0xFF1E293B) : const Color(0xFF94A3B8)),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  /// BƯỚC 0: Thông tin cá nhân & Giới thiệu bản thân
  Widget _buildStep0Personal() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('1. Thông tin cá nhân'),
        const SizedBox(height: 10),
        _buildCardContainer([
          _buildTextFormField(
            controller: _fullNameController,
            label: 'Họ và tên *',
            icon: Icons.person_outline_rounded,
            hint: 'Nhập họ và tên đầy đủ',
          ),
          const Divider(height: 1),
          _buildTextFormField(
            controller: _phoneController,
            label: 'Số điện thoại liên hệ *',
            icon: Icons.phone_outlined,
            hint: 'VD: 0912345678',
            keyboardType: TextInputType.phone,
          ),
          const Divider(height: 1),
          _buildReadOnlyField(
            'Email tài khoản',
            widget.user.email,
            Icons.email_outlined,
          ),
        ]),
        const SizedBox(height: 20),

        _buildSectionTitle('Giới thiệu bản thân & cam kết dịch vụ'),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextFormField(
                controller: _bioController,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Chia sẻ ngắn về phong cách dẫn tour, tuyến điểm yêu thích và cam kết chăm sóc du khách của bạn...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                ),
              ),
              const SizedBox(height: 6),
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

  /// BƯỚC 1: Giấy phép kinh nghiệm & Ảnh thẻ hành nghề (Khắc phục hoàn toàn lỗi overflow)
  Widget _buildStep1License() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('2. Giấy phép & Kinh nghiệm'),
        const SizedBox(height: 10),
        _buildCardContainer([
          TextFormField(
            controller: _licenseNumberController,
            decoration: const InputDecoration(
              labelText: 'Số thẻ Hướng dẫn viên du lịch *',
              hintText: 'VD: 10118-HDVQT-0029',
              prefixIcon: Icon(Icons.badge_outlined, color: Color(0xFF0F766E)),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập số thẻ hành nghề' : null,
          ),
          const Divider(height: 1),
          // Bố cục gọn gàng, linh hoạt tránh overflow 34px (Ảnh 1)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Kinh nghiệm dẫn tour:',
                  style: TextStyle(fontSize: 13, color: Color(0xFF334155), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
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
                        DropdownMenuItem(value: 10, child: Text('Trên 10 năm (Chuyên gia)')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedExperienceYears = val);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ]),
        const SizedBox(height: 20),

        _buildSectionTitle('4. Ảnh thẻ hành nghề Hướng dẫn viên'),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: _pickLicenseImage,
          child: Container(
            width: double.infinity,
            height: 170,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCBD5E1), style: BorderStyle.solid, width: 1.5),
            ),
            child: _licenseImageFile != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Image.file(_licenseImageFile!, fit: BoxFit.cover, width: double.infinity),
                  )
                : const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo_outlined, size: 40, color: Color(0xFF0F766E)),
                      SizedBox(height: 10),
                      Text('Tải lên ảnh thẻ Hướng dẫn viên / Chứng chỉ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF0F766E))),
                      SizedBox(height: 4),
                      Text('Định dạng JPG, PNG rõ nét 2 mặt', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  /// BƯỚC 2: Ngôn ngữ & Chuyên môn (Dropdown với custom ô tick theo yêu cầu)
  Widget _buildStep2Skills() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('3. Ngôn ngữ & Tuyến điểm thế mạnh'),
        const SizedBox(height: 10),

        // Dropdown Ngôn ngữ với Custom Ô Tick
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thanh bấm dropdown
              InkWell(
                onTap: () => setState(() => _isLangDropdownOpen = !_isLangDropdownOpen),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.language_rounded, color: Color(0xFF0F766E), size: 20),
                          const SizedBox(width: 10),
                          Text(
                            'Ngôn ngữ thành thạo (${_selectedLanguages.length})',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                      Icon(
                        _isLangDropdownOpen ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                        color: const Color(0xFF0F766E),
                        size: 24,
                      ),
                    ],
                  ),
                ),
              ),

              // Danh sách các lựa chọn có Custom Ô Tick tròn khi mở dropdown
              if (_isLangDropdownOpen) ...[
                const Divider(height: 1),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _defaultLanguages.length,
                  itemBuilder: (context, index) {
                    final lang = _defaultLanguages[index];
                    final isSelected = _selectedLanguages.contains(lang);
                    return InkWell(
                      onTap: () {
                        setState(() {
                          if (isSelected) {
                            if (_selectedLanguages.length > 1) _selectedLanguages.remove(lang);
                          } else {
                            _selectedLanguages.add(lang);
                          }
                        });
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        child: Row(
                          children: [
                            // Custom Ô Tick tròn
                            _buildCustomCircleTick(isSelected: isSelected),
                            const SizedBox(width: 12),
                            Text(
                              lang,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF334155),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
              ],

              // Danh sách chip các ngôn ngữ đã chọn
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _selectedLanguages.map((lang) {
                    return Chip(
                      label: Text(lang, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F766E))),
                      backgroundColor: const Color(0xFFCCFBF1),
                      deleteIcon: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF0F766E)),
                      onDeleted: _selectedLanguages.length > 1
                          ? () => setState(() => _selectedLanguages.remove(lang))
                          : null,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide.none),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Dropdown Chuyên môn & Tuyến điểm thế mạnh với Custom Ô Tick
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thanh bấm dropdown
              InkWell(
                onTap: () => setState(() => _isSpecialtyDropdownOpen = !_isSpecialtyDropdownOpen),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.explore_outlined, color: Color(0xFFD97706), size: 20),
                          const SizedBox(width: 10),
                          Text(
                            'Chuyên môn & Tuyến điểm (${_selectedSpecialties.length})',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                      Icon(
                        _isSpecialtyDropdownOpen ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                        color: const Color(0xFFD97706),
                        size: 24,
                      ),
                    ],
                  ),
                ),
              ),

              // Danh sách các lựa chọn có Custom Ô Tick tròn khi mở dropdown
              if (_isSpecialtyDropdownOpen) ...[
                const Divider(height: 1),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _defaultSpecialties.length,
                  itemBuilder: (context, index) {
                    final spec = _defaultSpecialties[index];
                    final isSelected = _selectedSpecialties.contains(spec);
                    return InkWell(
                      onTap: () {
                        setState(() {
                          if (isSelected) {
                            if (_selectedSpecialties.length > 1) _selectedSpecialties.remove(spec);
                          } else {
                            _selectedSpecialties.add(spec);
                          }
                        });
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        child: Row(
                          children: [
                            // Custom Ô Tick tròn
                            _buildCustomCircleTick(isSelected: isSelected, activeColor: const Color(0xFFD97706)),
                            const SizedBox(width: 12),
                            Text(
                              spec,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? const Color(0xFFB45309) : const Color(0xFF334155),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
              ],

              // Danh sách chip các chuyên môn đã chọn
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _selectedSpecialties.map((spec) {
                    return Chip(
                      label: Text(spec, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                      backgroundColor: const Color(0xFFFEF3C7),
                      deleteIcon: const Icon(Icons.close_rounded, size: 14, color: Color(0xFFB45309)),
                      onDeleted: _selectedSpecialties.length > 1
                          ? () => setState(() => _selectedSpecialties.remove(spec))
                          : null,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide.none),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Custom Ô Tick Tròn
  Widget _buildCustomCircleTick({required bool isSelected, Color activeColor = const Color(0xFF0F766E)}) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isSelected ? activeColor : Colors.white,
        border: Border.all(
          color: isSelected ? activeColor : const Color(0xFFCBD5E1),
          width: 1.5,
        ),
      ),
      child: isSelected
          ? const Center(
              child: Icon(Icons.check_rounded, color: Colors.white, size: 15),
            )
          : null,
    );
  }

  /// BƯỚC 3: Bảng Review cuối cùng (Xem tổng quát lại toàn bộ thông tin đã điền)
  Widget _buildStep3Review() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Bảng review tổng quát hồ sơ'),
        const SizedBox(height: 10),

        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thông tin ứng viên
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xFF0F766E),
                    child: Text(
                      _fullNameController.text.isNotEmpty ? _fullNameController.text[0].toUpperCase() : 'G',
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _fullNameController.text,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'SĐT: ${_phoneController.text} · ${widget.user.email}',
                          style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),

              // Giấy phép & Kinh nghiệm
              _buildReviewRow('Số thẻ hành nghề', _licenseNumberController.text),
              const SizedBox(height: 8),
              _buildReviewRow('Kinh nghiệm dẫn tour', '$_selectedExperienceYears năm kinh nghiệm'),
              const SizedBox(height: 12),

              // Ngôn ngữ
              const Text('Ngôn ngữ thành thạo:', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _selectedLanguages.map((l) => _buildBadge(l, const Color(0xFFCCFBF1), const Color(0xFF0F766E))).toList(),
              ),
              const SizedBox(height: 12),

              // Chuyên môn
              const Text('Chuyên môn & Tuyến điểm:', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _selectedSpecialties.map((s) => _buildBadge(s, const Color(0xFFFEF3C7), const Color(0xFFB45309))).toList(),
              ),
              const SizedBox(height: 16),

              // Tiểu sử
              if (_bioController.text.trim().isNotEmpty) ...[
                const Text('Giới thiệu & Cam kết:', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _bioController.text.trim(),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF334155), fontStyle: FontStyle.italic),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Ảnh thẻ hành nghề thumbnail
              if (_licenseImageFile != null) ...[
                const Text('Ảnh thẻ hành nghề:', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_licenseImageFile!, height: 120, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 16),
              ],

              // Cam kết
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Tôi cam kết thông tin và thẻ hành nghề cung cấp là chính xác và tuân thủ quy chuẩn phục vụ du khách của Tripin.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF166534), height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReviewRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
        Text(value, style: const TextStyle(fontSize: 13.5, color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildBadge(String text, Color bg, Color textCol) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textCol)),
    );
  }

  /// Thanh điều hướng chân trang (Bottom Navigation Bar)
  Widget _buildStepBottomBar() {
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
          // Nút Quay lại
          if (_activeStep > 0) ...[
            Expanded(
              flex: 1,
              child: OutlinedButton(
                onPressed: () => setState(() => _activeStep--),
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

          // Nút Tiếp tục hoặc Nộp hồ sơ
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _isSubmitting
                  ? null
                  : () {
                      if (_activeStep < 3) {
                        if (_validateCurrentStep()) {
                          setState(() => _activeStep++);
                        }
                      } else {
                        _submitApplication();
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 2,
              ),
              child: _isSubmitting
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _activeStep == 3 ? 'Gửi hồ sơ xét duyệt' : 'Tiếp tục',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(width: 6),
                        Icon(_activeStep == 3 ? Icons.send_rounded : Icons.arrow_forward_rounded, size: 18),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// GIAO DIỆN ĐANG CHỜ DUYỆT THỜI GIAN THỰC (REAL-TIME PENDING)
  Widget _buildPendingRealtimeView() {
    final note = _applicationData?['licenseNumber'] as String? ?? 'Chờ xác minh';
    final submittedAt = _applicationData?['submittedAt'] as String? ?? 'Vừa xong';

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFFDE68A), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFEF3C7),
                  border: Border.all(color: const Color(0xFFF59E0B), width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.hourglass_top_rounded, size: 36, color: Color(0xFFD97706)),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Hồ sơ đang được xét duyệt',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.wifi_tethering_rounded, size: 14, color: Color(0xFFD97706)),
                    SizedBox(width: 6),
                    Text(
                      'ĐANG THEO DÕI THỜI GIAN THỰC',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Hồ sơ đăng ký của bạn đang được Ban quản trị Tripin đối soát với Cục Du lịch Việt Nam. Khi được phê duyệt, tài khoản sẽ tự động chuyển thành Hướng dẫn viên.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: Color(0xFF475569), height: 1.45),
              ),
              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 12),
              _buildDetailInfoRow('Mã số thẻ HDV', note),
              const SizedBox(height: 8),
              _buildDetailInfoRow('Thời gian nộp', submittedAt),
              const SizedBox(height: 8),
              _buildDetailInfoRow('Trạng thái', 'Đang chờ xử lý (Pending)'),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Dev toolbar
        _buildDevTestingSection(),
      ],
    );
  }

  /// GIAO DIỆN ĐÃ ĐƯỢC PHÊ DUYỆT (APPROVED)
  Widget _buildApprovedView() {
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFA7F3D0), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFD1FAE5),
                  border: Border.all(color: const Color(0xFF10B981), width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.verified_rounded, size: 40, color: Color(0xFF059669)),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Chúc mừng bạn!',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Bạn đã trở thành Hướng dẫn viên chính thức',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
              ),
              const SizedBox(height: 14),
              const Text(
                'Hồ sơ của bạn đã được Admin xác minh. Bạn có thể cập nhật thông tin giới thiệu, lịch trình cá nhân và nhận các tour du lịch được điều phối.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: Color(0xFF475569), height: 1.45),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => GuideProfileScreen(user: widget.user),
                      ),
                    );
                  },
                  icon: const Icon(Icons.badge_rounded, size: 18),
                  label: const Text('Truy cập hồ sơ Hướng dẫn viên'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// GIAO DIỆN BỊ TỪ CHỐI (REJECTED)
  Widget _buildRejectedView() {
    final note = _applicationData?['verificationNote'] as String? ?? 'Thông tin thẻ hành nghề hoặc ảnh chụp chưa đạt chuẩn yêu cầu.';

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFEE2E2),
                  border: Border.all(color: const Color(0xFFEF4444), width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.cancel_outlined, size: 38, color: Color(0xFFDC2626)),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Hồ sơ chưa được phê duyệt',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFFE11D48)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Lý do: $note',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF9F1239), height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () {
                    setState(() {
                      _applicationStatus = 'NOT_SUBMITTED';
                      _activeStep = 0;
                    });
                  },
                  icon: const Icon(Icons.edit_note_rounded, size: 18),
                  label: const Text('Chỉnh sửa & Gửi lại hồ sơ'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Banner quyền lợi đối tác HDV
  Widget _buildOpportunityBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F766E), Color(0xFF115E59)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withValues(alpha: 0.25),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: const Row(
        children: [
          Icon(Icons.workspace_premium_rounded, size: 36, color: Color(0xFF5EEAD4)),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Đồng hành cùng Tripin',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
                SizedBox(height: 4),
                Text(
                  'Kết nối hàng nghìn du khách, nhận tour linh hoạt và nâng cao thu nhập.',
                  style: TextStyle(color: Color(0xFFCCFBF1), fontSize: 12.5, height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevTestingSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFCBD5E1), style: BorderStyle.solid),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.developer_mode_rounded, color: Color(0xFF475569), size: 18),
              SizedBox(width: 8),
              Text(
                'KIỂM THỬ THỜI GIAN THỰC (ADMIN / DEV)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Bấm nút bên dưới để mô phỏng Admin duyệt hoặc từ chối hồ sơ ngay lập tức:',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _devAcceptApplication,
                  icon: const Icon(Icons.bolt_rounded, size: 16),
                  label: const Text('Phê duyệt (Duyệt thật)'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isSubmitting ? null : _devRejectApplication,
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Từ chối'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
    );
  }

  Widget _buildCardContainer(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildTextFormField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: const Color(0xFF0F766E)),
        border: InputBorder.none,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  Widget _buildReadOnlyField(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF94A3B8), size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
      ],
    );
  }
}
