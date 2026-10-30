import 'package:equatable/equatable.dart';

class TourCategoryModel extends Equatable {
  final String id;
  final String name;

  const TourCategoryModel({
    required this.id,
    required this.name,
  });

  factory TourCategoryModel.fromJson(Map<String, dynamic> json) {
    return TourCategoryModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name};

  @override
  List<Object?> get props => [id, name];
}

class TourAgencyModel extends Equatable {
  final String id;
  final String name;
  final String? avatarUrl;

  const TourAgencyModel({
    required this.id,
    required this.name,
    this.avatarUrl,
  });

  factory TourAgencyModel.fromJson(Map<String, dynamic> json) {
    return TourAgencyModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      };

  @override
  List<Object?> get props => [id, name, avatarUrl];
}

class TourGuideModel extends Equatable {
  final String id;
  final String fullName;
  final String? avatarUrl;

  const TourGuideModel({
    required this.id,
    required this.fullName,
    this.avatarUrl,
  });

  factory TourGuideModel.fromJson(Map<String, dynamic> json) {
    return TourGuideModel(
      id: json['id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      };

  @override
  List<Object?> get props => [id, fullName, avatarUrl];
}

class TourDepartureModel extends Equatable {
  final String id;
  final DateTime date;
  final int capacity;
  final int remaining;
  final int price;
  final bool isOpen;

  const TourDepartureModel({
    required this.id,
    required this.date,
    required this.capacity,
    required this.remaining,
    required this.price,
    required this.isOpen,
  });

  bool get isBookable => isOpen && remaining > 0 && date.isAfter(DateTime.now());

  factory TourDepartureModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      parsedDate = json['date'] != null ? DateTime.parse(json['date'] as String) : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    return TourDepartureModel(
      id: json['id'] as String? ?? '',
      date: parsedDate,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      remaining: (json['remaining'] as num?)?.toInt() ?? 0,
      price: (json['price'] as num?)?.toInt() ?? 0,
      isOpen: json['isOpen'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date.toIso8601String(),
        'capacity': capacity,
        'remaining': remaining,
        'price': price,
        'isOpen': isOpen,
      };

  @override
  List<Object?> get props => [id, date, capacity, remaining, price, isOpen];
}

class TourItineraryDayModel extends Equatable {
  final int day;
  final int? toDay;
  final String title;
  final String? description;
  final List<String> activities;

  const TourItineraryDayModel({
    required this.day,
    this.toDay,
    required this.title,
    this.description,
    this.activities = const [],
  });

  factory TourItineraryDayModel.fromJson(Map<String, dynamic> json) {
    final rawActivities = json['activities'];
    final activitiesList = <String>[];
    if (rawActivities is List) {
      for (final item in rawActivities) {
        if (item != null && item.toString().trim().isNotEmpty) {
          activitiesList.add(item.toString().trim());
        }
      }
    }

    return TourItineraryDayModel(
      day: (json['day'] as num?)?.toInt() ?? 1,
      toDay: (json['toDay'] as num?)?.toInt(),
      title: json['title'] as String? ?? 'Lịch trình ngày',
      description: json['description'] as String?,
      activities: activitiesList,
    );
  }

  Map<String, dynamic> toJson() => {
        'day': day,
        if (toDay != null) 'toDay': toDay,
        'title': title,
        if (description != null) 'description': description,
        'activities': activities,
      };

  @override
  List<Object?> get props => [day, toDay, title, description, activities];
}

class TourDetailModel extends Equatable {
  final String id;
  final String title;
  final String? summary;
  final String destination;
  final int durationDays;
  final int basePrice;
  final String? coverImage;
  final List<String> images;
  final List<String> categoryIds;
  final List<TourCategoryModel> categories;
  final double ratingAvg;
  final int ratingCount;
  final String? description;
  final int? maxGroupSize;
  final String? childPricingPolicy;
  final String? cancellationPolicy;
  final String? travelNotes;
  final String? requiredDocuments;
  final List<String> inclusions;
  final List<String> exclusions;
  final List<TourItineraryDayModel> itinerary;
  final List<TourDepartureModel> departures;
  final TourAgencyModel? agency;
  final TourGuideModel? guide;

  const TourDetailModel({
    required this.id,
    required this.title,
    this.summary,
    required this.destination,
    required this.durationDays,
    required this.basePrice,
    this.coverImage,
    this.images = const [],
    this.categoryIds = const [],
    this.categories = const [],
    required this.ratingAvg,
    required this.ratingCount,
    this.description,
    this.maxGroupSize,
    this.childPricingPolicy,
    this.cancellationPolicy,
    this.travelNotes,
    this.requiredDocuments,
    this.inclusions = const [],
    this.exclusions = const [],
    this.itinerary = const [],
    this.departures = const [],
    this.agency,
    this.guide,
  });

  factory TourDetailModel.fromJson(Map<String, dynamic> json) {
    // Images parsing
    final rawImages = json['images'];
    final imageList = <String>[];
    if (rawImages is List) {
      for (final img in rawImages) {
        if (img != null && img.toString().trim().isNotEmpty) {
          imageList.add(img.toString().trim());
        }
      }
    }
    final cover = json['coverImage'] as String?;
    if (cover != null && cover.isNotEmpty && !imageList.contains(cover)) {
      imageList.insert(0, cover);
    }

    // Categories parsing
    final rawCats = json['categories'];
    final catList = <TourCategoryModel>[];
    if (rawCats is List) {
      for (final c in rawCats) {
        if (c is Map<String, dynamic>) {
          catList.add(TourCategoryModel.fromJson(c));
        }
      }
    }

    // Inclusions & Exclusions
    final rawInclusions = json['inclusions'];
    final incList = <String>[];
    if (rawInclusions is List) {
      for (final item in rawInclusions) {
        if (item != null && item.toString().trim().isNotEmpty) {
          incList.add(item.toString().trim());
        }
      }
    }

    final rawExclusions = json['exclusions'];
    final excList = <String>[];
    if (rawExclusions is List) {
      for (final item in rawExclusions) {
        if (item != null && item.toString().trim().isNotEmpty) {
          excList.add(item.toString().trim());
        }
      }
    }

    // Itinerary parsing & sorting by day
    final rawItinerary = json['itinerary'];
    final itinList = <TourItineraryDayModel>[];
    if (rawItinerary is List) {
      for (final day in rawItinerary) {
        if (day is Map<String, dynamic>) {
          itinList.add(TourItineraryDayModel.fromJson(day));
        }
      }
    }
    itinList.sort((a, b) => a.day.compareTo(b.day));

    // Departures parsing
    final rawDepartures = json['departures'];
    final depList = <TourDepartureModel>[];
    if (rawDepartures is List) {
      for (final d in rawDepartures) {
        if (d is Map<String, dynamic>) {
          depList.add(TourDepartureModel.fromJson(d));
        }
      }
    }
    depList.sort((a, b) => a.date.compareTo(b.date));

    // CategoryIds
    final rawCatIds = json['categoryIds'];
    final catIdList = <String>[];
    if (rawCatIds is List) {
      for (final cid in rawCatIds) {
        if (cid != null) catIdList.add(cid.toString());
      }
    }

    return TourDetailModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String?,
      destination: json['destination'] as String? ?? '',
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 1,
      basePrice: (json['basePrice'] as num?)?.toInt() ?? 0,
      coverImage: cover,
      images: imageList,
      categoryIds: catIdList,
      categories: catList,
      ratingAvg: (json['ratingAvg'] as num?)?.toDouble() ?? 0.0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      description: json['description'] as String?,
      maxGroupSize: (json['maxGroupSize'] as num?)?.toInt(),
      childPricingPolicy: json['childPricingPolicy'] as String?,
      cancellationPolicy: json['cancellationPolicy'] as String?,
      travelNotes: json['travelNotes'] as String?,
      requiredDocuments: json['requiredDocuments'] as String?,
      inclusions: incList,
      exclusions: excList,
      itinerary: itinList,
      departures: depList,
      agency: json['agency'] is Map<String, dynamic>
          ? TourAgencyModel.fromJson(json['agency'] as Map<String, dynamic>)
          : null,
      guide: json['guide'] is Map<String, dynamic>
          ? TourGuideModel.fromJson(json['guide'] as Map<String, dynamic>)
          : null,
    );
  }

  @override
  List<Object?> get props => [
        id,
        title,
        summary,
        destination,
        durationDays,
        basePrice,
        coverImage,
        images,
        categoryIds,
        categories,
        ratingAvg,
        ratingCount,
        description,
        maxGroupSize,
        childPricingPolicy,
        cancellationPolicy,
        travelNotes,
        requiredDocuments,
        inclusions,
        exclusions,
        itinerary,
        departures,
        agency,
        guide,
      ];
}

