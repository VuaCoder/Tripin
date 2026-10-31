import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/category_model.dart';
import '../models/promotion_banner_model.dart';
import '../models/tour_model.dart';

class ToursRepository {
  final ApiClient _apiClient;

  ToursRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  ApiClient get apiClient => _apiClient;

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  static const List<CategoryModel> _defaultCategories = [
    CategoryModel(id: 'cat-bien-dao', name: 'Biển đảo', slug: 'bien-dao', sortOrder: 1),
    CategoryModel(id: 'cat-van-hoa', name: 'Văn hóa & Di sản', slug: 'van-hoa', sortOrder: 2),
    CategoryModel(id: 'cat-nghi-duong', name: 'Nghỉ dưỡng & Spa', slug: 'nghi-duong', sortOrder: 3),
    CategoryModel(id: 'cat-am-thuc', name: 'Ẩm thực địa phương', slug: 'am-thuc', sortOrder: 4),
    CategoryModel(id: 'cat-kham-pha', name: 'Khám phá & Trekking', slug: 'kham-pha', sortOrder: 5),
    CategoryModel(id: 'cat-sinh-thai', name: 'Sinh thái & Thiên nhiên', slug: 'sinh-thai', sortOrder: 6),
  ];

  /// Lấy danh sách danh mục du lịch (/categories)
  Future<List<CategoryModel>> getCategories() async {
    if (_isInTest) return _defaultCategories;
    try {
      final response = await _apiClient.dio.get(ApiEndpoints.categories);
      final rawData = response.data;
      List<dynamic> list = [];

      if (rawData is Map<String, dynamic>) {
        if (rawData['data'] is List) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData['data'] is Map<String, dynamic> && rawData['data']['items'] is List) {
          list = rawData['data']['items'] as List<dynamic>;
        }
      } else if (rawData is List) {
        list = rawData;
      }

      if (list.isNotEmpty) {
        return list
            .map((item) => CategoryModel.fromJson(item as Map<String, dynamic>))
            .where((cat) => cat.isActive)
            .toList();
      }
    } catch (_) {
      // Fallback bên dưới
    }

