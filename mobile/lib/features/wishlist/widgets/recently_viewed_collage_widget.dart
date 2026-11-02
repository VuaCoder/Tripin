import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../models/recently_viewed_model.dart';

/// Khối hiển thị ảnh ghép cho mục "Gần đây"
/// Quy tắc:
/// - Nếu chỉ có 1 tour: hiển thị đúng 1 ảnh tràn trọn vẹn khung.
/// - Nếu chỉ có 2 tour: hiển thị đúng 2 ảnh chia đôi 2 cột, không lặp lại ảnh hay nhồi ảnh fallback.
/// - Nếu có 3 tour: hiển thị 3 ảnh (cột trái 1 ảnh, cột phải 2 ảnh trên dưới).
/// - Nếu có từ 4 tour trở lên: hiển thị lưới 2x2 gồm 4 ảnh khác nhau.
/// - Nếu chưa xem tour nào: hiển thị ảnh placeholder du lịch mặc định.
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
    // Thu thập danh sách ảnh bìa hợp lệ từ các tour xem gần đây (không trùng lặp)
    final validUrls = <String>[];
    for (final item in items) {
      final cover = item.tour.coverImage;
      if (cover != null && cover.isNotEmpty && !cover.contains('photo-1770181280811')) {
        if (!validUrls.contains(cover)) {
          validUrls.add(cover);
        }
      }
    }

    Widget buildContent() {
      if (validUrls.isEmpty) {
        return _buildQuadrant(_fallbackImages[0], 0);
      }
      if (validUrls.length == 1) {
        return _buildQuadrant(validUrls[0], 0);
      }
      if (validUrls.length == 2) {
        // Đúng yêu cầu: nếu chỉ có 2 thì chỉ có 2 ảnh thôi
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildQuadrant(validUrls[0], 0)),
            const SizedBox(width: 2.0),
            Expanded(child: _buildQuadrant(validUrls[1], 1)),
          ],
        );
      }
      if (validUrls.length == 3) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildQuadrant(validUrls[0], 0)),
            const SizedBox(width: 2.0),
            Expanded(
              child: Column(
                children: [
                  Expanded(child: _buildQuadrant(validUrls[1], 1)),
                  const SizedBox(height: 2.0),
                  Expanded(child: _buildQuadrant(validUrls[2], 2)),
                ],
              ),
            ),
          ],
        );
      }
      // Từ 4 ảnh trở lên: lưới 2x2 gồm 4 ảnh độc lập
      return Column(
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildQuadrant(validUrls[0], 0)),
                const SizedBox(width: 2.0),
                Expanded(child: _buildQuadrant(validUrls[1], 1)),
              ],
            ),
          ),
          const SizedBox(height: 2.0),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildQuadrant(validUrls[2], 2)),
                const SizedBox(width: 2.0),
                Expanded(child: _buildQuadrant(validUrls[3], 3)),
              ],
            ),
          ),
        ],
      );
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
          child: buildContent(),
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
