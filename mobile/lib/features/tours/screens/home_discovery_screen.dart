import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../bookings/storage/pending_booking_storage.dart';
import '../../wishlist/bloc/wishlist_cubit.dart';
import '../../wishlist/bloc/wishlist_state.dart';
import '../../wishlist/screens/recently_viewed_screen.dart';
import '../bloc/home_discovery_cubit.dart';
import '../bloc/home_discovery_state.dart';
import '../models/category_model.dart';
import '../models/promotion_banner_model.dart';
import '../models/tour_detail_model.dart';
import '../models/tour_model.dart';
import '../widgets/airbnb_search_modal.dart';
import '../widgets/banner_carousel_widget.dart';
import '../widgets/home_search_header.dart';
import '../widgets/network_error_widget.dart';
import '../widgets/tour_card_horizontal.dart';
import '../widgets/tour_card_vertical.dart';
import '../widgets/tour_shimmer_loading.dart';
import 'tour_booking_checkout_screen.dart';
import 'tour_detail_screen.dart';
import 'tour_search_screen.dart';

/// [FLOW-04] Màn hình Khám phá Trang chủ
/// Thứ tự hiển thị theo chuẩn Airbnb & Yêu cầu tối ưu:
/// 1. Top Search Header: Lời chào theo buổi + Thanh search căn giữa
/// 2. Bảng Hoàn thành tour dang dở (Nếu có đơn chưa thanh toán - nằm ngay dưới search header)
/// 3. Tour đã xem gần đây (Nằm trên đầu, thiết kế như tour nổi bật nhưng không có tag, 100% Tiếng Việt)
/// 4. Tour Nổi Bật (Card chuẩn Airbnb, nút tròn mũi tên xem tất cả)
/// 5. Voucher / Banner khuyến mãi du lịch
/// 6. Tour Mới Nhất
class HomeDiscoveryScreen extends StatefulWidget {
  const HomeDiscoveryScreen({super.key});

  @override
  State<HomeDiscoveryScreen> createState() => _HomeDiscoveryScreenState();
}

class _HomeDiscoveryScreenState extends State<HomeDiscoveryScreen> {
  PendingBookingDraft? _pendingDraft;
  final PendingBookingStorage _draftStorage = PendingBookingStorage();

  @override
  void initState() {
    super.initState();
    final cubit = context.read<HomeDiscoveryCubit>();
    if (cubit.state is HomeDiscoveryInitial) {
      cubit.loadHomeData();
    }
    _loadPendingDraft();
  }

  Future<void> _loadPendingDraft() async {
    final draft = await _draftStorage.getDraft();
    if (mounted) {
      setState(() {
        _pendingDraft = draft;
      });
    }
  }

