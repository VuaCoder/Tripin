import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/booking_create_model.dart';
import '../models/booking_voucher_model.dart';
import 'booking_create_event.dart';
import 'booking_create_state.dart';

class BookingCreateBloc extends Bloc<BookingCreateEvent, BookingCreateState> {
  final ApiClient apiClient;

  BookingCreateBloc({
    ApiClient? client,
  })  : apiClient = client ?? ApiClient(),
        super(const BookingCreateState()) {
    on<BookingCreateInitEvent>(_onInit);
    on<BookingCreateContactChangedEvent>(_onContactChanged);
    on<BookingCreateGuestsChangedEvent>(_onGuestsChanged);
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
    final clientRequestId = BookingCreateRequest.generateClientRequestId();

    emit(state.copyWith(
      tourId: event.tourId,
      departureId: event.departureId,
      tourTitle: event.tourTitle,
      departurePrice: event.departurePrice,
      remainingSeats: event.remainingSeats,
      departureDate: event.departureDate,
      fullName: event.initialFullName ?? state.fullName,
      phone: event.initialPhone ?? state.phone,
      email: event.initialEmail ?? state.email,
      adults: 1,
      children: 0,
      infants: 0,
      participants: 1,
      clientRequestId: clientRequestId,
      clearFullNameError: true,
      clearPhoneError: true,
      clearEmailError: true,
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
      email: event.email ?? state.email,
      notes: event.notes ?? state.notes,
      clearFullNameError: event.fullName != null,
      clearPhoneError: event.phone != null,
      clearEmailError: event.email != null,
      clearGeneralError: true,
    ));
  }

  Future<void> _onGuestsChanged(
    BookingCreateGuestsChangedEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    if (event.adults < 1) return;
    final total = event.adults + event.children + event.infants;
    if (total > state.remainingSeats) return;

    emit(state.copyWith(
      adults: event.adults,
      children: event.children,
      infants: event.infants,
      participants: total,
      clearGeneralError: true,
    ));

    if (state.previewResult != null) {
      await _previewVoucherCode(state.previewResult!.code, emit);
    }
  }

