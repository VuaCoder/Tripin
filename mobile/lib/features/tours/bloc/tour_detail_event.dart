import 'package:equatable/equatable.dart';

abstract class TourDetailEvent extends Equatable {
  const TourDetailEvent();

  @override
  List<Object?> get props => [];
}

class TourDetailLoadRequested extends TourDetailEvent {
  final String tourId;

  const TourDetailLoadRequested(this.tourId);

  @override
  List<Object?> get props => [tourId];
}

class TourDetailDepartureSelected extends TourDetailEvent {
  final String departureId;

  const TourDetailDepartureSelected(this.departureId);

  @override
  List<Object?> get props => [departureId];
}

class TourDetailRefreshRequested extends TourDetailEvent {
  const TourDetailRefreshRequested();
}

