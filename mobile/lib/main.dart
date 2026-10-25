import 'package:flutter/material.dart';
import 'core/constants/api_endpoints.dart';
import 'core/constants/app_colors.dart';
import 'core/network/api_client.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().init();
  runApp(const TripriApp());
}

class TripriApp extends StatelessWidget {
  const TripriApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tripri Travel Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const StarterHomePage(),
    );
  }
}

class StarterHomePage extends StatefulWidget {
  const StarterHomePage({super.key});

  @override
  State<StarterHomePage> createState() => _StarterHomePageState();
}

class _StarterHomePageState extends State<StarterHomePage> {
  final ApiClient _apiClient = ApiClient();
  String _apiStatus = 'Chưa kiểm tra';
  bool _isLoading = false;

  Future<void> _checkApiConnection() async {
    setState(() {
      _isLoading = true;
      _apiStatus = 'Đang kết nối tới ${ApiEndpoints.baseUrl}...';
    });

    try {
      final response = await _apiClient.get(ApiEndpoints.tours, queryParameters: {'limit': 1});
      if (response.statusCode != null && response.statusCode! < 400) {
        setState(() {
          _apiStatus = 'Kết nối API thành công (HTTP ${response.statusCode})!';
        });
      } else {
        setState(() {
          _apiStatus = 'Phản hồi từ server: HTTP ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _apiStatus = 'Lỗi kết nối (hãy đảm bảo backend cổng 3001 đang chạy): $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _triggerTestNotification() async {
    await NotificationService().showNotification(
      id: 100,
      title: 'Chào mừng đến với Tripri Mobile!',
      body: 'Hệ thống thông báo cục bộ flutter_local_notifications đã hoạt động sẵn sàng.',
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã gửi thông báo thử nghiệm! Hãy kiểm tra thanh thông báo thiết bị.'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tripri Flutter Starter', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(Icons.flutter_dash, color: Colors.white, size: 40),
              ),
              const SizedBox(height: 20),
              const Text(
                'Dự án Flutter Sẵn Sàng',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Đã cấu hình sẵn các thư viện chung: Dio API Client, Local Notifications, JWT Token Storage, Material 3 Theme.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 28),

              // API Base URL Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.link, color: AppColors.primary, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'API Base URL cấu hình:',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          ApiEndpoints.baseUrl,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Trạng thái: $_apiStatus',
                        style: TextStyle(
                          fontSize: 13,
                          color: _apiStatus.contains('thành công')
                              ? AppColors.success
                              : _apiStatus.contains('Lỗi')
                                  ? AppColors.error
                                  : AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isLoading ? null : _checkApiConnection,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.network_check),
                      label: const Text('Test API Backend'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _triggerTestNotification,
                      icon: const Icon(Icons.notifications_active_outlined),
                      label: const Text('Test Notification'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
