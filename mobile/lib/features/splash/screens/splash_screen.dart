import 'package:flutter/material.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../auth/screens/welcome_auth_screen.dart';
import '../../navigation/guide_main_navigation_screen.dart';
import '../../navigation/traveler_main_navigation_screen.dart';
import '../widgets/boat_preloader_widget.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  final TokenStorage _tokenStorage = TokenStorage();
  final ApiClient _apiClient = ApiClient();

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );

    _fadeController.forward();

    // Khởi tạo và kiểm tra phiên đăng nhập
    _initializeAppAndCheckSession();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  Future<void> _initializeAppAndCheckSession() async {
    // Đảm bảo tối thiểu 1.8s để người dùng trải nghiệm hiệu ứng preloader mượt mà chuẩn web
    final minDelay = Future.delayed(const Duration(milliseconds: 1800));

    try {
      final token = await _tokenStorage.getAccessToken();

      await minDelay;

      if (!mounted) return;

      if (token != null && token.isNotEmpty) {
        // Kiểm tra token hợp lệ bằng cách gọi /users/me
        try {
          final response = await _apiClient.get(ApiEndpoints.me);

          if (response.statusCode == 200 && response.data != null) {
            final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
            final role = data['role'] as String? ?? 'TRAVELER';

            if (!mounted) return;

            if (role == 'TOUR_GUIDE') {
              _navigateWithFade(const GuideMainNavigationScreen());
            } else {
              _navigateWithFade(const TravelerMainNavigationScreen());
            }
            return;
          }
        } catch (_) {
          // Token hết hạn hoặc không hợp lệ -> xóa sạch và về Welcome
          await _tokenStorage.clearAll();
        }
      }

      // Chưa đăng nhập hoặc token không hợp lệ
      if (!mounted) return;
      _navigateWithFade(const WelcomeAuthScreen());
    } catch (_) {
      if (!mounted) return;
      _navigateWithFade(const WelcomeAuthScreen());
    }
  }

  void _navigateWithFade(Widget destination) {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => destination,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundSand,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            children: [
              const SizedBox(height: 32),

              // Brand Header
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryLight],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.explore,
                      size: 22,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Tripri Travel',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                      color: AppColors.primaryDark,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Khám phá thế giới • Kết nối đồng hành',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.2,
                ),
              ),

              const Spacer(),

              // Web-like Boat Preloader Effect
              const Center(
                child: BoatPreloaderWidget(
                  size: 290,
                  subtitle: 'Khám phá hành trình cùng Tripri',
                ),
              ),

              const Spacer(),

              // App Version & Copyright
              const Text(
                'Tripri Travel • Capstone WDP302',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textMuted,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}