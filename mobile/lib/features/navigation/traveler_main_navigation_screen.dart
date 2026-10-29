import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/constants/app_colors.dart';
import '../profile/bloc/profile_bloc.dart';
import '../profile/screens/profile_screen.dart';

class _NavItem {
  final IconData icon;
  final IconData selectedIcon;
  final String label;

  const _NavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

class TravelerMainNavigationScreen extends StatefulWidget {
  final int initialIndex;
  const TravelerMainNavigationScreen({super.key, this.initialIndex = 0});

  @override
  State<TravelerMainNavigationScreen> createState() => _TravelerMainNavigationScreenState();
}

class _TravelerMainNavigationScreenState extends State<TravelerMainNavigationScreen> {
  int _currentIndex = 0;
  PageController? _pageController;

  PageController get _controller => _pageController ??= PageController(initialPage: _currentIndex);

  static const List<_NavItem> _navItems = [
    _NavItem(
      icon: Icons.explore_outlined,
      selectedIcon: Icons.explore_rounded,
      label: 'Khám phá',
    ),
    _NavItem(
      icon: Icons.favorite_border_rounded,
      selectedIcon: Icons.favorite_rounded,
      label: 'Yêu thích',
    ),
    _NavItem(
      icon: Icons.history_rounded,
      selectedIcon: Icons.history_rounded,
      label: 'Chuyến đi',
    ),
    _NavItem(
      icon: Icons.chat_bubble_outline_rounded,
      selectedIcon: Icons.chat_bubble_rounded,
      label: 'Tin nhắn',
    ),
    _NavItem(
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
      label: 'Tài khoản',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController?.dispose();
    super.dispose();
  }

  void _onTabSelected(int index) {
    if (_currentIndex == index) return;
    setState(() => _currentIndex = index);
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  List<Widget>? _screens;
  List<Widget> get _effectiveScreens => _screens ??= [
        _buildExploreScreen(),
        _buildTabPlaceholder(
          title: 'Tour yêu thích',
          subtitle: 'Danh sách các tour du lịch bạn đã lưu vào Wishlist',
          icon: Icons.favorite_rounded,
        ),
        _buildTabPlaceholder(
          title: 'Chuyến đi của tôi',
          subtitle: 'Lịch sử các chuyến đi đã tham gia, chi tiết tour & vé điện tử E-Ticket',
          icon: Icons.history_rounded,
        ),
        _buildTabPlaceholder(
          title: 'Tin nhắn & Trò chuyện',
          subtitle: 'Kênh chat trực tuyến với Hướng dẫn viên và Điều hành tour',
          icon: Icons.chat_bubble_rounded,
        ),
        BlocProvider(
          create: (_) => ProfileBloc(),
          child: const ProfileScreen(),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: PageView(
        controller: _controller,
        physics: const ClampingScrollPhysics(),
        onPageChanged: (idx) {
          if (_currentIndex != idx) {
            setState(() => _currentIndex = idx);
          }
        },
        children: _effectiveScreens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: const Border(top: BorderSide(color: AppColors.border, width: 0.8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 58,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_navItems.length, (i) {
                final item = _navItems[i];
                final isSelected = _currentIndex == i;
                return Expanded(
                  child: InkWell(
                    onTap: () => _onTabSelected(i),
                    splashColor: Colors.transparent,
                    highlightColor: Colors.transparent,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedScale(
                          scale: isSelected ? 1.08 : 1.0,
                          duration: const Duration(milliseconds: 200),
                          child: Icon(
                            isSelected ? item.selectedIcon : item.icon,
                            size: 24,
                            color: isSelected ? AppColors.primary : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected ? AppColors.primary : const Color(0xFF64748B),
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }

  /// Trang Khám phá với Thanh tìm kiếm STICKY cố định trên cùng khi cuộn
  Widget _buildExploreScreen() {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Sticky Search Bar Header (Cố định ở trên đỉnh màn hình khi cuộn)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: const Border(bottom: BorderSide(color: AppColors.border, width: 0.8)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Bạn muốn đi đâu?',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 1),
                          Text(
                            'Mọi điểm đến • Mọi thời điểm • Thêm khách',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.tune_rounded, color: AppColors.textSecondary, size: 20),
                  ],
                ),
              ),
            ),

            // Scrollable Tours & Highlights
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  // Promotional Hero Banner
                  Container(
                    height: 150,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF005A64), Color(0xFF0A7E8C)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'ƯU ĐÃI ĐẶC BIỆT',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Khám phá miền di sản Việt Nam',
                          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Giảm đến 30% cho các tour đặt sớm mùa hè này',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),
                  const Text(
                    'Điểm đến thịnh hành',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 12),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildDestinationChip('Đà Nẵng', Icons.location_on_outlined),
                        const SizedBox(width: 8),
                        _buildDestinationChip('Phú Quốc', Icons.beach_access_outlined),
                        const SizedBox(width: 8),
                        _buildDestinationChip('Hà Giang', Icons.landscape_outlined),
                        const SizedBox(width: 8),
                        _buildDestinationChip('Nha Trang', Icons.surfing_outlined),
                        const SizedBox(width: 8),
                        _buildDestinationChip('Sa Pa', Icons.cloud_outlined),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),
                  const Text(
                    'Gợi ý tour cho bạn',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 12),
                  _buildTourCardPlaceholder(
                    'Tour Bà Nà Hills 1 Ngày Trọn Gói',
                    'Đà Nẵng • Khởi hành hàng ngày',
                    '1.150.000đ',
                    '4.9 ★ (128 đánh giá)',
                  ),
                  const SizedBox(height: 12),
                  _buildTourCardPlaceholder(
                    'Khám phá Côn Đảo Huyền Bí 3N2Đ',
                    'Bà Rịa - Vũng Tàu • Bao vé tàu cao tốc',
                    '3.490.000đ',
                    '5.0 ★ (96 đánh giá)',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDestinationChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        ],
      ),
    );
  }

  Widget _buildTourCardPlaceholder(String title, String subtitle, String price, String rating) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.photo_outlined, size: 32, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(price, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.primary)),
                    Text(rating, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.secondaryDark)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabPlaceholder({
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        automaticallyImplyLeading: false,
      ),
      backgroundColor: AppColors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.primarySurface,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 36, color: AppColors.primary),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}