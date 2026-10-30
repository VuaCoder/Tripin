import 'package:equatable/equatable.dart';
import '../models/category_model.dart';
import '../models/promotion_banner_model.dart';
import '../models/tour_model.dart';

abstract class HomeDiscoveryState extends Equatable {
  const HomeDiscoveryState();

  @override
  List<Object?> get props => [];
}

class HomeDiscoveryInitial extends HomeDiscoveryState {
  const HomeDiscoveryInitial();
}

class HomeDiscoveryLoading extends HomeDiscoveryState {
  const HomeDiscoveryLoading();
}

class HomeDiscoveryLoaded extends HomeDiscoveryState {
  final List<CategoryModel> categories;
  final List<TourModel> featuredTours;
  final List<TourModel> latestTours;
  final List<PromotionBannerModel> promotions;
  final String? userName;
  final bool isRefreshing;

  const HomeDiscoveryLoaded({
    required this.categories,
    required this.featuredTours,
    required this.latestTours,
    required this.promotions,
    this.userName,
    this.isRefreshing = false,
  });

  HomeDiscoveryLoaded copyWith({
    List<CategoryModel>? categories,
    List<TourModel>? featuredTours,
    List<TourModel>? latestTours,
    List<PromotionBannerModel>? promotions,
    String? userName,
    bool? isRefreshing,
  }) {
    return HomeDiscoveryLoaded(
      categories: categories ?? this.categories,
      featuredTours: featuredTours ?? this.featuredTours,
      latestTours: latestTours ?? this.latestTours,
      promotions: promotions ?? this.promotions,
      userName: userName ?? this.userName,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }

  @override
  List<Object?> get props => [
        categories,
        featuredTours,
        latestTours,
        promotions,
        userName,
        isRefreshing,
      ];
}

class HomeDiscoveryError extends HomeDiscoveryState {
  final String message;

  const HomeDiscoveryError(this.message);

  @override
  List<Object?> get props => [message];
}
