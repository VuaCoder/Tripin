import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/booking_create_model.dart';
import '../models/booking_voucher_model.dart';
import 'booking_create_event.dart';
import 'booking_create_state.dart';

class BookingCreateBloc extends Bloc<BookingCreateEvent, BookingCreateState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;

  BookingCreateBloc({
    ApiClient? client,
    TokenStorage? storage,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        super(const BookingCreateState()) {
    on<BookingCreateInitEvent>(_onInit);
    on<BookingCreateContactChangedEvent>(_onContactChanged);
    on<BookingCreateParticipantsChangedEvent>(_onParticipantsChanged);
    on<BookingCreateApplyVoucherCodeEvent>(_onApplyVoucherCode);
    on<BookingCreateSelectVoucherItemEvent>(_onSelectVoucherItem);
    on<BookingCreateRemoveVoucherEvent>(_onRemoveVoucher);
    on<BookingCreateLoadVouchersEvent>(_onLoadVouchers);
    on<BookingCreateSubmitEvent>(_onSubmit);
  }

  Future<void> _onInit(
    BookingCreateInitEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    final requestId = BookingCreateRequest.generateClientRequestId();

    emit(state.copyWith(
      tourId: event.tourId,
      departureId: event.departureId,
      tourTitle: event.tourTitle,
      departurePrice: event.departurePrice,
      remainingSeats: event.remainingSeats,
      departureDate: event.departureDate,
      fullName: event.initialFullName ?? '',
      phone: event.initialPhone ?? '',
      clientRequestId: requestId,
      participants: 1,
      clearFullNameError: true,
      clearPhoneError: true,
      clearGeneralError: true,
      clearVoucherError: true,
    ));

    await _fetchVouchers(emit);
  }

  void _onContactChanged(
    BookingCreateContactChangedEvent event,
    Emitter<BookingCreateState> emit,
  ) {
    emit(state.copyWith(
      fullName: event.fullName ?? state.fullName,
      phone: event.phone ?? state.phone,
      notes: event.notes ?? state.notes,
      clearFullNameError: event.fullName != null,
      clearPhoneError: event.phone != null,
      clearGeneralError: true,
    ));
  }

  Future<void> _onParticipantsChanged(
    BookingCreateParticipantsChangedEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    if (event.participants < 1 || event.participants > state.remainingSeats) {
      return;
    }

    emit(state.copyWith(
      participants: event.participants,
      clearGeneralError: true,
    ));

    // Nếu đang áp dụng voucher, tự động tính lại preview theo subtotal mới
    if (state.previewResult != null) {
      await _previewVoucherCode(state.previewResult!.code, emit);
    }
  }

  Future<void> _onApplyVoucherCode(
    BookingCreateApplyVoucherCodeEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    final cleanCode = event.code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      emit(state.copyWith(voucherError: 'Vui lòng nhập mã khuyến mãi.'));
      return;
    }

    final codeRegex = RegExp(r'^[A-Z0-9_-]{3,30}$');
    if (!codeRegex.hasMatch(cleanCode)) {
      emit(state.copyWith(
        voucherError: 'Mã gồm 3–30 ký tự (chữ hoa, số, dấu gạch ngang hoặc gạch dưới).',
      ));
      return;
    }

    await _previewVoucherCode(cleanCode, emit);
  }

  Future<void> _onSelectVoucherItem(
    BookingCreateSelectVoucherItemEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    emit(state.copyWith(selectedVoucher: event.voucher));
    await _previewVoucherCode(event.voucher.code, emit);
  }

  void _onRemoveVoucher(
    BookingCreateRemoveVoucherEvent event,
    Emitter<BookingCreateState> emit,
  ) {
    emit(state.copyWith(
      clearSelectedVoucher: true,
      clearPreviewResult: true,
      clearVoucherError: true,
    ));
  }

  Future<void> _onLoadVouchers(
    BookingCreateLoadVouchersEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    await _fetchVouchers(emit);
  }

  Future<void> _fetchVouchers(Emitter<BookingCreateState> emit) async {
    emit(state.copyWith(isLoadingVouchers: true));
    try {
      final List<VoucherItemModel> collected = [];

      // 1. Lấy danh sách ví voucher của tôi (GET /promotions/my-vouchers)
      try {
        final myVouchersRes = await apiClient.get(ApiEndpoints.myVouchers);
        if (myVouchersRes.statusCode == 200 && myVouchersRes.data != null) {
          final data = myVouchersRes.data['data'];
          if (data is List) {
            for (final item in data) {
              if (item is Map<String, dynamic>) {
                final v = VoucherItemModel.fromJson(item);
                if (!v.isUsed && v.isActive && !v.isExpired) {
                  collected.add(v);
                }
              }
            }
          }
        }
      } catch (_) {
        // Bỏ qua lỗi ví voucher (ví dụ chưa đăng nhập hoặc mạng yếu)
      }

      // 2. Lấy thêm khuyến mãi khả dụng cho tour này (GET /promotions/available?tourId=...)
      if (state.tourId.isNotEmpty) {
        try {
          final availableRes = await apiClient.get(
            ApiEndpoints.promotionsAvailable,
            queryParameters: {'tourId': state.tourId},
          );
          if (availableRes.statusCode == 200 && availableRes.data != null) {
            final data = availableRes.data['data'];
            if (data is Map<String, dynamic>) {
              final platformList = data['platform'] as List?;
              final agencyList = data['agency'] as List?;

              for (final list in [platformList, agencyList]) {
                if (list != null) {
                  for (final item in list) {
                    if (item is Map<String, dynamic>) {
                      final v = VoucherItemModel.fromJson(item);
                      if (v.code.isNotEmpty &&
                          !collected.any((existing) => existing.code == v.code)) {
                        collected.add(v);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (_) {
          // Bỏ qua nếu endpoint available trả về lỗi
        }
      }

      emit(state.copyWith(
        vouchers: collected,
        isLoadingVouchers: false,
      ));
    } catch (_) {
      emit(state.copyWith(isLoadingVouchers: false));
    }
  }

  Future<void> _previewVoucherCode(
    String code,
    Emitter<BookingCreateState> emit,
  ) async {
    emit(state.copyWith(
      isPreviewingVoucher: true,
      clearVoucherError: true,
    ));

    try {
      final currentSubtotal = state.estimatedSubtotal;
      final response = await apiClient.get(
        ApiEndpoints.promotionsPreview,
        queryParameters: {
          'code': code,
          'tourId': state.tourId,
          'subtotal': currentSubtotal,
          'participants': state.participants,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final preview = PromotionPreviewResult.fromJson(data);

        // Tìm voucher tương ứng trong danh sách để gán selectedVoucher (nếu có)
        VoucherItemModel? matched;
        for (final v in state.vouchers) {
          if (v.code.toUpperCase() == code.toUpperCase()) {
            matched = v;
            break;
          }
        }

        emit(state.copyWith(
          previewResult: preview,
          selectedVoucher: matched,
          isPreviewingVoucher: false,
          clearVoucherError: true,
        ));
      } else {
        emit(state.copyWith(
          isPreviewingVoucher: false,
          clearPreviewResult: true,
          voucherError: 'Mã khuyến mãi không hợp lệ.',
        ));
      }
    } on DioException catch (dioErr) {
      final message = _extractErrorMessage(dioErr, 'Không thể áp dụng mã ưu đãi này.');
      emit(state.copyWith(
        isPreviewingVoucher: false,
        clearPreviewResult: true,
        voucherError: message,
      ));
    } catch (e) {
      emit(state.copyWith(
        isPreviewingVoucher: false,
        clearPreviewResult: true,
        voucherError: 'Có lỗi xảy ra khi kiểm tra mã khuyến mãi.',
      ));
    }
  }

  Future<void> _onSubmit(
    BookingCreateSubmitEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    // 1. Kiểm tra validation form
    String? fullNameErr;
    String? phoneErr;
    String? generalErr;

    if (state.fullName.trim().length < 2) {
      fullNameErr = 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).';
    }

    final phoneRegex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
    if (!phoneRegex.hasMatch(state.phone.trim())) {
      phoneErr = 'Số điện thoại không hợp lệ.';
    }

    if (state.participants < 1 || state.participants > state.remainingSeats) {
      generalErr = 'Số khách phải từ 1 đến ${state.remainingSeats}.';
    }

    if (fullNameErr != null || phoneErr != null || generalErr != null) {
      emit(state.copyWith(
        fullNameError: fullNameErr,
        phoneError: phoneErr,
        generalError: generalErr,
      ));
      return;
    }

    // 2. Bắt đầu gửi API
    emit(state.copyWith(
      isSubmitting: true,
      clearGeneralError: true,
    ));

    try {
      final request = BookingCreateRequest(
        tourId: state.tourId,
        departureId: state.departureId,
        participants: state.participants,
        contact: BookingContactModel(
          fullName: state.fullName.trim(),
          phone: state.phone.trim(),
        ),
        notes: state.notes.trim().isNotEmpty ? state.notes.trim() : null,
        promotionCode: state.previewResult?.code,
        clientRequestId: state.clientRequestId,
      );

      final response = await apiClient.post(
        ApiEndpoints.bookings,
        data: request.toJson(),
      );

      if ((response.statusCode == 200 || response.statusCode == 201) &&
          response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final created = BookingCreatedModel.fromJson(data);

        emit(state.copyWith(
          isSubmitting: false,
          submitSuccess: true,
          createdBooking: created,
          clearGeneralError: true,
        ));
      } else {
        emit(state.copyWith(
          isSubmitting: false,
          generalError: 'Không thể tạo đơn đặt chỗ. Vui lòng thử lại.',
        ));
      }
    } on DioException catch (dioErr) {
      final message = _extractErrorMessage(dioErr, 'Không thể đặt tour. Vui lòng thử lại sau.');
      emit(state.copyWith(
        isSubmitting: false,
        generalError: message,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmitting: false,
        generalError: 'Có lỗi không xác định xảy ra. Vui lòng thử lại.',
      ));
    }
  }

  String _extractErrorMessage(DioException dioErr, String fallback) {
    if (dioErr.type == DioExceptionType.connectionTimeout ||
        dioErr.type == DioExceptionType.sendTimeout ||
        dioErr.type == DioExceptionType.receiveTimeout ||
        dioErr.type == DioExceptionType.connectionError) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
    }

    final data = dioErr.response?.data;
    if (data is Map<String, dynamic>) {
      final errorMap = data['error'];
      if (errorMap is Map<String, dynamic>) {
        final code = errorMap['code']?.toString();
        switch (code) {
          case 'NOT_ENOUGH_SEATS':
            return 'Số chỗ trống vừa thay đổi. Hãy giảm số khách hoặc chọn ngày khởi hành khác.';
          case 'DEPARTURE_UNAVAILABLE':
            return 'Ngày khởi hành này hiện không còn nhận đặt chỗ hoặc đã diễn ra.';
          case 'TOUR_UNAVAILABLE':
            return 'Tour này hiện không còn nhận đặt chỗ.';
          case 'BOOKING_AMOUNT_TOO_LOW':
            return 'Tổng giá trị đơn hàng không hợp lệ (tối thiểu 1 ₫). Vui lòng kiểm tra lại mã giảm giá.';
          case 'PROMOTION_EXHAUSTED':
            return 'Mã giảm giá đã hết lượt sử dụng.';
          case 'PROMOTION_INACTIVE':
          case 'PROMOTION_EXPIRED':
            return 'Mã giảm giá này đã hết hiệu lực.';
          case 'PROMOTION_NOT_STARTED':
            return 'Mã giảm giá này chưa đến thời gian áp dụng.';
          case 'PROMOTION_NOT_APPLICABLE':
            return 'Mã giảm giá này không áp dụng cho đơn vị tổ chức hoặc tour đã chọn.';
          case 'PROMOTION_TOUR_NOT_ELIGIBLE':
            return 'Mã giảm giá này không áp dụng cho tour này.';
          case 'PROMOTION_MIN_ORDER':
            return 'Đơn hàng chưa đạt giá trị tối thiểu để dùng mã giảm giá này.';
          case 'PROMOTION_MIN_PARTICIPANTS':
            return 'Số lượng khách chưa đủ điều kiện áp dụng mã giảm giá.';
          case 'PROMOTION_FIRST_BOOKING_ONLY':
            return 'Mã giảm giá chỉ áp dụng cho đơn đặt tour đầu tiên của bạn.';
          case 'PROMOTION_USER_LIMIT_REACHED':
            return 'Bạn đã dùng hết số lượt cho phép của mã giảm giá này.';
          case 'PROMOTION_CODE_USED':
            return 'Mã voucher này đã được sử dụng trước đó.';
          case 'UNAUTHENTICATED':
          case 'TOKEN_INVALID':
            return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
          default:
            final msg = errorMap['message']?.toString();
            if (msg != null && msg.isNotEmpty) return msg;
        }
      }
    }
    return fallback;
  }
}

