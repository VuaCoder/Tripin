import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/tour_review_model.dart';
import 'tour_review_event.dart';
import 'tour_review_state.dart';

class TourReviewBloc extends Bloc<TourReviewEvent, TourReviewState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;
  String? _currentTourId;

  TourReviewBloc({
    ApiClient? client,
    TokenStorage? storage,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        super(const TourReviewState()) {
    on<TourReviewListLoadRequested>(_onListLoadRequested);
    on<TourReviewCheckEligibilityRequested>(_onCheckEligibilityRequested);
    on<TourReviewSubmitRequested>(_onSubmitRequested);
  }

  Future<void> _onListLoadRequested(
    TourReviewListLoadRequested event,
    Emitter<TourReviewState> emit,
  ) async {
    _currentTourId = event.tourId;
    final isFirstPage = event.page == 1 || event.refresh;

    if (isFirstPage) {
      emit(state.copyWith(isLoading: true, errorMessage: null));
    } else {
      emit(state.copyWith(isLoadingMore: true));
    }

    try {
      final response = await apiClient.get(
        ApiEndpoints.tourReviews(event.tourId),
        queryParameters: {
          'page': event.page,
          'limit': 10,
          'sort': 'newest',
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final dynamic raw = response.data;
        TourReviewPageModel pageData;

        if (raw is Map<String, dynamic>) {
          pageData = TourReviewPageModel.fromJson(raw);
        } else if (raw is List) {
          final items = raw
              .whereType<Map<String, dynamic>>()
              .map((e) => TourReviewModel.fromJson(e))
              .toList();
          pageData = TourReviewPageModel(
            items: items,
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: 1,
          );
        } else {
          pageData = const TourReviewPageModel();
        }

        final updatedList = isFirstPage
            ? pageData.items
            : [...state.reviews, ...pageData.items];

        emit(state.copyWith(
          reviews: updatedList,
          page: pageData.page,
          limit: pageData.limit,
          total: pageData.total,
          totalPages: pageData.totalPages,
          isLoading: false,
          isLoadingMore: false,
          errorMessage: null,
        ));
      } else {
        emit(state.copyWith(
          isLoading: false,
          isLoadingMore: false,
          errorMessage: 'Không thể tải danh sách đánh giá.',
        ));
      }
    } on DioException catch (e) {
      final errorMsg = e.response?.data is Map<String, dynamic> &&
              e.response?.data['error'] is Map<String, dynamic>
          ? e.response?.data['error']['message'] as String?
          : null;

      emit(state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: errorMsg ?? 'Lỗi kết nối khi tải đánh giá. Vui lòng thử lại.',
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        errorMessage: 'Đã có lỗi xảy ra: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCheckEligibilityRequested(
    TourReviewCheckEligibilityRequested event,
    Emitter<TourReviewState> emit,
  ) async {
    emit(state.copyWith(isCheckingEligibility: true));

    final token = await tokenStorage.getAccessToken();
    if (token == null || token.isEmpty) {
      emit(state.copyWith(
        isCheckingEligibility: false,
        canReview: false,
        eligibleBookingId: null,
        eligibilityMessage: 'Vui lòng đăng nhập để gửi đánh giá chuyến đi.',
      ));
      return;
    }

    try {
      // 1. Get user's completed bookings
      final bookingsRes = await apiClient.get(
        '/bookings/me',
        queryParameters: {'status': 'COMPLETED'},
      );

      final List<dynamic> bookingsList = (bookingsRes.data is Map<String, dynamic> &&
              bookingsRes.data['data'] is List)
          ? bookingsRes.data['data'] as List<dynamic>
          : [];

      // Filter bookings matching this tour
      final matchingBookings = bookingsList.where((b) {
        if (b is Map<String, dynamic>) {
          return b['tourId'] == event.tourId;
        }
        return false;
      }).toList();

      if (matchingBookings.isEmpty) {
        emit(state.copyWith(
          isCheckingEligibility: false,
          canReview: false,
          eligibleBookingId: null,
          eligibilityMessage: 'Bạn cần hoàn thành chuyến đi này để có thể gửi đánh giá.',
        ));
        return;
      }

      // 2. Get user's existing reviews to check which booking was already reviewed
      final reviewsRes = await apiClient.get(ApiEndpoints.myReviews);
      final List<dynamic> myReviewsList = (reviewsRes.data is Map<String, dynamic> &&
              reviewsRes.data['data'] is List)
          ? reviewsRes.data['data'] as List<dynamic>
          : [];

      final reviewedBookingIds = myReviewsList
          .whereType<Map<String, dynamic>>()
          .map((r) => r['bookingId'] as String?)
          .whereType<String>()
          .toSet();

      // Find an unreviewed completed booking
      Map<String, dynamic>? eligibleBooking;
      for (final b in matchingBookings) {
        if (b is Map<String, dynamic>) {
          final id = b['id'] as String?;
          if (id != null && !reviewedBookingIds.contains(id)) {
            eligibleBooking = b;
            break;
          }
        }
      }

      if (eligibleBooking != null) {
        emit(state.copyWith(
          isCheckingEligibility: false,
          canReview: true,
          eligibleBookingId: eligibleBooking['id'] as String?,
          eligibilityMessage: null,
        ));
      } else {
        emit(state.copyWith(
          isCheckingEligibility: false,
          canReview: false,
          eligibleBookingId: null,
          eligibilityMessage: 'Bạn đã đánh giá tất cả các chuyến đi hoàn thành của tour này.',
        ));
      }
    } catch (_) {
      // Fallback: If network fails or endpoints not available, allow opening form if logged in
      emit(state.copyWith(
        isCheckingEligibility: false,
        canReview: true,
        eligibilityMessage: null,
      ));
    }
  }

  Future<void> _onSubmitRequested(
    TourReviewSubmitRequested event,
    Emitter<TourReviewState> emit,
  ) async {
    // Client-side validations
    if (event.comment.trim().length < 10) {
      emit(state.copyWith(
        isSubmitting: false,
        submitSuccess: false,
        submitError: 'Nội dung đánh giá phải có ít nhất 10 ký tự.',
      ));
      return;
    }

    if (event.rating < 1 || event.rating > 5) {
      emit(state.copyWith(
        isSubmitting: false,
        submitSuccess: false,
        submitError: 'Vui lòng chọn số sao từ 1 đến 5.',
      ));
      return;
    }

    emit(state.copyWith(isSubmitting: true, submitError: null, submitSuccess: false));

    try {
      final request = CreateReviewRequest(
        bookingId: event.bookingId,
        rating: event.rating,
        comment: event.comment,
      );

      final response = await apiClient.post(
        ApiEndpoints.reviews,
        data: request.toJson(),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        emit(state.copyWith(
          isSubmitting: false,
          submitSuccess: true,
          submitError: null,
          canReview: false,
          eligibilityMessage: 'Bạn đã đánh giá chuyến đi này.',
        ));

        // Reload reviews list
        if (_currentTourId != null) {
          add(TourReviewListLoadRequested(_currentTourId!, page: 1, refresh: true));
        }
      } else {
        emit(state.copyWith(
          isSubmitting: false,
          submitSuccess: false,
          submitError: 'Không thể gửi đánh giá. Vui lòng thử lại.',
        ));
      }
    } on DioException catch (e) {
      String errorMessage = 'Lỗi kết nối máy chủ khi gửi đánh giá.';

      if (e.response?.statusCode == 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (e.response?.data is Map<String, dynamic> &&
          e.response?.data['error'] is Map<String, dynamic>) {
        final errorCode = e.response?.data['error']['code'] as String?;
        final errorDetail = e.response?.data['error']['message'] as String?;

        switch (errorCode) {
          case 'BOOKING_NOT_COMPLETED':
            errorMessage = 'Bạn chỉ có thể gửi đánh giá sau khi chuyến đi đã hoàn thành.';
            break;
          case 'REVIEW_EXISTS':
            errorMessage = 'Chuyến đi này đã được đánh giá trước đó.';
            break;
          case 'PROFANITY_DETECTED':
            errorMessage = 'Nội dung đánh giá chứa từ ngữ không phù hợp.';
            break;
          case 'BOOKING_NOT_FOUND':
            errorMessage = 'Không tìm thấy thông tin đơn đặt tour hợp lệ.';
            break;
          default:
            errorMessage = errorDetail ?? errorMessage;
        }
      }

      emit(state.copyWith(
        isSubmitting: false,
        submitSuccess: false,
        submitError: errorMessage,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmitting: false,
        submitSuccess: false,
        submitError: 'Đã có lỗi xảy ra: ${e.toString()}',
      ));
    }
  }
}

