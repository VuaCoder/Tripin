import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

/// Nút quay lại chuẩn phong cách Airbnb với nền tròn màu xám nhẹ (Color(0xFFF1F5F9))
class AppBackButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Color? color;
  final double size;

  const AppBackButton({
    super.key,
    this.onPressed,
    this.color,
    this.size = 38,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        key: const Key('app-back-button'),
        onTap: onPressed ?? () => Navigator.of(context).maybePop(),
        child: Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(
            color: Color(0xFFF1F5F9),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.arrow_back_rounded,
            size: 20,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}
