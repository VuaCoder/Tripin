import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/constants/app_colors.dart';
import '../profile/bloc/profile_bloc.dart';
import '../profile/screens/profile_screen.dart';
import '../tours/bloc/home_discovery_cubit.dart';
import '../tours/screens/home_discovery_screen.dart';
import '../wishlist/bloc/wishlist_cubit.dart';
import '../wishlist/bloc/wishlist_state.dart';
import '../wishlist/screens/wishlist_screen.dart';

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
      icon: Icons.search_rounded,
      selectedIcon: Icons.search_rounded,
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

  WishlistCubit? _localWishlistCubit;

  @override
  void dispose() {
    _pageController?.dispose();
    _localWishlistCubit?.close();
    super.dispose();
  }

  void _onTabSelected(int index) {
    if (index == 1) {
      try {
        context.read<WishlistCubit>().markWishlistSeen();
      } catch (_) {
        _localWishlistCubit?.markWishlistSeen();
      }
    }
    if (_currentIndex == index) return;
    setState(() => _currentIndex = index);
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  List<Widget> _buildScreens() => [
        BlocProvider(
          create: (_) => HomeDiscoveryCubit()..loadHomeData(),
          child: const HomeDiscoveryScreen(),
        ),
        WishlistScreen(
          onExploreTap: () => _onTabSelected(0),
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
    WishlistCubit cubit;
    try {
      cubit = context.read<WishlistCubit>();
    } catch (_) {
      cubit = _localWishlistCubit ??= (WishlistCubit()..loadWishlist());
    }

    final scaffold = Scaffold(
      backgroundColor: AppColors.background,
      body: PageView(
        controller: _controller,
        physics: const ClampingScrollPhysics(),
        onPageChanged: (idx) {
          if (_currentIndex != idx) {
            setState(() => _currentIndex = idx);
          }
        },
        children: _buildScreens(),
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
            child: BlocBuilder<WishlistCubit, WishlistState>(
              builder: (context, wishlistState) {
                return Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: List.generate(_navItems.length, (i) {
                    final item = _navItems[i];
                    final isSelected = _currentIndex == i;
                    final hasBadge = i == 1 && wishlistState.hasUnseenWishlistBadge;

                    return Expanded(
                      child: InkWell(
                        onTap: () => _onTabSelected(i),
                        splashColor: Colors.transparent,
                        highlightColor: Colors.transparent,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
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
                                if (hasBadge)
                                  Positioned(
                                    top: -1,
                                    right: -3,
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                              ],
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
                );
              },
            ),
          ),
        ),
      ),
    );

    return BlocProvider<WishlistCubit>.value(
      value: cubit,
      child: scaffold,
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