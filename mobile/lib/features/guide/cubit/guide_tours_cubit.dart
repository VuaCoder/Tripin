import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../api/guide_check_in_api.dart';
import '../models/guide_models.dart';
import '../utils/guide_error_messages.dart';

class GuideToursState extends Equatable {
  const GuideToursState({this.loading = false, this.error, this.tours = const []});

  final bool loading;
  final String? error;
  final List<GuideAssignedTour> tours;

  GuideToursState copyWith({
    bool? loading,
    List<GuideAssignedTour>? tours,
    String? error,
    bool clearError = false,
  }) {
    return GuideToursState(
      loading: loading ?? this.loading,
      tours: tours ?? this.tours,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [loading, error, tours];
}

class GuideToursCubit extends Cubit<GuideToursState> {
  GuideToursCubit(this._api) : super(const GuideToursState());

  final GuideCheckInApi _api;

  Future<void> load() async {
    emit(state.copyWith(loading: true, clearError: true));
    try {
      final tours = await _api.fetchAssignedTours();
      emit(state.copyWith(
        loading: false,
        tours: tours.where((tour) => tour.isAccepted).toList(),
      ));
    } on GuideApiException catch (error) {
      emit(state.copyWith(loading: false, error: guideErrorMessage(error)));
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Không tải được danh sách tour. Vui lòng thử lại.'));
    }
  }
}
