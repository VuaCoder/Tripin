import 'package:equatable/equatable.dart';

abstract class TourReviewEvent extends Equatable {
  const TourReviewEvent();

  @override
  List<Object?> get props => [];
}

class TourReviewListLoadRequested extends TourReviewEvent {
  final String tourId;
  final int page;
  final bool refresh;

  const TourReviewListLoadRequested(
    this.tourId, {
    this.page = 1,
    this.refresh = false,
  });

  @override
  List<Object?> get props => [tourId, page, refresh];
}

class TourReviewSubmitRequested extends TourReviewEvent {
  final String bookingId;
  final int rating;
  final String comment;

  const TourReviewSubmitRequested({
    required this.bookingId,
    required this.rating,
    required this.comment,
  });

  @override
  List<Object?> get props => [bookingId, rating, comment];
}

class TourReviewCheckEligibilityRequested extends TourReviewEvent {
  final String tourId;

  const TourReviewCheckEligibilityRequested(this.tourId);

  @override
  List<Object?> get props => [tourId];
}

