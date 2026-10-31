import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/bookings/bloc/booking_create_bloc.dart';
import 'package:mobile/features/bookings/bloc/booking_create_event.dart';

class MockBookingApiClient extends ApiClient {
  final Map<String, dynamic>? myVouchersResponse;
  final Map<String, dynamic>? previewResponse;
  final int previewStatusCode;
  final Map<String, dynamic>? previewErrorData;
  final int postStatusCode;
  final Map<String, dynamic>? postResponseData;
  final Map<String, dynamic>? postErrorData;

  String? lastPostPath;
  Map<String, dynamic>? lastPostData;

  MockBookingApiClient({
    this.myVouchersResponse,
    this.previewResponse,
    this.previewStatusCode = 200,
    this.previewErrorData,
    this.postStatusCode = 201,
    this.postResponseData,
    this.postErrorData,
  });

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    if (path == ApiEndpoints.myVouchers) {
      return Response<T>(
        requestOptions: RequestOptions(path: path),
        statusCode: 200,
        data: (myVouchersResponse ?? {
          'success': true,
          'data': [
            {
              'id': 'uv-01',
              'isUsed': false,
              'promotion': {
                'id': 'promo-01',
                'code': 'DISCOUNT10',
                'title': 'Giảm 10%',
                'discountType': 'PERCENT',
                'discountValue': 10,
                'minOrderAmount': 500000,
                'scope': 'PLATFORM',
                'isActive': true,
              },
            }
          ]
        }) as T,
      );
    }

    if (path == ApiEndpoints.promotionsPreview) {
      if (previewStatusCode >= 400) {
        throw DioException(
          requestOptions: RequestOptions(path: path),
          response: Response(
            requestOptions: RequestOptions(path: path),
            statusCode: previewStatusCode,
            data: previewErrorData ?? {
              'success': false,
              'error': {'code': 'PROMOTION_MIN_ORDER', 'message': 'Chưa đủ đơn tối thiểu'}
            },
          ),
          type: DioExceptionType.badResponse,
        );
      }

      return Response<T>(
        requestOptions: RequestOptions(path: path),
        statusCode: 200,
        data: (previewResponse ?? {
          'success': true,
          'data': {
            'promotionId': 'promo-01',
            'code': queryParameters?['code'] ?? 'DISCOUNT10',
            'scope': 'PLATFORM',
            'discountAmount': 150000,
            'finalAmount': 1350000,
          }
        }) as T,
      );
    }

    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': {}} as T,
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    lastPostPath = path;
    if (data is Map<String, dynamic>) {
      lastPostData = data;
    }

    if (postStatusCode >= 400) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: postStatusCode,
          data: postErrorData ?? {
            'success': false,
            'error': {'code': 'NOT_ENOUGH_SEATS', 'message': 'Hết chỗ'}
          },
        ),
        type: DioExceptionType.badResponse,
      );
    }

    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: postStatusCode,
      data: (postResponseData ?? {
        'success': true,
        'data': {
          'id': 'booking-res-123',
          'bookingCode': 'TRP-SUCCESS',
          'status': 'PENDING',
          'tour': {'id': 'tour-123', 'title': 'Hạ Long'},
          'departureId': 'dep-123',
          'participants': 2,
          'unitPrice': 1000000,
          'subtotal': 2000000,
          'discountAmount': 150000,
          'totalAmount': 1850000,
          'contact': {'fullName': 'Nguyen Van A', 'phone': '0901234567'},
          'isPaid': false,
          'paymentExpiresAt': '2026-11-01T16:00:00.000Z',
        }
      }) as T,
    );
  }
}

