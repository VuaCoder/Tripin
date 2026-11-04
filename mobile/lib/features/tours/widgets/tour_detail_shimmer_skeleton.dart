import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class ShimmerAnimationWidget extends StatefulWidget {
  final Widget child;

  const ShimmerAnimationWidget({super.key, required this.child});

  @override
  State<ShimmerAnimationWidget> createState() => _ShimmerAnimationWidgetState();
}

class _ShimmerAnimationWidgetState extends State<ShimmerAnimationWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    if (!_isInTest) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isInTest) {
      return widget.child;
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: const [
                Color(0xFFEDEDED),
                Color(0xFFF7F7F7),
                Color(0xFFEDEDED),
              ],
              stops: [
                (_controller.value - 0.3).clamp(0.0, 1.0),
                _controller.value.clamp(0.0, 1.0),
                (_controller.value + 0.3).clamp(0.0, 1.0),
              ],
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class ShimmerBox extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFEDEDED),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// Shimmer Skeleton chuẩn 1:1 cho màn hình Chi tiết Tour
/// Khớp chính xác với cấu trúc TourDetailScreen:
/// 1. Top Image Carousel (cao 340px)
/// 2. Floating Header: Nút back tròn + Nút tim tròn
/// 3. Main Content Card (Bo góc 28px trùm lên ảnh -26px):
///    - Tên tour & Địa điểm & Thời lượng
///    - Khối đánh giá 2 cột phong cách Airbnb (Điểm số / 5 sao | Số lượt / Đánh giá)
///    - Host section ("Thuộc về..." + Avatar tròn 52px)
///    - Điểm nổi bật chuyến đi (4 dòng icon + tiêu đề) + Mô tả
///    - 2 Dropdown Accordion (Lịch trình & Chính sách)
///    - Danh sách đánh giá mẫu
/// 4. Sticky Bottom Bar: Cột giá + Nút đặt tour
class TourDetailShimmerSkeleton extends StatelessWidget {
  const TourDetailShimmerSkeleton({super.key});

