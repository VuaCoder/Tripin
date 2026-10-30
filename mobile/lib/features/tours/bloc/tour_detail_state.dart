import 'package:equatable/equatable.dart';
import '../models/tour_detail_model.dart';

abstract class TourDetailState extends Equatable {
  const TourDetailState();

  @override
  List<Object?> get props => [];
}

class TourDetailInitial extends TourDetailState {
  const TourDetailInitial();
}

class TourDetailLoading extends TourDetailState {
  const TourDetailLoading();
}

class TourDetailLoaded extends TourDetailState {
  final TourDetailModel tour;
  final String? selectedDepartureId;

  const TourDetailLoaded({
    required this.tour,
    this.selectedDepartureId,
  });

  TourDepartureModel? get selectedDeparture {
    if (selectedDepartureId == null) return null;
    try {
      return tour.departures.firstWhere((d) => d.id == selectedDepartureId);
    } catch (_) {
      return null;
    }
  }

  int get effectivePrice {
    final dep = selectedDeparture;
    return dep?.price ?? tour.basePrice;
  }

  TourDetailLoaded copyWith({
    TourDetailModel? tour,
    String? selectedDepartureId,
  }) {
    return TourDetailLoaded(
      tour: tour ?? this.tour,
      selectedDepartureId: selectedDepartureId ?? this.selectedDepartureId,
    );
  }

  @override
  List<Object?> get props => [tour, selectedDepartureId];
}

class TourDetailNotFound extends TourDetailState {
  const TourDetailNotFound();
}

class TourDetailError extends TourDetailState {
  final String message;

  const TourDetailError(this.message);

  @override
  List<Object?> get props => [message];
}

