import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Shimmer / Skeleton Loading cho màn hình Khám phá Trang chủ
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
            color: const Color(0xFFCBD5E1).withValues(alpha: _animation.value),
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        );
      },
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
          // 1. Shimmer Featured Tours (Horizontal cards)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildShimmerBox(width: 140, height: 20, borderRadius: 6),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 250,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 2,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (_, _) => SizedBox(
                width: 260,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildShimmerBox(width: double.infinity, height: 195, borderRadius: 24),
                    const SizedBox(height: 10),
                    _buildShimmerBox(width: 180, height: 16, borderRadius: 4),
                    const SizedBox(height: 6),
                    _buildShimmerBox(width: 120, height: 13, borderRadius: 4),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // 2. Shimmer Promotional Banner Carousel
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildShimmerBox(width: double.infinity, height: 190, borderRadius: 20),
          ),
          const SizedBox(height: 28),

          // 3. Shimmer Latest Tours (Vertical items)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildShimmerBox(width: 140, height: 20, borderRadius: 6),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildShimmerBox(width: double.infinity, height: 100, borderRadius: 16),
          ),
        ],
      ),
    );
  }
}
