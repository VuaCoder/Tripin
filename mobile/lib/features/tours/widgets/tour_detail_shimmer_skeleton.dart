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

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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

class TourDetailShimmerSkeleton extends StatelessWidget {
  const TourDetailShimmerSkeleton({super.key});

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
                    ),
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tiêu đề tour
                        const ShimmerBox(width: double.infinity, height: 26, borderRadius: 6),
                        const SizedBox(height: 8),
                        const ShimmerBox(width: 240, height: 26, borderRadius: 6),
                        const SizedBox(height: 14),

                        // Subtitle: Điểm đến & Thời lượng
                        const ShimmerBox(width: 160, height: 16, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: 220, height: 14, borderRadius: 4),
                        const SizedBox(height: 20),

                        // Khối Đánh giá Skeleton đồng bộ 1:1 với giao diện thật (Bỏ khung xám)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              ShimmerBox(width: 95, height: 16, borderRadius: 4),
                              SizedBox(width: 10),
                              ShimmerBox(width: 28, height: 16, borderRadius: 4),
                              SizedBox(width: 8),
                              ShimmerBox(width: 80, height: 16, borderRadius: 4),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),
                        const Divider(height: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Host section Skeleton
                        Row(
                          children: [
                            Container(
                              width: 50,
                              height: 50,
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
                                  ShimmerBox(width: 160, height: 16, borderRadius: 4),
                                  SizedBox(height: 6),
                                  ShimmerBox(width: 100, height: 13, borderRadius: 4),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),
                        const Divider(height: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Điểm nổi bật & Mô tả
                        const ShimmerBox(width: 180, height: 18, borderRadius: 4),
                        const SizedBox(height: 12),
                        const ShimmerBox(width: double.infinity, height: 14, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: double.infinity, height: 14, borderRadius: 4),
                        const SizedBox(height: 6),
                        const ShimmerBox(width: 260, height: 14, borderRadius: 4),

                        const SizedBox(height: 24),
                        const Divider(height: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 18),

                        // Accordion Lịch trình & Chính sách
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFEBEBEB)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              ShimmerBox(width: 140, height: 16, borderRadius: 4),
                              ShimmerBox(width: 18, height: 18, borderRadius: 9),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFEBEBEB)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              ShimmerBox(width: 140, height: 16, borderRadius: 4),
                              ShimmerBox(width: 18, height: 18, borderRadius: 9),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),
                        const Divider(height: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Reviews section cards Skeleton (Chiều cao 215px chuẩn Ảnh 1)
                        const ShimmerBox(width: 170, height: 18, borderRadius: 4),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 190,
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
                                        ShimmerBox(width: 38, height: 38, borderRadius: 19),
                                        SizedBox(width: 10),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            ShimmerBox(width: 80, height: 14, borderRadius: 4),
                                            SizedBox(height: 4),
                                            ShimmerBox(width: 60, height: 12, borderRadius: 4),
                                          ],
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 12),
                                    ShimmerBox(width: 100, height: 14, borderRadius: 4),
                                    SizedBox(height: 10),
                                    ShimmerBox(width: double.infinity, height: 12, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 180, height: 12, borderRadius: 4),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Container(
                                height: 190,
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
                                        ShimmerBox(width: 38, height: 38, borderRadius: 19),
                                        SizedBox(width: 10),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            ShimmerBox(width: 80, height: 14, borderRadius: 4),
                                            SizedBox(height: 4),
                                            ShimmerBox(width: 60, height: 12, borderRadius: 4),
                                          ],
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 12),
                                    ShimmerBox(width: 100, height: 14, borderRadius: 4),
                                    SizedBox(height: 10),
                                    ShimmerBox(width: double.infinity, height: 12, borderRadius: 4),
                                    SizedBox(height: 6),
                                    ShimmerBox(width: 180, height: 12, borderRadius: 4),
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

        // 3. Floating Header (Nút Back hoạt động ngay lập tức + Nút Heart, ĐÃ BỎ NÚT SHARE)
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

                // Nút Heart (Đã bỏ nút share hoàn toàn theo yêu cầu Ảnh 1)
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

        // 4. Bottom Sticky Bar Skeleton (Giá & Nút xanh)
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
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
                      ShimmerBox(width: 50, height: 12, borderRadius: 3),
                      SizedBox(height: 4),
                      ShimmerBox(width: 120, height: 22, borderRadius: 4),
                    ],
                  ),
                  ShimmerBox(width: 130, height: 48, borderRadius: 12),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
