import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Shimmer / Skeleton Loading cho danh sách cuộc trò chuyện Tin nhắn
/// Khớp chuẩn 1:1 bố cục danh sách phong cách Messenger:
/// - Avatar tròn đường kính 52px
/// - Cột giữa: Thanh tên người dùng (130px) + Thanh xem trước tin nhắn (210px)
/// - Cột phải: Thanh thời gian tin nhắn (38px)
/// - Phân cách dòng có lề trái 82px
class ConversationsShimmerLoading extends StatefulWidget {
  final int itemCount;

  const ConversationsShimmerLoading({
    super.key,
    this.itemCount = 6,
  });

  @override
  State<ConversationsShimmerLoading> createState() => _ConversationsShimmerLoadingState();
}

class _ConversationsShimmerLoadingState extends State<ConversationsShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  bool get _isInTest {
    if (kIsWeb) return false;
    if (WidgetsBinding.instance.runtimeType.toString().contains('Test')) return true;
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } catch (_) {
      return false;
    }
  }

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
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
    double borderRadius = 6,
    bool isCircle = false,
  }) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0).withValues(alpha: _animation.value),
            shape: isCircle ? BoxShape.circle : BoxShape.rectangle,
            borderRadius: isCircle ? null : BorderRadius.circular(borderRadius),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: widget.itemCount,
      separatorBuilder: (_, _) => const Padding(
        padding: EdgeInsets.only(left: 82),
        child: Divider(height: 1, color: Color(0xFFF1F5F9)),
      ),
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            children: [
              // 1. Avatar tròn 52px
              _buildShimmerBox(
                width: 52,
                height: 52,
                isCircle: true,
              ),
              const SizedBox(width: 14),

              // 2. Cột tên và nội dung xem trước
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildShimmerBox(
                      width: index.isEven ? 135 : 110,
                      height: 15,
                      borderRadius: 4,
                    ),
                    const SizedBox(height: 7),
                    _buildShimmerBox(
                      width: index.isEven ? 210 : 180,
                      height: 13,
                      borderRadius: 4,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),

              // 3. Thời gian tin nhắn
              _buildShimmerBox(
                width: 38,
                height: 12,
                borderRadius: 4,
              ),
            ],
          ),
        );
      },
    );
  }
}