  Widget _buildHighlightRowSkeleton() {
    return const Padding(
      padding: EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerBox(width: 24, height: 24, borderRadius: 12),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerBox(width: 180, height: 16, borderRadius: 4),
                SizedBox(height: 6),
                ShimmerBox(width: double.infinity, height: 13, borderRadius: 4),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Nội dung shimmer có thể cuộn mô phỏng 1:1 màn hình chi tiết tour
        ShimmerAnimationWidget(
          child: SingleChildScrollView(
            physics: const NeverScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Top Image Carousel Skeleton (Khớp 100% tỷ lệ 340px)
                const ShimmerBox(
                  width: double.infinity,
                  height: 340,
                  borderRadius: 0,
                ),

                // 2. Main Content Card Skeleton (Trùm lên ảnh -26px bo góc 28px)
                Transform.translate(
                  offset: const Offset(0, -26),
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black12,
                          blurRadius: 10,
                          offset: Offset(0, -3),
                        ),
                      ],
                    ),
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tiêu đề tour (2 dòng)
                        const ShimmerBox(width: double.infinity, height: 24, borderRadius: 6),
                        const SizedBox(height: 8),
                        const ShimmerBox(width: 220, height: 24, borderRadius: 6),
                        const SizedBox(height: 14),

                        // Subtitle: Điểm đến & Thời lượng / Quy mô khách
                        const ShimmerBox(width: 150, height: 15, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: 230, height: 13.5, borderRadius: 4),
                        const SizedBox(height: 20),

                        // Khối Đánh giá Skeleton 2 cột chuẩn 1:1 Airbnb với viền và nền sáng
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFAFAFA),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
                          ),
                          child: Row(
                            children: [
                              // Cột 1: Điểm đánh giá & 5 sao
                              Expanded(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: const [
                                    ShimmerBox(width: 44, height: 22, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 80, height: 12, borderRadius: 3),
                                  ],
                                ),
                              ),
                              // Đường kẻ phân cách ở giữa
                              Container(
                                height: 38,
                                width: 1,
                                color: const Color(0xFFE5E7EB),
                              ),
                              // Cột 2: Số lượt đánh giá & nhãn
                              Expanded(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: const [
                                    ShimmerBox(width: 38, height: 22, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 60, height: 12, borderRadius: 3),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Host section Skeleton ("Thuộc về..." + Avatar)
                        Row(
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: const BoxDecoration(
                                color: Color(0xFFEDEDED),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 14),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ShimmerBox(width: 170, height: 16, borderRadius: 4),
                                  SizedBox(height: 6),
                                  ShimmerBox(width: 220, height: 13, borderRadius: 4),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Điểm nổi bật chuyến đi (4 dòng highlight chuẩn)
                        _buildHighlightRowSkeleton(),
                        _buildHighlightRowSkeleton(),
                        _buildHighlightRowSkeleton(),
                        _buildHighlightRowSkeleton(),

                        // Tóm tắt & Mô tả tour
                        const SizedBox(height: 8),
                        const ShimmerBox(width: double.infinity, height: 14, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: double.infinity, height: 14, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: 240, height: 14, borderRadius: 4),

                        const SizedBox(height: 24),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 18),

                        // Accordion 1: Lịch trình cụ thể
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFEBEBEB)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              ShimmerBox(width: 150, height: 16, borderRadius: 4),
                              ShimmerBox(width: 18, height: 18, borderRadius: 9),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Accordion 2: Thông tin & Chính sách
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFEBEBEB)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              ShimmerBox(width: 160, height: 16, borderRadius: 4),
                              ShimmerBox(width: 18, height: 18, borderRadius: 9),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Đánh giá từ khách hàng Skeleton
                        const ShimmerBox(width: 180, height: 18, borderRadius: 4),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 180,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFEBEBEB)),
                                ),
                                child: const Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        ShimmerBox(width: 36, height: 36, borderRadius: 18),
                                        SizedBox(width: 10),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            ShimmerBox(width: 75, height: 13, borderRadius: 4),
                                            SizedBox(height: 4),
                                            ShimmerBox(width: 55, height: 11, borderRadius: 4),
                                          ],
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 12),
                                    ShimmerBox(width: 90, height: 13, borderRadius: 4),
                                    SizedBox(height: 8),
                                    ShimmerBox(width: double.infinity, height: 11, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 120, height: 11, borderRadius: 4),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Container(
                                height: 180,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFEBEBEB)),
                                ),
                                child: const Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        ShimmerBox(width: 36, height: 36, borderRadius: 18),
                                        SizedBox(width: 10),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            ShimmerBox(width: 75, height: 13, borderRadius: 4),
                                            SizedBox(height: 4),
                                            ShimmerBox(width: 55, height: 11, borderRadius: 4),
                                          ],
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 12),
                                    ShimmerBox(width: 90, height: 13, borderRadius: 4),
                                    SizedBox(height: 8),
                                    ShimmerBox(width: double.infinity, height: 11, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 120, height: 11, borderRadius: 4),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 3. Floating Header (Nút Back hoạt động ngay lập tức + Nút Heart)
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Nút Back hoạt động ngay cả khi đang loading skeleton
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.arrow_back_rounded,
                      size: 20,
                      color: Color(0xFF222222),
                    ),
                  ),
                ),

                // Nút Heart
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.favorite_border_rounded,
                    size: 20,
                    color: Color(0xFF222222),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 4. Bottom Sticky Bar Skeleton (Giá & Nút đặt tour)
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: const Border(top: BorderSide(color: Color(0xFFEBEBEB), width: 1)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, -3),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerBox(width: 45, height: 12, borderRadius: 3),
                      SizedBox(height: 4),
                      ShimmerBox(width: 120, height: 22, borderRadius: 4),
                    ],
                  ),
                  ShimmerBox(width: 140, height: 48, borderRadius: 12),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
