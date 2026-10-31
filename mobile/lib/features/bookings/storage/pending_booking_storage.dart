import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Dữ liệu đơn đặt tour đang dang dở (chưa thanh toán xong)
class PendingBookingDraft {
  final String tourId;
  final String tourTitle;
  final String? destination;
  final String? coverImage;
  final String departureId;
  final DateTime departureDate;
  final DateTime endDate;
  final int durationDays;
  final int adultsCount;
  final int childrenCount;
  final int infantsCount;
  final int totalPrice;
  final DateTime savedAt;

  const PendingBookingDraft({
    required this.tourId,
    required this.tourTitle,
    this.destination,
    this.coverImage,
    required this.departureId,
    required this.departureDate,
    required this.endDate,
    this.durationDays = 1,
    this.adultsCount = 1,
    this.childrenCount = 0,
    this.infantsCount = 0,
    required this.totalPrice,
    required this.savedAt,
  });

  int get totalGuests => adultsCount + childrenCount + infantsCount;

  Map<String, dynamic> toJson() => {
        'tourId': tourId,
        'tourTitle': tourTitle,
        'destination': destination,
        'coverImage': coverImage,
        'departureId': departureId,
        'departureDate': departureDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'durationDays': durationDays,
        'adultsCount': adultsCount,
        'childrenCount': childrenCount,
        'infantsCount': infantsCount,
        'totalPrice': totalPrice,
        'savedAt': savedAt.toIso8601String(),
      };

  factory PendingBookingDraft.fromJson(Map<String, dynamic> json) {
    return PendingBookingDraft(
      tourId: json['tourId'] as String? ?? '',
      tourTitle: json['tourTitle'] as String? ?? '',
      destination: json['destination'] as String?,
      coverImage: json['coverImage'] as String?,
      departureId: json['departureId'] as String? ?? '',
      departureDate: json['departureDate'] != null
          ? DateTime.tryParse(json['departureDate'].toString()) ?? DateTime.now()
          : DateTime.now(),
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'].toString()) ?? DateTime.now()
          : DateTime.now(),
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 1,
      adultsCount: (json['adultsCount'] as num?)?.toInt() ?? 1,
      childrenCount: (json['childrenCount'] as num?)?.toInt() ?? 0,
      infantsCount: (json['infantsCount'] as num?)?.toInt() ?? 0,
      totalPrice: (json['totalPrice'] as num?)?.toInt() ?? 0,
      savedAt: json['savedAt'] != null
          ? DateTime.tryParse(json['savedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

/// Quản lý lưu trữ đơn đặt tour đang chờ hoàn thành
class PendingBookingStorage {
  static const _key = 'tripri_pending_booking_draft_v1';
  final SharedPreferences? prefs;

  PendingBookingStorage({this.prefs});

  Future<SharedPreferences> _getPrefs() async => prefs ?? await SharedPreferences.getInstance();

  Future<void> saveDraft(PendingBookingDraft draft) async {
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_key, jsonEncode(draft.toJson()));
    } catch (_) {}
  }

  Future<PendingBookingDraft?> getDraft() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_key);
      if (raw == null || raw.isEmpty) return null;
      return PendingBookingDraft.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearDraft() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_key);
    } catch (_) {}
  }
}
