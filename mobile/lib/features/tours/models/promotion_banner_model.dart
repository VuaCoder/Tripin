/// Model đại diện cho một Banner quảng cáo / Ưu đãi du lịch chuyên nghiệp
/// Thiết kế chuẩn thương mại điện tử du lịch (Traveloka, Klook, Agoda)
class PromotionBannerModel {
  final String id;
  final String title;
  final String subtitle;
  final String imageUrl;
  final String badgeText;
  final String promoCode;
  final String discountText;
  final String ctaText;
  final String? targetCategoryId;
  final String? targetSearchQuery;
  final bool isActive;

  const PromotionBannerModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.imageUrl,
    this.badgeText = 'HOT DEAL',
    this.promoCode = 'TRIPIN2025',
    this.discountText = 'Giảm 30%',
    this.ctaText = 'Săn deal ngay',
    this.targetCategoryId,
    this.targetSearchQuery,
    this.isActive = true,
  });

  factory PromotionBannerModel.fromJson(Map<String, dynamic> json) {
    return PromotionBannerModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? (json['name'] as String? ?? 'Ưu đãi du lịch'),
      subtitle: json['subtitle'] as String? ?? (json['description'] as String? ?? 'Khám phá ngay điểm đến hấp dẫn'),
      imageUrl: json['imageUrl'] as String? ?? (json['bannerUrl'] as String? ?? ''),
      badgeText: json['badgeText'] as String? ?? 'HOT DEAL',
      promoCode: json['promoCode'] as String? ?? (json['code'] as String? ?? 'TRIPIN'),
      discountText: json['discountText'] as String? ?? 'Ưu đãi sốc',
      ctaText: json['ctaText'] as String? ?? 'Săn deal ngay',
      targetCategoryId: json['targetCategoryId'] as String?,
      targetSearchQuery: json['targetSearchQuery'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'imageUrl': imageUrl,
      'badgeText': badgeText,
      'promoCode': promoCode,
      'discountText': discountText,
      'ctaText': ctaText,
      'targetCategoryId': targetCategoryId,
      'targetSearchQuery': targetSearchQuery,
      'isActive': isActive,
    };
  }

  /// Danh sách banner quảng cáo du lịch mặc định chuẩn thiết kế thương mại thực tế
  /// Sử dụng hình ảnh danh lam thắng cảnh Việt Nam chất lượng cao
  static List<PromotionBannerModel> get defaultPromotions => const [
        PromotionBannerModel(
          id: 'promo-halong',
          title: 'Hạ Long Kỳ Vĩ - Du Thuyền 5 Sao',
          subtitle: 'Nghỉ dưỡng thượng lưu trên vịnh di sản, ẩm thực hải sản cao cấp',
          imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=80',
          badgeText: 'GIẢM ĐẾN 35%',
          promoCode: 'HALONG35',
          discountText: 'Tiết kiệm 1.200.000₫',
          ctaText: 'Khám phá ngay',
          targetSearchQuery: 'Hạ Long',
        ),
        PromotionBannerModel(
          id: 'promo-phuquoc',
          title: 'Phú Quốc - Thiên Đường Nắng Vàng',
          subtitle: 'Lặn ngắm san hô 4 đảo, đón hoàng hôn lãng mạn tại Sunset Sanato',
          imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
          badgeText: 'ƯU ĐÃI MÙA HÈ',
          promoCode: 'PHUQUOC25',
          discountText: 'Giảm ngay 25%',
          ctaText: 'Săn deal ngay',
          targetSearchQuery: 'Phú Quốc',
        ),
        PromotionBannerModel(
          id: 'promo-sapa',
          title: 'Săn Mây Sa Pa - Chạm Đỉnh Fansipan',
          subtitle: 'Trekking ruộng bậc thang Mù Cang Chải, ngắm biển mây bồng bềnh',
          imageUrl: 'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=1000&q=80',
          badgeText: 'TOUR BÁN CHẠY',
          promoCode: 'FANSIPAN',
          discountText: 'Tặng voucher 300k',
          ctaText: 'Xem chi tiết',
          targetSearchQuery: 'Sa Pa',
        ),
        PromotionBannerModel(
          id: 'promo-hoian',
          title: 'Phố Cổ Hội An - Đêm Hoa Đăng Hoài Niệm',
          subtitle: 'Thả đèn hoa đăng sông Hoài, thưởng thức cao lầu và cà phê phố Hội',
          imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1000&q=80',
          badgeText: 'ĐỘC QUYỀN APP',
          promoCode: 'HOIANLOVE',
          discountText: 'Giảm 20% nhóm 3+',
          ctaText: 'Đặt vé ngay',
          targetSearchQuery: 'Hội An',
        ),
      ];
}
