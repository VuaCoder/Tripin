import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/constants/app_colors.dart';
import '../profile/bloc/profile_bloc.dart';
import '../profile/screens/profile_screen.dart';

class TravelerMainNavigationScreen extends StatefulWidget {
  final int initialIndex;
  const TravelerMainNavigationScreen({super.key, this.initialIndex = 0});

  @override
  State<TravelerMainNavigationScreen> createState() => _TravelerMainNavigationScreenState();
}

class _TravelerMainNavigationScreenState extends State<TravelerMainNavigationScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      _buildTabPlaceholder(
        title: 'Khám phá Tour',
        subtitle: 'Banner khuyến mãi, Tour nổi bật & Danh mục du lịch',
        icon: Icons.explore,
      ),
      _buildTabPlaceholder(
        title: 'Tìm kiếm & Bộ lọc',
        subtitle: 'Lọc tour theo giá, điểm đến, thời lượng & số sao',
        icon: Icons.search,
      ),
      _buildTabPlaceholder(
        title: 'Đơn đặt của tôi',
        subtitle: 'Lịch sử đặt tour, cổng VietQR PayOS & Vé E-Ticket',
        icon: Icons.confirmation_number_outlined,
      ),
      _buildTabPlaceholder(
        title: 'Yêu thích',
        subtitle: 'Danh sách các tour đã lưu vào Wishlist',
        icon: Icons.favorite_border,
      ),
      BlocProvider(
        create: (_) => ProfileBloc(),
        child: const ProfileScreen(),
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: const Border(top: BorderSide(color: AppColors.border, width: 0.8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: AppColors.surface,
          indicatorColor: AppColors.primarySurface,
          elevation: 0,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore, color: AppColors.primary),
              label: 'Khám phá',
            ),
            NavigationDestination(
              icon: Icon(Icons.search_outlined),
              selectedIcon: Icon(Icons.search, color: AppColors.primary),
              label: 'Tìm kiếm',
            ),
            NavigationDestination(
              icon: Icon(Icons.confirmation_number_outlined),
              selectedIcon: Icon(Icons.confirmation_number, color: AppColors.primary),
              label: 'Đơn đặt',
            ),
            NavigationDestination(
              icon: Icon(Icons.favorite_border),
              selectedIcon: Icon(Icons.favorite, color: AppColors.primary),
              label: 'Yêu thích',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person, color: AppColors.primary),
              label: 'Tài khoản',
            ),
          ],
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
                decoration: BoxDecoration(
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