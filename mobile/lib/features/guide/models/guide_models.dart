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
    this.feePerBooking = 0,
    this.nextDepartureDate,
    this.agencyName,
  });

  final String id;
  final String title;
  final String destination;
  final int durationDays;
  final String tourStatus;
  final String assignmentStatus;
  final int feePerBooking;
  final DateTime? nextDepartureDate;
  final String? agencyName;

  bool get isPending => assignmentStatus == 'PENDING';
  bool get isAccepted => assignmentStatus == 'ACCEPTED';

  GuideAssignedTour copyWith({String? assignmentStatus}) {
    return GuideAssignedTour(
      id: id,
      title: title,
      destination: destination,
      durationDays: durationDays,
      tourStatus: tourStatus,
      assignmentStatus: assignmentStatus ?? this.assignmentStatus,
      feePerBooking: feePerBooking,
      nextDepartureDate: nextDepartureDate,
      agencyName: agencyName,
    );
  }

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
      feePerBooking: (assignment['feePerBooking'] as num?)?.toInt() ?? 0,
      nextDepartureDate: _parseDate(json['nextDepartureDate']),
      agencyName: agency?['name'] as String?,
    );
  }
}

class GuideGuestCounts {
  const GuideGuestCounts({
    required this.adults,
    required this.children,
    required this.infants,
  });

  final int adults;
  final int children;
  final int infants;

  factory GuideGuestCounts.fromJson(Map<String, dynamic> json) {
    return GuideGuestCounts(
      adults: (json['adults'] as num?)?.toInt() ?? 0,
      children: (json['children'] as num?)?.toInt() ?? 0,
      infants: (json['infants'] as num?)?.toInt() ?? 0,
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
    this.guests,
    this.contactPhone,
    this.notes,
    this.departureDate,
    this.checkedInAt,
  });

  final String ticketId;
  final String bookingCode;
  final String holderName;
  final int participants;
  final bool checkedIn;
  final GuideGuestCounts? guests;
  final String? contactPhone;
  final String? notes;
  final DateTime? departureDate;
  final DateTime? checkedInAt;

  GuideRosterItem copyWith({bool? checkedIn, DateTime? checkedInAt}) {
    return GuideRosterItem(
      ticketId: ticketId,
      bookingCode: bookingCode,
      holderName: holderName,
      participants: participants,
      checkedIn: checkedIn ?? this.checkedIn,
      guests: guests,
      contactPhone: contactPhone,
      notes: notes,
      departureDate: departureDate,
      checkedInAt: checkedInAt ?? this.checkedInAt,
    );
  }

  factory GuideRosterItem.fromJson(Map<String, dynamic> json) {
    final guests = json['guests'];
    return GuideRosterItem(
      ticketId: json['ticketId'] as String,
      bookingCode: json['bookingCode'] as String? ?? '',
      holderName: json['holderName'] as String? ?? '',
      participants: (json['participants'] as num?)?.toInt() ?? 0,
      checkedIn: json['checkedIn'] as bool? ?? false,
      guests: guests is Map<String, dynamic>
          ? GuideGuestCounts.fromJson(guests)
          : null,
      contactPhone: json['contactPhone'] as String?,
      notes: json['notes'] as String?,
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

/// Public tour facts for the assignment detail (`GET /tours/:id`).
class GuideTourPublicDetail {
  const GuideTourPublicDetail({
    this.description,
    this.maxGroupSize,
    this.departures = const [],
  });

  final String? description;
  final int? maxGroupSize;
  final List<GuideDepartureInfo> departures;

  /// Seats already booked on the departure that matches [date], or null when the API does not list it.
  int? bookedSeatsFor(DateTime? date) {
    if (date == null) return null;
    for (final departure in departures) {
      final departureDate = departure.date;
      if (departureDate != null &&
          departureDate.year == date.year &&
          departureDate.month == date.month &&
          departureDate.day == date.day) {
        return departure.booked;
      }
    }
    return null;
  }

  factory GuideTourPublicDetail.fromJson(Map<String, dynamic> json) {
    final departures = (json['departures'] as List<dynamic>? ?? const [])
        .map(
          (item) => GuideDepartureInfo.fromJson(item as Map<String, dynamic>),
        )
        .toList();
    return GuideTourPublicDetail(
      description: (json['description'] as String?)?.trim(),
      maxGroupSize: (json['maxGroupSize'] as num?)?.toInt(),
      departures: departures,
    );
  }
}

class GuideDepartureInfo {
  const GuideDepartureInfo({
    this.date,
    required this.capacity,
    required this.remaining,
  });

  final DateTime? date;
  final int capacity;
  final int remaining;

  int get booked => (capacity - remaining).clamp(0, capacity).toInt();

  factory GuideDepartureInfo.fromJson(Map<String, dynamic> json) {
    return GuideDepartureInfo(
      date: _parseDate(json['date']),
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      remaining: (json['remaining'] as num?)?.toInt() ?? 0,
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

sealed class GuideAnswerOutcome {
  const GuideAnswerOutcome();
}

class GuideAnswerSuccess extends GuideAnswerOutcome {
  const GuideAnswerSuccess(this.tour);

  final GuideAssignedTour tour;
}

class GuideAnswerFailure extends GuideAnswerOutcome {
  const GuideAnswerFailure({required this.code, required this.message});

  final String code;
  final String message;
}