  void _navigateToSearch({
    String? categoryId,
    String? initialQuery,
    List<CategoryModel>? categories,
  }) {
    WishlistCubit? wishlistCubit;
    try {
      wishlistCubit = context.read<WishlistCubit>();
    } catch (_) {}

    Widget searchScreen = TourSearchScreen(
      initialCategoryId: categoryId,
      initialQuery: initialQuery,
      categories: categories,
    );

    if (wishlistCubit != null) {
      searchScreen = BlocProvider.value(
        value: wishlistCubit,
        child: searchScreen,
      );
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => searchScreen,
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
    try {
      context.read<WishlistCubit>().recordRecentlyViewed(tour);
    } catch (_) {}
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TourDetailScreen(tourId: tour.id),
      ),
    ).then((_) {
      _loadPendingDraft();
    });
  }

  Future<void> _resumePendingBooking(PendingBookingDraft draft) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );

    try {
      final cubit = context.read<HomeDiscoveryCubit>();
      final res = await cubit.repository.apiClient.dio.get('/tours/${draft.tourId}');
      if (mounted && Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }

      final raw = res.data;
      Map<String, dynamic>? data;
      if (raw is Map<String, dynamic>) {
        if (raw['data'] is Map<String, dynamic>) {
          data = raw['data'] as Map<String, dynamic>;
        } else {
          data = raw;
        }
      }

      if (data != null && mounted) {
        final tour = TourDetailModel.fromJson(data);
        TourDepartureModel dep;
        try {
          dep = tour.departures.firstWhere((d) => d.id == draft.departureId);
        } catch (_) {
          dep = TourDepartureModel(
            id: draft.departureId,
            date: draft.departureDate,
            capacity: 25,
            remaining: 10,
            price: draft.totalPrice ~/
                (draft.adultsCount + draft.childrenCount > 0
                    ? (draft.adultsCount + draft.childrenCount)
                    : 1),
            isOpen: true,
          );
        }

        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => TourBookingCheckoutScreen(
              tour: tour,
              initialDeparture: dep,
              initialAdults: draft.adultsCount,
              initialChildren: draft.childrenCount,
              initialInfants: draft.infantsCount,
              initialStep: 2,
              apiClient: cubit.repository.apiClient,
            ),
          ),
        );
        _loadPendingDraft();
        return;
      }
    } catch (_) {
      if (mounted && Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }

    if (mounted) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => TourDetailScreen(tourId: draft.tourId),
        ),
      );
      _loadPendingDraft();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scaffold = Scaffold(
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

    try {
      context.read<WishlistCubit>();
      return scaffold;
    } catch (_) {
      return BlocProvider(
        create: (_) => WishlistCubit()..loadWishlist(),
        child: scaffold,
      );
    }
  }

  Widget _buildDiscoveryBody(BuildContext context, HomeDiscoveryState state) {
    if (state is HomeDiscoveryLoading) {
      return const TourShimmerLoading();
    }

    if (state is HomeDiscoveryError) {
      return NetworkErrorWidget(
        message: state.message,
        onRetry: () {
          context.read<HomeDiscoveryCubit>().loadHomeData();
          _loadPendingDraft();
        },
      );
    }

    if (state is HomeDiscoveryLoaded) {
      return BlocBuilder<WishlistCubit, WishlistState>(
        builder: (context, wishlistState) {
          final recentlyViewed = wishlistState.recentlyViewed;

          return RefreshIndicator(
            color: AppColors.primary,
            backgroundColor: AppColors.surface,
            onRefresh: () async {
              await context.read<HomeDiscoveryCubit>().refreshHomeData();
              await _loadPendingDraft();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // 2. Component "Hoàn thành tour XXX" luôn luôn nằm đầu ngay dưới search (Ảnh 2)
                  if (_pendingDraft != null) ...[
                    _buildPendingResumptionCard(_pendingDraft!),
                    const SizedBox(height: 16),
                  ],

                  // 3. Tour đã xem gần đây (nằm trên đầu, thiết kế như tour nổi bật và Ảnh 3)
                  if (recentlyViewed.isNotEmpty) ...[
                    _buildRecentlyViewedSection(recentlyViewed, wishlistState),
                    const SizedBox(height: 28),
                  ],

                  // 4. Tour Nổi Bật (Card chuẩn Airbnb, nút chuyển trang hình tròn)
                  _buildFeaturedToursSection(state.featuredTours, state.categories, wishlistState),

                  const SizedBox(height: 28),

                  // 5. Sau đó đến Voucher (Banner Carousel khuyến mãi)
                  BannerCarouselWidget(
                    banners: state.promotions,
                    onBannerTap: (b) => _onBannerTap(b, state.categories),
                  ),

                  const SizedBox(height: 28),

                  // 6. Rồi đến Tour Mới Nhất
                  _buildLatestToursSection(state.latestTours, state.categories),

                  const SizedBox(height: 36),
                ],
              ),
            ),
          );
        },
      );
    }

    return const SizedBox.shrink();
  }

  /// Nút tiêu đề mục với icon mũi tên bọc background hình tròn (Ảnh 3)
  Widget _buildSectionHeader({
    required String title,
    required VoidCallback onAction,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          InkWell(
            onTap: onAction,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                size: 18,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Component phục hồi đơn đặt tour đang dang dở (Ảnh 2)
  Widget _buildPendingResumptionCard(PendingBookingDraft draft) {
    final titleText = draft.destination?.isNotEmpty == true
        ? draft.destination!
        : draft.tourTitle;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: () => _resumePendingBooking(draft),
          borderRadius: BorderRadius.circular(22),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Layout bên trái: Chữ "Hoàn thành tour XXX" và "Ngày · Số khách >"
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Hoàn thành tour $titleText',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E293B),
                          letterSpacing: -0.4,
                          height: 1.25,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${_formatDraftDate(draft.departureDate, draft.durationDays)} · ${draft.totalGuests} khách',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.chevron_right_rounded,
                            size: 16,
                            color: Color(0xFF64748B),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),

                // Layout bên phải: Ảnh của tour đó dạng vuông bo góc
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 74,
                    height: 74,
                    child: draft.coverImage?.isNotEmpty == true
                        ? Image.network(
                            draft.coverImage!,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => _buildPlaceholderThumb(),
                          )
                        : _buildPlaceholderThumb(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatDraftDate(DateTime start, int durationDays) {
    final end = start.add(Duration(days: durationDays > 1 ? durationDays - 1 : 0));
    final startDay = start.day;
    final endDay = end.day;
    final month = end.month;
    if (startDay == endDay) {
      return '$startDay Thg $month';
    }
    return '$startDay – $endDay Thg $month';
  }

  Widget _buildPlaceholderThumb() {
    return Container(
      color: const Color(0xFFF1F5F9),
      child: const Icon(Icons.travel_explore_rounded, color: Color(0xFF94A3B8), size: 28),
    );
  }

  /// Mục "Tour đã xem gần đây" (Ảnh 3 - tiếng Việt, không tag, nằm trên đầu)
  Widget _buildRecentlyViewedSection(
    List<dynamic> recentlyViewed,
    WishlistState wishlistState,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Tour đã xem gần đây',
          onAction: () {
            WishlistCubit? cubit;
            try {
              cubit = context.read<WishlistCubit>();
            } catch (_) {}

            Widget screen = const RecentlyViewedScreen();
            if (cubit != null) {
              screen = BlocProvider.value(
                value: cubit,
                child: screen,
              );
            }

            Navigator.of(context)
                .push(
                  MaterialPageRoute(builder: (_) => screen),
                )
                .then((_) => _loadPendingDraft());
          },
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 260,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: recentlyViewed.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (context, index) {
              final item = recentlyViewed[index];
              final tour = item.tour as TourModel;
              final isFav = wishlistState.isFavorite(tour.id);

              return TourCardHorizontal(
                tour: tour,
                isFavorite: isFav,
                showBadge: false, // TUYỆT ĐỐI KHÔNG CÓ BẤT KỲ TAG NÀO THEO ĐÚNG YÊU CẦU ẢNH 3
                useDestinationTitle: true,
                width: 220,
                onFavoriteTap: () {
                  context.read<WishlistCubit>().toggleFavorite(tour: tour, context: context);
                },
                onTap: () => _onTourTap(tour),
              );
            },
          ),
        ),
      ],
    );
  }

  /// Mục "Tour Nổi Bật" với nút chuyển trang hình tròn
  Widget _buildFeaturedToursSection(
    List<TourModel> tours,
    List<CategoryModel> categories,
    WishlistState wishlistState,
  ) {
    if (tours.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Tour Nổi Bật',
          onAction: () => _navigateToSearch(categories: categories),
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
              final isFav = wishlistState.isFavorite(tour.id);
              return TourCardHorizontal(
                tour: tour,
                isFavorite: isFav,
                onFavoriteTap: () {
                  context.read<WishlistCubit>().toggleFavorite(tour: tour, context: context);
                },
                onTap: () => _onTourTap(tour),
              );
            },
          ),
        ),
      ],
    );
  }

  /// Mục "Tour Mới Nhất" với nút chuyển trang hình tròn
  Widget _buildLatestToursSection(List<TourModel> tours, List<CategoryModel> categories) {
    if (tours.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          title: 'Tour Mới Nhất',
          onAction: () => _navigateToSearch(categories: categories),
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
