import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/cloudinary_service.dart';
import '../../../core/storage/token_storage.dart';
import '../models/user_profile_model.dart';
import 'profile_event.dart';
import 'profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;
  final CloudinaryService cloudinaryService;

  UserProfileModel? _currentUser;

  ProfileBloc({
    ApiClient? client,
    TokenStorage? storage,
    CloudinaryService? cloudService,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        cloudinaryService = cloudService ?? CloudinaryService(),
        super(const ProfileInitial()) {
    on<ProfileLoadRequested>(_onLoadProfile);
    on<ProfileUpdateRequested>(_onUpdateProfile);
    on<GuideProfileUpdateRequested>(_onUpdateGuideProfile);
    on<AvatarUploadRequested>(_onUploadAvatar);
    on<LicenseImageUploadRequested>(_onUploadLicenseImage);
    on<LogoutRequested>(_onLogout);
  }

  Future<void> _onLoadProfile(ProfileLoadRequested event, Emitter<ProfileState> emit) async {
    emit(const ProfileLoading());
    try {
      final response = await apiClient.get(ApiEndpoints.me);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
        _currentUser = UserProfileModel.fromJson(data);
        emit(ProfileLoaded(_currentUser!));
      } else {
        emit(const ProfileFailure(error: 'Không thể tải thông tin tài khoản'));
      }
    } on DioException catch (e) {
      final message = _extractErrorMessage(e, 'Lỗi kết nối máy chủ');
      emit(ProfileFailure(error: message));
    } catch (e) {
      emit(ProfileFailure(error: e.toString()));
    }
  }

  Future<void> _onUpdateProfile(ProfileUpdateRequested event, Emitter<ProfileState> emit) async {
    emit(const ProfileLoading(message: 'Đang cập nhật thông tin...'));
    try {
      final body = {
        'fullName': event.fullName.trim(),
        if (event.phone != null && event.phone!.isNotEmpty) 'phone': event.phone!.trim(),
      };

      final response = await apiClient.patch(ApiEndpoints.me, data: body);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
        _currentUser = UserProfileModel.fromJson(data);
        emit(ProfileUpdateSuccess(user: _currentUser!, message: 'Cập nhật thông tin thành công!'));
      } else {
        emit(ProfileFailure(error: 'Cập nhật thất bại', currentUser: _currentUser));
      }
    } on DioException catch (e) {
      final message = _extractErrorMessage(e, 'Cập nhật thông tin thất bại');
      emit(ProfileFailure(error: message, currentUser: _currentUser));
    } catch (e) {
      emit(ProfileFailure(error: e.toString(), currentUser: _currentUser));
    }
  }

  Future<void> _onUpdateGuideProfile(GuideProfileUpdateRequested event, Emitter<ProfileState> emit) async {
    emit(const ProfileLoading(message: 'Đang lưu hồ sơ chuyên môn...'));
    try {
      final body = {
        'guideProfile': event.guideProfileData.toJson(),
      };

      final response = await apiClient.patch(ApiEndpoints.me, data: body);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
        _currentUser = UserProfileModel.fromJson(data);
        emit(ProfileUpdateSuccess(user: _currentUser!, message: 'Cập nhật hồ sơ Hướng dẫn viên thành công!'));
      } else {
        emit(ProfileFailure(error: 'Lưu hồ sơ chuyên môn thất bại', currentUser: _currentUser));
      }
    } on DioException catch (e) {
      final message = _extractErrorMessage(e, 'Lỗi cập nhật hồ sơ chuyên môn');
      emit(ProfileFailure(error: message, currentUser: _currentUser));
    } catch (e) {
      emit(ProfileFailure(error: e.toString(), currentUser: _currentUser));
    }
  }

  Future<void> _onUploadAvatar(AvatarUploadRequested event, Emitter<ProfileState> emit) async {
    emit(const ProfileLoading(message: 'Đang tải ảnh đại diện lên...'));
    try {
      // B1: Lấy upload signature
      final sigRes = await apiClient.post(ApiEndpoints.avatarUploadSignature);
      final sigData = sigRes.data['data'] as Map<String, dynamic>? ?? sigRes.data as Map<String, dynamic>;

      // B2: Tải ảnh trực tiếp lên Cloudinary
      final uploadRes = await cloudinaryService.uploadImageWithSignature(
        file: event.imageFile,
        signatureData: sigData,
      );

      // B3: Gọi complete để backend lưu URL
      final compRes = await apiClient.post(
        ApiEndpoints.avatarComplete,
        data: {'publicId': uploadRes.publicId},
      );

      if (compRes.statusCode == 200 && compRes.data != null) {
        final data = compRes.data['data'] as Map<String, dynamic>? ?? compRes.data as Map<String, dynamic>;
        _currentUser = UserProfileModel.fromJson(data);
        emit(ProfileUpdateSuccess(user: _currentUser!, message: 'Cập nhật ảnh đại diện thành công!'));
      } else {
        emit(ProfileFailure(error: 'Không thể hoàn tất lưu ảnh', currentUser: _currentUser));
      }
    } on DioException catch (e) {
      final message = _extractErrorMessage(e, 'Tải ảnh đại diện thất bại');
      emit(ProfileFailure(error: message, currentUser: _currentUser));
    } catch (e) {
      emit(ProfileFailure(error: e.toString(), currentUser: _currentUser));
    }
  }

  Future<void> _onUploadLicenseImage(LicenseImageUploadRequested event, Emitter<ProfileState> emit) async {
    emit(const ProfileLoading(message: 'Đang tải ảnh thẻ HDV lên...'));
    try {
      // B1: Lấy upload signature
      final sigRes = await apiClient.post(ApiEndpoints.licenseImageUploadSignature);
      final sigData = sigRes.data['data'] as Map<String, dynamic>? ?? sigRes.data as Map<String, dynamic>;

      // B2: Tải ảnh trực tiếp lên Cloudinary
      final uploadRes = await cloudinaryService.uploadImageWithSignature(
        file: event.imageFile,
        signatureData: sigData,
      );

      // B3: Gọi complete
      final compRes = await apiClient.post(
        ApiEndpoints.licenseImageComplete,
        data: {'publicId': uploadRes.publicId},
      );

      if (compRes.statusCode == 200 && compRes.data != null) {
        final data = compRes.data['data'] as Map<String, dynamic>? ?? compRes.data as Map<String, dynamic>;
        _currentUser = UserProfileModel.fromJson(data);
        emit(ProfileUpdateSuccess(user: _currentUser!, message: 'Tải ảnh thẻ HDV thành công!'));
      } else {
        emit(ProfileFailure(error: 'Không thể lưu ảnh thẻ HDV', currentUser: _currentUser));
      }
    } on DioException catch (e) {
      final message = _extractErrorMessage(e, 'Lỗi tải ảnh thẻ HDV');
      emit(ProfileFailure(error: message, currentUser: _currentUser));
    } catch (e) {
      emit(ProfileFailure(error: e.toString(), currentUser: _currentUser));
    }
  }

  String _extractErrorMessage(DioException e, String defaultMessage) {
    if (e.response?.statusCode == 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    final data = e.response?.data;
    if (data is Map) {
      if (data['error'] is Map && data['error']['message'] != null) {
        return data['error']['message'].toString();
      }
      if (data['message'] != null) {
        return data['message'].toString();
      }
    }
    return defaultMessage;
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<ProfileState> emit) async {
    await tokenStorage.clearAll();
    _currentUser = null;
    emit(const ProfileLoggedOut());
  }
}