import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';

/// Pop up banner nổi sau khi lưu tour vào wishlist (Ảnh 2)
/// Hiển thị ảnh tour, chữ "Đã lưu vào [tên]", và nút gạch chân "Thay đổi"
class SavedToWishlistBanner {
  static OverlayEntry? _currentEntry;
  static Timer? _dismissTimer;

  static void show(
    BuildContext context, {
    required String collectionName,
    required TourModel tour,
    VoidCallback? onChangeTap,
    String? customMessage,
  }) {
    // Ẩn banner cũ nếu đang hiện
    hide();

    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return;

    _currentEntry = OverlayEntry(
      builder: (ctx) => _BannerWidget(
        collectionName: collectionName,
        customMessage: customMessage,
        tour: tour,
        onChangeTap: onChangeTap != null
            ? () {
                hide();
                onChangeTap();
              }
            : null,
      ),
    );

    overlay.insert(_currentEntry!);

    // Tự động ẩn sau 3.5 giây
    _dismissTimer = Timer(const Duration(milliseconds: 3500), () {
      hide();
    });
  }

  static void hide() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _currentEntry?.remove();
    _currentEntry = null;
  }
}

class _BannerWidget extends StatefulWidget {
  final String collectionName;
  final String? customMessage;
  final TourModel tour;
  final VoidCallback? onChangeTap;

  const _BannerWidget({
    required this.collectionName,
    this.customMessage,
    required this.tour,
    this.onChangeTap,
  });

  @override
  State<_BannerWidget> createState() => _BannerWidgetState();
}

class _BannerWidgetState extends State<_BannerWidget> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _fadeAnimation = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.4),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic));

    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Positioned(
      left: 16,
      right: 16,
      bottom: bottomInset + bottomPadding + 80, // Nằm trên thanh điều hướng dưới
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: SlideTransition(
          position: _slideAnimation,
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.14),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
                border: Border.all(
                  color: AppColors.borderLight,
                  width: 0.8,
                ),
              ),
              child: Row(
                children: [
                  // Ảnh thumbnail của tour (bo góc tròn)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 48,
                      height: 48,
                      color: AppColors.surfaceVariant,
                      child: widget.tour.coverImage != null && widget.tour.coverImage!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: widget.tour.coverImage!,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => const Center(
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                              ),
                              errorWidget: (context, url, error) => const Icon(
                                Icons.image_not_supported_outlined,
                                size: 20,
                                color: AppColors.textMuted,
                              ),
                            )
                          : const Icon(
                              Icons.travel_explore_rounded,
                              size: 22,
                              color: AppColors.primary,
                            ),
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Nội dung: "Đã lưu vào [tên]" hoặc customMessage ("Xoá khỏi [tên]")
                  Expanded(
                    child: Text(
                      widget.customMessage ?? 'Đã lưu vào ${widget.collectionName}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),

                  // Nút "Thay đổi" có gạch chân (chỉ hiện khi thêm mới / thay đổi, không hiện khi xoá)
                  if (widget.onChangeTap != null) ...[
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: widget.onChangeTap,
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        child: Text(
                          'Thay đổi',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
