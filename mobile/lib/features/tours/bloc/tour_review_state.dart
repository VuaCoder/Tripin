import 'package:equatable/equatable.dart';
import '../models/tour_review_model.dart';

class TourReviewState extends Equatable {
  final List<TourReviewModel> reviews;
  final bool isLoading;
  final bool isLoadingMore;
  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final String? errorMessage;

  // Form submission state
  final bool isSubmitting;
  final bool submitSuccess;
  final String? submitError;

  // Eligibility check state
  final bool isCheckingEligibility;
  final String? eligibleBookingId;
  final bool canReview;
  final String? eligibilityMessage;

  const TourReviewState({
    this.reviews = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.page = 1,
    this.limit = 10,
    this.total = 0,
    this.totalPages = 1,
    this.errorMessage,
    this.isSubmitting = false,
    this.submitSuccess = false,
    this.submitError,
    this.isCheckingEligibility = false,
    this.eligibleBookingId,
    this.canReview = false,
    this.eligibilityMessage,
  });

  bool get hasMore => page < totalPages;
  bool get isEmpty => !isLoading && reviews.isEmpty;

  TourReviewState copyWith({
    List<TourReviewModel>? reviews,
    bool? isLoading,
    bool? isLoadingMore,
    int? page,
    int? limit,
    int? total,
    int? totalPages,
    String? errorMessage,
    bool? isSubmitting,
    bool? submitSuccess,
    String? submitError,
    bool? isCheckingEligibility,
    String? eligibleBookingId,
    bool? canReview,
    String? eligibilityMessage,
  }) {
    return TourReviewState(
      reviews: reviews ?? this.reviews,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      page: page ?? this.page,
      limit: limit ?? this.limit,
      total: total ?? this.total,
      totalPages: totalPages ?? this.totalPages,
      errorMessage: errorMessage,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitSuccess: submitSuccess ?? this.submitSuccess,
      submitError: submitError,
      isCheckingEligibility: isCheckingEligibility ?? this.isCheckingEligibility,
      eligibleBookingId: eligibleBookingId ?? this.eligibleBookingId,
      canReview: canReview ?? this.canReview,
      eligibilityMessage: eligibilityMessage ?? this.eligibilityMessage,
    );
  }

  @override
  List<Object?> get props => [
        reviews,
        isLoading,
        isLoadingMore,
        page,
        limit,
        total,
        totalPages,
        errorMessage,
        isSubmitting,
        submitSuccess,
        submitError,
        isCheckingEligibility,
        eligibleBookingId,
        canReview,
        eligibilityMessage,
      ];
}

