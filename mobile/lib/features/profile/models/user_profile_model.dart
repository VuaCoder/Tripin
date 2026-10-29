class GuideProfileData {
  final String? bio;
  final List<String> languages;
  final List<String> specialties;
  final int? experienceYears;
  final String? licenseNumber;
  final String? licenseImageUrl;

  GuideProfileData({
    this.bio,
    this.languages = const [],
    this.specialties = const [],
    this.experienceYears,
    this.licenseNumber,
    this.licenseImageUrl,
  });

  factory GuideProfileData.fromJson(Map<String, dynamic>? json) {
    if (json == null) return GuideProfileData();
    return GuideProfileData(
      bio: json['bio'] as String?,
      languages: (json['languages'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      specialties: (json['specialties'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      experienceYears: json['experienceYears'] as int?,
      licenseNumber: json['licenseNumber'] as String?,
      licenseImageUrl: json['licenseImageUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (bio != null) 'bio': bio,
      'languages': languages,
      'specialties': specialties,
      if (experienceYears != null) 'experienceYears': experienceYears,
      if (licenseNumber != null) 'licenseNumber': licenseNumber,
      if (licenseImageUrl != null) 'licenseImageUrl': licenseImageUrl,
    };
  }
}

class UserProfileModel {
  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final String? status;
  final GuideProfileData? guideProfile;
  final String? emailVerifiedAt;
  final bool isEmailVerified;
  final String? bio;
  final String? dreamDestination;
  final String? work;
  final String? skill;
  final String? pets;

  UserProfileModel({
    required this.id,
    required this.email,
    required this.fullName,
    this.phone,
    this.avatarUrl,
    required this.role,
    this.status,
    this.guideProfile,
    this.emailVerifiedAt,
    this.isEmailVerified = false,
    this.bio,
    this.dreamDestination,
    this.work,
    this.skill,
    this.pets,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    final emailVerifiedAt = json['emailVerifiedAt'] as String?;
    final status = json['status'] as String?;
    final isEmailVerified = json['isEmailVerified'] as bool? ??
        (emailVerifiedAt != null && emailVerifiedAt.isNotEmpty);
    final preferences = json['preferences'] as Map<String, dynamic>?;
    return UserProfileModel(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      role: json['role'] as String? ?? 'TRAVELER',
      status: status,
      guideProfile: json['guideProfile'] != null
          ? GuideProfileData.fromJson(json['guideProfile'] as Map<String, dynamic>)
          : null,
      emailVerifiedAt: emailVerifiedAt,
      isEmailVerified: isEmailVerified,
      bio: json['bio'] as String? ?? preferences?['bio'] as String?,
      dreamDestination: json['dreamDestination'] as String? ?? preferences?['dreamDestination'] as String?,
      work: json['work'] as String? ?? preferences?['work'] as String?,
      skill: json['skill'] as String? ?? preferences?['skill'] as String?,
      pets: json['pets'] as String? ?? preferences?['pets'] as String?,
    );
  }

  bool get isGuide => role == 'TOUR_GUIDE';
  bool get isTraveler => role == 'TRAVELER';
  bool get isVerified => (isEmailVerified == true) || (emailVerifiedAt != null && emailVerifiedAt!.isNotEmpty);

  UserProfileModel copyWith({
    String? fullName,
    String? phone,
    String? avatarUrl,
    GuideProfileData? guideProfile,
    String? status,
    String? emailVerifiedAt,
    bool? isEmailVerified,
    String? bio,
    String? dreamDestination,
    String? work,
    String? skill,
    String? pets,
  }) {
    return UserProfileModel(
      id: id,
      email: email,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      role: role,
      status: status ?? this.status,
      guideProfile: guideProfile ?? this.guideProfile,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
      bio: bio ?? this.bio,
      dreamDestination: dreamDestination ?? this.dreamDestination,
      work: work ?? this.work,
      skill: skill ?? this.skill,
      pets: pets ?? this.pets,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'fullName': fullName,
      if (phone != null) 'phone': phone,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      'role': role,
      if (status != null) 'status': status,
      if (emailVerifiedAt != null) 'emailVerifiedAt': emailVerifiedAt,
      'isEmailVerified': isEmailVerified,
      if (bio != null) 'bio': bio,
      if (dreamDestination != null) 'dreamDestination': dreamDestination,
      if (work != null) 'work': work,
      if (skill != null) 'skill': skill,
      if (pets != null) 'pets': pets,
      if (guideProfile != null) 'guideProfile': guideProfile!.toJson(),
    };
  }
}