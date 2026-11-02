import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../auth/screens/verify_otp_screen.dart';
import '../../bookings/bloc/booked_trips_repository.dart';
import '../../bookings/models/booking_models.dart';
import '../../earnings/api/earnings_api.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../models/user_profile_model.dart';
import 'edit_profile_screen.dart';

class UserProfileDetailScreen extends StatefulWidget {
  final UserProfileModel user;

  const UserProfileDetailScreen({super.key, required this.user});

  @override
  State<UserProfileDetailScreen> createState() => _UserProfileDetailScreenState();
}

class _UserProfileDetailScreenState extends State<UserProfileDetailScreen> {
  bool _isSendingOtp = false;
  int _tripsCount = 0;
  int _reviewsCount = 0;
  int _guideCompletedToursCount = 7;
  List<BookingItem> _completedTrips = [];
  List<BookingItem> _reviewedTrips = [];

  @override
  void initState() {
    super.initState();
    _loadStats();
    BookedTripsRepository.statsNotifier.addListener(_loadStats);
  }

  @override
  void dispose() {
    BookedTripsRepository.statsNotifier.removeListener(_loadStats);
    super.dispose();
  }

  Future<void> _loadStats() async {
    try {
      final tripsRepo = BookedTripsRepository();
      final trips = await tripsRepo.getTrips();
      final reviewedIds = await tripsRepo.getReviewedBookingIds();
      final completedTrips = trips.where((t) => t.status == BookingStatus.completed).toList();
      final countOfTrips = completedTrips.isNotEmpty ? completedTrips.length : trips.length;
      final reviewedTrips = trips.where((t) => t.isReviewed || reviewedIds.contains(t.id) || reviewedIds.contains(t.bookingCode)).toList();

      var guideTours = 7;
      try {
        final earnings = await DioEarningsApi().fetchSummary();
        if (earnings.count > 0) {
          guideTours = earnings.count;
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _tripsCount = countOfTrips;
          _reviewsCount = reviewedTrips.length;
          _completedTrips = completedTrips;
          _reviewedTrips = reviewedTrips;
          _guideCompletedToursCount = guideTours;
        });
      }
    } catch (_) {}
  }

  Future<void> _startVerification(UserProfileModel user) async {
    setState(() => _isSendingOtp = true);
    try {
      final apiClient = ApiClient();
      await apiClient.post(
        ApiEndpoints.resendOtp,
        data: {
          'email': user.email.trim().toLowerCase(),
          'purpose': 'REGISTER',
        },
      );
      if (!mounted) return;
      setState(() => _isSendingOtp = false);

      final result = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => VerifyOtpScreen(
            email: user.email,
            role: user.role,
            returnOnSuccess: true,
          ),
        ),
      );

      if (result == true && mounted) {
        context.read<ProfileBloc>().add(const ProfileLoadRequested());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Xác thực tài khoản thành công!'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSendingOtp = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể gửi mã xác thực: $e'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openEditProfile(BuildContext context, UserProfileModel currentUser) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<ProfileBloc>(),
          child: EditProfileScreen(initialUser: currentUser),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProfileBloc, ProfileState>(
      builder: (context, state) {
        final currentUser = (state is ProfileLoaded)
            ? state.user
            : (state is ProfileUpdateSuccess)
                ? state.user
                : widget.user;
        final isVerified = currentUser.isVerified == true;
        final isGuide = currentUser.isGuide;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            automaticallyImplyLeading: false,
            leading: Padding(
              padding: const EdgeInsets.only(left: 16),
              child: Center(
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.arrow_back_rounded,
                      size: 20,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ),
            leadingWidth: 54,
            title: const SizedBox.shrink(),
            centerTitle: false,
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(
                  child: TextButton(
                    onPressed: () => _openEditProfile(context, currentUser),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      splashFactory: NoSplash.splashFactory,
                    ),
                    child: const Text(
                      'Chỉnh sửa',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Hero Passport / Public Card (Airbnb Style)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF64748B).withValues(alpha: 0.10),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: const Color(0xFF94A3B8).withValues(alpha: 0.06),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Avatar with verified badge
                      Stack(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isVerified
                                    ? (isGuide ? AppColors.primaryDark : AppColors.primary)
                                    : const Color(0xFFE2E8F0),
                                width: isVerified ? 2.5 : 1.5,
                              ),
                            ),
                            child: CircleAvatar(
                              radius: 46,
                              backgroundColor: AppColors.primarySurface,
                              child: ClipOval(
                                child: currentUser.avatarUrl != null && currentUser.avatarUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: currentUser.avatarUrl!,
                                        width: 92,
                                        height: 92,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) =>
                                            const CircularProgressIndicator(strokeWidth: 2),
                                        errorWidget: (context, url, error) => const Icon(
                                          Icons.person,
                                          size: 46,
                                          color: AppColors.primary,
                                        ),
                                      )
                                    : const Icon(Icons.person, size: 46, color: AppColors.primary),
                              ),
                            ),
                          ),
                          if (isVerified)
                            Positioned(
                              right: 2,
                              bottom: 2,
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.check_circle_rounded,
                                  size: 22,
                                  color: isGuide ? AppColors.primaryDark : AppColors.success,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // User Name
                      Text(
                        currentUser.fullName,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Role Label
                      Text(
                        isGuide ? 'Hướng dẫn viên du lịch' : 'Khách du lịch',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Verification Status Indicator
                      if (isVerified)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified_rounded, size: 16, color: AppColors.success),
                              SizedBox(width: 6),
                              Text(
                                'Danh tính đã xác minh',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF065F46),
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        InkWell(
                          onTap: _isSendingOtp ? null : () => _startVerification(currentUser),
                          borderRadius: BorderRadius.circular(20),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFBEB),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFFDE68A)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFFD97706)),
                                const SizedBox(width: 6),
                                Text(
                                  _isSendingOtp ? 'Đang gửi mã...' : 'Chưa xác thực • Xác thực ngay',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF92400E),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      const SizedBox(height: 20),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 16),

                      // Stats Row: Đồng bộ theo đúng vai trò (Traveler vs Tour Guide)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: isGuide
                            ? [
                                _buildDetailStat(
                                  title: 'Tour hoàn thành',
                                  value: '$_guideCompletedToursCount tour',
                                ),
                                Container(height: 28, width: 1, color: AppColors.border),
                                _buildDetailStat(
                                  title: 'Tham gia từ',
                                  value: currentUser.createdAt != null
                                      ? 'Thg ${currentUser.createdAt!.month}/${currentUser.createdAt!.year}'
                                      : 'Năm 2026',
                                ),
                                Container(height: 28, width: 1, color: AppColors.border),
                                _buildDetailStat(
                                  title: 'Số sao',
                                  value: '4.9 ★',
                                  valueColor: const Color(0xFFD97706),
                                ),
                              ]
                            : [
                                _buildDetailStat(
                                  title: 'Số chuyến đi',
                                  value: '$_tripsCount chuyến',
                                ),
                                Container(height: 28, width: 1, color: AppColors.border),
                                _buildDetailStat(
                                  title: 'Số lần đánh giá',
                                  value: '$_reviewsCount lần',
                                ),
                                Container(height: 28, width: 1, color: AppColors.border),
                                _buildDetailStat(
                                  title: 'Tham gia từ',
                                  value: currentUser.createdAt != null
                                      ? 'Năm ${currentUser.createdAt!.year}'
                                      : 'Năm 2026',
                                ),
                              ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // 2. Section: Về tôi / Giới thiệu
                if (isGuide) ...[
                  _buildSectionTitle('Về tôi'),
                  const SizedBox(height: 12),
                  _buildGuideProfessionalCard(context, currentUser),
                ] else ...[
                  _buildSectionTitle('Về tôi'),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF64748B).withValues(alpha: 0.08),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildInfoRow(
                          icon: Icons.public_rounded,
                          title: 'Điểm đến mơ ước',
                          value: currentUser.dreamDestination ?? 'Chưa cập nhật',
                        ),
                        const Divider(height: 24, color: AppColors.border),
                        _buildInfoRow(
                          icon: Icons.work_outline_rounded,
                          title: 'Công việc / Nghề nghiệp',
                          value: currentUser.work ?? 'Chưa cập nhật',
                        ),
                        const Divider(height: 24, color: AppColors.border),
                        _buildInfoRow(
                          icon: Icons.auto_awesome_outlined,
                          title: 'Kỹ năng đặc biệt / Sở thích',
                          value: currentUser.skill ?? 'Chưa cập nhật',
                        ),
                        const Divider(height: 24, color: AppColors.border),
                        _buildInfoRow(
                          icon: Icons.pets_outlined,
                          title: 'Thú cưng / Bạn đồng hành',
                          value: currentUser.pets ?? 'Chưa cập nhật',
                        ),
                        if (currentUser.bio != null && currentUser.bio!.isNotEmpty) ...[
                          const Divider(height: 24, color: AppColors.border),
                          _buildInfoRow(
                            icon: Icons.notes_rounded,
                            title: 'Tiểu sử',
                            value: currentUser.bio!,
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // 3. Section: Tour đã đi (Chuyến đi của tôi - Dành riêng cho Traveler)
                  _buildSectionTitle('Tour đã đi'),
                  const SizedBox(height: 12),
                  if (_completedTrips.isNotEmpty)
                    ..._completedTrips.map((trip) => _buildCompletedTripCard(trip))
                  else
                    _buildDashedEmptyCard(
                      icon: Icons.luggage_outlined,
                      iconBgColor: Colors.white,
                      iconColor: AppColors.primary,
                      title: 'Chưa có chuyến đi nào',
                      subtitle: 'Các tour du lịch bạn đã hoàn thành sẽ xuất hiện tại đây để lưu giữ hành trình trải nghiệm.',
                    ),

                  const SizedBox(height: 24),

                  // 4. Section: Đánh giá của mình (Dành riêng cho Traveler)
                  _buildSectionTitle('Đánh giá của tôi'),
                  const SizedBox(height: 12),
                  if (_reviewedTrips.isNotEmpty)
                    ..._reviewedTrips.map((trip) => _buildReviewedTripCard(trip))
                  else
                    _buildDashedEmptyCard(
                      icon: Icons.rate_review_outlined,
                      iconBgColor: Colors.white,
                      iconColor: AppColors.secondaryDark,
                      title: 'Chưa có đánh giá nào',
                      subtitle: 'Sau khi hoàn thành chuyến đi, những phản hồi và đánh giá của bạn sẽ được hiển thị công khai.',
                    ),
                ],

                const SizedBox(height: 36),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
        letterSpacing: -0.3,
      ),
    );
  }

  Widget _buildDetailStat({
    required String title,
    required String value,
    Color? valueColor,
  }) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF64748B)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Thẻ hiển thị tour đã hoàn thành
  Widget _buildCompletedTripCard(BookingItem trip) {
    final dateStr = DateFormat('dd/MM/yyyy').format(trip.departureDate);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF64748B).withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: trip.thumbnailUrl != null && trip.thumbnailUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: trip.thumbnailUrl!,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    placeholder: (_, url) => Container(
                      width: 72,
                      height: 72,
                      color: AppColors.primarySurface,
                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                    errorWidget: (_, url, error) => Container(
                      width: 72,
                      height: 72,
                      color: AppColors.primarySurface,
                      child: const Icon(Icons.landscape_rounded, color: AppColors.primary),
                    ),
                  )
                : Container(
                    width: 72,
                    height: 72,
                    color: AppColors.primarySurface,
                    child: const Icon(Icons.landscape_rounded, color: AppColors.primary),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trip.tourTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    const Icon(Icons.calendar_today_rounded, size: 13, color: AppColors.textSecondary),
                    const SizedBox(width: 5),
                    Text(
                      dateStr,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: const Text(
                    'Đã hoàn thành',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Thẻ hiển thị đánh giá của người dùng
  Widget _buildReviewedTripCard(BookingItem trip) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF64748B).withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: trip.thumbnailUrl != null && trip.thumbnailUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: trip.thumbnailUrl!,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    placeholder: (_, url) => Container(
                      width: 72,
                      height: 72,
                      color: AppColors.primarySurface,
                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                    errorWidget: (_, url, error) => Container(
                      width: 72,
                      height: 72,
                      color: AppColors.primarySurface,
                      child: const Icon(Icons.rate_review_rounded, color: AppColors.primary),
                    ),
                  )
                : Container(
                    width: 72,
                    height: 72,
                    color: AppColors.primarySurface,
                    child: const Icon(Icons.rate_review_rounded, color: AppColors.primary),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trip.tourTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: List.generate(
                    5,
                    (i) => const Icon(Icons.star_rounded, size: 16, color: AppColors.secondary),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Text(
                    'Đã đánh giá 5 sao',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Thẻ trạng thái trống viền nét đứt và nền màu xanh theo yêu cầu
  Widget _buildDashedEmptyCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
  }) {
    return CustomPaint(
      painter: const _DashedRectPainter(
        color: Color(0xFF99F6E4),
        strokeWidth: 1.5,
        dash: 6.0,
        gap: 4.0,
        radius: 20.0,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDFA), // Nền màu xanh thanh nhã theo yêu cầu
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: iconBgColor,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(
                icon,
                size: 32,
                color: iconColor,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Painter vẽ viền nét đứt bo góc tròn (Dashed Rounded Rectangle)
class _DashedRectPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double dash;
  final double gap;
  final double radius;

  const _DashedRectPainter({
    required this.color,
    this.strokeWidth = 1.5,
    this.dash = 6.0,
    this.gap = 4.0,
    this.radius = 20.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0.0;
      while (distance < metric.length) {
        final len = (distance + dash < metric.length) ? dash : metric.length - distance;
        final extractPath = metric.extractPath(distance, distance + len);
        canvas.drawPath(extractPath, paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRectPainter oldDelegate) =>
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth ||
      dash != oldDelegate.dash ||
      gap != oldDelegate.gap ||
      radius != oldDelegate.radius;
}

extension _UserProfileDetailGuideExt on _UserProfileDetailScreenState {
  Widget _buildGuideProfessionalCard(BuildContext context, UserProfileModel user) {
    final guide = user.guideProfile;
    final licenseNumber = guide?.licenseNumber?.isNotEmpty == true ? guide!.licenseNumber! : 'HDV-645507';
    final experienceYears = guide?.experienceYears ?? 5;
    final languages = (guide?.languages != null && guide!.languages.isNotEmpty)
        ? guide.languages
        : const ['Tiếng Việt', 'Tiếng Anh'];
    final bio = (guide?.bio != null && guide!.bio!.isNotEmpty)
        ? guide.bio!
        : 'Hướng dẫn viên chuyên nghiệp nhiệt tình, 8 năm kinh nghiệm dẫn tour toàn quốc.';
    final licenseImageUrl = guide?.licenseImageUrl;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF64748B).withValues(alpha: 0.08),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Badge thông báo Hướng dẫn viên Tripri
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFCCFBF1)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, color: AppColors.primary, size: 24),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Tài khoản Hướng dẫn viên Tripri',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.primaryDark,
                              fontSize: 14,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Hồ sơ chuyên môn đầy đủ sẽ giúp du khách và công ty lữ hành tin tưởng khi phân công tour.',
                            style: TextStyle(
                              color: Color(0xFF475569),
                              fontSize: 12,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Số thẻ HDV
              _buildInfoRow(
                icon: Icons.badge_outlined,
                title: 'Số thẻ Hướng dẫn viên (License Number)',
                value: licenseNumber,
              ),
              const Divider(height: 22, color: AppColors.border),

              // Số năm kinh nghiệm
              _buildInfoRow(
                icon: Icons.history_edu_rounded,
                title: 'Số năm kinh nghiệm',
                value: '$experienceYears năm',
              ),
              const Divider(height: 22, color: AppColors.border),

              // Ngôn ngữ thành thạo
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.translate_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Ngôn ngữ thành thạo',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: languages.map((lang) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE0F2FE),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFBAE6FD)),
                              ),
                              child: Text(
                                lang,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0369A1),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 22, color: AppColors.border),

              // Tiểu sử & Giới thiệu
              _buildInfoRow(
                icon: Icons.menu_book_rounded,
                title: 'Tiểu sử & Giới thiệu chuyên môn',
                value: bio,
              ),

              if (licenseImageUrl != null && licenseImageUrl.isNotEmpty) ...[
                const Divider(height: 22, color: AppColors.border),
                const Text(
                  'Ảnh thẻ Hướng dẫn viên (Mặt trước)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: licenseImageUrl,
                    height: 160,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (_, url) => Container(
                      height: 160,
                      color: const Color(0xFFF1F5F9),
                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                    errorWidget: (_, url, error) => Container(
                      height: 160,
                      color: const Color(0xFFF1F5F9),
                      child: const Center(
                        child: Icon(Icons.image_not_supported_rounded, color: AppColors.textMuted),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
  }
}
