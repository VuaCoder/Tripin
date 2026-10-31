import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../wishlist/bloc/wishlist_cubit.dart';
import '../bloc/tour_detail_bloc.dart';
import '../bloc/tour_detail_event.dart';
import '../bloc/tour_detail_state.dart';
import '../models/tour_detail_model.dart';
import '../widgets/precise_rating_stars.dart';
import '../widgets/tour_detail_image_carousel.dart';
import '../widgets/tour_detail_policies_widget.dart';
import '../widgets/tour_detail_reviews_section.dart';
import '../widgets/tour_detail_shimmer_skeleton.dart';
import '../widgets/tour_detail_timeline_widget.dart';
import 'tour_booking_checkout_screen.dart';

/// Màn hình Chi tiết Tour phong cách Airbnb (Ảnh 1)
/// - Top Carousel: Nút Back tròn, Nút Chia sẻ, Nút Trái tim (đỏ nếu đã tim, xám nếu chưa)
/// - Body Card bo tròn góc trên (28px) trùm lên ảnh
/// - Tên tour kèm icon dịch/ngôn ngữ
/// - Hàng đánh giá 3 cột: Điểm sao | Được khách yêu thích | Số đánh giá
/// - Phần Host: "Thuộc về [Tên công ty]" kèm logo & huy hiệu xác minh
/// - Thông tin chuyến đi & mô tả chi tiết
/// - Lịch trình chi tiết: Dropdown accordion (thu gọn/mở rộng để tránh kéo dài)
/// - Thông tin & chính sách: Dropdown accordion
/// - Đánh giá từ du khách
/// - Sticky Bottom Bar:
///   - Bên trái: Giá tour (/ khách)
///   - Bên phải: Nút "Đặt tour" -> bấm vào mở modal chọn ngày -> chọn ngày & bấm "Hoàn tất"
///   - Sau đó đổi nút thành "Thanh toán ➔" -> bấm vào chuyển sang màn hình thanh toán PayOS
class TourDetailScreen extends StatefulWidget {
  final String tourId;
  final void Function(String tourId, String departureId)? onBookTour;
  final ApiClient? apiClient;

  const TourDetailScreen({
    super.key,
    required this.tourId,
    this.onBookTour,
    this.apiClient,
  });

  @override
  State<TourDetailScreen> createState() => _TourDetailScreenState();
}

class _TourDetailScreenState extends State<TourDetailScreen> {
  TourDepartureModel? _selectedDeparture;
  bool _hasConfirmedDate = false;
  bool _isItineraryExpanded = false;
  bool _isPoliciesExpanded = false;

