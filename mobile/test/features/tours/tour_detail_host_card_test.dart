import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/features/tours/screens/tour_detail_screen.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_cubit.dart';

class MockTourDetailApiClient extends ApiClient {
  final Map<String, dynamic> sampleData;

  MockTourDetailApiClient(this.sampleData);

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {
        'success': true,
        'data': sampleData,
      } as T,
    );
  }
}

void main() {
  testWidgets('TourDetailScreen host section renders sketch layout: avatar, company, guide with stars, chat icon', (tester) async {
    final tourData = {
      'id': 'tour-hagiang-99',
      'title': 'Hà Giang Mùa Hoa Tam Giác Mạch',
      'summary': 'Chinh phục Mã Pí Lèng',
      'destination': 'Hà Giang',
      'durationDays': 3,
      'basePrice': 2850000,
      'ratingAvg': 4.9,
      'ratingCount': 28,
      'images': [],
      'agency': {
        'id': 'agency-tripri',
        'name': 'Tripri Vietnam Travel',
      },
      'guide': {
        'id': 'guide-hoang',
        'fullName': 'Nguyễn Hoàng Phúc',
        'ratingAvg': 4.9,
        'ratingCount': 15,
      },
      'departures': [],
      'itinerary': [],
      'inclusions': [],
      'exclusions': [],
    };

    final mockClient = MockTourDetailApiClient(tourData);

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<WishlistCubit>(
          create: (_) => WishlistCubit(),
          child: TourDetailScreen(
            tourId: 'tour-hagiang-99',
            apiClient: mockClient,
          ),
        ),
      ),
    );

    // Initial pump -> shows shimmer
    await tester.pump();
    // Allow bloc async call to finish
    await tester.pump(const Duration(milliseconds: 100));

    // 1. Verify company name is displayed at the top
    expect(find.text('Tripri Vietnam Travel'), findsOneWidget);

    // 2. Verify guide name is displayed below
    expect(find.text('Nguyễn Hoàng Phúc'), findsOneWidget);

    // 3. Verify circular avatar on left exists
    expect(find.byType(CircleAvatar), findsWidgets);

    // 5. Verify chat icon button exists on the right (icon only, with Key 'btn_chat_guide')
    final chatBtnFinder = find.byKey(const Key('btn_chat_guide'));
    expect(chatBtnFinder, findsOneWidget);
    expect(
      find.descendant(of: chatBtnFinder, matching: find.byIcon(Icons.chat_bubble_outline_rounded)),
      findsOneWidget,
    );
  });
}
