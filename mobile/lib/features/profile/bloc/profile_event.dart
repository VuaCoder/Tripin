import 'dart:io';
import 'package:equatable/equatable.dart';
import '../models/user_profile_model.dart';

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();

  @override
  List<Object?> get props => [];
}

class ProfileLoadRequested extends ProfileEvent {
  const ProfileLoadRequested();
}

class ProfileUpdateRequested extends ProfileEvent {
  final String fullName;
  final String? phone;

  const ProfileUpdateRequested({
    required this.fullName,
    this.phone,
  });

  @override
  List<Object?> get props => [fullName, phone];
}

class GuideProfileUpdateRequested extends ProfileEvent {
  final GuideProfileData guideProfileData;

  const GuideProfileUpdateRequested(this.guideProfileData);

  @override
  List<Object?> get props => [guideProfileData];
}

class AvatarUploadRequested extends ProfileEvent {
  final File imageFile;

  const AvatarUploadRequested(this.imageFile);

  @override
  List<Object?> get props => [imageFile.path];
}

class LicenseImageUploadRequested extends ProfileEvent {
  final File imageFile;

  const LicenseImageUploadRequested(this.imageFile);

  @override
  List<Object?> get props => [imageFile.path];
}

class LogoutRequested extends ProfileEvent {
  const LogoutRequested();
}