  final NumberFormat _currencyFormatter = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => TourDetailBloc(client: widget.apiClient)
        ..add(TourDetailLoadRequested(widget.tourId)),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: BlocBuilder<TourDetailBloc, TourDetailState>(
          builder: (context, state) {
            if (state is TourDetailLoading || state is TourDetailInitial) {
              return const TourDetailShimmerSkeleton();
            }

            if (state is TourDetailNotFound) {
              return _buildNotFoundState(context);
            }

            if (state is TourDetailError) {
              return _buildErrorState(context, state.message);
            }

            if (state is TourDetailLoaded) {
              return _buildLoadedState(context, state);
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }

  Widget _buildNotFoundState(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: AppColors.primarySurface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.travel_explore_rounded,
                  size: 64,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Không tìm thấy tour',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Tour này có thể đã bị xóa, tạm ngưng hoặc không còn khả dụng trên hệ thống.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: const Text('Quay lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, String message) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: AppColors.errorSurface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.cloud_off_rounded,
                  size: 56,
                  color: AppColors.error,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Không thể tải thông tin',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded, size: 18),
                    label: const Text('Quay lại'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      context.read<TourDetailBloc>().add(TourDetailLoadRequested(widget.tourId));
                    },
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Thử lại'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadedState(BuildContext context, TourDetailLoaded state) {
    final tour = state.tour;

    // Lắng nghe trạng thái yêu thích từ WishlistCubit
    final isFavorite = context.select<WishlistCubit, bool>(
      (cubit) => cubit.state.isFavorite(tour.id),
    );

    // Xác định departure được chọn
    final currentDep = _selectedDeparture ?? state.selectedDeparture;
    final displayPrice = currentDep != null ? currentDep.price : tour.basePrice;

    return Stack(
      children: [
        // Nội dung cuộn
        RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<TourDetailBloc>().add(const TourDetailRefreshRequested());
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Top Image Carousel (Ảnh 1)
                TourDetailImageCarousel(
                  images: tour.images,
                  isFavorite: isFavorite,
                  onFavoriteTap: () {
                    context.read<WishlistCubit>().handleHeartTap(
                          context: context,
                          tour: tour.toTourModel(),
                        );
                  },
                  onBack: () => Navigator.of(context).pop(),
                ),

                // 2. Main Content Card (Bo góc tròn 28px trùm lên ảnh)
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
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 140),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tên tour (bỏ icon dịch thuật theo yêu cầu)
                        Text(
                          tour.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.4,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Subtitle: Điểm đến & Loại tour / số khách
                        Text(
                          tour.destination,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${tour.durationDays} ngày · ${tour.maxGroupSize != null ? "Tối đa ${tour.maxGroupSize} khách" : "Tour trọn gói"} · Dịch vụ chuẩn',
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: AppColors.textSecondary,
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Khối đánh giá 3 cột phong cách Airbnb (Ảnh 1)
                        _buildAirbnbRatingSection(tour),

                        const SizedBox(height: 20),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Host section: Thiết kế "Thuộc về + [Tên công ty]" theo yêu cầu
                        _buildHostSection(tour),

                        const SizedBox(height: 20),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 20),

                        // Thông tin về chuyến đi & Mô tả
                        _buildTripHighlightsAndDescription(tour),

                        const SizedBox(height: 24),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 18),

                        // Lịch trình cụ thể: Dropdown Accordion để tránh kéo nhiều
                        _buildItineraryDropdown(tour),

                        const SizedBox(height: 16),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 18),

                        // Thông tin & Chính sách: Dropdown Accordion để tránh kéo nhiều
                        _buildPoliciesDropdown(tour),

                        const SizedBox(height: 24),
                        const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
                        const SizedBox(height: 24),

                        // Đánh giá từ khách hàng
                        TourDetailReviewsSection(
                          tourId: tour.id,
                          ratingAvg: tour.ratingAvg,
                          ratingCount: tour.ratingCount,
                          apiClient: widget.apiClient,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 3. Sticky Bottom Bar: Giá & Nút Đặt tour / Thanh toán
        _buildBottomStickyBar(context, tour, displayPrice),
      ],
    );
  }

