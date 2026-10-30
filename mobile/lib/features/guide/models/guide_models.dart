DateTime? _parseDate(dynamic value) => value is String ? DateTime.tryParse(value) : null;

/// A tour the logged-in guide is assigned to (`GET /guide/tours`).
class GuideAssignedTour {
  const GuideAssignedTour({
    required this.id,
    required this.title,
    required this.destination,
    required this.durationDays,
    required this.tourStatus,
    required this.assignmentStatus,
    this.nextDepartureDate,
    this.agencyName,
  });

  final String id;
  final String title;
  final String destination;
  final int durationDays;
  final String tourStatus;
  final String assignmentStatus;
  final DateTime? nextDepartureDate;
  final String? agencyName;

  bool get isAccepted => assignmentStatus == 'ACCEPTED';

  factory GuideAssignedTour.fromJson(Map<String, dynamic> json) {
    final assignment = json['assignment'] as Map<String, dynamic>? ?? const {};
    final agency = json['agency'] as Map<String, dynamic>?;
    return GuideAssignedTour(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      destination: json['destination'] as String? ?? '',
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 0,
      tourStatus: json['tourStatus'] as String? ?? '',
      assignmentStatus: assignment['status'] as String? ?? '',
      nextDepartureDate: _parseDate(json['nextDepartureDate']),
      agencyName: agency?['name'] as String?,
    );
  }
}

/// One booking group in the tour roster (`GET /guide/e-tickets/:tourId`).
class GuideRosterItem {
  const GuideRosterItem({
    required this.ticketId,
    required this.bookingCode,
    required this.holderName,
    required this.participants,
    required this.checkedIn,
    this.departureDate,
    this.checkedInAt,
  });

  final String ticketId;
  final String bookingCode;
  final String holderName;
  final int participants;
  final bool checkedIn;
  final DateTime? departureDate;
  final DateTime? checkedInAt;

  GuideRosterItem copyWith({bool? checkedIn, DateTime? checkedInAt}) {
    return GuideRosterItem(
      ticketId: ticketId,
      bookingCode: bookingCode,
      holderName: holderName,
      participants: participants,
      checkedIn: checkedIn ?? this.checkedIn,
      departureDate: departureDate,
      checkedInAt: checkedInAt ?? this.checkedInAt,
    );
  }

  factory GuideRosterItem.fromJson(Map<String, dynamic> json) {
    return GuideRosterItem(
      ticketId: json['ticketId'] as String,
      bookingCode: json['bookingCode'] as String? ?? '',
      holderName: json['holderName'] as String? ?? '',
      participants: (json['participants'] as num?)?.toInt() ?? 0,
      checkedIn: json['checkedIn'] as bool? ?? false,
      departureDate: _parseDate(json['departureDate']),
      checkedInAt: _parseDate(json['checkedInAt']),
    );
  }
}

class GuideRoster {
  const GuideRoster({
    required this.tourId,
    required this.tourTitle,
    required this.total,
    required this.checkedIn,
    required this.items,
  });

  final String tourId;
  final String tourTitle;
  final int total;
  final int checkedIn;
  final List<GuideRosterItem> items;

  bool get allCheckedIn => total > 0 && checkedIn >= total;

  GuideRoster copyWith({List<GuideRosterItem>? items, int? checkedIn}) {
    return GuideRoster(
      tourId: tourId,
      tourTitle: tourTitle,
      total: items?.length ?? total,
      checkedIn: checkedIn ?? this.checkedIn,
      items: items ?? this.items,
    );
  }

  factory GuideRoster.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => GuideRosterItem.fromJson(item as Map<String, dynamic>))
        .toList();
    return GuideRoster(
      tourId: json['tourId'] as String? ?? '',
      tourTitle: json['tourTitle'] as String? ?? '',
      total: (json['total'] as num?)?.toInt() ?? items.length,
      checkedIn: (json['checkedIn'] as num?)?.toInt() ?? items.where((item) => item.checkedIn).length,
      items: items,
    );
  }
}

class CheckInResult {
  const CheckInResult({
    required this.ticketId,
    required this.holderName,
    required this.participants,
    required this.tourTitle,
    this.checkedInAt,
  });

  final String ticketId;
  final String holderName;
  final int participants;
  final String tourTitle;
  final DateTime? checkedInAt;

  factory CheckInResult.fromJson(Map<String, dynamic> json) {
    return CheckInResult(
      ticketId: json['ticketId'] as String? ?? '',
      holderName: json['holderName'] as String? ?? '',
      participants: (json['participants'] as num?)?.toInt() ?? 0,
      tourTitle: json['tourTitle'] as String? ?? '',
      checkedInAt: _parseDate(json['checkedInAt']),
    );
  }
}

sealed class CheckInOutcome {
  const CheckInOutcome();
}

class CheckInSuccess extends CheckInOutcome {
  const CheckInSuccess(this.result);

  final CheckInResult result;
}

class CheckInFailure extends CheckInOutcome {
  const CheckInFailure({required this.code, required this.message});

  final String code;
  final String message;
}
