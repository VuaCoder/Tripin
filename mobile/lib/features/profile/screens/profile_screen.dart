import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/screens/welcome_auth_screen.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import 'edit_profile_screen.dart';
import 'guide_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Đăng xuất tài khoản', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng Tripri Travel?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Hủy', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<ProfileBloc>().add(const LogoutRequested());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Đăng xuất', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Tài khoản của tôi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
        automaticallyImplyLeading: false,
      ),
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
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text(state.error, style: const TextStyle(color: AppColors.textSecondary)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.read<ProfileBloc>().add(const ProfileLoadRequested()),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                    child: const Text('Thử lại', style: TextStyle(color: Colors.white)),
                  ),
                ],
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
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                children: [
                  // User Profile Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 36,
                          backgroundColor: AppColors.primarySurface,
                          child: ClipOval(
                            child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: user.avatarUrl!,
                                    width: 72,
                                    height: 72,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => const CircularProgressIndicator(strokeWidth: 2),
                                    errorWidget: (context, url, error) => const Icon(Icons.person, size: 36, color: AppColors.primary),
                                  )
                                : const Icon(Icons.person, size: 36, color: AppColors.primary),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.fullName,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                user.email,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              // Role Badge
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isGuide ? AppColors.secondarySurface : AppColors.primarySurface,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  isGuide ? 'Hướng dẫn viên' : 'Khách du lịch',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isGuide ? AppColors.secondaryDark : AppColors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Menu Section: Chuyên môn & Tài khoản
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        _buildMenuItem(
                          icon: Icons.person_outline,
                          title: 'Chỉnh sửa thông tin cá nhân',
                          subtitle: 'Cập nhật họ tên, số điện thoại, avatar',
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => BlocProvider.value(
                                  value: context.read<ProfileBloc>(),
                                  child: EditProfileScreen(initialUser: user),
                                ),
                              ),
                            );
                          },
                        ),
                        if (isGuide) ...[
                          const Divider(height: 1, indent: 56),
                          _buildMenuItem(
                            icon: Icons.badge_outlined,
                            iconColor: AppColors.secondary,
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
                        ],
                        const Divider(height: 1, indent: 56),
                        _buildMenuItem(
                          icon: Icons.notifications_none_outlined,
                          title: 'Cài đặt thông báo',
                          subtitle: 'Thông báo tour, trạng thái đơn đặt',
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Hệ thống thông báo cục bộ đã sẵn sàng.'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Menu Section: Hỗ trợ & Ứng dụng
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        _buildMenuItem(
                          icon: Icons.info_outline,
                          title: 'Về Tripri Travel',
                          subtitle: 'Phiên bản 1.0.0 (WDP302 Capstone)',
                          onTap: () {},
                        ),
                        const Divider(height: 1, indent: 56),
                        _buildMenuItem(
                          icon: Icons.security_outlined,
                          title: 'Chính sách & Bảo mật',
                          subtitle: 'Điều khoản sử dụng dịch vụ',
                          onTap: () {},
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Đăng xuất
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmLogout(context),
                      icon: const Icon(Icons.logout, color: AppColors.error, size: 20),
                      label: const Text(
                        'Đăng xuất',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.error,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.error, width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        backgroundColor: AppColors.surface,
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    Color iconColor = AppColors.primary,
  }) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: iconColor, size: 22),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
    );
  }
}