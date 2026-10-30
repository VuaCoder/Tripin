import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/storage/token_storage.dart';
import '../models/category_model.dart';
import '../models/promotion_banner_model.dart';
import '../models/tour_model.dart';
import 'home_discovery_state.dart';
import 'tours_repository.dart';

class HomeDiscoveryCubit extends Cubit<HomeDiscoveryState> {
  final ToursRepository _repository;
  final TokenStorage _tokenStorage;

  HomeDiscoveryCubit({
    ToursRepository? repository,
    TokenStorage? tokenStorage,
  })  : _repository = repository ?? ToursRepository(),
        _tokenStorage = tokenStorage ?? TokenStorage(),
        super(const HomeDiscoveryInitial());

  /// Tải dữ liệu trang chủ đồng thời (Parallel loading) tối ưu hiệu năng
  Future<void> loadHomeData() async {
    emit(const HomeDiscoveryLoading());
    try {
      final userFuture = _getUserName();
      final categoriesFuture = _repository.getCategories();
      final featuredToursFuture = _repository.getFeaturedTours();
      final latestToursFuture = _repository.getLatestTours();
      final promotionsFuture = _repository.getPromotions();

      final results = await Future.wait([
        userFuture,
        categoriesFuture,
        featuredToursFuture,
        latestToursFuture,
        promotionsFuture,
      ]);

      final userName = results[0] as String?;
      final categories = results[1] as List<CategoryModel>;
      final featuredTours = results[2] as List<TourModel>;
      final latestTours = results[3] as List<TourModel>;
      final promotions = results[4] as List<PromotionBannerModel>;

      emit(HomeDiscoveryLoaded(
        categories: categories,
        featuredTours: featuredTours,
        latestTours: latestTours,
        promotions: promotions,
        userName: userName,
      ));
    } catch (e) {
      emit(HomeDiscoveryError(
        'Không thể tải dữ liệu trang chủ lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.',
      ));
    }
  }

  /// Kéo xuống để làm mới (Pull-to-refresh)
  Future<void> refreshHomeData() async {
    final currentState = state;
    if (currentState is HomeDiscoveryLoaded) {
      emit(currentState.copyWith(isRefreshing: true));
    }

    try {
      final userFuture = _getUserName();
      final categoriesFuture = _repository.getCategories();
      final featuredToursFuture = _repository.getFeaturedTours();
      final latestToursFuture = _repository.getLatestTours();
      final promotionsFuture = _repository.getPromotions();

      final results = await Future.wait([
        userFuture,
        categoriesFuture,
        featuredToursFuture,
        latestToursFuture,
        promotionsFuture,
      ]);

      final userName = results[0] as String?;
      final categories = results[1] as List<CategoryModel>;
      final featuredTours = results[2] as List<TourModel>;
      final latestTours = results[3] as List<TourModel>;
      final promotions = results[4] as List<PromotionBannerModel>;

      emit(HomeDiscoveryLoaded(
        categories: categories,
        featuredTours: featuredTours,
        latestTours: latestTours,
        promotions: promotions,
        userName: userName,
        isRefreshing: false,
      ));
    } catch (_) {
      if (currentState is HomeDiscoveryLoaded) {
        emit(currentState.copyWith(isRefreshing: false));
      } else {
        emit(const HomeDiscoveryError(
          'Làm mới thất bại. Vui lòng kiểm tra lại kết nối mạng.',
        ));
      }
    }
  }

  Future<String?> _getUserName() async {
    try {
      final info = await _tokenStorage.getUserInfo();
      return info['name'];
    } catch (_) {
      return null;
    }
  }
}
