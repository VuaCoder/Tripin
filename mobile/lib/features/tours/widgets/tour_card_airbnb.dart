import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/tour_model.dart';

/// Thẻ Tour dạng danh sách lớn phong cách Airbnb Listing Card (Ảnh 1)
/// - Ảnh lớn bo góc 16px tỉ lệ chuẩn Airbnb
/// - Góc trên bên trái: Badge "Khách yêu thích" kèm biểu tượng Cúp
/// - Góc trên bên phải: Nút Trái tim Wishlist
/// - Dấu chấm phân trang (Dots indicator) ở đáy ảnh
/// - Thông tin: Địa điểm, Đánh giá sao, Tóm tắt, Thời lượng, Giá tiền gạch chân và Miễn phí hủy
class TourCardAirbnb extends StatefulWidget {
  final TourModel tour;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;
  final bool isFavorite;

  const TourCardAirbnb({
    super.key,
    required this.tour,
    this.onTap,
    this.onFavoriteTap,
    this.isFavorite = false,
  });

  @override
  State<TourCardAirbnb> createState() => _TourCardAirbnbState();
}

class _TourCardAirbnbState extends State<TourCardAirbnb> {
  late bool _isFavorite;
  final int _activeImageIndex = 0;
  final _currencyFormat = NumberFormat('#,###', 'vi_VN');

  @override
  void initState() {
    super.initState();
    _isFavorite = widget.isFavorite;
  }

  @override
  void didUpdateWidget(covariant TourCardAirbnb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isFavorite != widget.isFavorite) {
      _isFavorite = widget.isFavorite;
    }
  }

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  @override
  Widget build(BuildContext context) {
    final tour = widget.tour;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: InkWell(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Khung ảnh lớn với bo góc 16px chuẩn Airbnb
            AspectRatio(
              aspectRatio: 1.15,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: _buildImage(tour.coverImage),
                  ),

                  // Góc trên bên trái: Badge "Khách yêu thích" (Guest favorite)
                  Positioned(
                    top: 14,
                    left: 14,
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
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.workspace_premium_rounded,
                            size: 15,
                            color: Color(0xFFD97706), // Amber bronze
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Khách yêu thích',
                            style: TextStyle(
                              color: Color(0xFF222222),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Góc trên bên phải: Nút Trái tim Wishlist
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      onPressed: () {
                        setState(() => _isFavorite = !_isFavorite);
                        widget.onFavoriteTap?.call();
                      },
                      splashRadius: 22,
                      icon: Icon(
                        _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: _isFavorite ? const Color(0xFFFF385C) : Colors.white,
                        size: 26,
                        shadows: [
                          Shadow(
                            color: Colors.black.withValues(alpha: 0.45),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Đáy ảnh: Dots indicator (Các dấu chấm phân trang ảnh)
                  Positioned(
                    bottom: 12,
                    left: 0,
                    right: 0,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final isActive = index == _activeImageIndex;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 2.5),
                          width: isActive ? 6.5 : 5.5,
                          height: isActive ? 6.5 : 5.5,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isActive
                                ? Colors.white
                                : Colors.white.withValues(alpha: 0.55),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 2,
                              ),
                            ],
                          ),
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 2. Phần chi tiết tour bên dưới ảnh
            // Dòng 1: Tên địa điểm / tour + Đánh giá sao
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    tour.destination.isNotEmpty ? 'Tour tại ${tour.destination}' : tour.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: Color(0xFF222222),
                    ),
                    const SizedBox(width: 2),
                    Text(
                      '${tour.ratingAvg > 0 ? tour.ratingAvg.toStringAsFixed(1) : '5.0'} (${tour.ratingCount > 0 ? tour.ratingCount : 19})',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF222222),
                      ),
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 3),

            // Dòng 2: Tóm tắt / Điểm nhấn
            Text(
              tour.summary ?? tour.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF717171),
                height: 1.25,
              ),
            ),

            const SizedBox(height: 2),

            // Dòng 3: Thời lượng & Tiện ích
            Text(
              '${tour.durationDays} ngày ${tour.durationDays > 1 ? '${tour.durationDays - 1} đêm' : ''} · Hướng dẫn viên địa phương',
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF717171),
              ),
            ),

            const SizedBox(height: 2),

            // Dòng 4: Ngày khởi hành
            Text(
              tour.nextDepartureDate != null
                  ? 'Khởi hành: ${tour.nextDepartureDate}'
                  : 'Khởi hành hàng ngày',
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF717171),
              ),
            ),

            const SizedBox(height: 5),

            // Dòng 5: Giá tiền nổi bật có gạch chân nhẹ
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '₫${_currencyFormat.format(tour.basePrice.toInt())}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF222222),
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  TextSpan(
                    text: ' cho ${tour.durationDays} ngày',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF222222),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 3),

            // Dòng 6: Chính sách hủy phòng
            const Text(
              'Miễn phí hủy',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF222222),
                decoration: TextDecoration.underline,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage(String? imageUrl) {
    if (_isInTest || imageUrl == null || imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFFF1F5F9),
        child: const Center(
          child: Icon(Icons.landscape_rounded, size: 54, color: Color(0xFFCBD5E1)),
        ),
      );
    }

    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: BoxFit.cover,
      placeholder: (_, _) => Container(color: const Color(0xFFF1F5F9)),
      errorWidget: (_, _, _) => Container(
        color: const Color(0xFFF1F5F9),
        child: const Center(
          child: Icon(Icons.broken_image_rounded, size: 40, color: Color(0xFFCBD5E1)),
        ),
      ),
    );
  }
}
