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
  final String? bio;
  final String? dreamDestination;
  final String? work;
  final String? skill;
  final String? pets;

  const ProfileUpdateRequested({
    required this.fullName,
    this.phone,
    this.bio,
    this.dreamDestination,
    this.work,
    this.skill,
    this.pets,
  });

  @override
  List<Object?> get props => [fullName, phone, bio, dreamDestination, work, skill, pets];
}

class ChangePasswordRequested extends ProfileEvent {
  final String currentPassword;
  final String newPassword;

  const ChangePasswordRequested({
    required this.currentPassword,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [currentPassword, newPassword];
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