import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../api/guide_check_in_api.dart';
import '../models/guide_models.dart';
import '../utils/guide_error_messages.dart';

class GuideCheckInState extends Equatable {
  const GuideCheckInState({
    this.loading = false,
    this.error,
    this.roster,
    this.submitting = false,
    this.tripStarted = false,
    this.tripFinished = false,
  });

  final bool loading;
  final String? error;
  final GuideRoster? roster;
  final bool submitting;
  final bool tripStarted;
  final bool tripFinished;

  bool get allCheckedIn => roster?.allCheckedIn ?? false;

  GuideCheckInState copyWith({
    bool? loading,
    String? error,
    GuideRoster? roster,
    bool? submitting,
    bool? tripStarted,
    bool? tripFinished,
    bool clearError = false,
  }) {
    return GuideCheckInState(
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      roster: roster ?? this.roster,
      submitting: submitting ?? this.submitting,
      tripStarted: tripStarted ?? this.tripStarted,
      tripFinished: tripFinished ?? this.tripFinished,
    );
  }

  @override
  List<Object?> get props => [loading, error, roster, submitting, tripStarted, tripFinished];
}

class GuideCheckInCubit extends Cubit<GuideCheckInState> {
  GuideCheckInCubit(this._api, this.tourId) : super(const GuideCheckInState());

  final GuideCheckInApi _api;
  final String tourId;

  Future<void> loadRoster() async {
    emit(state.copyWith(loading: true, clearError: true));
    try {
      final roster = await _api.fetchRoster(tourId);
      emit(state.copyWith(loading: false, roster: roster));
    } on GuideApiException catch (error) {
      emit(state.copyWith(loading: false, error: guideErrorMessage(error)));
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Không tải được danh sách đoàn. Vui lòng thử lại.'));
    }
  }

  /// Returns the outcome for the screen to show; null when a request is already running.
  Future<CheckInOutcome?> checkIn(String code) async {
    if (state.submitting) return null;
    final trimmed = code.trim();
    if (trimmed.isEmpty) {
      return const CheckInFailure(code: 'VALIDATION_ERROR', message: 'Vui lòng nhập mã vé.');
    }

    emit(state.copyWith(submitting: true, clearError: true));
    try {
      final result = await _api.checkIn(tourId: tourId, code: trimmed);
      final roster = state.roster;
      if (roster == null) {
        emit(state.copyWith(submitting: false));
      } else {
        final items = roster.items
            .map((item) => item.ticketId == result.ticketId
                ? item.copyWith(checkedIn: true, checkedInAt: result.checkedInAt)
                : item)
            .toList();
        emit(state.copyWith(
          submitting: false,
          roster: roster.copyWith(
            items: items,
            checkedIn: items.where((item) => item.checkedIn).length,
          ),
        ));
      }
      return CheckInSuccess(result);
    } on GuideApiException catch (error) {
      emit(state.copyWith(submitting: false));
      return CheckInFailure(code: error.code, message: guideErrorMessage(error));
    } catch (_) {
      emit(state.copyWith(submitting: false));
      return const CheckInFailure(code: 'UNKNOWN', message: 'Điểm danh thất bại. Vui lòng thử lại.');
    }
  }

  // shortcut: trip start/finish is UI-only until the backend exposes a trip state.
  void startTrip() {
    if (state.allCheckedIn) emit(state.copyWith(tripStarted: true));
  }

  void finishTrip() {
    if (state.tripStarted) emit(state.copyWith(tripFinished: true));
  }
}
