import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

enum PasswordStrength { none, weak, medium, strong }

/// Widget hiển thị thanh đo độ mạnh mật khẩu (AC1)
class PasswordStrengthBar extends StatelessWidget {
  final String password;

  const PasswordStrengthBar({super.key, required this.password});

  PasswordStrength get strength {
    if (password.isEmpty) return PasswordStrength.none;
    if (password.length < 8) return PasswordStrength.weak;

    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(password);
    final hasDigit = RegExp(r'\d').hasMatch(password);
    final hasSpecial = RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password);

    if (hasLetter && hasDigit && hasSpecial && password.length >= 10) {
      return PasswordStrength.strong;
    }
    if (hasLetter && hasDigit) {
      return PasswordStrength.medium;
    }
    return PasswordStrength.weak;
  }

  Color get barColor {
    switch (strength) {
      case PasswordStrength.none:
        return AppColors.border;
      case PasswordStrength.weak:
        return AppColors.error;
      case PasswordStrength.medium:
        return AppColors.warning;
      case PasswordStrength.strong:
        return AppColors.success;
    }
  }

  String get labelText {
    switch (strength) {
      case PasswordStrength.none:
        return '';
      case PasswordStrength.weak:
        return 'Mật khẩu yếu (cần tối thiểu 8 ký tự, gồm chữ và số)';
      case PasswordStrength.medium:
        return 'Mật khẩu trung bình';
      case PasswordStrength.strong:
        return 'Mật khẩu rất mạnh và an toàn';
    }
  }

  int get activeSegments {
    switch (strength) {
      case PasswordStrength.none:
        return 0;
      case PasswordStrength.weak:
        return 1;
      case PasswordStrength.medium:
        return 2;
      case PasswordStrength.strong:
        return 3;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 6),
        Row(
          children: List.generate(3, (index) {
            final isActive = index < activeSegments;
            return Expanded(
              child: Container(
                height: 4,
                margin: EdgeInsets.only(right: index < 2 ? 6 : 0),
                decoration: BoxDecoration(
                  color: isActive ? barColor : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 4),
        Text(
          labelText,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: barColor,
          ),
        ),
      ],
    );
  }
}
