import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../models/tour_model.dart';

/// Thẻ Tour phong cách Airbnb Listing Card UI
/// - Image container: Aspect ratio ~ 4:3, bo góc lớn rounded-3xl (24px)
/// - Top-left: White pill badge "Guest favorite" (black bold text, rounded-full, px-4 py-2, shadow-sm)
/// - Top-right: Heart wishlist icon button with thin stroke
/// - Content section: Không viền card, padding sạch sẽ
/// - Title: text-neutral-900, font-semibold, single line truncate
/// - Subtitle line: "₫[amount] cho [duration] · ★ [rating]"
class TourCardHorizontal extends StatelessWidget {
  final TourModel tour;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;
  final bool isFavorite;

  const TourCardHorizontal({
    super.key,
    required this.tour,
    this.onTap,
    this.onFavoriteTap,
    this.isFavorite = false,
  });

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Image container (rounded-3xl, aspect ratio ~ 4:3)
            Container(
              height: 195,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24), // rounded-3xl
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Image with rounded-3xl
                  ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: _buildImage(tour.coverImage),
                  ),

                  // Top-left: White pill badge "Guest favorite"
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(30), // rounded-full
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'Được khách yêu thích',
                        style: TextStyle(
                          color: Colors.black,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.1,
                        ),
                      ),
                    ),
                  ),

                  // Top-right: Heart/wishlist icon button
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      onPressed: onFavoriteTap,
                      splashRadius: 20,
                      icon: Icon(
                        isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: isFavorite ? const Color(0xFFFF385C) : Colors.white,
                        size: 24,
                        shadows: const [
                          Shadow(
                            color: Colors.black45,
                            blurRadius: 4,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // 2. Content section (Below image, no card border, clean padding)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title: font-semibold, text-base, text-neutral-900, single line truncate
                  Text(
                    tour.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF171717), // text-neutral-900
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 3),

                  // Subtitle/Meta line: Price for duration · ★ rating
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          tour.airbnbPriceDuration,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF525252), // text-neutral-600
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          '·',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF525252),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.star_rounded,
                        size: 14,
                        color: Colors.black,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        tour.formattedRating,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF171717),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage(String? url) {
    if (_isInTest || url == null || url.isEmpty) {
      return Container(
        color: const Color(0xFFE2E8F0),
        child: const Center(
          child: Icon(Icons.image_outlined, color: Colors.black26, size: 36),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, _) => Container(color: const Color(0xFFF1F5F9)),
      errorWidget: (_, _, _) => Container(
        color: const Color(0xFFE2E8F0),
        child: const Icon(Icons.broken_image_rounded, color: Colors.black26),
      ),
    );
  }
}
