import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/home_discovery_cubit.dart';
import '../bloc/home_discovery_state.dart';
import '../models/category_model.dart';
import '../models/promotion_banner_model.dart';
import '../models/tour_model.dart';
import '../widgets/airbnb_search_modal.dart';
import '../widgets/banner_carousel_widget.dart';
import '../widgets/home_search_header.dart';
import '../widgets/network_error_widget.dart';
import '../widgets/tour_card_horizontal.dart';
import '../widgets/tour_card_vertical.dart';
import '../widgets/tour_shimmer_loading.dart';
import 'tour_search_screen.dart';

/// [FLOW-04] Màn hình Khám phá Trang chủ
/// Thứ tự hiển thị theo chuẩn Airbnb & Yêu cầu tối ưu:
/// 1. Top Search Header: Lời chào theo buổi (Sáng, Trưa, Chiều, Tối - không emoji) + Thanh search căn giữa
/// 2. Tour Nổi Bật (Card phong cách Airbnb Listing Card UI, không icon lửa)
/// 3. Voucher / Banner khuyến mãi du lịch
/// 4. Tour Mới Nhất
class HomeDiscoveryScreen extends StatefulWidget {
  const HomeDiscoveryScreen({super.key});

  @override
  State<HomeDiscoveryScreen> createState() => _HomeDiscoveryScreenState();
}

class _HomeDiscoveryScreenState extends State<HomeDiscoveryScreen> {
  @override
  void initState() {
    super.initState();
    final cubit = context.read<HomeDiscoveryCubit>();
    if (cubit.state is HomeDiscoveryInitial) {
      cubit.loadHomeData();
    }
  }

  void _navigateToSearch({
    String? categoryId,
    String? initialQuery,
    List<CategoryModel>? categories,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TourSearchScreen(
          initialCategoryId: categoryId,
          initialQuery: initialQuery,
          categories: categories,
        ),
      ),
    );
  }

  void _onBannerTap(PromotionBannerModel banner, List<CategoryModel> categories) {
    _navigateToSearch(
      categoryId: banner.targetCategoryId,
      initialQuery: banner.targetSearchQuery,
      categories: categories,
    );
  }

  void _onTourTap(TourModel tour) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đang mở chi tiết tour: ${tour.title}'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: BlocBuilder<HomeDiscoveryCubit, HomeDiscoveryState>(
          builder: (context, state) {
            final categories = (state is HomeDiscoveryLoaded) ? state.categories : <CategoryModel>[];

            return Column(
              children: [
                // 1. Thanh tìm kiếm trên đầu nhất (Floating 3D pill mở AirbnbSearchModal)
                HomeSearchHeader(
                  onSearchTap: () async {
                    final result = await AirbnbSearchModal.show(context);
                    if (result != null) {
                      _navigateToSearch(
                        initialQuery: result.destination,
                        categories: categories,
                      );
                    }
                  },
                ),

                // Nội dung bên dưới cuộn mượt mà
                Expanded(
                  child: _buildDiscoveryBody(context, state),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildDiscoveryBody(BuildContext context, HomeDiscoveryState state) {
    if (state is HomeDiscoveryLoading) {
      return const TourShimmerLoading();
    }

    if (state is HomeDiscoveryError) {
      return NetworkErrorWidget(
        message: state.message,
        onRetry: () => context.read<HomeDiscoveryCubit>().loadHomeData(),
      );
    }

    if (state is HomeDiscoveryLoaded) {
      return RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        onRefresh: () => context.read<HomeDiscoveryCubit>().refreshHomeData(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 14),

              // 2. Ngay dưới thanh search: Tour Nổi Bật (Card chuẩn Airbnb, bỏ icon lửa)
              _buildFeaturedToursSection(state.featuredTours, state.categories),

              const SizedBox(height: 28),

              // 3. Sau đó đến Voucher (Banner Carousel khuyến mãi)
              BannerCarouselWidget(
                banners: state.promotions,
                onBannerTap: (b) => _onBannerTap(b, state.categories),
              ),

              const SizedBox(height: 28),

              // 4. Rồi đến Tour Mới Nhất
              _buildLatestToursSection(state.latestTours, state.categories),

              const SizedBox(height: 36),
            ],
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildFeaturedToursSection(List<TourModel> tours, List<CategoryModel> categories) {
    if (tours.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tour Nổi Bật',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              InkWell(
                onTap: () => _navigateToSearch(categories: categories),
                borderRadius: BorderRadius.circular(12),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Xem tất cả',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 260,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: tours.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (context, index) {
              final tour = tours[index];
              return TourCardHorizontal(
                tour: tour,
                onTap: () => _onTourTap(tour),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildLatestToursSection(List<TourModel> tours, List<CategoryModel> categories) {
    if (tours.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tour Mới Nhất',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              InkWell(
                onTap: () => _navigateToSearch(categories: categories),
                borderRadius: BorderRadius.circular(12),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Xem tất cả',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          itemCount: tours.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final tour = tours[index];
            return TourCardVertical(
              tour: tour,
              onTap: () => _onTourTap(tour),
            );
          },
        ),
      ],
    );
  }
}