  /// Khối đánh giá chuẩn theo bố cục Ảnh 2 (Bỏ Guest favorite):
  /// - Cột 1: Điểm số trung bình + 5 ngôi sao bên dưới
  /// - Đường gạch dọc ngăn cách ở giữa
  /// - Cột 2: Số lượt đánh giá + Chữ "Đánh giá" bên dưới
  Widget _buildAirbnbRatingSection(TourDetailModel tour) {
    final hasRatings = tour.ratingCount > 0 && tour.ratingAvg > 0;
    final ratingValue = hasRatings ? tour.ratingAvg : 5.0;
    final ratingStr = ratingValue.toStringAsFixed(1);
    final countStr = '${tour.ratingCount}';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
      ),
      child: Row(
        children: [
          // Cột 1: Điểm đánh giá & 5 ngôi sao
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  ratingStr,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF222222),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                PreciseRatingStars(
                  rating: ratingValue,
                  size: 13,
                  spacing: 2,
                ),
              ],
            ),
          ),

          // Đường kẻ dọc phân cách ở giữa (chuẩn Ảnh 2)
          Container(
            height: 38,
            width: 1,
            color: const Color(0xFFE5E7EB),
          ),

          // Cột 2: Số lượt đánh giá & Nhãn Đánh giá
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  countStr,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF222222),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  hasRatings ? 'Đánh giá' : 'Chưa có đánh giá',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF222222),
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Phần Host: Yêu cầu "thiết kế lại bằng Thuộc về + 'Tên công ty'"
  Widget _buildHostSection(TourDetailModel tour) {
    final companyName = tour.agency?.name ?? 'Tripri Travel Partner';

    return Row(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: const Color(0xFFF3F4F6),
              backgroundImage: tour.agency?.avatarUrl != null
                  ? NetworkImage(tour.agency!.avatarUrl!)
                  : null,
              child: tour.agency?.avatarUrl == null
                  ? const Icon(Icons.business_rounded, color: AppColors.primary, size: 26)
                  : null,
            ),
            Positioned(
              right: -2,
              bottom: -2,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: Color(0xFFE00B41),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.verified_rounded,
                  size: 11,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Thuộc về $companyName',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'Đơn vị tổ chức chuyên nghiệp · Đối tác xác minh Tripri',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Thông tin chuyến đi & Mô tả (Ảnh 1)
  Widget _buildTripHighlightsAndDescription(TourDetailModel tour) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Item 1: Điểm đến
        _buildHighlightRow(
          icon: Icons.location_on_outlined,
          title: 'Điểm đến & Tuyến tham quan',
          subtitle: 'Khám phá các điểm nổi tiếng tại ${tour.destination}',
        ),
        const SizedBox(height: 16),

        // Item 2: Phương tiện
        _buildHighlightRow(
          icon: Icons.directions_bus_outlined,
          title: 'Phương tiện di chuyển',
          subtitle: 'Xe du lịch đời mới, tiện nghi, đưa đón chu đáo suốt hành trình',
        ),
        const SizedBox(height: 16),

        // Item 3: Hướng dẫn viên
        _buildHighlightRow(
          icon: Icons.badge_outlined,
          title: 'Hướng dẫn viên đồng hành',
          subtitle: tour.guide != null
              ? 'HDV ${tour.guide!.fullName} nhiệt tình, am hiểu văn hóa bản địa'
              : 'HDV chuyên nghiệp hỗ trợ tận tâm suốt tuyến',
        ),
        const SizedBox(height: 16),

        // Item 4: Quy mô đoàn
        _buildHighlightRow(
          icon: Icons.groups_outlined,
          title: 'Quy mô đoàn',
          subtitle: 'Tối đa ${tour.maxGroupSize ?? 20} khách, đảm bảo trải nghiệm tốt nhất',
        ),

        // Tóm tắt & Mô tả
        if (tour.summary != null && tour.summary!.trim().isNotEmpty) ...[
          const SizedBox(height: 20),
          Text(
            tour.summary!,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              height: 1.5,
            ),
          ),
        ],

        if (tour.description != null && tour.description!.trim().isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            tour.description!,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildHighlightRow({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 24, color: const Color(0xFF222222)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 13.5,
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Dropdown Accordion cho Lịch trình cụ thể
  Widget _buildItineraryDropdown(TourDetailModel tour) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEBEBEB)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                _isItineraryExpanded = !_isItineraryExpanded;
              });
            },
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.calendar_month_outlined,
                      size: 20,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Lịch trình cụ thể',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'Chi tiết từng ngày (${tour.itinerary.length} chặng)',
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _isItineraryExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 26,
                    color: AppColors.textPrimary,
                  ),
                ],
              ),
            ),
          ),
          if (_isItineraryExpanded) ...[
            const Divider(height: 1, color: Color(0xFFEBEBEB)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TourDetailTimelineWidget(itinerary: tour.itinerary),
            ),
          ],
        ],
      ),
    );
  }

  /// Dropdown Accordion cho Thông tin & Chính sách
  Widget _buildPoliciesDropdown(TourDetailModel tour) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEBEBEB)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                _isPoliciesExpanded = !_isPoliciesExpanded;
              });
            },
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEBF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      size: 20,
                      color: Color(0xFF007A87),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Thông tin & Chính sách',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'Bao gồm, điều khoản hoàn hủy & lưu ý',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _isPoliciesExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 26,
                    color: AppColors.textPrimary,
                  ),
                ],
              ),
            ),
          ),
          if (_isPoliciesExpanded) ...[
            const Divider(height: 1, color: Color(0xFFEBEBEB)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TourDetailPoliciesWidget(tour: tour),
            ),
          ],
        ],
      ),
    );
  }

  /// Sticky Bottom Bar:
  /// - Bên trái: Giá (/ khách)
  /// - Bên phải: Nút "Đặt tour" -> Bấm vào hiện sheet chọn ngày -> Bấm "Hoàn tất" -> Nút chuyển thành "Thanh toán ➔" -> Chuyển qua màn hình thanh toán
  Widget _buildBottomStickyBar(
    BuildContext context,
    TourDetailModel tour,
    int displayPrice,
  ) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
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
            children: [
              // Cột giá
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedDeparture != null
                          ? 'Khởi hành: ${DateFormat('dd/MM/yyyy').format(_selectedDeparture!.date)}'
                          : 'Giá từ:',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          _currencyFormatter.format(displayPrice),
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF222222),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          '/ khách',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Nút hành động: "Đặt tour"
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    if (!_hasConfirmedDate || _selectedDeparture == null) {
                            _openDeparturePickerSheet(context, tour);
                          } else {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => TourBookingCheckoutScreen(
                                  tour: tour,
                                  initialDeparture: _selectedDeparture!,
                                  availableDepartures: _getAvailableDepartures(tour),
                                  apiClient: widget.apiClient,
                                ),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary, // Màu xanh chủ đạo
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.6),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Đặt tour',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatVietnameseDate(DateTime date) {
    const weekdays = [
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
      'Chủ Nhật',
    ];
    final weekday = weekdays[(date.weekday - 1).clamp(0, 6)];
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString();
    return '$weekday, $day/$month/$year';
  }

  /// Badge hiển thị số lượng chỗ còn lại và tag trạng thái (MỚI, SẮP HẾT)
  Widget _buildDepartureSlotBadges(TourDepartureModel dep) {
    final remaining = dep.remaining > 0 ? dep.remaining : 8;

    // Phân loại trạng thái chỗ
    final bool isUrgent = remaining <= 5;
    final bool isPopular = remaining > 5 && remaining <= 15;
    final bool isPlenty = remaining > 15;

    // Màu & Text cho Pill "Còn X chỗ"
    final Color pillBgColor = isUrgent
        ? const Color(0xFFFFF1F2)
        : (isPopular ? const Color(0xFFFFFBEB) : const Color(0xFFF0FDF4));
    final Color pillBorderColor = isUrgent
        ? const Color(0xFFFECDD3)
        : (isPopular ? const Color(0xFFFDE68A) : const Color(0xFFBBF7D0));
    final Color pillTextColor = isUrgent
        ? const Color(0xFFE11D48)
        : (isPopular ? const Color(0xFFD97706) : const Color(0xFF16A34A));
    final IconData pillIcon = isUrgent
        ? Icons.local_fire_department_rounded
        : (isPopular ? Icons.bolt_rounded : Icons.confirmation_number_outlined);

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Pill: Còn X chỗ thiết kế nổi bật, mềm mại
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
          decoration: BoxDecoration(
            color: pillBgColor,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: pillBorderColor, width: 0.8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(pillIcon, size: 12, color: pillTextColor),
              const SizedBox(width: 3.5),
              Text(
                isUrgent ? 'Chỉ còn $remaining chỗ' : 'Còn $remaining chỗ',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: pillTextColor,
                ),
              ),
            ],
          ),
        ),

        // Tag bổ trợ bên cạnh (SẮP HẾT, MỚI)
        if (isUrgent)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
            decoration: BoxDecoration(
              color: const Color(0xFFFFE4E6),
              borderRadius: BorderRadius.circular(5),
            ),
            child: const Text(
              'SẮP HẾT',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
                color: Color(0xFFBE123C),
              ),
            ),
          )
        else if (isPlenty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(5),
              border: Border.all(color: const Color(0xFFBFDBFE), width: 0.8),
            ),
            child: const Text(
              'MỚI',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
                color: Color(0xFF1D4ED8),
              ),
            ),
          ),
      ],
    );
  }

  /// Lấy danh sách ngày khởi hành cố định
  List<TourDepartureModel> _getAvailableDepartures(TourDetailModel tour) {
    if (tour.departures.isNotEmpty) {
      return tour.departures;
    }
    final now = DateTime.now();
    return [
      TourDepartureModel(
        id: 'dep_mock_1',
        date: now.add(const Duration(days: 7)),
        capacity: 25,
        remaining: 12,
        price: tour.basePrice,
        isOpen: true,
      ),
      TourDepartureModel(
        id: 'dep_mock_2',
        date: now.add(const Duration(days: 14)),
        capacity: 25,
        remaining: 8,
        price: tour.basePrice,
        isOpen: true,
      ),
      TourDepartureModel(
        id: 'dep_mock_3',
        date: now.add(const Duration(days: 21)),
        capacity: 25,
        remaining: 18,
        price: tour.basePrice,
        isOpen: true,
      ),
    ];
  }

  /// Modal chọn ngày khởi hành: hiển thị danh sách các ngày đang có
  void _openDeparturePickerSheet(BuildContext context, TourDetailModel tour) {
    final departuresList = _getAvailableDepartures(tour);
    TourDepartureModel tempSelected = _selectedDeparture ?? departuresList.first;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(sheetContext).size.height * 0.75,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Thanh gạt
                    Center(
                      child: Container(
                        margin: const EdgeInsets.only(top: 12, bottom: 8),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD6D6D6),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),

                    // Header modal
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Chọn ngày khởi hành',
                                style: TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Chọn ngày phù hợp với kế hoạch của bạn',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Color(0xFF222222)),
                            onPressed: () => Navigator.of(sheetContext).pop(),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFF0F0F0)),

                    // Danh sách các ngày đang có
                    Flexible(
                      child: ListView.separated(
                        padding: const EdgeInsets.all(20),
                        shrinkWrap: true,
                        itemCount: departuresList.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (ctx, index) {
                          final dep = departuresList[index];
                          final isSelected = tempSelected.id == dep.id;
                          final dateStr = _formatVietnameseDate(dep.date);

                          return InkWell(
                            onTap: () {
                              setModalState(() {
                                tempSelected = dep;
                              });
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primarySurface : Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.primary
                                      : const Color(0xFFEBEBEB),
                                  width: isSelected ? 1.8 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isSelected
                                            ? AppColors.primary
                                            : const Color(0xFFB0B0B0),
                                        width: 2,
                                      ),
                                      color: isSelected
                                          ? AppColors.primary
                                          : Colors.transparent,
                                    ),
                                    child: isSelected
                                        ? const Center(
                                            child: Icon(
                                              Icons.check_rounded,
                                              size: 14,
                                              color: Colors.white,
                                            ),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          dateStr,
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w700,
                                            color: isSelected
                                                ? AppColors.primary
                                                : AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        _buildDepartureSlotBadges(dep),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    _currencyFormatter.format(dep.price),
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: isSelected
                                          ? AppColors.primary
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Nút Hoàn tất
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                      child: SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _selectedDeparture = tempSelected;
                              _hasConfirmedDate = true;
                            });

                            // Đồng bộ với Bloc nếu có
                            try {
                              context.read<TourDetailBloc>().add(
                                    TourDetailDepartureSelected(tempSelected.id),
                                  );
                            } catch (_) {}

                            Navigator.of(sheetContext).pop();

                            // Chuyển sang luồng Đặt tour 2 bước (Ảnh 2 & 3)
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => TourBookingCheckoutScreen(
                                  tour: tour,
                                  initialDeparture: tempSelected,
                                  availableDepartures: departuresList,
                                  apiClient: widget.apiClient,
                                ),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text(
                            'Hoàn tất',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
