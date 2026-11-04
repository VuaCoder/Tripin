import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/notification_service.dart';
import '../../notifications/models/notification_models.dart';
import '../../notifications/services/notifications_storage.dart';
import '../../profile/bloc/profile_bloc.dart';
import '../../profile/bloc/profile_state.dart';
import '../../tours/bloc/tour_review_bloc.dart';
import '../../tours/widgets/tour_review_form_modal.dart';
import '../bloc/booked_trips_repository.dart';
import '../models/booking_models.dart';

/// Màn hình danh sách Chuyến đi theo thiết kế Ảnh 3
class TripsScreen extends StatefulWidget {
  final BookedTripsRepository? repository;
  final VoidCallback? onExploreTap;
  final List<BookingItem>? initialTrips;

  const TripsScreen({super.key, this.repository, this.onExploreTap, this.initialTrips});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  late final BookedTripsRepository _repo = widget.repository ?? BookedTripsRepository();
  List<BookingItem> _trips = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    if (widget.initialTrips != null) {
      _trips = widget.initialTrips!;
      _isLoading = false;
    } else {
      _trips = [];
      _isLoading = true;
      _loadTrips();
    }
  }

  Future<void> _loadTrips() async {
    try {
      final trips = await _repo.getTrips();
      if (mounted) {
        setState(() {
          _trips = trips;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showQrDialog(BookingItem trip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _TripQrBottomSheet(trip: trip),
    );
  }

  Future<void> _handleCompleteTrip(BookingItem trip) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận hoàn thành'),
        content: Text('Bạn đã kết thúc chuyến đi "${trip.tourTitle}"? Sau khi hoàn thành, bạn có thể viết đánh giá cho chuyến đi này.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Chưa', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
            ),
            child: const Text('Hoàn thành'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _repo.markCompleted(trip.id);

      // Lưu thông báo hoàn thành tour và xin cảm nghĩ
      final notif = AppNotification(
        id: 'notif-completed-${trip.id}-${DateTime.now().millisecondsSinceEpoch}',
        type: 'TOUR_COMPLETED',
        title: 'Chuyến đi hoàn thành! 🎉',
        body: 'Chúc mừng bạn đã hoàn thành tour "${trip.tourTitle}". Hãy cho chúng tôi xin cảm nghĩ và đánh giá của bạn nhé!',
        isRead: false,
        createdAt: DateTime.now(),
      );
      await NotificationsStorage().addNotification(notif);
      try {
        await NotificationService().showNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: 'Chuyến đi hoàn thành! 🎉',
          body: 'Chúc mừng bạn đã hoàn thành tour "${trip.tourTitle}". Hãy cho chúng tôi xin cảm nghĩ nhé!',
        );
      } catch (_) {}

      if (mounted) {
        setState(() {
          _trips = _trips.map((t) => t.id == trip.id ? t.copyWith(status: BookingStatus.completed) : t).toList();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã cập nhật trạng thái: Hoàn thành! Bạn có thể viết đánh giá ngay bây giờ.'),
            backgroundColor: Color(0xFF0F766E),
          ),
        );
        await _loadTrips();
      }
    }
  }

  final Set<String> _inProgressReviewBookingIds = {};

  Future<void> _handleWriteReview(BookingItem trip) async {
    // Đánh dấu người dùng đã mở ô viết đánh giá
    setState(() {
      _inProgressReviewBookingIds.add(trip.id);
    });

    final result = await TourReviewFormModal.show(
      context,
      bookingId: trip.id,
      bloc: TourReviewBloc(),
    );

    if (result == true) {
      await _repo.markReviewed(trip.id);
      if (mounted) {
        setState(() {
          _inProgressReviewBookingIds.remove(trip.id);
          _trips = _trips.map((t) => (t.id == trip.id || t.bookingCode == trip.bookingCode) ? t.copyWith(isReviewed: true) : t).toList();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cảm ơn bạn đã gửi đánh giá cho chuyến đi!'),
            backgroundColor: Color(0xFF0F766E),
          ),
        );
        await _loadTrips();
      }
    } else {
      // Người dùng đã bấm vào ô đánh giá nhưng dừng lại / chưa gửi: giữ màu vàng cho tick thứ 2
      if (mounted) {
        setState(() {});
      }
    }
  }

  String _formatDateRange(DateTime start, DateTime end) {
    try {
      final startDay = start.day.toString().padLeft(2, '0');
      final endDay = end.day.toString().padLeft(2, '0');
      if (start.month == end.month && start.year == end.year) {
        return '$startDay – $endDay thg ${start.month}, ${start.year}';
      }
      if (start.year == end.year) {
        return '$startDay thg ${start.month} – $endDay thg ${end.month}, ${start.year}';
      }
      return '$startDay thg ${start.month}, ${start.year} – $endDay thg ${end.month}, ${end.year}';
    } catch (_) {
      return '${start.day}/${start.month} – ${end.day}/${end.month}/${end.year}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Chuyến đi',
          style: TextStyle(
            color: Color(0xFF1E293B),
            fontSize: 22,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.3,
          ),
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const _TripsSkeletonLoading()
            : (_trips.isEmpty
                ? _EmptyTripsView(onExploreTap: widget.onExploreTap)
                : RefreshIndicator(
                    onRefresh: _loadTrips,
                    color: AppColors.primary,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      itemCount: _trips.length,
                      separatorBuilder: (_, index) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final trip = _trips[index];
                        return _TripCard(
                          trip: trip,
                          dateRangeText: _formatDateRange(trip.departureDate, trip.endDate),
                          onViewQr: () => _showQrDialog(trip),
                          onComplete: () => _handleCompleteTrip(trip),
                          onWriteReview: () => _handleWriteReview(trip),
                          isInProgressReview: _inProgressReviewBookingIds.contains(trip.id),
                        );
                      },
                    ),
                  )),
      ),
    );
  }
}