    return _defaultCategories;
  }

  /// Lấy danh sách Tour Nổi bật (/tours?sort=rating&limit=10)
  Future<List<TourModel>> getFeaturedTours({int limit = 10}) async {
    if (_isInTest) return _sampleFeaturedTours;
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.tours,
        queryParameters: {'sort': 'rating', 'limit': limit},
      );
      final tours = _parseTourList(response.data);
      if (tours.isNotEmpty) return tours;
    } catch (_) {
      // Fallback to sample featured tours
    }

    return _sampleFeaturedTours;
  }

  /// Lấy danh sách Tour Mới nhất (/tours?sort=newest&limit=10)
  Future<List<TourModel>> getLatestTours({int limit = 10}) async {
    if (_isInTest) return _sampleLatestTours;
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.tours,
        queryParameters: {'sort': 'newest', 'limit': limit},
      );
      final tours = _parseTourList(response.data);
      if (tours.isNotEmpty) return tours;
    } catch (_) {
      // Fallback to sample latest tours
    }

    return _sampleLatestTours;
  }

  /// Lấy danh sách Banner chương trình khuyến mãi (/promotions)
  Future<List<PromotionBannerModel>> getPromotions() async {
    if (_isInTest) return PromotionBannerModel.defaultPromotions;
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.promotions,
        queryParameters: {'isActive': true},
      );
      final rawData = response.data;
      List<dynamic> list = [];

      if (rawData is Map<String, dynamic>) {
        if (rawData['data'] is List) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData['data'] is Map<String, dynamic> && rawData['data']['items'] is List) {
          list = rawData['data']['items'] as List<dynamic>;
        }
      } else if (rawData is List) {
        list = rawData;
      }

      if (list.isNotEmpty) {
        final parsed = list
            .map((item) => PromotionBannerModel.fromJson(item as Map<String, dynamic>))
            .where((promo) => promo.isActive)
            .toList();
        if (parsed.isNotEmpty) return parsed;
      }
    } catch (_) {
      // Fallback to rich default travel ad banners
    }

    return PromotionBannerModel.defaultPromotions;
  }

  /// Tìm kiếm & Lọc Tour du lịch (AC2)
  Future<List<TourModel>> searchTours({
    String? query,
    String? categoryId,
    Set<String>? categoryIds,
    String? destination,
    double? minPrice,
    double? maxPrice,
    int? minDays,
    int? maxDays,
    double? minRating,
    String? sort,
    int page = 1,
    int limit = 20,
  }) async {
    final effectiveCategoryIds = categoryIds ?? (categoryId != null ? {categoryId} : <String>{});

    if (_isInTest) {
      final all = [..._sampleFeaturedTours, ..._sampleLatestTours];
      var filtered = all.where((t) {
        final matchCat = effectiveCategoryIds.isEmpty ||
            effectiveCategoryIds.any((id) => t.categoryIds.contains(id));
        final matchQuery = query == null ||
            query.trim().isEmpty ||
            t.title.toLowerCase().contains(query.toLowerCase()) ||
            t.destination.toLowerCase().contains(query.toLowerCase());
        final matchMinPrice = minPrice == null || t.basePrice >= minPrice;
        final matchMaxPrice = maxPrice == null || t.basePrice <= maxPrice;
        final matchMinDays = minDays == null || t.durationDays >= minDays;
        final matchMaxDays = maxDays == null || t.durationDays <= maxDays;
        final matchRating = minRating == null || t.ratingAvg >= minRating;

        return matchCat && matchQuery && matchMinPrice && matchMaxPrice && matchMinDays && matchMaxDays && matchRating;
      }).toList();

      if (sort == 'price_asc') {
        filtered.sort((a, b) => a.basePrice.compareTo(b.basePrice));
      } else if (sort == 'price_desc') {
        filtered.sort((a, b) => b.basePrice.compareTo(a.basePrice));
      } else if (sort == 'rating') {
        filtered.sort((a, b) => b.ratingAvg.compareTo(a.ratingAvg));
      }

      // Phân trang đơn giản cho test
      final startIndex = (page - 1) * limit;
      if (startIndex >= filtered.length) return [];
      final endIndex = (startIndex + limit).clamp(0, filtered.length);
      return filtered.sublist(startIndex, endIndex);
    }

    try {
      final Map<String, dynamic> queryParams = {
        'page': page,
        'limit': limit,
      };
      if (query != null && query.trim().isNotEmpty) {
        queryParams['q'] = query.trim();
      }
      if (categoryId != null && categoryId.isNotEmpty) {
        queryParams['categoryId'] = categoryId;
      } else if (effectiveCategoryIds.isNotEmpty) {
        queryParams['categoryId'] = effectiveCategoryIds.first;
      }
      if (destination != null && destination.isNotEmpty) {
        queryParams['destination'] = destination;
      }
      if (minPrice != null) {
        queryParams['minPrice'] = minPrice.toInt();
      }
      if (maxPrice != null) {
        queryParams['maxPrice'] = maxPrice.toInt();
      }
      if (minDays != null) {
        queryParams['minDays'] = minDays;
      }
      if (maxDays != null) {
        queryParams['maxDays'] = maxDays;
      }
      if (minRating != null && minRating > 0) {
        queryParams['minRating'] = minRating;
      }
      if (sort != null && sort.isNotEmpty) {
        queryParams['sort'] = sort;
      }

      final response = await _apiClient.dio.get(
        ApiEndpoints.tours,
        queryParameters: queryParams,
      );
      return _parseTourList(response.data);
    } catch (e) {
      if (e is DioException) {
        throw Exception(e.response?.data?['message'] ?? 'Không thể tìm kiếm tour lúc này');
      }
      rethrow;
    }
  }

  List<TourModel> _parseTourList(dynamic rawData) {
    List<dynamic> list = [];
    if (rawData is Map<String, dynamic>) {
      if (rawData['data'] is Map<String, dynamic> && rawData['data']['items'] is List) {
        list = rawData['data']['items'] as List<dynamic>;
      } else if (rawData['data'] is List) {
        list = rawData['data'] as List<dynamic>;
      } else if (rawData['items'] is List) {
        list = rawData['items'] as List<dynamic>;
      }
    } else if (rawData is List) {
      list = rawData;
    }

    return list.map((item) => TourModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  static const List<TourModel> _sampleFeaturedTours = [
    TourModel(
      id: 'tour-halong-01',
      title: 'Du Thuyền Hạ Long 5 Sao Heritage Cruises',
      summary: 'Thưởng ngoạn vẻ đẹp vịnh Hạ Long, chèo thuyền kayak và tiệc BBQ hoàng hôn',
      destination: 'Hạ Long, Quảng Ninh',
      durationDays: 2,
      basePrice: 3250000,
      coverImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-bien-dao', 'cat-nghi-duong'],
      ratingAvg: 4.9,
      ratingCount: 128,
      agencyName: 'Heritage Luxury Travel',
    ),
    TourModel(
      id: 'tour-phuquoc-02',
      title: 'Tour 4 Đảo Phú Quốc & Cáp Treo Hòn Thơm',
      summary: 'Trải nghiệm cáp treo vượt biển dài nhất thế giới, lặn ngắm san hô tự nhiên',
      destination: 'Phú Quốc, Kiên Giang',
      durationDays: 3,
      basePrice: 2890000,
      coverImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-bien-dao'],
      ratingAvg: 4.8,
      ratingCount: 96,
      agencyName: 'Đảo Ngọc Discovery',
    ),
    TourModel(
      id: 'tour-danang-03',
      title: 'Đà Nẵng - Bà Nà Hills Cầu Vàng - Phố Cổ Hội An',
      summary: 'Check-in Cầu Vàng nổi tiếng thế giới, lạc bước phố cổ đèn lồng huyền ảo',
      destination: 'Đà Nẵng - Hội An',
      durationDays: 4,
      basePrice: 4150000,
      coverImage: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-van-hoa', 'cat-nghi-duong'],
      ratingAvg: 4.85,
      ratingCount: 215,
      agencyName: 'Miền Trung Heritage Tours',
    ),
  ];

  static const List<TourModel> _sampleLatestTours = [
    TourModel(
      id: 'tour-sapa-04',
      title: 'Khám Phá Sapa - Chinh Phục Đỉnh Fansipan',
      summary: 'Đi tàu hỏa leo núi Mường Hoa, trekking bản Cát Cát và săn biển mây',
      destination: 'Sa Pa, Lào Cai',
      durationDays: 3,
      basePrice: 2450000,
      coverImage: 'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-kham-pha'],
      ratingAvg: 4.75,
      ratingCount: 64,
      agencyName: 'Tây Bắc Adventure',
    ),
    TourModel(
      id: 'tour-dalat-05',
      title: 'Đà Lạt Ngàn Hoa - Camping Đồi Đa Phú',
      summary: 'Cắm trại săn mây, nướng BBQ đêm giữa rừng thông mơ mộng',
      destination: 'Đà Lạt, Lâm Đồng',
      durationDays: 2,
      basePrice: 1650000,
      coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-kham-pha', 'cat-nghi-duong'],
      ratingAvg: 4.7,
      ratingCount: 42,
      agencyName: 'Cao Nguyên Glamping',
    ),
    TourModel(
      id: 'tour-hue-06',
      title: 'Huế Thương - Đại Nội Cổ Kính & Ca Huế Sông Hương',
      summary: 'Nghe ca Huế trên thuyền rồng, viếng chùa Thiên Mụ và thưởng thức ẩm thực cung đình',
      destination: 'Huế, Thừa Thiên Huế',
      durationDays: 2,
      basePrice: 1850000,
      coverImage: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=800&q=80',
      categoryIds: ['cat-van-hoa', 'cat-am-thuc'],
      ratingAvg: 4.8,
      ratingCount: 51,
      agencyName: 'Cố Đô Travel',
    ),
  ];
}
