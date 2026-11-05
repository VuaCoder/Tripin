import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/wishlist_item_model.dart';

class WishlistRepository {
  final ApiClient _apiClient;
  final TokenStorage _tokenStorage;

  WishlistRepository({
    ApiClient? apiClient,
    TokenStorage? tokenStorage,
  })  : _apiClient = apiClient ?? ApiClient(),
        _tokenStorage = tokenStorage ?? TokenStorage();

  /// Kiểm tra xem người dùng hiện tại có token đăng nhập hay là khách vãng lai
  Future<bool> isAuthenticated() async {
    final token = await _tokenStorage.getAccessToken();
    return token != null && token.isNotEmpty;
  }

  /// Lấy danh sách tour đã lưu trong wishlist (GET /api/v1/wishlist)
  Future<List<WishlistItemModel>> getWishlist({
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _apiClient.get(
      ApiEndpoints.wishlist,
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      final rawData = response.data;
      List<dynamic> list = [];

      if (rawData is Map<String, dynamic>) {
        if (rawData['data'] is List) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData['items'] is List) {
          list = rawData['items'] as List<dynamic>;
        }
      } else if (rawData is List) {
        list = rawData;
      }

      return list
          .map((item) => WishlistItemModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return [];
  }

  /// Thêm tour vào wishlist (POST /api/v1/wishlist/:tourId)
  Future<void> addToWishlist(String tourId) async {
    await _apiClient.post(ApiEndpoints.wishlistTour(tourId));
  }

  /// Xóa tour khỏi wishlist (DELETE /api/v1/wishlist/:tourId)
  Future<void> removeFromWishlist(String tourId) async {
    await _apiClient.delete(ApiEndpoints.wishlistTour(tourId));
  }
}