/// Thẻ chuyến đi thiết kế chuẩn Ảnh 3 với circular tick overlapping
class _TripCard extends StatelessWidget {
  final BookingItem trip;
  final String dateRangeText;
  final VoidCallback onViewQr;
  final VoidCallback onComplete;
  final VoidCallback onWriteReview;
  final bool isInProgressReview;

  const _TripCard({
    required this.trip,
    required this.dateRangeText,
    required this.onViewQr,
    required this.onComplete,
    required this.onWriteReview,
    this.isInProgressReview = false,
  });

  @override
  Widget build(BuildContext context) {
    // Tên chuyến đi (luôn ưu tiên tên tour đầy đủ, không lấy tên điểm đến đè lên)
    final title = trip.tourTitle.trim().isNotEmpty
        ? trip.tourTitle.trim()
        : (trip.destination?.trim().isNotEmpty == true ? trip.destination!.trim() : 'Chuyến đi');

    // Số khách đi cùng ngoài người đặt (nếu 3 người thì +2)
    final additionalGuests = trip.participants > 1 ? trip.participants - 1 : 0;

    // Lấy avatar người dùng thực tế: ưu tiên từ trip -> người dùng đang đăng nhập -> biểu tượng avatar
    final profileState = context.watch<ProfileBloc?>()?.state;
    String? userAvatar;
    if (profileState is ProfileLoaded) {
      userAvatar = profileState.user.avatarUrl;
    } else if (profileState is ProfileUpdateSuccess) {
      userAvatar = profileState.user.avatarUrl;
    }
    final effectiveAvatarUrl = (trip.customerAvatarUrl != null && trip.customerAvatarUrl!.trim().isNotEmpty)
        ? trip.customerAvatarUrl!.trim()
        : (userAvatar != null && userAvatar.trim().isNotEmpty ? userAvatar.trim() : null);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Ảnh bên trái bo góc tròn
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: trip.thumbnailUrl != null && trip.thumbnailUrl!.startsWith('http')
                    ? CachedNetworkImage(
                        imageUrl: trip.thumbnailUrl!,
                        width: 90,
                        height: 90,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          width: 90,
                          height: 90,
                          color: const Color(0xFFE2E8F0),
                          child: const Icon(Icons.image, color: Colors.grey),
                        ),
                        errorWidget: (context, url, error) => _buildFallbackImage(),
                      )
                    : _buildFallbackImage(),
              ),
              const SizedBox(width: 14),

              // Cột thông tin bên phải: Tên + ngày + avatar số lượng khách
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateRangeText,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Nhóm Avatar người đặt + số lượng khách đi cùng (+X) lồng nhau: bên trái đè lên bên phải
                    _buildGuestGroupAvatar(
                      additionalGuests: additionalGuests,
                      avatarUrl: effectiveAvatarUrl,
                      fallbackLetter: '',
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Khu vực hành động dưới thẻ (Đã bỏ mã, hiện icon tick tròn theo Ảnh 3, nút Đã đánh giá / Viết đánh giá, nút Xem QR)
          Row(
            children: [
              // Bên trái: 2 ô tick overlapping theo prompt "Use circular tick overlapping through compact negative spacing"
              // Tick 1 đại diện cho tour (Vàng nếu đã xác nhận, Xanh nếu hoàn thành)
              // Tick 2 đại diện cho đánh giá (Xám nếu chưa đánh giá, Vàng nếu đang đánh giá, Xanh nếu đã đánh giá)
              _buildOverlappingTicks(),
              const Spacer(),

              // Nút Hoàn thành HOẶC Viết đánh giá
              // Nếu đã đánh giá: Không hiện nút (vì đã có 2 tick xanh bên trái đại diện)
              if (trip.status != BookingStatus.completed)
                InkWell(
                  onTap: onComplete,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: const Text(
                      'Hoàn thành',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF059669),
                      ),
                    ),
                  ),
                )
              else if (!trip.isReviewed)
                InkWell(
                  onTap: onWriteReview,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: const Text(
                      'Viết đánh giá',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ),
                ),

              if (trip.status != BookingStatus.completed || !trip.isReviewed)
                const SizedBox(width: 8),

              // Nút Xem QR
              InkWell(
                onTap: onViewQr,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.qr_code_2_rounded, size: 16, color: Color(0xFF0F766E)),
                      SizedBox(width: 4),
                      Text(
                        'Xem QR',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Thiết kế 2 ô tick lồng nhẹ lên nhau: "Use circular tick overlapping through compact negative spacing"
  /// - Ô tick 1: Đại diện cho Tour:
  ///     + Đã xác nhận: Màu vàng (yellow/amber)
  ///     + Đã hoàn thành: Màu xanh lá (green)
  /// - Ô tick 2: Đại diện cho Đánh giá:
  ///     + Chưa đánh giá: Màu xám
  ///     + Đang đánh giá (bấm vào ô nhưng dừng lại/chưa gửi): Màu vàng
  ///     + Đã đánh giá: Màu xanh lá
  Widget _buildOverlappingTicks() {
    final bool isCompleted = trip.status == BookingStatus.completed;
    final Color tourColor = isCompleted
        ? const Color(0xFF16A34A) // Xanh lá
        : const Color(0xFFEAB308); // Vàng
    final Color tourBgColor = isCompleted
        ? const Color(0xFFDCFCE7)
        : const Color(0xFFFEF9C3);

    final Color reviewColor;
    final Color reviewBgColor;
    if (trip.isReviewed) {
      reviewColor = const Color(0xFF16A34A); // Xanh lá
      reviewBgColor = const Color(0xFFDCFCE7);
    } else if (isInProgressReview) {
      reviewColor = const Color(0xFFEAB308); // Vàng
      reviewBgColor = const Color(0xFFFEF9C3);
    } else {
      reviewColor = const Color(0xFF94A3B8); // Xám
      reviewBgColor = const Color(0xFFF1F5F9);
    }

    final String tourTooltip = isCompleted ? 'Đã hoàn thành chuyến đi' : 'Đã xác nhận chuyến đi';
    final String reviewTooltip = trip.isReviewed
        ? 'Đã đánh giá chuyến đi'
        : (isInProgressReview ? 'Đang viết đánh giá' : 'Chưa đánh giá chuyến đi');

    return SizedBox(
      height: 29,
      width: 45, // 26px + 26px - 7px (compact negative spacing)
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.centerLeft,
        children: [
          // Ô tick 1: Tour status (Vàng nếu đã xác nhận, Xanh nếu hoàn thành)
          Positioned(
            left: 0,
            child: Tooltip(
              message: tourTooltip,
              child: _buildTickBadge(
                color: tourColor,
                bgColor: tourBgColor,
                hasWhiteSeparation: false,
              ),
            ),
          ),
          // Ô tick 2: Review status (Xám nếu chưa đánh giá, Vàng nếu đang đánh giá, Xanh nếu đã đánh giá)
          // Luôn có viền màu sắc nét, kèm viền trắng halo 1.5px phân tách khi đè lên tick 1
          Positioned(
            left: 17,
            child: Tooltip(
              message: reviewTooltip,
              child: _buildTickBadge(
                color: reviewColor,
                bgColor: reviewBgColor,
                hasWhiteSeparation: true,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTickBadge({
    required Color color,
    required Color bgColor,
    required bool hasWhiteSeparation,
  }) {
    final badge = Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: bgColor,
        border: Border.all(
          color: color,
          width: 1.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Center(
        child: Icon(
          Icons.check_rounded,
          size: 15,
          color: color,
        ),
      ),
    );

    if (hasWhiteSeparation) {
      return Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
        ),
        padding: const EdgeInsets.all(1.5),
        child: badge,
      );
    }

    return badge;
  }

  Widget _buildFallbackImage() => Container(
        width: 90,
        height: 90,
        color: const Color(0xFFCBD5E1),
        child: const Icon(Icons.apartment_rounded, color: Colors.white, size: 36),
      );

  /// Thiết kế nhóm avatar khách lồng nhau (+1, +2, +3...):
  /// "phần bên trái phải đè phía trên, phần bên phải nằm phía dưới"
  Widget _buildGuestGroupAvatar({
    required int additionalGuests,
    required String? avatarUrl,
    required String fallbackLetter,
  }) {
    final avatar = _buildUserAvatar(avatarUrl, fallbackLetter);
    if (additionalGuests <= 0) {
      return avatar;
    }

    final plusBadge = Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFFF1F5F9),
        border: Border.all(
          color: const Color(0xFF94A3B8),
          width: 1.6,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '+$additionalGuests',
        style: const TextStyle(
          color: Color(0xFF334155),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    // Thiết kế giống 2 tick lồng nhau: bên trái đè phía trên, bên phải nằm phía dưới
    return SizedBox(
      height: 29,
      width: 45, // 26px + 26px - 7px
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.centerLeft,
        children: [
          // Bên phải (+X) nằm phía dưới
          Positioned(
            left: 17,
            child: plusBadge,
          ),
          // Bên trái (Avatar người dùng) đè phía trên, bọc viền halo trắng 1.5px để phân tách viền sắc nét
          Positioned(
            left: 0,
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              padding: const EdgeInsets.all(1.5),
              child: avatar,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserAvatar(String? avatarUrl, String fallbackLetter) {
    if (avatarUrl != null && avatarUrl.isNotEmpty && avatarUrl.startsWith('http')) {
      return Container(
        width: 26,
        height: 26,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
        ),
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: avatarUrl,
            width: 26,
            height: 26,
            fit: BoxFit.cover,
            placeholder: (context, url) => Container(
              color: AppColors.primarySurface,
              alignment: Alignment.center,
              child: const Icon(
                Icons.person,
                size: 15,
                color: AppColors.primary,
              ),
            ),
            errorWidget: (context, url, error) => Container(
              color: AppColors.primarySurface,
              alignment: Alignment.center,
              child: const Icon(
                Icons.person,
                size: 15,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      width: 26,
      height: 26,
      decoration: const BoxDecoration(
        color: AppColors.primarySurface,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.person,
        size: 15,
        color: AppColors.primary,
      ),
    );
  }
}

/// Bottom Sheet hiển thị mã QR vé điện tử
class _TripQrBottomSheet extends StatelessWidget {
  final BookingItem trip;

  const _TripQrBottomSheet({required this.trip});

  @override
  Widget build(BuildContext context) {
    final title = trip.tourTitle.isNotEmpty ? trip.tourTitle : (trip.destination ?? 'Chuyến đi Tripri');
    final qrData = 'TRIPRI:${trip.bookingCode}:${trip.tourId}';
    final dateFormatted = DateFormat('dd/MM/yyyy').format(trip.departureDate);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Thanh kéo chỉ dẫn
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Mã QR Check-in',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Xuất trình mã này cho Hướng dẫn viên khi lên xe/tàu',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 20),

          // Khung hiển thị QR code thật
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: QrImageView(
              data: qrData,
              version: QrVersions.auto,
              size: 210,
              backgroundColor: Colors.white,
              errorCorrectionLevel: QrErrorCorrectLevel.H,
            ),
          ),
          const SizedBox(height: 16),

          // Thông tin chi tiết đơn
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Mã đặt chỗ:', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                    Text(
                      trip.bookingCode,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Chuyến đi:', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                    Expanded(
                      child: Text(
                        title,
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Ngày khởi hành:', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                    Text(dateFormatted, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Số khách:', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                    Text(
                      '${trip.participants} người',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Đóng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyTripsView extends StatelessWidget {
  final VoidCallback? onExploreTap;

  const _EmptyTripsView({this.onExploreTap});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.luggage_outlined, size: 72, color: Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            const Text(
              'Chưa có chuyến đi nào',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            const Text(
              'Các chuyến đi sau khi thanh toán thành công sẽ xuất hiện tại đây kèm mã QR check-in.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), height: 1.4),
            ),
            const SizedBox(height: 24),
            if (onExploreTap != null)
              ElevatedButton(
                onPressed: onExploreTap,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text('Khám phá tour ngay'),
              ),
          ],
        ),
      ),
    );
  }
}

/// Shimmer / Skeleton Loading cho màn hình danh sách Chuyến đi
/// Khớp 1:1 bố cục thẻ _TripCard:
/// - Ảnh thumbnail 90x90 bo góc 18px
/// - Tiêu đề tour + ngày tháng + avatar người đặt
/// - Đường phân cách
/// - 2 tick overlapping + nút hành động
class _TripsSkeletonLoading extends StatefulWidget {
  const _TripsSkeletonLoading();

  @override
  State<_TripsSkeletonLoading> createState() => _TripsSkeletonLoadingState();
}

class _TripsSkeletonLoadingState extends State<_TripsSkeletonLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

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

  Widget _buildBox({required double width, required double height, double borderRadius = 6}) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
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

  Widget _buildCardSkeleton() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildBox(width: 90, height: 90, borderRadius: 18),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBox(width: double.infinity, height: 18, borderRadius: 4),
                    const SizedBox(height: 8),
                    _buildBox(width: 130, height: 14, borderRadius: 4),
                    const SizedBox(height: 12),
                    _buildBox(width: 28, height: 28, borderRadius: 14),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildBox(width: 44, height: 26, borderRadius: 13),
              const Spacer(),
              _buildBox(width: 95, height: 32, borderRadius: 10),
              const SizedBox(width: 8),
              _buildBox(width: 80, height: 32, borderRadius: 10),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 3,
      separatorBuilder: (_, _) => const SizedBox(height: 16),
      itemBuilder: (_, _) => _buildCardSkeleton(),
    );
  }
}

