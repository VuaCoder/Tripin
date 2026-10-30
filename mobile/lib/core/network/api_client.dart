import 'package:dio/dio.dart';
import '../constants/api_endpoints.dart';
import '../storage/token_storage.dart';

class ApiClient {
  late final Dio dio;
  final TokenStorage tokenStorage;

  ApiClient({TokenStorage? storage}) : tokenStorage = storage ?? TokenStorage() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Xử lý lỗi 401 Unauthorized tự động làm mới token
          if (error.response?.statusCode == 401 &&
              !error.requestOptions.path.contains('/auth/login') &&
              !error.requestOptions.path.contains('/auth/register') &&
              !error.requestOptions.path.contains('/auth/refresh')) {
            final refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                final refreshDio = Dio(
                  BaseOptions(
                    baseUrl: ApiEndpoints.baseUrl,
                    connectTimeout: const Duration(seconds: 10),
                    receiveTimeout: const Duration(seconds: 10),
                  ),
                );
                final res = await refreshDio.post(
                  ApiEndpoints.refresh,
                  data: {'refreshToken': refreshToken},
                  options: Options(headers: {'x-refresh-token': refreshToken}),
                );
                if (res.statusCode == 200 && res.data != null) {
                  final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
                  final newAccessToken = data['accessToken'] as String?;
                  final newRefreshToken = data['refreshToken'] as String?;
                  if (newAccessToken != null && newAccessToken.isNotEmpty) {
                    await tokenStorage.saveTokens(
                      accessToken: newAccessToken,
                      refreshToken: newRefreshToken ?? refreshToken,
                    );
                    final retryOpts = Options(
                      method: error.requestOptions.method,
                      headers: Map<String, dynamic>.from(error.requestOptions.headers)
                        ..['Authorization'] = 'Bearer $newAccessToken',
                    );
                    final response = await dio.request(
                      error.requestOptions.path,
                      data: error.requestOptions.data,
                      queryParameters: error.requestOptions.queryParameters,
                      options: retryOpts,
                    );
                    return handler.resolve(response);
                  }
                }
              } catch (_) {
                await tokenStorage.clearAll();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // GET helper
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  // POST helper
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  // PATCH helper
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.patch<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  // DELETE helper
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
  }
}
