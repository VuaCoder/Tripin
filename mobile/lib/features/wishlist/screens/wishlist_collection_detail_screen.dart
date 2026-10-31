import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';
import '../../tours/screens/tour_detail_screen.dart';
import '../bloc/wishlist_cubit.dart';
import '../bloc/wishlist_state.dart';
import '../models/wishlist_collection_model.dart';

/// Màn hình chi tiết một Wishlist do người dùng tự tạo (Ảnh 1)
/// Bỏ phần Share và Dates·Guests theo yêu cầu
/// Header gồm nút Back tròn bên trái, nút 3 chấm (...) tròn bên phải
/// Bấm 3 chấm (...) mở Settings Sheet với đúng 2 mục: Sửa tên và Xóa
/// Layout các tour dạng lưới 2 cột giống hệt bên mục "Gần đây"
class WishlistCollectionDetailScreen extends StatefulWidget {
  final String collectionId;
  final String title;

  const WishlistCollectionDetailScreen({
    super.key,
    required this.collectionId,
    required this.title,
  });

  @override
  State<WishlistCollectionDetailScreen> createState() => _WishlistCollectionDetailScreenState();
}

class _WishlistCollectionDetailScreenState extends State<WishlistCollectionDetailScreen> {
  void _openSettingsSheet(BuildContext context, WishlistCollectionModel collection) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
              // Header Settings với nút X đóng bên phải (Ảnh 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Center(
                      child: Text(
                        'Cài đặt',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      child: IconButton(
                        icon: const Icon(
                          Icons.close_rounded,
                          color: AppColors.textPrimary,
                          size: 22,
                        ),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.borderLight),

              // Mục 1: Sửa tên (Rename)
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: AppColors.textPrimary),
                title: const Text(
                  'Sửa tên',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _openRenameSheet(context, collection);
                },
              ),
              const Divider(height: 1, indent: 56, color: AppColors.borderLight),

              // Mục 2: Xóa (Delete)
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: AppColors.error),
                title: const Text(
                  'Xóa',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _confirmDeleteCollection(context, collection);
                },
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

  void _openRenameSheet(BuildContext context, WishlistCollectionModel collection) {
    final controller = TextEditingController(text: collection.name);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final text = controller.text;
          final isEnabled = text.trim().isNotEmpty && text.length <= 50;

          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: Material(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
                child: SafeArea(
                  top: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                    const Center(
                      child: Text(
                        'Đổi tên danh sách',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.textPrimary, width: 1.5),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: TextField(
                        controller: controller,
                        autofocus: true,
                        maxLength: 50,
                        onChanged: (_) => setSheetState(() {}),
                        decoration: const InputDecoration(
                          labelText: 'Tên danh sách',
                          border: InputBorder.none,
                          counterText: '',
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${text.length}/50 ký tự',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          child: const Text(
                            'Hủy',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        ElevatedButton(
                          onPressed: isEnabled
                              ? () {
                                  context.read<WishlistCubit>().renameCollection(
                                        collection.id,
                                        text.trim(),
                                      );
                                  Navigator.of(ctx).pop();
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isEnabled ? AppColors.textPrimary : const Color(0xFFF3F4F6),
                            foregroundColor: isEnabled ? Colors.white : const Color(0xFF9CA3AF),
                            disabledBackgroundColor: const Color(0xFFF3F4F6),
                            disabledForegroundColor: const Color(0xFF9CA3AF),
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Lưu', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
      ),
    );
  }

  void _confirmDeleteCollection(BuildContext context, WishlistCollectionModel collection) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text(
          'Xóa danh sách yêu thích?',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: Text('Bạn có chắc chắn muốn xóa wishlist "${collection.name}" không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<WishlistCubit>().deleteCollection(collection.id);
              Navigator.of(context).pop();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Xóa', style: TextStyle(fontWeight: FontWeight.w700)),
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
            final matched = state.collections.where((c) => c.id == widget.collectionId);
            final collection = matched.isNotEmpty
                ? matched.first
                : WishlistCollectionModel(
                    id: widget.collectionId,
                    name: widget.title,
                    tours: const [],
                    createdAt: DateTime.now(),
                    updatedAt: DateTime.now(),
                  );

            final tours = collection.tours;

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                // Top Header: Nút back hình tròn bên trái và nút 3 chấm (...) bên phải (Ảnh 1)
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

                        // Nút 3 chấm (...) hình tròn mở Settings
                        GestureDetector(
                          onTap: () => _openSettingsSheet(context, collection),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF3F4F6),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.more_horiz_rounded,
                              size: 22,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Tiêu đề lớn tên Wishlist (ví dụ: ok)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                    child: Text(
                      collection.name,
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.6,
                      ),
                    ),
                  ),
                ),

                // Trường hợp danh sách rỗng
                if (tours.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.favorite_border_rounded,
                            size: 56,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'Chưa có tour nào trong danh sách',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Bấm vào biểu tượng trái tim trên tour để lưu vào đây.',
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
                  // Lưới hiển thị các tour chuẩn 2 cột giống hệt bên mục "Gần đây"
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
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
                          return _buildTourGridItem(
                            context: context,
                            tour: tour,
                            collectionId: collection.id,
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
            );
          },
        ),
      ),
    );
  }

  Widget _buildTourGridItem({
    required BuildContext context,
    required TourModel tour,
    required String collectionId,
  }) {
    return GestureDetector(
      onTap: () {
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
          // Khối ảnh tour bo góc 16 (giống bên Gần đây)
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

                // Badge "Được khách yêu thích" (Guest favorite như trong Ảnh 1)
                if (tour.ratingAvg >= 4.8)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 4,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'Được yêu thích',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),

                // Nút icon Trái tim ở góc trên bên phải (đỏ)
                Positioned(
                  top: 10,
                  right: 10,
                  child: GestureDetector(
                    onTap: () {
                      context.read<WishlistCubit>().removeTourFromCollection(
                            collectionId,
                            tour.id,
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
                      child: const Icon(
                        Icons.favorite_rounded,
                        color: AppColors.error,
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

          // Thông tin: Thời lượng · ★ Điểm đánh giá (giống Gần đây)
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
