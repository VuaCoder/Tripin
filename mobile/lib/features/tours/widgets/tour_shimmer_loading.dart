import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Shimmer / Skeleton Loading cho màn hình Khám phá Trang chủ
/// Khớp chuẩn 1:1 bố cục thực tế:
/// 1. Tour Nổi Bật: Header tròn + Dải thẻ cuộn ngang Airbnb (ảnh bo góc 24px, pill tag "Được khách yêu thích", icon tim, text giá/đánh giá)
/// 2. Voucher Banner Carousel: Thẻ banner khuyến mãi bo góc 20px
/// 3. Tour Mới Nhất: Header tròn + Dải thẻ cuộn ngang Airbnb đồng bộ (không tag góc trái)
class TourShimmerLoading extends StatefulWidget {
  const TourShimmerLoading({super.key});

  @override
  State<TourShimmerLoading> createState() => _TourShimmerLoadingState();
}

class _TourShimmerLoadingState extends State<TourShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

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
      _controller.repeat(reverse: true);
    }
    _animation = Tween<double>(begin: 0.35, end: 0.85).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _buildShimmerBox({
    required double width,
    required double height,
    double borderRadius = 8,
  }) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0).withValues(alpha: _animation.value),
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        );
      },
    );
  }

  Widget _buildSectionHeaderSkeleton({required double titleWidth}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildShimmerBox(width: titleWidth, height: 22, borderRadius: 6),
          _buildShimmerBox(width: 36, height: 36, borderRadius: 18),
        ],
      ),
    );
  }

  Widget _buildHorizontalTourCardSkeleton({bool showBadge = false}) {
    return SizedBox(
      width: 260,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Khung ảnh 4:3 bo tròn 24px (rounded-3xl)
          Stack(
            children: [
              _buildShimmerBox(
                width: double.infinity,
                height: 195,
                borderRadius: 24,
              ),
              if (showBadge)
                Positioned(
                  top: 12,
                  left: 12,
                  child: _buildShimmerBox(
                    width: 120,
                    height: 24,
                    borderRadius: 12,
                  ),
                ),
              Positioned(
                top: 12,
                right: 12,
                child: _buildShimmerBox(
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Tiêu đề tour
          _buildShimmerBox(width: 210, height: 16, borderRadius: 4),
          const SizedBox(height: 6),
          // Dòng phụ đề: Giá + thời lượng + sao
          Row(
            children: [
              _buildShimmerBox(width: 120, height: 13, borderRadius: 4),
              const SizedBox(width: 6),
              _buildShimmerBox(width: 4, height: 4, borderRadius: 2),
              const SizedBox(width: 6),
              _buildShimmerBox(width: 45, height: 13, borderRadius: 4),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Shimmer Mục "Tour Nổi Bật" (có tag "Được khách yêu thích")
          _buildSectionHeaderSkeleton(titleWidth: 130),
          const SizedBox(height: 12),
          SizedBox(
            height: 260,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 2,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (_, _) => _buildHorizontalTourCardSkeleton(showBadge: true),
            ),
          ),
          const SizedBox(height: 28),

          // 2. Shimmer Mục Voucher / Banner khuyến mãi
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildShimmerBox(
              width: double.infinity,
              height: 180,
              borderRadius: 20,
            ),
          ),
          const SizedBox(height: 28),

          // 3. Shimmer Mục "Tour Mới Nhất" (Đồng bộ thẻ ngang, KHÔNG CÓ tag góc trái)
          _buildSectionHeaderSkeleton(titleWidth: 140),
          const SizedBox(height: 12),
          SizedBox(
            height: 260,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 2,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (_, _) => _buildHorizontalTourCardSkeleton(showBadge: false),
            ),
          ),
        ],
      ),
    );
  }
}
