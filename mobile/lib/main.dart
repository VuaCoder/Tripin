import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/constants/api_endpoints.dart';
import 'core/network/api_client.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';
import 'features/splash/screens/splash_screen.dart';
import 'features/wishlist/bloc/wishlist_cubit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().init();
  if (kDebugMode) await _devAutoLogin();
  runApp(const TripriApp());
}

/// Debug-only: shortcut dev login via --dart-define.
Future<void> _devAutoLogin() async {
  const email = String.fromEnvironment('DEV_LOGIN_EMAIL');
  const password = String.fromEnvironment('DEV_LOGIN_PASSWORD');
  if (email.isEmpty || password.isEmpty) return;
  try {
    final api = ApiClient();
    final response = await api.post(ApiEndpoints.login, data: {'email': email, 'password': password});
    final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    await api.tokenStorage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String?,
    );
  } catch (error) {
    debugPrint('[dev-login] failed: $error');
  }
}

class TripriApp extends StatelessWidget {
  const TripriApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => WishlistCubit()..loadWishlist(),
      child: MaterialApp(
        title: 'Tripri Travel Mobile',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const SplashScreen(),
      ),
    );
  }
}
