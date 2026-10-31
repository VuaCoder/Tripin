import 'package:flutter/material.dart';

/// Widget hiển thị hàng 5 ngôi sao chuẩn đẹp mắt (Ảnh 3)
/// Hỗ trợ tô màu chính xác theo tỷ lệ điểm trung bình thập phân (fractional star)
class PreciseRatingStars extends StatelessWidget {
  final double rating;
  final double size;
  final double spacing;
  final Color filledColor;
  final Color unfilledColor;

  const PreciseRatingStars({
    super.key,
    required this.rating,
    this.size = 17,
    this.spacing = 2,
    this.filledColor = const Color(0xFF222222),
    this.unfilledColor = const Color(0xFFDCDCDC),
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starValue = index + 1;
        double fill = 0.0;
        if (rating >= starValue) {
          fill = 1.0;
        } else if (rating > index) {
          fill = (rating - index).clamp(0.0, 1.0);
        }

        return Padding(
          padding: EdgeInsets.only(right: index < 4 ? spacing : 0),
          child: FractionalStar(
            fill: fill,
            size: size,
            filledColor: filledColor,
            unfilledColor: unfilledColor,
          ),
        );
      }),
    );
  }
}

class FractionalStar extends StatelessWidget {
  final double fill; // 0.0 to 1.0
  final double size;
  final Color filledColor;
  final Color unfilledColor;

  const FractionalStar({
    super.key,
    required this.fill,
    required this.size,
    this.filledColor = const Color(0xFF222222),
    this.unfilledColor = const Color(0xFFDCDCDC),
  });

  @override
  Widget build(BuildContext context) {
    if (fill <= 0) {
      return Icon(Icons.star_rounded, size: size, color: unfilledColor);
    }
    if (fill >= 1) {
      return Icon(Icons.star_rounded, size: size, color: filledColor);
    }

    return Stack(
      children: [
        Icon(Icons.star_rounded, size: size, color: unfilledColor),
        ClipRect(
          clipper: _StarClipper(fill),
          child: Icon(Icons.star_rounded, size: size, color: filledColor),
        ),
      ],
    );
  }
}

class _StarClipper extends CustomClipper<Rect> {
  final double fraction;
  const _StarClipper(this.fraction);

  @override
  Rect getClip(Size size) {
    return Rect.fromLTWH(0, 0, size.width * fraction, size.height);
  }

  @override
  bool shouldReclip(_StarClipper oldClipper) => oldClipper.fraction != fraction;
}
