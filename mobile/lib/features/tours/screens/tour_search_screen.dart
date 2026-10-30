import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/tour_search_cubit.dart';
import '../bloc/tour_search_state.dart';
import '../models/category_model.dart';
import '../models/tour_model.dart';
import '../widgets/airbnb_search_modal.dart';
import '../widgets/tour_card_airbnb.dart';
import '../widgets/tour_filter_bottom_sheet.dart';
import '../../wishlist/bloc/wishlist_cubit.dart';
import '../../wishlist/bloc/wishlist_state.dart';

/// Màn hình Danh sách & Tìm kiếm Tour du lịch phong cách Airbnb (Ảnh 1)
/// - Thanh search dạng Capsule 3D nổi bật đồng bộ với trang khám phá
/// - Nút lọc icon tinh tế, KHÔNG CÓ BACKGROUND
/// - Danh sách thẻ tour dạng lớn chuẩn Airbnb Listing Card (Ảnh 1)
/// - Nút nổi "Bản đồ" ở chính giữa cạnh dưới
class TourSearchScreen extends StatelessWidget {
  final String? initialCategoryId;
  final String? initialQuery;
  final List<CategoryModel>? categories;
  final TourSearchCubit? cubit;

  const TourSearchScreen({
    super.key,
    this.initialCategoryId,
    this.initialQuery,
    this.categories,
    this.cubit,
  });

  @override
  Widget build(BuildContext context) {
    if (cubit != null) {
      return BlocProvider<TourSearchCubit>.value(
        value: cubit!,
        child: const _TourSearchView(),
      );
    }

    return BlocProvider(
      create: (_) => TourSearchCubit()
        ..init(
          initialCategoryId: initialCategoryId,
          initialQuery: initialQuery,
          categories: categories,
        ),
      child: const _TourSearchView(),
    );
  }
}

class _TourSearchView extends StatefulWidget {
  const _TourSearchView();

  @override
  State<_TourSearchView> createState() => _TourSearchViewState();
}

