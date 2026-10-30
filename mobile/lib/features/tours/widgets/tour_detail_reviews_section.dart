import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../bloc/tour_review_bloc.dart';
import '../bloc/tour_review_event.dart';
import '../bloc/tour_review_state.dart';
import 'tour_review_form_modal.dart';
import 'tour_review_item_widget.dart';
import 'tour_review_summary_widget.dart';

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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Header & "Viết đánh giá" Button (AC3)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.rate_review_outlined, color: AppColors.primary, size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Đánh giá & Nhận xét',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: () => _handleWriteReview(context, state),
                  icon: const Icon(Icons.edit_note_rounded, size: 18, color: AppColors.primary),
                  label: const Text(
                    'Viết đánh giá',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Rating Summary Card (AC2)
            TourReviewSummaryWidget(
              ratingAvg: ratingAvg,
              ratingCount: ratingCount,
            ),
            const SizedBox(height: 16),

            // Loading state (initial)
            if (state.isLoading) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ] else if (state.errorMessage != null && state.reviews.isEmpty) ...[
              // Error state with retry
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 32),
                    const SizedBox(height: 8),
                    Text(
                      state.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 10),
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
              // Empty state (AC5)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textMuted, size: 40),
                    SizedBox(height: 10),
                    Text(
                      'Chưa có đánh giá nào cho tour này',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Hãy là người đầu tiên trải nghiệm và chia sẻ cảm nghĩ của bạn!',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // Reviews List (AC1)
              ...state.reviews.map((review) => TourReviewItemWidget(review: review)),

              // Pagination Load More Button (AC1)
              if (state.hasMore) ...[
                const SizedBox(height: 8),
                Center(
                  child: state.isLoadingMore
                      ? const CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        )
                      : OutlinedButton.icon(
                          onPressed: () {
                            context.read<TourReviewBloc>().add(
                                  TourReviewListLoadRequested(
                                    tourId,
                                    page: state.page + 1,
                                  ),
                                );
                          },
                          icon: const Icon(Icons.expand_more_rounded, size: 18),
                          label: const Text('Xem thêm đánh giá'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            side: const BorderSide(color: AppColors.primary),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                ),
              ],
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
    } else {
      final reason = state.eligibilityMessage ??
          'Bạn cần hoàn thành chuyến đi này để có thể gửi đánh giá.';
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 22),
              SizedBox(width: 8),
              Text(
                'Điều kiện đánh giá',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            reason,
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Đã hiểu', style: TextStyle(color: AppColors.primary)),
            ),
          ],
        ),
      );
    }
  }
}

