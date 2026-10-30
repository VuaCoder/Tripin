import 'package:equatable/equatable.dart';
import '../models/user_profile_model.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();

  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {
  const ProfileInitial();
}

class ProfileLoading extends ProfileState {
  final String? message;
  const ProfileLoading({this.message});

  @override
  List<Object?> get props => [message];
}

class ProfileLoaded extends ProfileState {
  final UserProfileModel user;

  const ProfileLoaded(this.user);

  @override
  List<Object?> get props => [user];
}

class ProfileUpdateSuccess extends ProfileState {
  final UserProfileModel user;
  final String message;

  const ProfileUpdateSuccess({
    required this.user,
    required this.message,
  });

  @override
  List<Object?> get props => [user, message];
}

class ProfileFailure extends ProfileState {
  final String error;
  final UserProfileModel? currentUser;

  const ProfileFailure({required this.error, this.currentUser});

  @override
  List<Object?> get props => [error, currentUser];
}

class ProfileLoggedOut extends ProfileState {
  const ProfileLoggedOut();
}