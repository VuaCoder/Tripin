import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/constants/app_colors.dart';
import '../profile/bloc/profile_bloc.dart';
import '../profile/screens/profile_screen.dart';

class GuideMainNavigationScreen extends StatefulWidget {
  final int initialIndex;
  const GuideMainNavigationScreen({super.key, this.initialIndex = 0});

  @override
  State<GuideMainNavigationScreen> createState() => _GuideMainNavigationScreenState();
}

class _GuideMainNavigationScreenState extends State<GuideMainNavigationScreen> {
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
          indicatorColor: AppColors.secondarySurface,
          elevation: 0,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined),
              selectedIcon: Icon(Icons.calendar_month, color: AppColors.secondaryDark),
              label: 'Lịch tour',
            ),
            NavigationDestination(
              icon: Icon(Icons.qr_code_scanner),
              selectedIcon: Icon(Icons.qr_code_scanner, color: AppColors.secondaryDark),
              label: 'Quét QR',
            ),
            NavigationDestination(
              icon: Icon(Icons.account_balance_wallet_outlined),
              selectedIcon: Icon(Icons.account_balance_wallet, color: AppColors.secondaryDark),
              label: 'Thu nhập',
            ),
            NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble, color: AppColors.secondaryDark),
              label: 'Tin nhắn',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person, color: AppColors.secondaryDark),
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