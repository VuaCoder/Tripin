import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/bookings/bloc/booking_create_bloc.dart';
import 'package:mobile/features/bookings/bloc/booking_create_event.dart';
import 'package:mobile/features/bookings/models/booking_voucher_model.dart';

class MockBookingApiClient extends Fake implements ApiClient {
  final int getStatusCode;
  final dynamic getResponseData;
  final int postStatusCode;
  final dynamic postResponseData;
  final Map<String, dynamic>? postErrorData;

  String? lastGetPath;
  Map<String, dynamic>? lastGetQueryParams;
  String? lastPostPath;
  dynamic lastPostData;

  MockBookingApiClient({
    this.getStatusCode = 200,
    this.getResponseData,
    this.postStatusCode = 200,
    this.postResponseData,
    this.postErrorData,
  });

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastGetPath = path;
    lastGetQueryParams = queryParameters;

    if (getStatusCode >= 400) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: getStatusCode,
          data: {'success': false, 'message': 'API Error'},
        ),
        type: DioExceptionType.badResponse,
      );
    }

    dynamic defaultData;
    if (path == ApiEndpoints.myVouchers) {
      defaultData = {
        'success': true,
        'data': [
          {
            'id': 'uv-1',
            'isUsed': false,
            'promotion': {
              'id': 'promo-1',
              'code': 'DISCOUNT10',
              'title': 'Giảm 10%',
              'discountType': 'PERCENT',
              'discountValue': 10,
              'minOrderAmount': 100000,
              'scope': 'PLATFORM',
              'isActive': true,
            }
          }
        ]
      };
    } else if (path == ApiEndpoints.promotionsAvailable) {
      defaultData = {
        'success': true,
        'data': [
          {
            'id': 'promo-2',
            'code': 'BIGSALE',
            'title': 'Giảm 100K',
            'discountType': 'FIXED',
            'discountValue': 100000,
            'minOrderAmount': 2000000,
            'scope': 'AGENCY',
            'isActive': true,
          }
        ]
      };
    } else if (path == ApiEndpoints.promotionsPreview) {
      final code = queryParameters?['code']?.toString() ?? '';
      if (code == 'BIGSALE') {
        throw DioException(
          requestOptions: RequestOptions(path: path),
          response: Response(
            requestOptions: RequestOptions(path: path),
            statusCode: 400,
            data: {
              'success': false,
              'error': {'code': 'PROMOTION_MIN_ORDER', 'message': 'Chưa đạt giá trị đơn hàng tối thiểu'}
            },
          ),
          type: DioExceptionType.badResponse,
        );
      }
      defaultData = {
        'success': true,
        'data': {
          'promotionId': 'promo-1',
          'code': code.isNotEmpty ? code : 'DISCOUNT10',
          'scope': 'PLATFORM',
          'discountAmount': 100000,
          'finalAmount': 900000,
        }
      };
    }

    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: getStatusCode,
      data: (getResponseData ?? defaultData) as T,
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPostPath = path;
    lastPostData = data;

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
        tourTitle: 'Tour Đà Nẵng 3N2Đ',
        departurePrice: 1500000,
        remainingSeats: 5,
        initialFullName: 'Nguyen Van A',
        initialPhone: '0901234567',
        initialEmail: 'nguyenvana@gmail.com',
      ));

      await Future.delayed(const Duration(milliseconds: 50));

      expect(bloc.state.tourId, 'tour-1');
      expect(bloc.state.departureId, 'dep-1');
      expect(bloc.state.tourTitle, 'Tour Đà Nẵng 3N2Đ');
      expect(bloc.state.departurePrice, 1500000);
      expect(bloc.state.remainingSeats, 5);
      expect(bloc.state.fullName, 'Nguyen Van A');
      expect(bloc.state.phone, '0901234567');
      expect(bloc.state.email, 'nguyenvana@gmail.com');
      expect(bloc.state.adults, 1);
      expect(bloc.state.totalGuests, 1);
      expect(bloc.state.clientRequestId, isNotEmpty);
      expect(bloc.state.isFormValid, isTrue);

      expect(bloc.state.vouchers.length, 2);
      expect(bloc.state.vouchers.first.code, 'DISCOUNT10');

      await bloc.close();
    });

    test('Form validation fails on short fullName, invalid phone and missing email', () async {
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

      // Nhập họ tên 1 ký tự, số điện thoại sai, không nhập email
      bloc.add(const BookingCreateContactChangedEvent(
        fullName: 'A',
        phone: 'invalid-phone',
        email: 'invalid-email',
      ));
      bloc.add(const BookingCreateSubmitEvent());

      await Future.delayed(const Duration(milliseconds: 20));

      expect(bloc.state.fullNameError, isNotNull);
      expect(bloc.state.phoneError, isNotNull);
      expect(bloc.state.emailError, isNotNull);
      expect(bloc.state.isSubmitting, isFalse);
      expect(bloc.state.submitSuccess, isFalse);

      await bloc.close();
    });

    test('BookingCreateGuestsChangedEvent calculates adult, child and infant pricing', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Phú Quốc',
        departurePrice: 2000000,
        remainingSeats: 5,
        initialFullName: 'Tran C',
        initialPhone: '0901234567',
        initialEmail: 'tranc@gmail.com',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      // 2 Người lớn (2x2tr), 1 Trẻ em (1x1.4tr), 1 Em bé (miễn phí) -> Tổng = 5.400.000đ
      bloc.add(const BookingCreateGuestsChangedEvent(
        adults: 2,
        children: 1,
        infants: 1,
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      expect(bloc.state.adults, 2);
      expect(bloc.state.children, 1);
      expect(bloc.state.infants, 1);
      expect(bloc.state.totalGuests, 4);
      expect(bloc.state.estimatedSubtotal, 5400000);
      expect(bloc.state.isFormValid, isTrue);

      await bloc.close();
    });

    test('BookingCreateParticipantsChangedEvent updates subtotal and bounds check', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Phú Quốc',
        departurePrice: 2000000,
        remainingSeats: 3,
        initialFullName: 'Tran C',
        initialPhone: '0901234567',
        initialEmail: 'tranc@gmail.com',
      ));

      await Future.delayed(const Duration(milliseconds: 20));
      expect(bloc.state.estimatedSubtotal, 2000000);

      // Tăng lên 2 khách
      bloc.add(const BookingCreateParticipantsChangedEvent(2));
      await Future.delayed(const Duration(milliseconds: 20));
      expect(bloc.state.participants, 2);
      expect(bloc.state.estimatedSubtotal, 4000000);

      // Thử đặt 4 khách (vượt quá 3 chỗ còn lại) -> Giữ nguyên 2
      bloc.add(const BookingCreateParticipantsChangedEvent(4));
      await Future.delayed(const Duration(milliseconds: 20));
      expect(bloc.state.participants, 2);

      await bloc.close();
    });

    test('Applies voucher code successfully and updates estimatedTotal', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Nha Trang',
        departurePrice: 1000000,
        remainingSeats: 4,
        initialFullName: 'Le D',
        initialPhone: '0912345678',
        initialEmail: 'led@gmail.com',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(const BookingCreateApplyVoucherCodeEvent('DISCOUNT10'));
      await Future.delayed(const Duration(milliseconds: 40));

      expect(bloc.state.previewResult, isNotNull);
      expect(bloc.state.discountAmount, 100000);
      expect(bloc.state.estimatedTotal, 900000);
      expect(bloc.state.voucherError, isNull);

      // Gỡ voucher
      bloc.add(const BookingCreateRemoveVoucherEvent());
      await Future.delayed(const Duration(milliseconds: 20));
      expect(bloc.state.previewResult, isNull);
      expect(bloc.state.discountAmount, 0);
      expect(bloc.state.estimatedTotal, 1000000);

      await bloc.close();
    });

    test('Handles voucher error when backend rejects code (PROMOTION_MIN_ORDER)', () async {
      final mockApi = MockBookingApiClient();
      final bloc = BookingCreateBloc(client: mockApi);

      bloc.add(const BookingCreateInitEvent(
        tourId: 'tour-1',
        departureId: 'dep-1',
        tourTitle: 'Tour Sapa',
        departurePrice: 500000,
        remainingSeats: 4,
        initialFullName: 'Hoang E',
        initialPhone: '0912345678',
        initialEmail: 'hoange@gmail.com',
      ));

      await Future.delayed(const Duration(milliseconds: 30));

      bloc.add(BookingCreateSelectVoucherItemEvent(
        const VoucherItemModel(
          id: 'v-high',
          code: 'BIGSALE',
          title: 'Giảm 100K',
          discountType: 'FIXED',
          discountValue: 100000,
          minOrderAmount: 2000000,
          scope: 'AGENCY',
        ),
      ));
      await Future.delayed(const Duration(milliseconds: 30));

      expect(bloc.state.previewResult, isNull);
      expect(bloc.state.voucherError, contains('chưa đạt giá trị tối thiểu'));

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
        initialEmail: 'tranvanf@gmail.com',
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
        initialEmail: 'tranvanf@gmail.com',
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
        initialEmail: 'tranvanf@gmail.com',
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
