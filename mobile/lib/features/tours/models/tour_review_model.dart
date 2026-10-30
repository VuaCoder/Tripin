import 'package:equatable/equatable.dart';

class TourReviewAuthorModel extends Equatable {
  final String name;
  final String? avatarUrl;

  const TourReviewAuthorModel({
    required this.name,
    this.avatarUrl,
  });

  factory TourReviewAuthorModel.fromJson(Map<String, dynamic> json) {
    return TourReviewAuthorModel(
      name: json['name'] as String? ?? 'Khách du lịch',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      };

  @override
  List<Object?> get props => [name, avatarUrl];
}

class TourReviewModel extends Equatable {
  final String id;
  final int rating;
  final String comment;
  final List<String> images;
  final String tourId;
  final TourReviewAuthorModel author;
  final DateTime createdAt;

  const TourReviewModel({
    required this.id,
    required this.rating,
    required this.comment,
    this.images = const [],
    required this.tourId,
    required this.author,
    required this.createdAt,
  });

  factory TourReviewModel.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'];
    final imageList = <String>[];
    if (rawImages is List) {
      for (final img in rawImages) {
        if (img != null && img.toString().trim().isNotEmpty) {
          imageList.add(img.toString().trim());
        }
      }
    }

    DateTime parsedDate;
    try {
      parsedDate = json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    return TourReviewModel(
      id: json['id'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      comment: json['comment'] as String? ?? '',
      images: imageList,
      tourId: json['tourId'] as String? ?? '',
      author: json['author'] is Map<String, dynamic>
          ? TourReviewAuthorModel.fromJson(json['author'] as Map<String, dynamic>)
          : const TourReviewAuthorModel(name: 'Khách du lịch'),
      createdAt: parsedDate,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'rating': rating,
        'comment': comment,
        'images': images,
        'tourId': tourId,
        'author': author.toJson(),
        'createdAt': createdAt.toIso8601String(),
      };

  @override
  List<Object?> get props => [id, rating, comment, images, tourId, author, createdAt];
}

class TourReviewPageModel extends Equatable {
  final List<TourReviewModel> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const TourReviewPageModel({
    this.items = const [],
    this.page = 1,
    this.limit = 10,
    this.total = 0,
    this.totalPages = 1,
  });

  factory TourReviewPageModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['data'];
    final list = <TourReviewModel>[];
    if (rawItems is List) {
      for (final item in rawItems) {
        if (item is Map<String, dynamic>) {
          list.add(TourReviewModel.fromJson(item));
        }
      }
    }

    final meta = json['meta'] as Map<String, dynamic>? ?? {};
    return TourReviewPageModel(
      items: list,
      page: (meta['page'] as num?)?.toInt() ?? 1,
      limit: (meta['limit'] as num?)?.toInt() ?? 10,
      total: (meta['total'] as num?)?.toInt() ?? list.length,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  bool get hasMore => page < totalPages;

  @override
  List<Object?> get props => [items, page, limit, total, totalPages];
}

class CreateReviewRequest extends Equatable {
  final String bookingId;
  final int rating;
  final String comment;
  final List<String>? imagePublicIds;

  const CreateReviewRequest({
    required this.bookingId,
    required this.rating,
    required this.comment,
    this.imagePublicIds,
  });

  Map<String, dynamic> toJson() => {
        'bookingId': bookingId,
        'rating': rating,
        'comment': comment.trim(),
        if (imagePublicIds != null && imagePublicIds!.isNotEmpty)
          'imagePublicIds': imagePublicIds,
      };

  @override
  List<Object?> get props => [bookingId, rating, comment, imagePublicIds];
}

