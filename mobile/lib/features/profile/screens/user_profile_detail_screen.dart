import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../auth/screens/verify_otp_screen.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../models/user_profile_model.dart';
import 'edit_profile_screen.dart';

class UserProfileDetailScreen extends StatefulWidget {
  final UserProfileModel user;

  const UserProfileDetailScreen({super.key, required this.user});

  @override
  State<UserProfileDetailScreen> createState() => _UserProfileDetailScreenState();
}

class _UserProfileDetailScreenState extends State<UserProfileDetailScreen> {
  bool _isSendingOtp = false;

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

  void _openEditProfile(BuildContext context, UserProfileModel currentUser) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<ProfileBloc>(),
          child: EditProfileScreen(initialUser: currentUser),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProfileBloc, ProfileState>(
      builder: (context, state) {
        final currentUser = (state is ProfileLoaded)
            ? state.user
            : (state is ProfileUpdateSuccess)
                ? state.user
                : widget.user;
        final isVerified = currentUser.isVerified == true;
        final isGuide = currentUser.isGuide;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: const Text(
              'Hồ sơ của tôi',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            centerTitle: true,
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: TextButton(
                  onPressed: () => _openEditProfile(context, currentUser),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.edit_outlined, size: 16, color: AppColors.primary),
                      SizedBox(width: 4),
                      Text(
                        'Chỉnh sửa',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Hero Passport / Public Card (Airbnb Style)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF64748B).withValues(alpha: 0.10),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: const Color(0xFF94A3B8).withValues(alpha: 0.06),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Avatar with verified badge
                      Stack(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isVerified
                                    ? (isGuide ? AppColors.secondary : AppColors.primary)
                                    : const Color(0xFFE2E8F0),
                                width: isVerified ? 2.5 : 1.5,
                              ),
                            ),
                            child: CircleAvatar(
                              radius: 46,
                              backgroundColor: AppColors.primarySurface,
                              child: ClipOval(
                                child: currentUser.avatarUrl != null && currentUser.avatarUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: currentUser.avatarUrl!,
                                        width: 92,
                                        height: 92,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) =>
                                            const CircularProgressIndicator(strokeWidth: 2),
                                        errorWidget: (context, url, error) => const Icon(
                                          Icons.person,
                                          size: 46,
                                          color: AppColors.primary,
                                        ),
                                      )
                                    : const Icon(Icons.person, size: 46, color: AppColors.primary),
                              ),
                            ),
                          ),
                          if (isVerified)
                            Positioned(
                              right: 2,
                              bottom: 2,
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.check_circle_rounded,
                                  size: 22,
                                  color: isGuide ? AppColors.secondaryDark : AppColors.success,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // User Name
                      Text(
                        currentUser.fullName,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Role Label
                      Text(
                        isGuide ? 'Hướng dẫn viên du lịch' : 'Khách du lịch',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Verification Status Indicator
                      if (isVerified)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified_rounded, size: 16, color: AppColors.success),
                              SizedBox(width: 6),
                              Text(
                                'Danh tính đã xác minh',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF065F46),
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        InkWell(
                          onTap: _isSendingOtp ? null : () => _startVerification(currentUser),
                          borderRadius: BorderRadius.circular(20),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFBEB),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFFDE68A)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFFD97706)),
                                const SizedBox(width: 6),
                                Text(
                                  _isSendingOtp ? 'Đang gửi mã...' : 'Chưa xác thực • Xác thực ngay',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF92400E),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      const SizedBox(height: 20),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 16),

                      // Stats Row: Chuyến đi & Đánh giá
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildDetailStat(
                            title: 'Chuyến đi',
                            value: isGuide
                                ? (currentUser.guideProfile?.experienceYears != null
                                    ? '${currentUser.guideProfile!.experienceYears} năm'
                                    : '0')
                                : '0',
                            icon: Icons.flight_takeoff_rounded,
                          ),
                          Container(height: 28, width: 1, color: AppColors.border),
                          _buildDetailStat(
                            title: 'Đánh giá',
                            value: '0',
                            icon: Icons.star_rounded,
                          ),
                          Container(height: 28, width: 1, color: AppColors.border),
                          _buildDetailStat(
                            title: 'Tham gia',
                            value: '2026',
                            icon: Icons.calendar_today_rounded,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 2. Section: Về tôi / Giới thiệu (Airbnb Style)
                _buildSectionTitle('Về tôi'),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF64748B).withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildInfoRow(
                        icon: Icons.public_rounded,
                        title: 'Điểm đến mơ ước',
                        value: currentUser.dreamDestination ?? 'Chưa cập nhật',
                      ),
                      const Divider(height: 24, color: AppColors.border),
                      _buildInfoRow(
                        icon: Icons.work_outline_rounded,
                        title: 'Công việc / Nghề nghiệp',
                        value: currentUser.work ?? 'Chưa cập nhật',
                      ),
                      const Divider(height: 24, color: AppColors.border),
                      _buildInfoRow(
                        icon: Icons.auto_awesome_outlined,
                        title: 'Kỹ năng đặc biệt / Sở thích',
                        value: currentUser.skill ?? 'Chưa cập nhật',
                      ),
                      const Divider(height: 24, color: AppColors.border),
                      _buildInfoRow(
                        icon: Icons.pets_outlined,
                        title: 'Thú cưng / Bạn đồng hành',
                        value: currentUser.pets ?? 'Chưa cập nhật',
                      ),
                      if (currentUser.bio != null && currentUser.bio!.isNotEmpty) ...[
                        const Divider(height: 24, color: AppColors.border),
                        _buildInfoRow(
                          icon: Icons.notes_rounded,
                          title: 'Tiểu sử',
                          value: currentUser.bio!,
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 3. Section: Tour đã đi (Chuyến đi của tôi)
                _buildSectionTitle('Tour đã đi'),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF64748B).withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.luggage_outlined,
                          size: 32,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Chưa có chuyến đi nào',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Các tour du lịch bạn đã hoàn thành sẽ xuất hiện tại đây để lưu giữ hành trình trải nghiệm.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 4. Section: Đánh giá của mình
                _buildSectionTitle('Đánh giá của tôi'),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF64748B).withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.rate_review_outlined,
                          size: 32,
                          color: AppColors.secondaryDark,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Chưa có đánh giá nào',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Sau khi hoàn thành chuyến đi, những phản hồi và đánh giá của bạn sẽ được hiển thị công khai.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 36),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
        letterSpacing: -0.3,
      ),
    );
  }

  Widget _buildDetailStat({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.primary),
            const SizedBox(width: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF64748B)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
