import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/constants/app_colors.dart';
import '../profile/bloc/profile_bloc.dart';
import '../profile/bloc/profile_event.dart';
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

class GuideMainNavigationScreen extends StatefulWidget {
  final int initialIndex;
  const GuideMainNavigationScreen({super.key, this.initialIndex = 0});

  @override
  State<GuideMainNavigationScreen> createState() => _GuideMainNavigationScreenState();
}

class _GuideMainNavigationScreenState extends State<GuideMainNavigationScreen> {
  int _currentIndex = 0;
  PageController? _pageController;

  PageController get _controller => _pageController ??= PageController(initialPage: _currentIndex);

  static const List<_NavItem> _navItems = [
    _NavItem(
      icon: Icons.calendar_month_outlined,
      selectedIcon: Icons.calendar_month,
      label: 'Lịch tour',
    ),
    _NavItem(
      icon: Icons.qr_code_scanner,
      selectedIcon: Icons.qr_code_scanner,
      label: 'Quét QR',
    ),
    _NavItem(
      icon: Icons.account_balance_wallet_outlined,
      selectedIcon: Icons.account_balance_wallet,
      label: 'Thu nhập',
    ),
    _NavItem(
      icon: Icons.chat_bubble_outline,
      selectedIcon: Icons.chat_bubble,
      label: 'Tin nhắn',
    ),
    _NavItem(
      icon: Icons.person_outline,
      selectedIcon: Icons.person,
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
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOutCubic,
    );
  }

  List<Widget>? _screens;
  List<Widget> get _effectiveScreens => _screens ??= [
        _buildTabPlaceholder(
          title: 'Lịch Tour HDV',
          subtitle: 'Danh sách tour được phân công, xác nhận & quản lý đoàn',
          icon: Icons.calendar_month_outlined,
        ),
        _buildTabPlaceholder(
          title: 'Quét vé QR',
          subtitle: 'Camera quét mã QR vé E-Ticket điểm danh hành khách',
          icon: Icons.qr_code_scanner,
        ),
        _buildTabPlaceholder(
          title: 'Bảng thu nhập',
          subtitle: 'Thù lao dẫn tour, lịch sử chi trả và thống kê',
          icon: Icons.account_balance_wallet_outlined,
        ),
        _buildTabPlaceholder(
          title: 'Tin nhắn đoàn',
          subtitle: 'Kênh chat trực tuyến với khách đoàn & điều hành tour',
          icon: Icons.chat_bubble_outline,
        ),
        BlocProvider(
          create: (_) => ProfileBloc(),
          child: const ProfileScreen(),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
            height: 62,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_navItems.length, (i) {
                final item = _navItems[i];
                final isSelected = _currentIndex == i;
                return Expanded(
                  child: InkWell(
                    onTap: () => _onTabSelected(i),
                    borderRadius: BorderRadius.circular(16),
                    splashColor: Colors.transparent,
                    highlightColor: Colors.transparent,
                    child: Center(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeInOut,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.secondaryDark : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: AppColors.secondaryDark.withValues(alpha: 0.25),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              isSelected ? item.selectedIcon : item.icon,
                              size: 22,
                              color: isSelected ? Colors.white : const Color(0xFF64748B),
                            ),
                            const SizedBox(height: 3),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                item.label,
                                maxLines: 1,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                  color: isSelected ? Colors.white : const Color(0xFF64748B),
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
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
                  color: AppColors.secondarySurface,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 36, color: AppColors.secondaryDark),
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