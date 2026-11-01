import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';
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

  @override
  void initState() {
    super.initState();
    _trips = widget.initialTrips ?? [
      BookingItem(
        id: 'trip-dalat-demo-1',
        bookingCode: 'TRP-DLT8920',
        status: BookingStatus.confirmed,
        tourId: 'tour-dalat-1',
        tourTitle: 'Dalat',
        departureDate: DateTime(2026, 8, 18),
        endDate: DateTime(2026, 8, 20),
        participants: 4,
        totalAmount: 3200000,
        isPaid: true,
        refundRequired: false,
        thumbnailUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop&q=80',
        destination: 'Dalat',
        contactName: 'Hoàng Phúc',
      ),
    ];
    _loadTrips();
  }

  Future<void> _loadTrips() async {
    try {
      final trips = await _repo.getTrips();
      if (mounted && trips.isNotEmpty) {
        setState(() {
          _trips = trips;
        });
      }
    } catch (_) {}
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

  Future<void> _handleWriteReview(BookingItem trip) async {
    final result = await TourReviewFormModal.show(
      context,
      bookingId: trip.id,
      bloc: TourReviewBloc(),
    );

    if (result == true) {
      await _repo.markReviewed(trip.id);
      if (mounted) {
        setState(() {
          _trips = _trips.map((t) => t.id == trip.id ? t.copyWith(isReviewed: true) : t).toList();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cảm ơn bạn đã gửi đánh giá cho chuyến đi!'),
            backgroundColor: Color(0xFF0F766E),
          ),
        );
        await _loadTrips();
      }
    }
  }

  String _formatDateRange(DateTime start, DateTime end) {
    try {
      final startStr = DateFormat('dd').format(start);
      final endDay = DateFormat('dd').format(end);
      final endMonthYear = DateFormat('MMM yyyy', 'en_US').format(end);
      if (start.month == end.month && start.year == end.year) {
        return '$startStr – $endDay $endMonthYear';
      }
      return '${DateFormat('dd MMM', 'en_US').format(start)} – $endDay $endMonthYear';
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
        child: _trips.isEmpty
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
                        );
                      },
                    ),
                  ),
      ),
    );
  }
}

/// Thẻ chuyến đi thiết kế chuẩn Ảnh 3
class _TripCard extends StatelessWidget {
  final BookingItem trip;
  final String dateRangeText;
  final VoidCallback onViewQr;
  final VoidCallback onComplete;
  final VoidCallback onWriteReview;

  const _TripCard({
    required this.trip,
    required this.dateRangeText,
    required this.onViewQr,
    required this.onComplete,
    required this.onWriteReview,
  });

  @override
  Widget build(BuildContext context) {
    // Tên điểm đến / tên chuyến đi
    final title = trip.destination?.isNotEmpty == true
        ? trip.destination!
        : trip.tourTitle.split('–').first.trim();

    // Số khách đi cùng ngoài người đặt (nếu 3 người thì +2)
    final additionalGuests = trip.participants > 1 ? trip.participants - 1 : 0;

    // Avatar chữ cái của người đặt (mặc định 'H' theo yêu cầu)
    final avatarLetter = trip.contactName?.trim().isNotEmpty == true
        ? trip.contactName!.trim()[0].toUpperCase()
        : 'H';

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

                    // Nhóm Avatar người đặt + số lượng khách đi cùng (+X)
                    Row(
                      children: [
                        // Avatar người dùng đặt tour (ảnh đại diện người dùng hoặc chữ cái đầu)
                        _buildUserAvatar(trip.customerAvatarUrl, avatarLetter),

                        // Huy hiệu số khách còn lại (+X)
                        if (additionalGuests > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '+$additionalGuests',
                              style: const TextStyle(
                                color: Color(0xFF334155),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Khu vực hành động dưới thẻ (Mã + Trạng thái hoàn thành + Nút Đánh giá / Hoàn thành + Nút Xem QR)
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Mã: ${trip.bookingCode}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (trip.status == BookingStatus.completed) ...[
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_rounded, size: 12, color: Color(0xFF15803D)),
                            SizedBox(width: 2),
                            Text(
                              'Đã hoàn thành',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Nút Hoàn thành HOẶC Viết đánh giá HOẶC Đã đánh giá
              if (trip.status != BookingStatus.completed)
                InkWell(
                  onTap: onComplete,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_outline_rounded, size: 15, color: Color(0xFF059669)),
                        SizedBox(width: 4),
                        Text(
                          'Hoàn thành',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (trip.isReviewed)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star_rounded, size: 15, color: Color(0xFFF59E0B)),
                      SizedBox(width: 4),
                      Text(
                        'Đã đánh giá',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                )
              else
                InkWell(
                  onTap: onWriteReview,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.rate_review_outlined, size: 15, color: Color(0xFFD97706)),
                        SizedBox(width: 4),
                        Text(
                          'Viết đánh giá',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

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

  Widget _buildFallbackImage() => Container(
        width: 90,
        height: 90,
        color: const Color(0xFFCBD5E1),
        child: const Icon(Icons.apartment_rounded, color: Colors.white, size: 36),
      );

  Widget _buildUserAvatar(String? avatarUrl, String fallbackLetter) {
    if (avatarUrl != null && avatarUrl.isNotEmpty && avatarUrl.startsWith('http')) {
      return Container(
        width: 28,
        height: 28,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
        ),
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: avatarUrl,
            width: 28,
            height: 28,
            fit: BoxFit.cover,
            placeholder: (context, url) => Container(
              color: const Color(0xFFD1FAE5),
              alignment: Alignment.center,
              child: Text(
                fallbackLetter,
                style: const TextStyle(
                  color: Color(0xFF065F46),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            errorWidget: (context, url, error) => Container(
              color: const Color(0xFFD1FAE5),
              alignment: Alignment.center,
              child: Text(
                fallbackLetter,
                style: const TextStyle(
                  color: Color(0xFF065F46),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      width: 28,
      height: 28,
      decoration: const BoxDecoration(
        color: Color(0xFFD1FAE5),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        fallbackLetter,
        style: const TextStyle(
          color: Color(0xFF065F46),
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
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
