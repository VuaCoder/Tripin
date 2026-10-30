import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

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
                AppColors.shimmerBase,
                AppColors.shimmerHighlight,
                AppColors.shimmerBase,
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
        color: AppColors.shimmerBase,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class TourDetailShimmerSkeleton extends StatelessWidget {
  const TourDetailShimmerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerAnimationWidget(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image Carousel Skeleton
            const ShimmerBox(
              width: double.infinity,
              height: 280,
              borderRadius: 0,
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Destination & Duration Chips
                  const Row(
                    children: [
                      ShimmerBox(width: 90, height: 26, borderRadius: 16),
                      SizedBox(width: 8),
                      ShimmerBox(width: 80, height: 26, borderRadius: 16),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Title
                  const ShimmerBox(width: double.infinity, height: 24),
                  const SizedBox(height: 8),
                  const ShimmerBox(width: 220, height: 24),
                  const SizedBox(height: 16),
                  // Rating & Reviews
                  const Row(
                    children: [
                      ShimmerBox(width: 20, height: 20, borderRadius: 4),
                      SizedBox(width: 6),
                      ShimmerBox(width: 60, height: 16),
                      SizedBox(width: 12),
                      ShimmerBox(width: 100, height: 16),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Price Tag Skeleton
                  const ShimmerBox(width: 180, height: 32),
                  const SizedBox(height: 24),
                  // Departures Skeleton
                  const ShimmerBox(width: 140, height: 20),
                  const SizedBox(height: 12),
                  Row(
                    children: List.generate(
                      3,
                      (index) => const Padding(
                        padding: EdgeInsets.only(right: 12),
                        child: ShimmerBox(width: 110, height: 80, borderRadius: 12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  // Timeline Skeleton
                  const ShimmerBox(width: 160, height: 20),
                  const SizedBox(height: 16),
                  Column(
                    children: List.generate(
                      3,
                      (index) => Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const ShimmerBox(width: 36, height: 36, borderRadius: 18),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: const [
                                  ShimmerBox(width: 140, height: 16),
                                  SizedBox(height: 8),
                                  ShimmerBox(width: double.infinity, height: 14),
                                  SizedBox(height: 6),
                                  ShimmerBox(width: 200, height: 14),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

