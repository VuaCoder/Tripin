import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/tours/bloc/tour_detail_bloc.dart';
import 'package:mobile/features/tours/bloc/tour_detail_event.dart';
import 'package:mobile/features/tours/bloc/tour_detail_state.dart';

class MockSuccessApiClient extends ApiClient {
  final Map<String, dynamic> responseData;

  MockSuccessApiClient(this.responseData);

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: responseData as T,
    );
  }
}

class MockErrorApiClient extends ApiClient {
  final int statusCode;
  final String errorMessage;

  MockErrorApiClient({required this.statusCode, required this.errorMessage});

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    throw DioException(
      requestOptions: RequestOptions(path: path),
      response: Response(
        requestOptions: RequestOptions(path: path),
        statusCode: statusCode,
        data: {
          'success': false,
          'error': {'code': 'ERROR', 'message': errorMessage},
        },
      ),
      type: DioExceptionType.badResponse,
    );
  }
}

void main() {
  group('[FLOW-07] TourDetailBloc Unit Tests', () {
    late Map<String, dynamic> sampleTourJson;

    setUp(() {
      sampleTourJson = {
        'success': true,
        'data': {
          'id': 'tour-test-01',
          'title': 'Tour Bà Nà Hills 1 Ngày',
          'destination': 'Đà Nẵng',
          'durationDays': 1,
          'basePrice': 1150000,
          'ratingAvg': 4.9,
          'ratingCount': 85,
          'images': ['https://example.com/bana.jpg'],
          'itinerary': [
            {
              'day': 1,
              'title': 'Khởi hành lên đỉnh Bà Nà',
              'activities': ['Đi cáp treo', 'Check-in Cầu Vàng'],
            }
          ],
          'departures': [
            {
              'id': 'dep-01',
              'date': DateTime.now().add(const Duration(days: 7)).toIso8601String(),
              'capacity': 30,
              'remaining': 15,
              'price': 1150000,
              'isOpen': true,
            },
            {
              'id': 'dep-02',
              'date': DateTime.now().add(const Duration(days: 14)).toIso8601String(),
              'capacity': 30,
              'remaining': 20,
              'price': 1250000,
              'isOpen': true,
            },
          ],
        },
      };
    });

    test('emits [TourDetailLoading, TourDetailLoaded] when API returns 200 with tour data', () async {
      final client = MockSuccessApiClient(sampleTourJson);
      final bloc = TourDetailBloc(client: client);

      final expectedStates = [
        const TourDetailLoading(),
        isA<TourDetailLoaded>()
            .having((s) => s.tour.id, 'tour.id', 'tour-test-01')
            .having((s) => s.tour.title, 'tour.title', 'Tour Bà Nà Hills 1 Ngày')
            .having((s) => s.selectedDepartureId, 'selectedDepartureId', 'dep-01'),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));

      bloc.add(const TourDetailLoadRequested('tour-test-01'));
    });

    test('emits [TourDetailLoading, TourDetailNotFound] when API responds with 404', () async {
      final client = MockErrorApiClient(statusCode: 404, errorMessage: 'Tour not found');
      final bloc = TourDetailBloc(client: client);

      final expectedStates = [
        const TourDetailLoading(),
        const TourDetailNotFound(),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));

      bloc.add(const TourDetailLoadRequested('tour-not-found-id'));
    });

    test('emits [TourDetailLoading, TourDetailError] when server returns 500 error', () async {
      final client = MockErrorApiClient(statusCode: 500, errorMessage: 'Internal Server Error');
      final bloc = TourDetailBloc(client: client);

      final expectedStates = [
        const TourDetailLoading(),
        isA<TourDetailError>().having(
          (s) => s.message,
          'message',
          'Internal Server Error',
        ),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));

      bloc.add(const TourDetailLoadRequested('tour-test-01'));
    });

    test('updates selectedDepartureId when TourDetailDepartureSelected event is added', () async {
      final client = MockSuccessApiClient(sampleTourJson);
      final bloc = TourDetailBloc(client: client);

      bloc.add(const TourDetailLoadRequested('tour-test-01'));

      await expectLater(
        bloc.stream,
        emitsThrough(isA<TourDetailLoaded>()),
      );

      // Current selected is dep-01, switch to dep-02
      bloc.add(const TourDetailDepartureSelected('dep-02'));

      await expectLater(
        bloc.stream,
        emits(
          isA<TourDetailLoaded>()
              .having((s) => s.selectedDepartureId, 'selectedDepartureId', 'dep-02')
              .having((s) => s.effectivePrice, 'effectivePrice', 1250000),
        ),
      );
    });
  });
}

