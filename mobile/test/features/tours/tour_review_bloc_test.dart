import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/tours/bloc/tour_review_bloc.dart';
import 'package:mobile/features/tours/bloc/tour_review_event.dart';

class MockReviewApiClient extends ApiClient {
  final Map<String, dynamic>? getReviewsResponse;
  final int postStatusCode;
  final Map<String, dynamic>? postResponseData;

  MockReviewApiClient({
    this.getReviewsResponse,
    this.postStatusCode = 201,
    this.postResponseData,
  });

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    if (getReviewsResponse != null) {
      return Response<T>(
        requestOptions: RequestOptions(path: path),
        statusCode: 200,
        data: getReviewsResponse as T,
      );
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': [], 'meta': {}} as T,
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    if (postStatusCode >= 400) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: postStatusCode,
          data: postResponseData ?? {'success': false, 'error': {'code': 'ERROR'}},
        ),
        type: DioExceptionType.badResponse,
      );
    }

    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: postStatusCode,
      data: (postResponseData ?? {'success': true, 'data': {}}) as T,
    );
  }
}

class FakeTokenStorage extends TokenStorage {
  final String? token;
  FakeTokenStorage(this.token);

  @override
  Future<String?> getAccessToken() async => token;
}

void main() {
  group('[FLOW-08] TourReviewBloc Unit Tests', () {
    late Map<String, dynamic> sampleReviewsPage;

    setUp(() {
      sampleReviewsPage = {
        'success': true,
        'data': [
          {
            'id': 'r-1',
            'rating': 5,
            'comment': 'Dịch vụ rất tốt!',
            'tourId': 'tour-01',
            'author': {'name': 'Nguyen A.'},
            'createdAt': '2026-10-20T00:00:00.000Z',
          },
        ],
        'meta': {
          'page': 1,
          'limit': 10,
          'total': 1,
          'totalPages': 1,
        },
      };
    });

    test('loads reviews list on page 1 and updates state', () async {
      final client = MockReviewApiClient(getReviewsResponse: sampleReviewsPage);
      final bloc = TourReviewBloc(client: client);

      bloc.add(const TourReviewListLoadRequested('tour-01'));

      await expectLater(
        bloc.stream,
        emitsThrough(
          predicate<dynamic>((state) =>
              state.reviews.length == 1 &&
              state.reviews.first.comment == 'Dịch vụ rất tốt!' &&
              !state.isLoading),
        ),
      );
    });

    test('client validation rejects comments with less than 10 characters', () async {
      final client = MockReviewApiClient();
      final bloc = TourReviewBloc(client: client);

      bloc.add(const TourReviewSubmitRequested(
        bookingId: 'book-1',
        rating: 5,
        comment: 'Tốt', // < 10 chars
      ));

      await expectLater(
        bloc.stream,
        emitsThrough(
          predicate<dynamic>((state) =>
              state.submitError == 'Nội dung đánh giá phải có ít nhất 10 ký tự.' &&
              !state.isSubmitting),
        ),
      );
    });

    test('successfully submits review and marks submitSuccess as true', () async {
      final client = MockReviewApiClient(
        postStatusCode: 201,
        postResponseData: {
          'success': true,
          'data': {'id': 'new-rev', 'rating': 5, 'comment': 'Chuyến đi tuyệt vời!'},
        },
      );
      final bloc = TourReviewBloc(client: client);

      bloc.add(const TourReviewSubmitRequested(
        bookingId: 'book-1',
        rating: 5,
        comment: 'Chuyến đi thật tuyệt vời và nhiều kỷ niệm đẹp!',
      ));

      await expectLater(
        bloc.stream,
        emitsThrough(
          predicate<dynamic>((state) => state.submitSuccess && !state.isSubmitting),
        ),
      );
    });

    test('maps BOOKING_NOT_COMPLETED error code to friendly Vietnamese message', () async {
      final client = MockReviewApiClient(
        postStatusCode: 409,
        postResponseData: {
          'success': false,
          'error': {'code': 'BOOKING_NOT_COMPLETED', 'message': 'Only completed bookings can be reviewed'},
        },
      );
      final bloc = TourReviewBloc(client: client);

      bloc.add(const TourReviewSubmitRequested(
        bookingId: 'book-1',
        rating: 5,
        comment: 'Chuyến đi thật tuyệt vời và nhiều kỷ niệm đẹp!',
      ));

      await expectLater(
        bloc.stream,
        emitsThrough(
          predicate<dynamic>((state) =>
              state.submitError == 'Bạn chỉ có thể gửi đánh giá sau khi chuyến đi đã hoàn thành.' &&
              !state.isSubmitting),
        ),
      );
    });

    test('maps REVIEW_EXISTS error code to friendly Vietnamese message', () async {
      final client = MockReviewApiClient(
        postStatusCode: 409,
        postResponseData: {
          'success': false,
          'error': {'code': 'REVIEW_EXISTS', 'message': 'The booking already has a review'},
        },
      );
      final bloc = TourReviewBloc(client: client);

      bloc.add(const TourReviewSubmitRequested(
        bookingId: 'book-1',
        rating: 5,
        comment: 'Chuyến đi thật tuyệt vời và nhiều kỷ niệm đẹp!',
      ));

      await expectLater(
        bloc.stream,
        emitsThrough(
          predicate<dynamic>((state) =>
              state.submitError == 'Chuyến đi này đã được đánh giá trước đó.' &&
              !state.isSubmitting),
        ),
      );
    });
  });
}