void main() {
  group('[FLOW-09] BookingCreateBloc Unit Tests', () {
    test('BookingCreateInitEvent initializes state and clientRequestId and loads vouchers', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Phú Quốc 3N2Đ',
        departurePrice: 2000000,
        remainingSeats: 5,
        initialFullName: 'Pham Van E',
        initialPhone: '0912345678',
      ));

      await Future.delayed(const Duration(milliseconds: 50));

      expect(bloc.state.tourId, 'tour-1');
      expect(bloc.state.departureId, 'dep-1');
      expect(bloc.state.tourTitle, 'Tour Phú Quốc 3N2Đ');
      expect(bloc.state.departurePrice, 2000000);
      expect(bloc.state.remainingSeats, 5);
      expect(bloc.state.fullName, 'Pham Van E');
      expect(bloc.state.phone, '0912345678');
      expect(bloc.state.clientRequestId, isNotEmpty);
      expect(bloc.state.clientRequestId.length, 32);
      expect(bloc.state.vouchers.length, 1);
      expect(bloc.state.vouchers.first.code, 'DISCOUNT10');

      await bloc.close();
    });

    test('Form validation fails on short fullName and invalid phone number', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Đà Lạt',
        departurePrice: 1000000,
        remainingSeats: 4,
      ));

      await Future.delayed(const Duration(milliseconds: 20));

      // Nhập họ tên 1 ký tự, số điện thoại sai
      bloc.add(const BookingCreateContactChangedEvent(
        fullName: 'A',
        phone: 'invalid-phone',
      ));
      bloc.add(const BookingCreateSubmitEvent());

      await Future.delayed(const Duration(milliseconds: 20));

      expect(bloc.state.fullNameError, isNotNull);
      expect(bloc.state.phoneError, isNotNull);
      expect(bloc.state.isSubmitting, isFalse);
      expect(bloc.state.submitSuccess, isFalse);

      await bloc.close();
    });

    test('BookingCreateParticipantsChangedEvent updates subtotal and bounds check', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Đà Lạt',
        departurePrice: 1000000,
        remainingSeats: 4,
      ));

      await Future.delayed(const Duration(milliseconds: 20));

      bloc.add(const BookingCreateParticipantsChangedEvent(3));
      await Future.delayed(const Duration(milliseconds: 10));

      expect(bloc.state.participants, 3);
      expect(bloc.state.estimatedSubtotal, 3000000);
      expect(bloc.state.estimatedTotal, 3000000);

      // Thử số khách vượt quá remainingSeats (4)
      bloc.add(const BookingCreateParticipantsChangedEvent(10));
      await Future.delayed(const Duration(milliseconds: 10));
      expect(bloc.state.participants, 3); // Giữ nguyên, không đổi sang 10

      await bloc.close();
    });

    test('Applies voucher code successfully and updates estimatedTotal', () async {
      final mockApi = MockBookingApiClient(
        previewResponse: {
          'success': true,
          'data': {
            'promotionId': 'p-promo',
            'code': 'GIAM100K',
            'scope': 'AGENCY',
            'discountAmount': 100000,
            'finalAmount': 900000,
          }
        },
      );
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Sapa',
        departurePrice: 1000000,
        remainingSeats: 4,
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateApplyVoucherCodeEvent('giam100k'));
      await Future.delayed(const Duration(milliseconds: 30));

      expect(bloc.state.previewResult, isNotNull);
      expect(bloc.state.previewResult!.code, 'GIAM100K');
      expect(bloc.state.discountAmount, 100000);
      expect(bloc.state.estimatedTotal, 900000);
      expect(bloc.state.voucherError, isNull);

      // Bỏ voucher
      bloc.add(const BookingCreateRemoveVoucherEvent());
      await Future.delayed(const Duration(milliseconds: 10));
      expect(bloc.state.previewResult, isNull);
      expect(bloc.state.discountAmount, 0);
      expect(bloc.state.estimatedTotal, 1000000);

      await bloc.close();
    });

    test('Handles voucher error when backend rejects code (PROMOTION_MIN_ORDER)', () async {
      final mockApi = MockBookingApiClient(
        previewStatusCode: 409,
        previewErrorData: {
          'success': false,
          'error': {
            'code': 'PROMOTION_MIN_ORDER',
            'message': 'Đơn hàng chưa đạt giá trị tối thiểu',
          }
        },
      );
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Sapa',
        departurePrice: 500000,
        remainingSeats: 4,
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateApplyVoucherCodeEvent('BIGSALE'));
      await Future.delayed(const Duration(milliseconds: 30));

      expect(bloc.state.previewResult, isNull);
      expect(bloc.state.voucherError, contains('Đơn hàng chưa đạt giá trị tối thiểu'));

      await bloc.close();
    });

    test('Successfully submits booking with clientRequestId and marks submitSuccess', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Hạ Long',
        departurePrice: 1000000,
        remainingSeats: 4,
        initialFullName: 'Tran Van F',
        initialPhone: '0909998888',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateSubmitEvent());
      await Future.delayed(const Duration(milliseconds: 50));

      expect(mockApi.lastPostPath, ApiEndpoints.bookings);
      expect(mockApi.lastPostData?['tourId'], 'tour-1');
      expect(mockApi.lastPostData?['departureId'], 'dep-1');
      expect(mockApi.lastPostData?['contact']['fullName'], 'Tran Van F');
      expect(mockApi.lastPostData?['clientRequestId'], isNotEmpty);

      expect(bloc.state.isSubmitting, isFalse);
      expect(bloc.state.submitSuccess, isTrue);
      expect(bloc.state.createdBooking, isNotNull);
      expect(bloc.state.createdBooking!.bookingCode, 'TRP-SUCCESS');
      expect(bloc.state.createdBooking!.status, 'PENDING');

      await bloc.close();
    });

    test('Catches NOT_ENOUGH_SEATS error and maps to friendly Vietnamese message', () async {
      final mockApi = MockBookingApiClient(
        postStatusCode: 409,
        postErrorData: {
          'success': false,
          'error': {
            'code': 'NOT_ENOUGH_SEATS',
            'message': 'Fewer seats left than requested',
          }
        },
      );
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Hạ Long',
        departurePrice: 1000000,
        remainingSeats: 2,
        initialFullName: 'Tran Van F',
        initialPhone: '0909998888',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateSubmitEvent());
      await Future.delayed(const Duration(milliseconds: 50));

      expect(bloc.state.isSubmitting, isFalse);
      expect(bloc.state.submitSuccess, isFalse);
      expect(bloc.state.generalError, contains('Số chỗ trống vừa thay đổi'));

      await bloc.close();
    });

    test('Catches BOOKING_AMOUNT_TOO_LOW error and maps to friendly Vietnamese message', () async {
      final mockApi = MockBookingApiClient(
        postStatusCode: 409,
        postErrorData: {
          'success': false,
          'error': {
            'code': 'BOOKING_AMOUNT_TOO_LOW',
            'message': 'Amount must be at least 1 VND',
          }
        },
      );
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Miễn Phí',
        departurePrice: 0,
        remainingSeats: 2,
        initialFullName: 'Tran Van F',
        initialPhone: '0909998888',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateSubmitEvent());
      await Future.delayed(const Duration(milliseconds: 50));

      expect(bloc.state.isSubmitting, isFalse);
      expect(bloc.state.submitSuccess, isFalse);
      expect(bloc.state.generalError, contains('Tổng giá trị đơn hàng không hợp lệ'));

      await bloc.close();
    });
  });
}
