import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../bloc/tour_detail_bloc.dart';
import '../bloc/tour_detail_event.dart';
import '../bloc/tour_detail_state.dart';
import '../widgets/tour_detail_departures_widget.dart';
import '../widgets/tour_detail_image_carousel.dart';
import '../widgets/tour_detail_policies_widget.dart';
import '../widgets/tour_detail_reviews_section.dart';
import '../widgets/tour_detail_shimmer_skeleton.dart';
import '../widgets/tour_detail_timeline_widget.dart';

class TourDetailScreen extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => TourDetailBloc(client: apiClient)
        ..add(TourDetailLoadRequested(tourId)),
      child: Scaffold(
        backgroundColor: AppColors.background,
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
                      context.read<TourDetailBloc>().add(TourDetailLoadRequested(tourId));
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
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    final selectedDeparture = state.selectedDeparture;
    final canBook = selectedDeparture != null && selectedDeparture.isBookable;

    return Stack(
      children: [
        // Scrollable Tour Details
        RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<TourDetailBloc>().add(const TourDetailRefreshRequested());
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Image Carousel
                TourDetailImageCarousel(
                  images: tour.images,
                  onBack: () => Navigator.of(context).pop(),
                ),

                // Main Info Container
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Destination & Duration Chips
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primarySurface,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.location_on_rounded,
                                  size: 14,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  tour.destination,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.schedule_rounded,
                                  size: 14,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${tour.durationDays} ngày',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (tour.maxGroupSize != null) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.group_outlined,
                                    size: 14,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Tối đa ${tour.maxGroupSize} khách',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Tour Title
                      Text(
                        tour.title,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Rating & Reviews row
                      Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 20,
                            color: AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            tour.ratingAvg.toStringAsFixed(1),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '(${tour.ratingCount} đánh giá)',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (tour.categories.isNotEmpty) ...[
                            const SizedBox(width: 10),
                            const Text('•', style: TextStyle(color: AppColors.textMuted)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                tour.categories.map((c) => c.name).join(', '),
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.primaryLight,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),

                      // Agency / Guide Info Card
                      if (tour.agency != null || tour.guide != null) ...[
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundColor: AppColors.primarySurface,
                                backgroundImage: tour.agency?.avatarUrl != null
                                    ? NetworkImage(tour.agency!.avatarUrl!)
                                    : null,
                                child: tour.agency?.avatarUrl == null
                                    ? const Icon(Icons.business_rounded, color: AppColors.primary)
                                    : null,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      tour.agency?.name ?? 'Đơn vị tổ chức uy tín',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      tour.guide != null
                                          ? 'HDV đồng hành: ${tour.guide!.fullName}'
                                          : 'Nhà tổ chức được chứng thực trên Tripri',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Summary & Description
                      if (tour.summary != null && tour.summary!.trim().isNotEmpty) ...[
                        const SizedBox(height: 18),
                        Text(
                          tour.summary!,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary,
                            height: 1.5,
                          ),
                        ),
                      ],

                      if (tour.description != null && tour.description!.trim().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          tour.description!,
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),
                      const Divider(height: 1, color: AppColors.borderLight),
                      const SizedBox(height: 24),

                      // Departures section (AC4)
                      TourDetailDeparturesWidget(
                        departures: tour.departures,
                        selectedDepartureId: state.selectedDepartureId,
                        onDepartureSelected: (depId) {
                          context
                              .read<TourDetailBloc>()
                              .add(TourDetailDepartureSelected(depId));
                        },
                      ),

                      const SizedBox(height: 28),
                      const Divider(height: 1, color: AppColors.borderLight),
                      const SizedBox(height: 24),

                      // Step Timeline section (AC2)
                      TourDetailTimelineWidget(
                        itinerary: tour.itinerary,
                      ),

                      const SizedBox(height: 28),
                      const Divider(height: 1, color: AppColors.borderLight),
                      const SizedBox(height: 24),

                      // Policies section (AC3)
                      TourDetailPoliciesWidget(
                        tour: tour,
                      ),

                      const SizedBox(height: 28),
                      const Divider(height: 1, color: AppColors.borderLight),
                      const SizedBox(height: 24),

                      // Reviews section (FLOW-08)
                      TourDetailReviewsSection(
                        tourId: tour.id,
                        ratingAvg: tour.ratingAvg,
                        ratingCount: tour.ratingCount,
                        apiClient: apiClient,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Sticky Bottom Action Bar with Price & "Đặt tour" Button (AC4)
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: const Border(top: BorderSide(color: AppColors.border)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  // Price column
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          selectedDeparture != null ? 'Giá khởi hành:' : 'Giá cơ bản:',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              currencyFormatter.format(state.effectivePrice),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
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

                  // "Đặt tour" Button (AC4 - AppColors.secondary)
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: canBook
                          ? () {
                              if (onBookTour != null) {
                                onBookTour!(tour.id, selectedDeparture.id);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Đã chọn ngày khởi hành: ${DateFormat('dd/MM/yyyy').format(selectedDeparture.date)}',
                                    ),
                                    backgroundColor: AppColors.primary,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            }
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.secondary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.border,
                        disabledForegroundColor: AppColors.textMuted,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.airplane_ticket_outlined, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Đặt tour',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

