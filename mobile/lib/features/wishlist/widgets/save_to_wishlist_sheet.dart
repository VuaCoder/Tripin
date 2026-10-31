import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';
import '../models/wishlist_collection_model.dart';
import 'create_wishlist_sheet.dart';

/// Modal "Lưu vào danh sách" (Ảnh 3)
/// Hiển thị danh sách wishlist đã tạo (ảnh bìa vuông bo góc, tên wishlist, số lượng đã lưu),
/// nút đóng X trên góc phải, và nút màu đen "Tạo danh sách yêu thích" bên dưới
class SaveToWishlistSheet extends StatelessWidget {
  final List<WishlistCollectionModel> collections;
  final TourModel tour;
  final ValueChanged<WishlistCollectionModel> onSelectCollection;
  final ValueChanged<String> onCreateNewCollection;

  const SaveToWishlistSheet({
    super.key,
    required this.collections,
    required this.tour,
    required this.onSelectCollection,
    required this.onCreateNewCollection,
  });

  static Future<void> show({
    required BuildContext context,
    required List<WishlistCollectionModel> collections,
    required TourModel tour,
    required ValueChanged<WishlistCollectionModel> onSelectCollection,
    required ValueChanged<String> onCreateNewCollection,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SaveToWishlistSheet(
        collections: collections,
        tour: tour,
        onSelectCollection: onSelectCollection,
        onCreateNewCollection: onCreateNewCollection,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header: Title "Lưu vào danh sách" và nút đóng "X" bên phải
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Center(
                    child: Text(
                      'Lưu vào danh sách',
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
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),

            // Danh sách các wishlist dạng lưới (2 cột như ảnh 3)
            Flexible(
              child: collections.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Text(
                          'Chưa có danh sách yêu thích nào',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    )
                  : GridView.builder(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 20,
                        childAspectRatio: 0.70,
                      ),
                      itemCount: collections.length,
                      itemBuilder: (context, index) {
                        final collection = collections[index];
                        final coverUrl = collection.coverImageUrl ?? tour.coverImage;

                        return GestureDetector(
                          onTap: () {
                            Navigator.of(context).pop();
                            onSelectCollection(collection);
                          },
                          behavior: HitTestBehavior.opaque,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Khối ảnh bìa vuông bo góc lớn 20 (chỉ hiện ảnh, không viền, không nút tick)
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
                                              Icons.travel_explore_rounded,
                                              size: 36,
                                              color: AppColors.primaryLight,
                                            ),
                                          ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),

                              // Tên Wishlist (ví dụ: "love" hoặc "ngu")
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

                              // Số lượng đã lưu (ví dụ: "1 đã lưu")
                              Text(
                                collection.savedSubtitle,
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),

            // Nút to màu đen "Tạo danh sách yêu thích" ở cuối
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.of(context).pop();
                  final newName = await CreateWishlistSheet.show(context);
                  if (newName != null && newName.isNotEmpty) {
                    onCreateNewCollection(newName);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF222222),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Tạo danh sách yêu thích',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ),

            // Home indicator line
            Center(
              child: Container(
                width: 134,
                height: 5,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