  Future<void> _onParticipantsChanged(
    BookingCreateParticipantsChangedEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    if (event.participants < 1 || event.participants > state.remainingSeats) {
      return;
    }

    emit(state.copyWith(
      adults: event.participants,
      children: 0,
      infants: 0,
      participants: event.participants,
      clearGeneralError: true,
    ));

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
        voucherError: 'Mã khuyến mãi không đúng định dạng (3-30 ký tự chữ cái, số, gạch nối).',
      ));
      return;
    }

    await _previewVoucherCode(cleanCode, emit);
  }

  Future<void> _onSelectVoucherItem(
    BookingCreateSelectVoucherItemEvent event,
    Emitter<BookingCreateState> emit,
  ) async {
    final voucher = event.voucher;

    // Kiểm tra điều kiện đơn hàng tối thiểu
    final currentSubtotal = state.estimatedSubtotal;
    if (voucher.minOrderAmount > 0 && currentSubtotal < voucher.minOrderAmount) {
      emit(state.copyWith(
        voucherError: 'Đơn hàng tạm tính chưa đạt giá trị tối thiểu (${voucher.formattedMinOrderText}) để áp dụng mã ${voucher.code}.',
      ));
      return;
    }

    await _previewVoucherCode(voucher.code, emit);
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

      // 1. Lấy danh sách ví voucher của người dùng: GET /promotions/my-vouchers
      try {
        final response = await apiClient.get(ApiEndpoints.myVouchers);
        if (response.statusCode == 200 && response.data != null) {
          final rawData = response.data['data'] ?? response.data;
          if (rawData is List) {
            for (final item in rawData) {
              if (item is Map<String, dynamic>) {
                final v = VoucherItemModel.fromJson(item);
                if (v.code.isNotEmpty && !collected.any((existing) => existing.code == v.code)) {
                  collected.add(v);
                }
              }
            }
          }
        }
      } catch (_) {
        // Tiếp tục lấy từ danh sách công khai
      }

      // 2. Lấy voucher khả dụng công khai: GET /promotions/available
      if (state.tourId.isNotEmpty) {
        try {
          final response = await apiClient.get(
            ApiEndpoints.promotionsAvailable,
            queryParameters: {'tourId': state.tourId},
          );
          if (response.statusCode == 200 && response.data != null) {
            final rawData = response.data['data'] ?? response.data;
            if (rawData is List) {
              for (final item in rawData) {
                if (item is Map<String, dynamic>) {
                  final v = VoucherItemModel.fromJson(item);
                  if (v.code.isNotEmpty && !collected.any((existing) => existing.code == v.code)) {
                    collected.add(v);
                  }
                }
              }
            }
          }
        } catch (_) {}
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
          'participants': state.totalGuests,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        final preview = PromotionPreviewResult.fromJson(data);

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
        voucherError: 'Lỗi kiểm tra mã: $e',
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
    String? emailErr;
    String? generalErr;

    if (state.fullName.trim().length < 2) {
      fullNameErr = 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).';
    }

    final phoneRegex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
    if (!phoneRegex.hasMatch(state.phone.trim())) {
      phoneErr = 'Số điện thoại không hợp lệ.';
    }

    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(state.email.trim())) {
      emailErr = 'Email không hợp lệ (bắt buộc để nhận vé điện tử).';
    }

    if (state.adults < 1) {
      generalErr = 'Phải có ít nhất 1 người lớn tham gia chuyến đi.';
    } else if (state.totalGuests < 1 || state.totalGuests > state.remainingSeats) {
      generalErr = 'Tổng số khách phải từ 1 đến ${state.remainingSeats}.';
    }

    if (fullNameErr != null || phoneErr != null || emailErr != null || generalErr != null) {
      emit(state.copyWith(
        fullNameError: fullNameErr,
        phoneError: phoneErr,
        emailError: emailErr,
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
        participants: state.totalGuests,
        guestCounts: state.guestCounts,
        contact: BookingContactModel(
          fullName: state.fullName.trim(),
          phone: state.phone.trim(),
          email: state.email.trim(),
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
        dioErr.type == DioExceptionType.receiveTimeout) {
      return 'Kết nối mạng quá hạn. Vui lòng kiểm tra đường truyền và thử lại.';
    }

    if (dioErr.type == DioExceptionType.connectionError) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.';
    }

    final data = dioErr.response?.data;
    if (data is Map<String, dynamic>) {
      final err = data['error'];
      if (err is Map<String, dynamic>) {
        final code = err['code']?.toString().toUpperCase();
        if (code != null) {
          switch (code) {
            case 'NOT_ENOUGH_SEATS':
            case 'BOOKING_DEPARTURE_FULL':
              return 'Số chỗ trống vừa thay đổi, chuyến đi không đủ chỗ cho đoàn của bạn.';
            case 'BOOKING_CAPACITY_EXCEEDED':
              return 'Số lượng khách bạn đặt vượt quá số chỗ còn lại của chuyến.';
            case 'BOOKING_AMOUNT_TOO_LOW':
              return 'Tổng giá trị đơn hàng không hợp lệ (tối thiểu 1.000 ₫).';
            case 'BOOKING_UNAUTHORIZED':
            case 'UNAUTHORIZED':
              return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
            case 'PROMOTION_INVALID':
            case 'PROMOTION_NOT_FOUND':
              return 'Mã khuyến mãi không tồn tại hoặc đã hết lượt dùng.';
            case 'PROMOTION_EXPIRED':
              return 'Mã khuyến mãi đã hết hạn sử dụng.';
            case 'PROMOTION_MIN_SPEND_NOT_MET':
              return 'Giá trị đơn hàng chưa đạt mức tối thiểu để dùng mã này.';
            case 'PROMOTION_ALREADY_USED':
              return 'Bạn đã sử dụng mã khuyến mãi này trước đó.';
          }
        }
        if (err['message'] != null && err['message'].toString().trim().isNotEmpty) {
          return err['message'].toString();
        }
      }
      if (data['message'] != null && data['message'].toString().trim().isNotEmpty) {
        return data['message'].toString();
      }
    }

    final statusCode = dioErr.response?.statusCode;
    if (statusCode == 401) {
      return 'Vui lòng đăng nhập để thực hiện đặt tour.';
    }
    if (statusCode == 404) {
      return 'Không tìm thấy tour hoặc chuyến khởi hành yêu cầu.';
    }
    if (statusCode == 409) {
      return 'Yêu cầu đặt tour trùng lặp hoặc chuyến đi vừa hết chỗ.';
    }
    if (statusCode != null && statusCode >= 500) {
      return 'Máy chủ đang bảo trì. Vui lòng thử lại sau ít phút.';
    }

    return fallback;
  }
}
