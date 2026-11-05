import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../api/guide_check_in_api.dart';
import '../models/guide_models.dart';
import '../utils/guide_error_messages.dart';

class GuideToursState extends Equatable {
  const GuideToursState({
    this.loading = false,
    this.answering = false,
    this.error,
    this.tours = const [],
  });

  final bool loading;
  final bool answering;
  final String? error;
  final List<GuideAssignedTour> tours;

  List<GuideAssignedTour> get pendingTours =>
      _byDeparture(tours.where((tour) => tour.isPending));
  List<GuideAssignedTour> get upcomingTours =>
      _byDeparture(tours.where((tour) => tour.isAccepted));

  static List<GuideAssignedTour> _byDeparture(
    Iterable<GuideAssignedTour> items,
  ) {
    final sorted = items.toList();
    sorted.sort((a, b) {
      final left = a.nextDepartureDate;
      final right = b.nextDepartureDate;
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return left.compareTo(right);
    });
    return sorted;
  }

  GuideToursState copyWith({
    bool? loading,
    bool? answering,
    List<GuideAssignedTour>? tours,
    String? error,
    bool clearError = false,
  }) {
    return GuideToursState(
      loading: loading ?? this.loading,
      answering: answering ?? this.answering,
      tours: tours ?? this.tours,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [loading, answering, error, tours];
}

class GuideToursCubit extends Cubit<GuideToursState> {
  GuideToursCubit(this._api) : super(const GuideToursState());

  final GuideCheckInApi _api;

  Future<void> load() async {
    emit(state.copyWith(loading: true, clearError: true));
    try {
      final tours = await _api.fetchAssignedTours();
      emit(state.copyWith(loading: false, tours: tours));
    } on GuideApiException catch (error) {
      emit(state.copyWith(loading: false, error: guideErrorMessage(error)));
    } catch (_) {
      emit(
        state.copyWith(
          loading: false,
          error: 'Không tải được danh sách tour. Vui lòng thử lại.',
        ),
      );
    }
  }

  /// Returns null while another answer is in flight.
  Future<GuideAnswerOutcome?> answer({
    required String tourId,
    required bool accept,
    String? note,
  }) async {
    if (state.answering) return null;
    emit(state.copyWith(answering: true, clearError: true));
    try {
      await _api.answerAssignment(tourId: tourId, accept: accept, note: note);
      final tours = state.tours
          .map(
            (tour) => tour.id == tourId
                ? tour.copyWith(
                    assignmentStatus: accept ? 'ACCEPTED' : 'DECLINED',
                  )
                : tour,
          )
          .toList();
      emit(state.copyWith(answering: false, tours: tours));
      return GuideAnswerSuccess(tours.firstWhere((tour) => tour.id == tourId));
    } on GuideApiException catch (error) {
      emit(state.copyWith(answering: false));
      return GuideAnswerFailure(
        code: error.code,
        message: guideErrorMessage(error),
      );
    } catch (_) {
      emit(state.copyWith(answering: false));
      return const GuideAnswerFailure(
        code: 'UNKNOWN',
        message: 'Không thể gửi phản hồi. Vui lòng thử lại.',
      );
    }
  }
}
