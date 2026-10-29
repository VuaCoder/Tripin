import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/bloc/profile_bloc.dart';
import 'package:mobile/features/profile/bloc/profile_state.dart';
import 'package:mobile/features/profile/models/user_profile_model.dart';
import 'package:mobile/features/profile/screens/profile_screen.dart';

void main() {
  group('[FLOW-03] UserProfileModel & GuideProfileData Tests', () {
    test('Correctly parses Traveler profile from JSON', () {
      final json = {
        'id': 'user-123',
        'email': 'traveler@tripri.com',
        'fullName': 'Nguyễn Văn Du Khách',
        'phone': '0901234567',
        'avatarUrl': 'https://res.cloudinary.com/tripri/image/upload/v1/avatar.jpg',
        'role': 'TRAVELER',
        'status': 'ACTIVE',
      };

      final profile = UserProfileModel.fromJson(json);

      expect(profile.id, 'user-123');
      expect(profile.email, 'traveler@tripri.com');
      expect(profile.fullName, 'Nguyễn Văn Du Khách');
      expect(profile.phone, '0901234567');
      expect(profile.isGuide, false);
      expect(profile.guideProfile, isNull);
    });

    test('Correctly parses Tour Guide profile with GuideProfileData from JSON', () {
      final json = {
        'id': 'guide-456',
        'email': 'guide@tripri.com',
        'fullName': 'Trần Hướng Dẫn',
        'role': 'TOUR_GUIDE',
        'status': 'ACTIVE',
        'guideProfile': {
          'licenseNumber': '10118/HDVDL-QT',
          'experienceYears': 5,
          'languages': ['Tiếng Việt', 'Tiếng Anh'],
          'bio': 'Hướng dẫn viên chuyên nghiệp miền Trung.',
          'licenseImageUrl': 'https://res.cloudinary.com/tripri/image/upload/v1/license.jpg',
        },
      };

      final profile = UserProfileModel.fromJson(json);

      expect(profile.id, 'guide-456');
      expect(profile.isGuide, true);
      expect(profile.guideProfile, isNotNull);
      expect(profile.guideProfile?.licenseNumber, '10118/HDVDL-QT');
      expect(profile.guideProfile?.experienceYears, 5);
      expect(profile.guideProfile?.languages, ['Tiếng Việt', 'Tiếng Anh']);
      expect(profile.guideProfile?.bio, 'Hướng dẫn viên chuyên nghiệp miền Trung.');
      expect(profile.guideProfile?.licenseImageUrl, 'https://res.cloudinary.com/tripri/image/upload/v1/license.jpg');
    });

    test('GuideProfileData toJson serializes properly', () {
      final guideData = GuideProfileData(
        licenseNumber: 'TEST-123',
        experienceYears: 3,
        languages: ['Tiếng Việt', 'Tiếng Pháp'],
        bio: 'Mô tả ngắn',
        licenseImageUrl: 'https://example.com/license.jpg',
      );

      final json = guideData.toJson();

      expect(json['licenseNumber'], 'TEST-123');
      expect(json['experienceYears'], 3);
      expect(json['languages'], ['Tiếng Việt', 'Tiếng Pháp']);
      expect(json['bio'], 'Mô tả ngắn');
      expect(json['licenseImageUrl'], 'https://example.com/license.jpg');
    });

    test('UserProfileModel copyWith works accurately', () {
      final original = UserProfileModel(
        id: '1',
        email: 'test@tripri.com',
        fullName: 'Test Name',
        role: 'TRAVELER',
      );

      final updated = original.copyWith(
        fullName: 'Updated Name',
        phone: '0988888888',
      );

      expect(updated.id, original.id);
      expect(updated.email, original.email);
      expect(updated.fullName, 'Updated Name');
      expect(updated.phone, '0988888888');
    });

    testWidgets('ProfileScreen renders menu items without assertion errors', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final user = UserProfileModel(
        id: '1',
        email: 'test@tripri.com',
        fullName: 'Test Traveler',
        role: 'TRAVELER',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider(
            create: (_) => ProfileBloc()..emit(ProfileLoaded(user)),
            child: const ProfileScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Hồ sơ'), findsOneWidget);
      expect(find.text('Cài đặt thông báo'), findsOneWidget);
      expect(find.text('Đăng nhập & Bảo mật'), findsOneWidget);
      expect(find.text('Về Tripri Travel'), findsOneWidget);
      expect(find.text('Đăng xuất'), findsOneWidget);
    });
  });
}