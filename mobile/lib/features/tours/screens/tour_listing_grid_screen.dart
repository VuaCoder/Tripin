import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../wishlist/bloc/wishlist_cubit.dart';
import '../../wishlist/bloc/wishlist_state.dart';
import '../models/tour_model.dart';
import 'tour_detail_screen.dart';

/// Màn hình danh sách Tour dạng lưới 2 cột phong cách Airbnb
/// Có thiết kế, bố cục, nút quay lại tròn và thẻ tour giống hệt màn hình "Tour đã xem gần đây"
class TourListingGridScreen extends StatelessWidget {
  final String title;
  final List<TourModel> tours;
  final bool isFeatured;

  const TourListingGridScreen({
    super.key,
    required this.title,
    required this.tours,
    this.isFeatured = false,
  });

  @override
  Widget build(BuildContext context) {
    WishlistCubit? cubit;
    try {
      cubit = context.read<WishlistCubit>();
    } catch (_) {}

    if (cubit != null) {
      return BlocBuilder<WishlistCubit, WishlistState>(
        builder: (context, wishlistState) => _buildScaffold(context, wishlistState),
      );
    }
    return _buildScaffold(context, const WishlistState());
  }

  Widget _buildScaffold(BuildContext context, WishlistState wishlistState) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
                // 1. Top Header: Nút back hình tròn bên trái giống hệt RecentlyViewedScreen
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF3F4F6),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.arrow_back_rounded,
                              size: 20,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. Tiêu đề lớn (ví dụ "Tour Nổi Bật" hoặc "Tour Mới Nhất") và số lượng
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${tours.length} tour du lịch',
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3. Trường hợp danh sách rỗng
                if (tours.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.travel_explore_rounded,
                            size: 56,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'Chưa có tour nào',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  // 4. Lưới 2 cột cho các tour
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 20,
                        childAspectRatio: 0.74,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final tour = tours[index];
                          final isFav = wishlistState.isFavorite(tour.id);

                          return _buildTourGridItem(
                            context: context,
                            tour: tour,
                            isFavorite: isFav,
                          );
                        },
                        childCount: tours.length,
                      ),
                    ),
                  ),

                const SliverToBoxAdapter(
                  child: SizedBox(height: 32),
                ),
              ],
            ),
      ),
    );
  }

  Widget _buildTourGridItem({
    required BuildContext context,
    required TourModel tour,
    required bool isFavorite,
  }) {
    return GestureDetector(
      onTap: () {
        try {
          context.read<WishlistCubit>().recordRecentlyViewed(tour);
        } catch (_) {}
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => TourDetailScreen(tourId: tour.id),
          ),
        );
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Khối ảnh tour bo góc 16 đồng đều kích thước tuyệt đối
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  width: double.infinity,
                  height: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: const Color(0xFFF3F4F6),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: tour.coverImage != null && tour.coverImage!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: tour.coverImage!,
                            width: double.infinity,
                            height: double.infinity,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => const Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                            errorWidget: (context, url, error) => const Center(
                              child: Icon(
                                Icons.image_outlined,
                                size: 28,
                                color: AppColors.textMuted,
                              ),
                            ),
                          )
                        : const Center(
                            child: Icon(
                              Icons.travel_explore_rounded,
                              size: 32,
                              color: AppColors.primaryLight,
                            ),
                          ),
                  ),
                ),

                // Tag "Được khách yêu thích" cho Tour Nổi Bật (Chỉ hiện chữ, KHÔNG CÓ ICON)
                if (isFeatured)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'Được khách yêu thích',
                        style: TextStyle(
                          color: Color(0xFF222222),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ),

                // Nút icon Trái tim ở góc trên bên phải
                Positioned(
                  top: 10,
                  right: 10,
                  child: GestureDetector(
                    onTap: () {
                      try {
                        context.read<WishlistCubit>().handleHeartTap(
                              context: context,
                              tour: tour,
                            );
                      } catch (_) {}
                    },
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.22),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: isFavorite ? AppColors.error : Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Tên tour
          Text(
            tour.title,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              letterSpacing: -0.2,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),

          // Thông tin: Thời lượng · ★ Điểm đánh giá (ví dụ: 3 ngày 2 đêm · ★ 5.0)
          Text(
            '${tour.durationText} · ★ ${tour.formattedRating}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),

          // Giá tiền
          Text(
            tour.formattedPrice,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
