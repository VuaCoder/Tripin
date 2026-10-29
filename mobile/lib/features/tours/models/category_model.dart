import 'package:flutter/material.dart';

/// Model đại diện cho danh mục tour du lịch Tripri
class CategoryModel {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final int sortOrder;
  final bool isActive;

  const CategoryModel({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'description': description,
      'sortOrder': sortOrder,
      'isActive': isActive,
    };
  }

  /// Trả về biểu tượng trực quan sinh động theo đặc trưng từng danh mục
  IconData get iconData {
    final lower = (slug.isNotEmpty ? slug : name).toLowerCase();
    if (lower.contains('bien') || lower.contains('dao') || lower.contains('beach') || lower.contains('island')) {
      return Icons.beach_access_rounded;
    }
    if (lower.contains('van-hoa') || lower.contains('culture') || lower.contains('di-san') || lower.contains('heritage')) {
      return Icons.temple_buddhist_rounded;
    }
    if (lower.contains('nghi-duong') || lower.contains('resort') || lower.contains('spa') || lower.contains('relax')) {
      return Icons.spa_rounded;
    }
    if (lower.contains('am-thuc') || lower.contains('food') || lower.contains('culinary') || lower.contains('an-uong')) {
      return Icons.restaurant_rounded;
    }
    if (lower.contains('kham-pha') || lower.contains('trekking') || lower.contains('adventure') || lower.contains('nui')) {
      return Icons.terrain_rounded;
    }
    if (lower.contains('sinh-thai') || lower.contains('eco') || lower.contains('forest') || lower.contains('thien-nhien')) {
      return Icons.forest_rounded;
    }
    if (lower.contains('du-thuyen') || lower.contains('cruise') || lower.contains('boat') || lower.contains('tau')) {
      return Icons.sailing_rounded;
    }
    if (lower.contains('pho') || lower.contains('city') || lower.contains('do-thi')) {
      return Icons.location_city_rounded;
    }
    return Icons.explore_rounded;
  }
}
