import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/screens/welcome_auth_screen.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../models/user_profile_model.dart';
import 'edit_profile_screen.dart';
import 'guide_profile_screen.dart';
import 'user_profile_detail_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    final state = context.read<ProfileBloc>().state;
    if (state is ProfileInitial) {
      context.read<ProfileBloc>().add(const ProfileLoadRequested());
    }
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.logout, color: AppColors.error, size: 24),
            SizedBox(width: 10),
            Text('Đăng xuất tài khoản', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: const Text(
          'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Tripri Travel trên thiết bị này?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Hủy', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<ProfileBloc>().add(const LogoutRequested());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            ),
            child: const Text('Đăng xuất', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showComingSoonSnackBar(BuildContext context, String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.info_outline, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text('$feature đang được cập nhật trong phiên bản tiếp theo.')),
          ],
        ),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocConsumer<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileLoggedOut) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const WelcomeAuthScreen()),
              (route) => false,
            );
          }
        },
        builder: (context, state) {
          if (state is ProfileLoading && state.message == null) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          if (state is ProfileFailure && state.currentUser == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(
                        color: AppColors.errorSurface,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.error_outline, size: 40, color: AppColors.error),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      state.error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: () {
                        if (state.error.contains('hết hạn')) {
                          context.read<ProfileBloc>().add(const LogoutRequested());
                        } else {
                          context.read<ProfileBloc>().add(const ProfileLoadRequested());
                        }
                      },
                      icon: Icon(
                        state.error.contains('hết hạn') ? Icons.login_rounded : Icons.refresh_rounded,
                        size: 18,
                        color: Colors.white,
                      ),
                      label: Text(
                        state.error.contains('hết hạn') ? 'Đăng nhập lại' : 'Thử lại',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          final user = (state is ProfileLoaded)
              ? state.user
              : (state is ProfileUpdateSuccess)
                  ? state.user
                  : (state is ProfileFailure)
                      ? state.currentUser
                      : null;

          if (user == null) {
            return const SizedBox.shrink();
          }

          final isGuide = user.isGuide;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              context.read<ProfileBloc>().add(const ProfileLoadRequested());
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // Top Editorial Header (Airbnb Style)
                SliverToBoxAdapter(
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Hồ sơ',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.8,
                            ),
                          ),
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.border),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.notifications_none_rounded, color: AppColors.textPrimary, size: 22),
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Hệ thống thông báo cục bộ đã sẵn sàng.'),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Main Content List
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // --- 1. AIRBNB PASSPORT / HERO CARD ---
                      _buildAirbnbPassportCard(context, user, isGuide),

                      const SizedBox(height: 24),

                      // --- 2. HOST / TOUR GUIDE BANNER ---
                      if (!isGuide) ...[
                        _buildBecomeGuideBanner(context),
                        const SizedBox(height: 28),
                      ] else ...[
                        _buildGuideSpecialtyBanner(context, user),
                        const SizedBox(height: 28),
                      ],

                      // --- 3. CATEGORY 1: CÀI ĐẶT TÀI KHOẢN ---
                      _buildSectionHeader('CÀI ĐẶT TÀI KHOẢN'),
                      _buildGroupedMenuCard([
                        if (isGuide) ...[
                          _buildMenuItem(
                            icon: Icons.badge_outlined,
                            iconBgColor: const Color(0xFFFEF3C7),
                            iconColor: AppColors.secondaryDark,
                            title: 'Hồ sơ chuyên môn Hướng dẫn viên',
                            subtitle: 'Số thẻ hành nghề, ngôn ngữ, kinh nghiệm, ảnh thẻ',
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => BlocProvider.value(
                                    value: context.read<ProfileBloc>(),
                                    child: GuideProfileScreen(user: user),
                                  ),
                                ),
                              );
                            },
                          ),
                          const Divider(height: 1, indent: 64, endIndent: 16),
                        ],
                        _buildMenuItem(
                          icon: Icons.lock_outline_rounded,
                          iconBgColor: const Color(0xFFF1F5F9),
                          iconColor: const Color(0xFF475569),
                          title: 'Đăng nhập & Bảo mật',
                          subtitle: 'Đổi mật khẩu, bảo mật tài khoản',
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => BlocProvider.value(
                                  value: context.read<ProfileBloc>(),
                                  child: EditProfileScreen(
                                    initialUser: user,
                                    openChangePasswordDirectly: true,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ]),

                      const SizedBox(height: 28),

                      // --- 4. CATEGORY 2: ƯU ĐÃI & ĐẶC QUYỀN ---
                      _buildSectionHeader('ƯU ĐÃI & ĐẶC QUYỀN'),
                      _buildGroupedMenuCard([
                        _buildMenuItem(
                          icon: Icons.card_giftcard_rounded,
                          iconBgColor: const Color(0xFFFEF3C7),
                          iconColor: AppColors.secondaryDark,
                          title: 'Ưu đãi & Voucher của tôi',
                          subtitle: 'Mã giảm giá đặt tour tích lũy',
                          onTap: () => _showComingSoonSnackBar(context, 'Voucher ưu đãi'),
                        ),
                      ]),

                      const SizedBox(height: 28),

                      // --- 5. CATEGORY 3: HỖ TRỢ & PHÁP LÝ ---
                      _buildSectionHeader('HỖ TRỢ & ĐIỀU KHOẢN'),
                      _buildGroupedMenuCard([
                        _buildMenuItem(
                          icon: Icons.help_outline_rounded,
                          iconBgColor: const Color(0xFFF1F5F9),
                          iconColor: const Color(0xFF475569),
                          title: 'Trung tâm trợ giúp 24/7',
                          subtitle: 'Giải đáp thắc mắc và hỗ trợ sự cố',
                          onTap: () => _showComingSoonSnackBar(context, 'Trung tâm trợ giúp'),
                        ),
                        const Divider(height: 1, indent: 64, endIndent: 16),
                        _buildMenuItem(
                          icon: Icons.security_outlined,
                          iconBgColor: const Color(0xFFF1F5F9),
                          iconColor: const Color(0xFF475569),
                          title: 'Chính sách & Bảo mật',
                          subtitle: 'Điều khoản sử dụng dịch vụ Tripri',
                          onTap: () => _showComingSoonSnackBar(context, 'Chính sách & Bảo mật'),
                        ),
                        const Divider(height: 1, indent: 64, endIndent: 16),
                        _buildMenuItem(
                          icon: Icons.info_outline_rounded,
                          iconBgColor: const Color(0xFFF1F5F9),
                          iconColor: const Color(0xFF475569),
                          title: 'Về Tripri Travel',
                          subtitle: 'Phiên bản 1.0.0 (WDP302 Capstone)',
                          onTap: () {
                            showAboutDialog(
                              context: context,
                              applicationName: 'Tripri Travel Mobile',
                              applicationVersion: '1.0.0',
                              applicationLegalese: '© 2026 Tripri Capstone Project. Mọi quyền được bảo lưu.',
                            );
                          },
                        ),
                      ]),

                      const SizedBox(height: 32),

                      // --- 6. LOGOUT BUTTON (Airbnb Style) ---
                      Material(
                        color: Colors.white,
                        clipBehavior: Clip.antiAlias,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: AppColors.error.withValues(alpha: 0.3)),
                        ),
                        child: InkWell(
                          onTap: () => _confirmLogout(context),
                          splashColor: AppColors.errorSurface,
                          child: Container(
                            height: 52,
                            alignment: Alignment.center,
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.logout_rounded, color: AppColors.error, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Đăng xuất',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.error,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Version tag
                      const Center(
                        child: Text(
                          'Tripri Travel Mobile • Version 1.0.0 (WDP302)',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 36),
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // --- WIDGET BUILDERS ---

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: Color(0xFF64748B),
          letterSpacing: 0.9,
        ),
      ),
    );
  }

  Widget _buildGroupedMenuCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.9),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF64748B).withValues(alpha: 0.10),
            blurRadius: 16,
            spreadRadius: 0,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: const Color(0xFF94A3B8).withValues(alpha: 0.06),
            blurRadius: 4,
            spreadRadius: 0,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: Column(children: children),
        ),
      ),
    );
  }

  /// Airbnb-style Passport Hero Card
  Widget _buildAirbnbPassportCard(BuildContext context, UserProfileModel user, bool isGuide) {
    final isVerified = user.isVerified == true;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF64748B).withValues(alpha: 0.12),
            blurRadius: 18,
            spreadRadius: 0,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: const Color(0xFF94A3B8).withValues(alpha: 0.08),
            blurRadius: 6,
            spreadRadius: 0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => BlocProvider.value(
                    value: context.read<ProfileBloc>(),
                    child: UserProfileDetailScreen(user: user),
                  ),
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Avatar with conditional Verified Frame & Badge
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
                                width: isVerified ? 2.2 : 1.5,
                              ),
                            ),
                            child: CircleAvatar(
                              radius: 38,
                              backgroundColor: AppColors.primarySurface,
                              child: ClipOval(
                                child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: user.avatarUrl!,
                                        width: 76,
                                        height: 76,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => const CircularProgressIndicator(strokeWidth: 2),
                                        errorWidget: (context, url, error) => const Icon(Icons.person, size: 38, color: AppColors.primary),
                                      )
                                    : const Icon(Icons.person, size: 38, color: AppColors.primary),
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
                                  size: 20,
                                  color: isGuide ? AppColors.secondaryDark : AppColors.success,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 16),

                      // Name & Clean Role (no email, plain text role)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.fullName,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                letterSpacing: -0.4,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isGuide ? 'Hướng dẫn viên du lịch' : 'Khách du lịch',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.textMuted),
                    ],
                  ),

                  const SizedBox(height: 18),
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: 16),

                  // Passport Stats Row (Airbnb Feature)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildPassportStat(
                        title: 'Chuyến đi',
                        value: isGuide
                            ? (user.guideProfile?.experienceYears != null ? '${user.guideProfile!.experienceYears} năm' : '0')
                            : '0',
                        icon: Icons.flight_takeoff_rounded,
                      ),
                      Container(height: 28, width: 1, color: AppColors.border),
                      _buildPassportStat(
                        title: 'Đánh giá',
                        value: 'Chưa có',
                        icon: Icons.star_rounded,
                        valueColor: AppColors.textSecondary,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPassportStat({
    required String title,
    required String value,
    required IconData icon,
    Color? valueColor,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: valueColor ?? AppColors.textPrimary),
            const SizedBox(width: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: valueColor ?? AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  /// Banner inviting user to become a Guide (Airbnb Host style)
  Widget _buildBecomeGuideBanner(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF005A64), Color(0xFF00383E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () {
            _showComingSoonSnackBar(context, 'Chương trình đăng ký Hướng dẫn viên');
          },
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'CƠ HỘI ĐỒNG HÀNH',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppColors.secondary,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Trở thành Hướng dẫn viên',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Dẫn tour, chia sẻ văn hóa địa phương và gia tăng thu nhập cùng Tripri.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFFBCE3E7),
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Banner for existing Tour Guides
  Widget _buildGuideSpecialtyBanner(BuildContext context, UserProfileModel user) {
    final guideData = user.guideProfile;
    final licenseNumber = guideData?.licenseNumber ?? 'Chưa cập nhật số thẻ';
    final experience = guideData?.experienceYears != null ? '${guideData!.experienceYears} năm kinh nghiệm' : 'Chưa cập nhật kinh nghiệm';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFFDE68A)),
        boxShadow: [
          BoxShadow(
            color: Colors.amber.withValues(alpha: 0.1),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => BlocProvider.value(
                  value: context.read<ProfileBloc>(),
                  child: GuideProfileScreen(user: user),
                ),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.workspace_premium_rounded, color: AppColors.secondaryDark, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Hồ sơ Hướng dẫn viên chính thức',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF78350F),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Số thẻ: $licenseNumber • $experience',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF92400E),
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFFB45309)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Refined Airbnb Menu Item with soft rounded icon background
  Widget _buildMenuItem({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.primarySurface.withValues(alpha: 0.5),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textMuted, size: 14),
            ],
          ),
        ),
      ),
    );
  }
}