import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';
import '../../tours/screens/tour_detail_screen.dart';
import '../bloc/wishlist_cubit.dart';
import '../bloc/wishlist_state.dart';
import '../models/recently_viewed_model.dart';

/// Màn hình danh sách "Gần đây" (Recently viewed)
/// Ảnh 1: Xem bình thường theo nhóm ngày (Hôm nay, Thứ Hai...) kèm icon Trái tim trên ảnh
/// Ảnh 2: Khi bấm Chỉnh sửa, nút trên đổi thành "Xong", xuất hiện nút (x) trắng trên góc trái ảnh để xóa
class RecentlyViewedScreen extends StatefulWidget {
  const RecentlyViewedScreen({super.key});

  @override
  State<RecentlyViewedScreen> createState() => _RecentlyViewedScreenState();
}

class _RecentlyViewedScreenState extends State<RecentlyViewedScreen> {
  bool _isEditing = false;

  void _toggleEditMode() {
    setState(() {
      _isEditing = !_isEditing;
    });
  }

  void _confirmDeleteTour(BuildContext context, TourModel tour) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text(
          'Xóa khỏi mục gần đây?',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: Text(
          'Bạn có muốn xóa "${tour.title}" khỏi danh sách xem gần đây không?',
          style: const TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
            height: 1.4,
          ),
        ),
        actionsPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Hủy',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<WishlistCubit>().removeRecentlyViewed(tour.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text(
              'Xóa',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: BlocBuilder<WishlistCubit, WishlistState>(
          builder: (context, state) {
            final items = state.recentlyViewed;

            // Nhóm các tour theo nhãn thời gian tương đối ("Hôm nay", "Hôm qua", "Thứ Hai, 19 tháng 10"...)
            final Map<String, List<RecentlyViewedTourModel>> grouped = {};
            for (final item in items) {
              final groupKey = item.relativeTime;
              grouped.putIfAbsent(groupKey, () => []).add(item);
            }

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                // Top Header: Nút back hình tròn bên trái và nút Chỉnh sửa / Xong dạng pill bên phải (Ảnh 1 & 2)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Nút quay lại hình tròn
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

                        // Nút Chỉnh sửa / Xong dạng pill
                        if (items.isNotEmpty)
                          GestureDetector(
                            onTap: _toggleEditMode,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F4F6),
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: Text(
                                _isEditing ? 'Xong' : 'Chỉnh sửa',
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // Tiêu đề lớn "Gần đây"
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
                    child: Text(
                      'Gần đây',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.6,
                      ),
                    ),
                  ),
                ),

                // Trường hợp danh sách rỗng
                if (items.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.history_rounded,
                            size: 56,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'Chưa có tour xem gần đây',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Các tour bạn vừa xem sẽ được lưu tại đây.',
                            style: TextStyle(
                              fontSize: 13.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  // Danh sách từng nhóm ngày kèm lưới 2 cột
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, groupIndex) {
                        final groupKey = grouped.keys.elementAt(groupIndex);
                        final groupItems = grouped[groupKey]!;

                        return Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Tiêu đề nhóm ngày (ví dụ: Hôm nay, Thứ Hai, 19 tháng 10...)
                              Text(
                                groupKey,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 14),

                              // Lưới 2 cột cho các tour trong ngày đó
                              GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 16,
                                  mainAxisSpacing: 20,
                                  childAspectRatio: 0.74,
                                ),
                                itemCount: groupItems.length,
                                itemBuilder: (context, index) {
                                  final item = groupItems[index];
                                  final tour = item.tour;
                                  final isFav = state.isFavorite(tour.id);

                                  return _buildTourGridItem(
                                    context: context,
                                    tour: tour,
                                    isFavorite: isFav,
                                  );
                                },
                              ),
                            ],
                          ),
                        );
                      },
                      childCount: grouped.length,
                    ),
                  ),

                const SliverToBoxAdapter(
                  child: SizedBox(height: 32),
                ),
              ],
            );
          },
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
        if (_isEditing) {
          _confirmDeleteTour(context, tour);
          return;
        }

        context.read<WishlistCubit>().recordRecentlyViewed(tour);
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
          // Khối ảnh tour bo góc 16
          Expanded(
            child: Stack(
              children: [
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: const Color(0xFFF3F4F6),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: tour.coverImage != null && tour.coverImage!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: tour.coverImage!,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => const Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                            errorWidget: (context, url, error) => const Icon(
                              Icons.image_outlined,
                              size: 28,
                              color: AppColors.textMuted,
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

                // Ảnh 1 (Chế độ xem bình thường): Nút icon Trái tim ở góc trên bên phải
                if (!_isEditing)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: GestureDetector(
                      onTap: () {
                        context.read<WishlistCubit>().handleHeartTap(
                              context: context,
                              tour: tour,
                            );
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

                // Ảnh 2 (Chế độ Chỉnh sửa): Nút tròn màu trắng (x) ở góc trên bên trái
                if (_isEditing)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: GestureDetector(
                      onTap: () => _confirmDeleteTour(context, tour),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black26,
                              blurRadius: 4,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 16,
                          color: Color(0xFF222222),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Tên tour (ví dụ: Room in Kuala Lumpur)
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

          // Thông tin: Thời lượng · ★ Điểm đánh giá (ví dụ: 1 ngày · ★ 4.9)
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
        ],
      ),
    );
  }
}
