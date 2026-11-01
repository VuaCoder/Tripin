import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../models/recently_viewed_model.dart';

/// Khối hiển thị ảnh ghép 2x2 cho mục "Recently viewed" (Ảnh 5 & Ảnh 1)
/// Thiết kế tràn hết khung 4 ô, fill đủ ảnh, không bao giờ để ô trống hay icon lỗi
class RecentlyViewedCollageWidget extends StatelessWidget {
  final List<RecentlyViewedTourModel> items;

  static const List<String> _fallbackImages = [
    'https://images.unsplash.com/photo-1560113855-2ea616c915ee?auto=format&fit=crop&w=800&q=78', // Hội An / Đà Nẵng
    'https://images.unsplash.com/photo-1675111066042-9baa4c343157?auto=format&fit=crop&w=800&q=78', // Hạ Long
    'https://images.unsplash.com/photo-1666160416071-f76c9cb5a1c9?auto=format&fit=crop&w=800&q=78', // Sapa
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=78', // Đà Lạt rừng thông
  ];

  const RecentlyViewedCollageWidget({
    super.key,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    // Thu thập danh sách ảnh bìa hợp lệ từ các tour xem gần đây
    final validUrls = <String>[];
    for (final item in items) {
      final cover = item.tour.coverImage;
      if (cover != null && cover.isNotEmpty && !cover.contains('photo-1770181280811')) {
        if (!validUrls.contains(cover)) {
          validUrls.add(cover);
        }
      }
    }

    // Đảm bảo cả 4 ô luôn có ảnh đẹp, tuần hoàn qua các tour đã xem hoặc fallback travel images
    String getUrlForIndex(int index) {
      if (validUrls.isNotEmpty) {
        if (index < validUrls.length) {
          return validUrls[index];
        }
        // Nếu số ảnh ít hơn 4, tuần hoàn từ danh sách đã xem
        return validUrls[index % validUrls.length];
      }
      return _fallbackImages[index % _fallbackImages.length];
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: AspectRatio(
          aspectRatio: 1.0,
          child: Column(
            children: [
              // Hàng trên (2 ảnh)
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: _buildQuadrant(getUrlForIndex(0), 0)),
                    const SizedBox(width: 2.0),
                    Expanded(child: _buildQuadrant(getUrlForIndex(1), 1)),
                  ],
                ),
              ),
              const SizedBox(height: 2.0),
              // Hàng dưới (2 ảnh)
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: _buildQuadrant(getUrlForIndex(2), 2)),
                    const SizedBox(width: 2.0),
                    Expanded(child: _buildQuadrant(getUrlForIndex(3), 3)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuadrant(String url, int fallbackIndex) {
    return SizedBox.expand(
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        placeholder: (context, url) => Container(
          color: const Color(0xFFF1F5F9),
          width: double.infinity,
          height: double.infinity,
        ),
        errorWidget: (context, errorUrl, error) {
          // Khi ảnh gốc bị lỗi (404), tự động thay thế bằng ảnh du lịch chất lượng cao, không để icon lỗi
          final fallback = _fallbackImages[fallbackIndex % _fallbackImages.length];
          return CachedNetworkImage(
            imageUrl: fallback,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            placeholder: (_, _) => Container(color: const Color(0xFFF1F5F9)),
            errorWidget: (_, _, _) => Container(color: const Color(0xFFE2E8F0)),
          );
        },
      ),
    );
  }
}
