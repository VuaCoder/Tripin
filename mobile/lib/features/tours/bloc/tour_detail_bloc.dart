import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/tour_detail_model.dart';
import 'tour_detail_event.dart';
import 'tour_detail_state.dart';

class TourDetailBloc extends Bloc<TourDetailEvent, TourDetailState> {
  final ApiClient apiClient;
  String? _currentTourId;

  TourDetailBloc({ApiClient? client})
      : apiClient = client ?? ApiClient(),
        super(const TourDetailInitial()) {
    on<TourDetailLoadRequested>(_onLoadRequested);
    on<TourDetailDepartureSelected>(_onDepartureSelected);
    on<TourDetailRefreshRequested>(_onRefreshRequested);
  }

  Future<void> _onLoadRequested(
    TourDetailLoadRequested event,
    Emitter<TourDetailState> emit,
  ) async {
    _currentTourId = event.tourId;
    emit(const TourDetailLoading());

    try {
      final response = await apiClient.get(ApiEndpoints.tourDetail(event.tourId));

      if (response.statusCode == 200 && response.data != null) {
        final dynamic rawData = response.data;
        Map<String, dynamic>? tourMap;

        if (rawData is Map<String, dynamic>) {
          if (rawData['success'] == true && rawData['data'] is Map<String, dynamic>) {
            tourMap = rawData['data'] as Map<String, dynamic>;
          } else if (rawData.containsKey('title')) {
            tourMap = rawData;
          }
        }

        if (tourMap == null) {
          emit(const TourDetailError('Dữ liệu tour không hợp lệ.'));
          return;
        }

        final tour = TourDetailModel.fromJson(tourMap);

        // Pick default departure: first bookable departure, or first departure if any
        String? defaultDepartureId;
        final bookableDepartures = tour.departures.where((d) => d.isBookable).toList();
        if (bookableDepartures.isNotEmpty) {
          defaultDepartureId = bookableDepartures.first.id;
        } else if (tour.departures.isNotEmpty) {
          defaultDepartureId = tour.departures.first.id;
        }

        emit(TourDetailLoaded(
          tour: tour,
          selectedDepartureId: defaultDepartureId,
        ));
      } else {
        emit(const TourDetailError('Không thể tải thông tin tour.'));
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        emit(const TourDetailNotFound());
      } else {
        final msg = e.response?.data is Map<String, dynamic> &&
                e.response?.data['error'] is Map<String, dynamic>
            ? e.response?.data['error']['message'] as String?
            : null;
        emit(TourDetailError(msg ?? 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.'));
      }
    } catch (e) {
      emit(TourDetailError('Đã có lỗi xảy ra: ${e.toString()}'));
    }
  }

  void _onDepartureSelected(
    TourDetailDepartureSelected event,
    Emitter<TourDetailState> emit,
  ) {
    if (state is TourDetailLoaded) {
      final currentState = state as TourDetailLoaded;
      emit(currentState.copyWith(selectedDepartureId: event.departureId));
    }
  }

  Future<void> _onRefreshRequested(
    TourDetailRefreshRequested event,
    Emitter<TourDetailState> emit,
  ) async {
    if (_currentTourId != null && _currentTourId!.isNotEmpty) {
      add(TourDetailLoadRequested(_currentTourId!));
    }
  }
}

