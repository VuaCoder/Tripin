import 'dart:async';
import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/promotion_banner_model.dart';

/// Carousel Banner chương trình ưu đãi & khuyến mãi
/// Thiết kế chuẩn banner quảng cáo thương mại điện tử du lịch (Traveloka, Klook, Agoda):
/// - Hình ảnh danh lam thắng cảnh du lịch thực tế độ phân giải cao
/// - Lớp phủ Scrim Gradient điện ảnh giúp tôn vinh hình ảnh và chữ hiển thị sắc nét
/// - Nhãn Deal / Tag khuyến mãi nổi bật ("HOT DEAL 🔥", "GIẢM ĐẾN 35%")
/// - Mã giảm giá / Voucher Ticket chip
/// - Nút CTA kích thích hành động ("Khám phá ngay →")
/// - Tự động trượt slide mỗi 4 giây & hỗ trợ vuốt chạm cảm ứng mượt mà
class BannerCarouselWidget extends StatefulWidget {
  final List<PromotionBannerModel> banners;
  final ValueChanged<PromotionBannerModel>? onBannerTap;

  const BannerCarouselWidget({
    super.key,
    required this.banners,
    this.onBannerTap,
  });

  @override
  State<BannerCarouselWidget> createState() => _BannerCarouselWidgetState();
}

class _BannerCarouselWidgetState extends State<BannerCarouselWidget> {
  late PageController _pageController;
  int _currentPage = 0;
  Timer? _autoSlideTimer;

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.92);
    if (!_isInTest && widget.banners.length > 1) {
      _startAutoSlide();
    }
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!mounted || widget.banners.isEmpty) return;
      final nextPage = (_currentPage + 1) % widget.banners.length;
      _pageController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 650),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _stopAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = null;
  }

  @override
  void didUpdateWidget(covariant BannerCarouselWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.banners.length != widget.banners.length) {
      if (!_isInTest && widget.banners.length > 1) {
        _startAutoSlide();
      }
    }
  }

  @override
  void dispose() {
    _stopAutoSlide();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.banners.isNotEmpty
        ? widget.banners
        : PromotionBannerModel.defaultPromotions;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 195,
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollStartNotification) {
                _stopAutoSlide();
              } else if (notification is ScrollEndNotification) {
                if (!_isInTest && list.length > 1) {
                  _startAutoSlide();
                }
              }
              return false;
            },
            child: PageView.builder(
              controller: _pageController,
              itemCount: list.length,
              onPageChanged: (index) {
                setState(() => _currentPage = index);
              },
              itemBuilder: (context, index) {
                final banner = list[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
                  child: _buildCommercialBannerCard(banner),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 10),
        // Thanh chỉ báo Indicator hiện đại (Dots & Active Pill)
        _buildPageIndicator(list.length),
      ],
    );
  }

  /// Thẻ banner quảng cáo du lịch thực tế
  Widget _buildCommercialBannerCard(PromotionBannerModel banner) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => widget.onBannerTap?.call(banner),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // 1. ẢNH NỀN PHONG CẢNH DU LỊCH ĐỘ NÉT CAO (Authentic Travel Photography)
                _buildBannerImage(banner.imageUrl),

                // 2. LỚP PHỦ SCRIM GRADIENT CHUYÊN NGHIỆP CHO QUẢNG CÁO
                // Phủ tối góc trái và dưới cùng để text & badge luôn nổi bật tuyệt đối
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.15),
                          Colors.black.withValues(alpha: 0.35),
                          Colors.black.withValues(alpha: 0.88),
                        ],
                        stops: const [0.0, 0.45, 1.0],
                      ),
                    ),
                  ),
                ),

                // 3. NỘI DUNG QUẢNG CÁO & TYPOGRAPHY PHÂN CẤP RÕ RỆT
                Padding(
                  padding: const EdgeInsets.all(14.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Hàng trên: Badge tag & Mã coupon voucher
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Badge khuyến mãi đỏ cam rực rỡ
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFF416C), Color(0xFFFF4B2B)],
                              ),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFFF416C).withValues(alpha: 0.4),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  banner.badgeText,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Mã Voucher Ticket Chip
                          if (banner.promoCode.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.85),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: Colors.white,
                                  width: 0.8,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.confirmation_number_outlined,
                                    size: 13,
                                    color: AppColors.primaryDark,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    banner.promoCode,
                                    style: const TextStyle(
                                      color: AppColors.primaryDark,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),

                      // Hàng dưới: Tiêu đề, Mô tả ngắn & Nút CTA hành động
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            banner.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                              shadows: [
                                Shadow(
                                  color: Colors.black54,
                                  blurRadius: 6,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            banner.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Discount text nổi bật
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: const Color(0xFFFBBF24),
                                    width: 0.8,
                                  ),
                                ),
                                child: Text(
                                  banner.discountText,
                                  style: const TextStyle(
                                    color: Color(0xFFFDE68A),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),

                              // Nút Call To Action "Khám phá ngay →"
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.2),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      banner.ctaText,
                                      style: const TextStyle(
                                        color: AppColors.primaryDark,
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.arrow_forward_rounded,
                                      size: 13,
                                      color: AppColors.primaryDark,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBannerImage(String imageUrl) {
    if (_isInTest || imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF1E293B),
        child: const Center(
          child: Icon(Icons.photo_size_select_actual_outlined, color: Colors.white38, size: 40),
        ),
      );
    }

    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: BoxFit.cover,
      placeholder: (context, url) => Container(
        color: const Color(0xFF1E293B),
        child: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white38),
          ),
        ),
      ),
      errorWidget: (context, url, error) => Container(
        color: const Color(0xFF1E293B),
        child: const Center(
          child: Icon(Icons.landscape_rounded, color: Colors.white38, size: 40),
        ),
      ),
    );
  }

  Widget _buildPageIndicator(int count) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final isActive = index == _currentPage;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          height: 6,
          width: isActive ? 22 : 6,
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.border,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}