class _TourSearchViewState extends State<_TourSearchView> {
  late ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    // Tải thêm trang khi còn cách đáy 200px
    if (currentScroll >= maxScroll - 200) {
      context.read<TourSearchCubit>().loadMore();
    }
  }

  /// Mở AirbnbSearchModal đồng bộ với trang Khám phá
  Future<void> _openSearchModal() async {
    final cubit = context.read<TourSearchCubit>();
    final result = await AirbnbSearchModal.show(
      context,
      initialDestination: cubit.state.searchQuery.isNotEmpty ? cubit.state.searchQuery : null,
    );

    if (result != null) {
      String? datesSummary;
      if (result.startDate != null && result.endDate != null) {
        datesSummary =
            '${DateFormat('dd/MM').format(result.startDate!)} – ${DateFormat('dd/MM').format(result.endDate!)}';
      } else if (result.flexibleDuration != null) {
        datesSummary = result.datePrecisionChip;
      }

      final guestsSummary =
          result.guestsSummary != 'Thêm khách' ? result.guestsSummary : null;

      cubit.updateSearchParams(
        query: result.destination,
        datesSummary: datesSummary,
        guestsSummary: guestsSummary,
      );
    }
  }

  /// Mở Bottom Sheet bộ lọc nâng cao (Ảnh 2)
  void _openFilterBottomSheet() {
    final cubit = context.read<TourSearchCubit>();

    TourFilterBottomSheet.show(
      context,
      initialCriteria: cubit.filterCriteria,
      categories: cubit.state.categories,
      matchingCount: cubit.state.tours.length,
      onApply: (criteria) => cubit.applyFilters(criteria),
      onReset: () => cubit.resetFilters(),
    );
  }

  void _onTourTap(TourModel tour) {
    try {
      context.read<WishlistCubit>().recordRecentlyViewed(tour);
    } catch (_) {}
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đang mở chi tiết: ${tour.title}'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<TourSearchCubit>();

    return BlocBuilder<TourSearchCubit, TourSearchState>(
      builder: (context, state) {
        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: Stack(
              children: [
                Column(
                  children: [
                    // 1. Thanh tìm kiếm Capsule 3D đồng bộ với trang khám phá & Nút lọc bỏ background (Ảnh 1)
                    _buildHeader(context, state, cubit),

                    // 2. Danh sách Tour hiển thị dạng lớn chuẩn Airbnb (Ảnh 1)
                    // Lưu ý: Đã loại bỏ hoàn toàn hàng Category chips và hàng Active filter chips theo yêu cầu
                    Expanded(
                      child: _buildTourListContent(context, state, cubit),
                    ),
                  ],
                ),

                // 3. Nút nổi "Bản đồ" ở chính giữa cạnh dưới (Ảnh 1)
                if (state.tours.isNotEmpty && state.status == TourSearchStatus.success)
                  Positioned(
                    bottom: 20,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: InkWell(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Chế độ xem bản đồ đang được hoàn thiện'),
                              duration: Duration(seconds: 1),
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(24),
                        child: Container(
                          height: 42,
                          padding: const EdgeInsets.symmetric(horizontal: 18),
                          decoration: BoxDecoration(
                            color: const Color(0xFF222222),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Bản đồ',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              SizedBox(width: 6),
                              Icon(Icons.map_rounded, color: Colors.white, size: 16),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Header gồm Nút Quay lại, Thanh Search Capsule 3D và Nút Bộ lọc không nền (Ảnh 1)
  Widget _buildHeader(BuildContext context, TourSearchState state, TourSearchCubit cubit) {
    final activeCount = cubit.activeFilterCount;

    // Dòng 1: Tiêu đề địa điểm (100% tiếng Việt)
    final titleText = state.searchQuery.isNotEmpty
        ? state.searchQuery
        : 'Địa điểm bất kỳ';

    // Dòng 2: Thời gian và khách (100% tiếng Việt)
    String subtitleText;
    if (cubit.searchDatesSummary != null || cubit.searchGuestsSummary != null) {
      final dates = cubit.searchDatesSummary ?? 'Bất kỳ tuần nào';
      final guests = cubit.searchGuestsSummary ?? 'Thêm khách';
      subtitleText = '$dates · $guests';
    } else {
      subtitleText = 'Bất kỳ tuần nào · Thêm khách';
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 16, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
      ),
      child: Row(
        children: [
          // Nút quay lại (Back Button)
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            splashRadius: 22,
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: Color(0xFF222222),
              size: 22,
            ),
          ),
          const SizedBox(width: 4),

          // Thanh Search dạng Capsule 3D nổi bật đồng bộ với trang khám phá (Ảnh 1)
          Expanded(
            child: InkWell(
              key: const Key('tour_search_capsule_btn'),
              onTap: _openSearchModal,
              borderRadius: BorderRadius.circular(32),
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    width: 1.0,
                  ),
                  // Đổ bóng 3D chân thực chuẩn Airbnb
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.search_rounded,
                      color: Color(0xFF222222),
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            titleText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF222222),
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            subtitleText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF717171),
                              letterSpacing: -0.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // NÚT ICON BỘ LỌC (BỎ BACKGROUND, VIỀN MỎNG TINH TẾ - ẢNH 1)
          InkWell(
            key: const Key('tour_search_filter_icon_btn'),
            onTap: _openFilterBottomSheet,
            borderRadius: BorderRadius.circular(21),
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Colors.transparent, // BỎ ĐI BACKGROUND HOÀN TOÀN
                shape: BoxShape.circle,
                border: Border.all(
                  color: activeCount > 0 ? const Color(0xFF222222) : const Color(0xFFCBD5E1),
                  width: 1.2,
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(
                    Icons.tune_rounded,
                    size: 19,
                    color: Color(0xFF222222),
                  ),
                  if (activeCount > 0)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        padding: const EdgeInsets.all(3.5),
                        decoration: const BoxDecoration(
                          color: Color(0xFF222222),
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                        alignment: Alignment.center,
                        child: Text(
                          '$activeCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Danh sách kết quả hiển thị Thẻ Tour lớn chuẩn Airbnb Listing Card (Ảnh 1)
  Widget _buildTourListContent(BuildContext context, TourSearchState state, TourSearchCubit cubit) {
    if (state.status == TourSearchStatus.loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (state.status == TourSearchStatus.failure) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
              const SizedBox(height: 12),
              Text(
                state.errorMessage ?? 'Đã xảy ra lỗi tìm kiếm',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => cubit.search(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    // Giao diện Empty State khi không tìm thấy tour phù hợp
    if (state.tours.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.search_off_rounded, size: 38, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 18),
              const Text(
                'Không tìm thấy tour phù hợp',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF222222),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Hãy thử thay đổi tiêu chí hoặc đặt lại bộ lọc để khám phá các hành trình hấp dẫn khác nhé!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF717171), height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () => cubit.resetFilters(),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Đặt lại bộ lọc'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF222222),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Danh sách thẻ Tour lớn Airbnb Listing Card (Ảnh 1)
    Widget listView = RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => cubit.search(isRefresh: true),
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.only(top: 4, bottom: 80),
        itemCount: state.tours.length + (cubit.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.tours.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
                ),
              ),
            );
          }

          final tour = state.tours[index];
          WishlistCubit? wishlistCubit;
          try {
            wishlistCubit = context.read<WishlistCubit>();
          } catch (_) {}

          final isFav = wishlistCubit?.isFavorite(tour.id) ?? false;

          return TourCardAirbnb(
            tour: tour,
            isFavorite: isFav,
            onFavoriteTap: () {
              wishlistCubit?.toggleFavorite(tour: tour, context: context);
            },
            onTap: () => _onTourTap(tour),
          );
        },
      ),
    );

    try {
      context.read<WishlistCubit>();
      return BlocBuilder<WishlistCubit, WishlistState>(
        builder: (context, _) => listView,
      );
    } catch (_) {
      return listView;
    }
  }
}
