import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/bloc/login_bloc.dart';
import '../../auth/screens/login_screen.dart';
import '../bloc/wishlist_cubit.dart';
import '../bloc/wishlist_state.dart';
import '../widgets/recently_viewed_collage_widget.dart';
import 'recently_viewed_screen.dart';
import 'wishlist_collection_detail_screen.dart';

/// Màn hình Tab "Yêu thích" - Danh sách yêu thích
/// Hiển thị dạng lưới 2 cột:
/// 1. Card "Gần đây" với ảnh ghép 2x2 và thời gian (ví dụ: Hôm nay)
/// 2. Các danh sách do người dùng tự tạo (ảnh bìa, tên, số lượng đã lưu)
/// 3. Nút "Chỉnh sửa" trên góc phải khi có danh sách tự tạo; khi xoá hết chỉ còn "Gần đây" thì ẩn nút Chỉnh sửa
class WishlistScreen extends StatefulWidget {
  final VoidCallback? onExploreTap;

  const WishlistScreen({
    super.key,
    this.onExploreTap,
  });

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<WishlistCubit>().loadWishlist();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: BlocBuilder<WishlistCubit, WishlistState>(
          builder: (context, state) {
            // Trường hợp khách chưa đăng nhập và hoàn toàn chưa có dữ liệu nào
            if (!state.isAuthenticated && state.collections.isEmpty && state.recentlyViewed.isEmpty) {
              return _buildGuestPlaceholder(context);
            }

            final hasCustomWishlists = state.hasCustomWishlists;
            final isEditing = state.isEditMode;

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                // Header thanh tiêu đề lớn "Danh sách yêu thích" và nút "Chỉnh sửa"
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Text(
                          'Yêu thích',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.6,
                          ),
                        ),
                        // Nút Chỉnh sửa chỉ hiện khi có ít nhất 1 wishlist tự tạo
                        if (hasCustomWishlists)
                          GestureDetector(
                            onTap: () {
                              context.read<WishlistCubit>().toggleEditMode();
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                              child: Text(
                                isEditing ? 'Xong' : 'Chỉnh sửa',
                                style: const TextStyle(
                                  fontSize: 16,
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

                // Lưới 2 cột hiển thị các Collection
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 24,
                      childAspectRatio: 0.70,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        // Vị trí 0 luôn là "Gần đây" (Xem gần đây)
                        if (index == 0) {
                          return _buildRecentlyViewedCard(context, state);
                        }

                        // Các vị trí tiếp theo là các Wishlist tự tạo (ví dụ: "ngu")
                        final collection = state.collections[index - 1];
                        return _buildCustomWishlistCard(context, collection, isEditing);
                      },
                      childCount: 1 + state.collections.length,
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

  /// Card "Gần đây" với ảnh ghép 2x2 và thời gian xem tương đối (ví dụ: Hôm nay)
  Widget _buildRecentlyViewedCard(BuildContext context, WishlistState state) {
    final recentItems = state.recentlyViewed;
    final timeSubtitle = recentItems.isNotEmpty ? recentItems.first.relativeTime : 'Hôm nay';

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: context.read<WishlistCubit>(),
              child: const RecentlyViewedScreen(),
            ),
          ),
        );
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Khối ảnh ghép 2x2
          AspectRatio(
            aspectRatio: 1.0,
            child: RecentlyViewedCollageWidget(items: recentItems),
          ),
          const SizedBox(height: 10),

          // Tiêu đề: "Gần đây"
          const Text(
            'Gần đây',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              letterSpacing: -0.2,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),

          // Thời gian: ví dụ "Hôm nay"
          Text(
            timeSubtitle,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  /// Card cho từng Wishlist tự tạo (ví dụ: "ngu") kèm nút xoá trong chế độ Chỉnh sửa
  Widget _buildCustomWishlistCard(
    BuildContext context,
    dynamic collection,
    bool isEditing,
  ) {
    final coverUrl = collection.coverImageUrl;

    return GestureDetector(
      onTap: () {
        if (isEditing) {
          _confirmDeleteWishlist(context, collection);
          return;
        }

        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: context.read<WishlistCubit>(),
              child: WishlistCollectionDetailScreen(
                collectionId: collection.id,
                title: collection.name,
              ),
            ),
          ),
        );
      },
      behavior: HitTestBehavior.opaque,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Khối ảnh bìa vuông bo góc lớn (20)
              AspectRatio(
                aspectRatio: 1.0,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    width: double.infinity,
                    color: const Color(0xFFF3F4F6),
                    child: coverUrl != null && coverUrl.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: coverUrl,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => const Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                            errorWidget: (context, url, error) => const Icon(
                              Icons.image_outlined,
                              size: 32,
                              color: AppColors.textMuted,
                            ),
                          )
                        : const Center(
                            child: Icon(
                              Icons.favorite_rounded,
                              size: 36,
                              color: AppColors.primaryLight,
                            ),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Tên Wishlist (ví dụ: "ngu")
              Text(
                collection.name,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),

              // Số lượng: ví dụ "3 đã lưu"
              Text(
                collection.savedSubtitle,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),

          // Nút xoá màu đỏ xuất hiện khi đang ở chế độ Chỉnh sửa
          if (isEditing)
            Positioned(
              top: 8,
              right: 8,
              child: GestureDetector(
                onTap: () => _confirmDeleteWishlist(context, collection),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.error,
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
                    Icons.remove_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _confirmDeleteWishlist(BuildContext context, dynamic collection) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xóa danh sách yêu thích?'),
        content: Text('Bạn có chắc muốn xóa wishlist "${collection.name}" không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<WishlistCubit>().deleteCollection(collection.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }

  Widget _buildGuestPlaceholder(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppColors.primarySurface,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline_rounded,
                size: 38,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Đăng nhập để xem mục yêu thích',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Lưu và quản lý tất cả các tour du lịch bạn yêu thích tại đây sau khi đăng nhập.',
              style: TextStyle(
                fontSize: 13.5,
                color: AppColors.textSecondary,
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => BlocProvider(
                      create: (_) => LoginBloc(),
                      child: const LoginScreen(),
                    ),
                  ),
                ).then((_) {
                  if (context.mounted) {
                    context.read<WishlistCubit>().loadWishlist();
                  }
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              ),
              child: const Text(
                'Đăng nhập ngay',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
