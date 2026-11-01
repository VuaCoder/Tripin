import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../bloc/tour_review_bloc.dart';
import '../bloc/tour_review_event.dart';
import '../bloc/tour_review_state.dart';
import 'tour_review_form_modal.dart';
import 'tour_review_item_widget.dart';

class TourDetailReviewsSection extends StatelessWidget {
  final String tourId;
  final double ratingAvg;
  final int ratingCount;
  final ApiClient? apiClient;

  const TourDetailReviewsSection({
    super.key,
    required this.tourId,
    required this.ratingAvg,
    required this.ratingCount,
    this.apiClient,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => TourReviewBloc(client: apiClient)
        ..add(TourReviewListLoadRequested(tourId))
        ..add(TourReviewCheckEligibilityRequested(tourId)),
      child: _TourDetailReviewsView(
        tourId: tourId,
        ratingAvg: ratingAvg,
        ratingCount: ratingCount,
      ),
    );
  }
}

class _TourDetailReviewsView extends StatelessWidget {
  final String tourId;
  final double ratingAvg;
  final int ratingCount;

  const _TourDetailReviewsView({
    required this.tourId,
    required this.ratingAvg,
    required this.ratingCount,
  });

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TourReviewBloc, TourReviewState>(
      listener: (context, state) {
        if (state.errorMessage != null && state.reviews.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: AppColors.error,
            ),
          );
        }
      },
      builder: (context, state) {
        final totalCount = state.total > 0 ? state.total : state.reviews.length;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Tiêu đề mục Đánh giá
            const Text(
              'Đánh giá từ du khách',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF222222),
              ),
            ),
            const SizedBox(height: 12),

            // 2. Nút "Viết đánh giá" thiết kế trực quan, nổi bật
            // CHỈ HIỆN KHI NGƯỜI DÙNG ĐÃ CÓ LỊCH SỬ HOÀN THÀNH CHUYẾN ĐI (state.canReview == true)
            if (state.canReview && state.eligibleBookingId != null) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFE6F3F4), Color(0xFFF0FDF4)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.25), width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.06),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.rate_review_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Bạn đã hoàn thành tour này!',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF222222),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Chia sẻ trải nghiệm chân thực của bạn cho các du khách khác nhé',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _handleWriteReview(context, state),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Viết đánh giá',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // 3. Trạng thái Loading ban đầu
            if (state.isLoading) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ] else if (state.errorMessage != null && state.reviews.isEmpty) ...[
              // Trạng thái Lỗi có nút Thử lại
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBEBEB)),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.cloud_off_rounded, color: AppColors.error, size: 32),
                    const SizedBox(height: 8),
                    Text(
                      state.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: () {
                        context
                            .read<TourReviewBloc>()
                            .add(TourReviewListLoadRequested(tourId, refresh: true));
                      },
                      icon: const Icon(Icons.refresh_rounded, size: 16),
                      label: const Text('Thử lại'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (state.isEmpty) ...[
              // Trạng thái Chưa có đánh giá
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: const Color(0xFFFAFAFA),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBEBEB)),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textMuted, size: 36),
                    SizedBox(height: 8),
                    Text(
                      'Chưa có đánh giá nào cho tour này',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF222222),
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Hãy là người đầu tiên trải nghiệm chuyến đi và chia sẻ cảm nghĩ của bạn!',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // 4. Danh sách đánh giá ngang chuẩn Airbnb (Ảnh 1)
              SizedBox(
                height: 215,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  itemCount: state.reviews.length,
                  itemBuilder: (context, index) {
                    final review = state.reviews[index];
                    return TourReviewItemWidget(
                      review: review,
                      isCard: true,
                      width: 295,
                    );
                  },
                ),
              ),

              const SizedBox(height: 16),

              // 5. Nút "Show all X reviews" / "Xem tất cả X đánh giá" chuẩn Ảnh 1
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () => _openAllReviewsSheet(context, state),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF2F2F2),
                    foregroundColor: const Color(0xFF222222),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFE2E2E2), width: 0.8),
                    ),
                  ),
                  child: Text(
                    'Xem tất cả $totalCount đánh giá',
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  void _handleWriteReview(BuildContext context, TourReviewState state) {
    final bloc = context.read<TourReviewBloc>();

    if (state.canReview && state.eligibleBookingId != null) {
      TourReviewFormModal.show(
        context,
        bookingId: state.eligibleBookingId!,
        bloc: bloc,
      );
    }
  }

  /// Modal hiển thị toàn bộ danh sách đánh giá cuộn dọc
  void _openAllReviewsSheet(BuildContext context, TourReviewState state) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
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

                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Đánh giá (${state.total > 0 ? state.total : state.reviews.length})',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF222222),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Color(0xFF222222)),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFF0F0F0)),

                // Danh sách đầy đủ
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: state.reviews.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 14),
                    itemBuilder: (ctx, index) {
                      final review = state.reviews[index];
                      return TourReviewItemWidget(
                        review: review,
                        isCard: false,
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
