import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/tour_review_model.dart';

class TourReviewItemWidget extends StatefulWidget {
  final TourReviewModel review;
  final bool isCard;
  final double? width;

  const TourReviewItemWidget({
    super.key,
    required this.review,
    this.isCard = false,
    this.width,
  });

  @override
  State<TourReviewItemWidget> createState() => _TourReviewItemWidgetState();
}

class _TourReviewItemWidgetState extends State<TourReviewItemWidget> {
  bool _isExpanded = false;

  String _formatReviewDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return 'Hôm nay';
    } else if (diff.inDays == 1) {
      return 'Hôm qua';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} ngày trước';
    } else {
      return DateFormat('dd/MM/yyyy').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final review = widget.review;
    final dateStr = _formatReviewDate(review.createdAt);
    final isLongComment = review.comment.length > 90;

    return Container(
      width: widget.width ?? (widget.isCard ? 295 : double.infinity),
      margin: widget.isCard
          ? const EdgeInsets.only(right: 14)
          : const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEBEBEB), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Author Header (Avatar & Name + Subtitle) - Chuẩn Ảnh 1
          Row(
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: AppColors.primarySurface,
                backgroundImage: review.author.avatarUrl != null
                    ? CachedNetworkImageProvider(review.author.avatarUrl!)
                    : null,
                child: review.author.avatarUrl == null
                    ? Text(
                        review.author.name.isNotEmpty
                            ? review.author.name[0].toUpperCase()
                            : 'K',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.author.name,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF222222),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 1),
                    const Text(
                      'Thành viên Tripri',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF717171),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // 2. Stars & Date inline: ★★★★★ · Today (Ảnh 3 & Ảnh 1)
          Row(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (index) {
                    final isFilled = index < review.rating;
                    return Padding(
                      padding: const EdgeInsets.only(right: 1.5),
                      child: Icon(
                        Icons.star_rounded,
                        size: 15,
                        color: isFilled
                            ? const Color(0xFF222222)
                            : const Color(0xFFDCDCDC),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                '·',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF222222),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                dateStr,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF222222),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // 3. Comment Content & "Show more" / "Hiển thị thêm" (Ảnh 1)
          Text(
            review.comment,
            maxLines: (widget.isCard && !_isExpanded) ? 3 : null,
            overflow: (widget.isCard && !_isExpanded) ? TextOverflow.ellipsis : null,
            style: const TextStyle(
              fontSize: 13.5,
              color: Color(0xFF222222),
              height: 1.45,
            ),
          ),

          if (isLongComment && widget.isCard && !_isExpanded) ...[
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () {
                setState(() {
                  _isExpanded = true;
                });
              },
              child: const Text(
                'Xem thêm',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF222222),
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],

          // 4. Attached Images (nếu có)
          if (review.images.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: review.images.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final imageUrl = review.images[index];
                  return GestureDetector(
                    onTap: () => _showImageDialog(context, imageUrl),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: imageUrl,
                        width: 56,
                        height: 56,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          width: 56,
                          height: 56,
                          color: const Color(0xFFF0F0F0),
                        ),
                        errorWidget: (_, _, _) => Container(
                          width: 56,
                          height: 56,
                          color: const Color(0xFFF0F0F0),
                          child: const Icon(
                            Icons.broken_image_rounded,
                            size: 18,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showImageDialog(BuildContext context, String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.center,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.contain,
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: CircleAvatar(
                backgroundColor: Colors.black.withValues(alpha: 0.6),
                child: IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
