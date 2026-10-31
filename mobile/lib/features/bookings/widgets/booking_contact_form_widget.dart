import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

class BookingContactFormWidget extends StatelessWidget {
  final String fullName;
  final String phone;
  final String notes;
  final int participants;
  final int maxParticipants;
  final String? fullNameError;
  final String? phoneError;
  final ValueChanged<String> onFullNameChanged;
  final ValueChanged<String> onPhoneChanged;
  final ValueChanged<String> onNotesChanged;
  final ValueChanged<int> onParticipantsChanged;

  const BookingContactFormWidget({
    super.key,
    required this.fullName,
    required this.phone,
    required this.notes,
    required this.participants,
    required this.maxParticipants,
    this.fullNameError,
    this.phoneError,
    required this.onFullNameChanged,
    required this.onPhoneChanged,
    required this.onNotesChanged,
    required this.onParticipantsChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.person_outline,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Thông tin người liên hệ',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Họ và tên
          _buildTextField(
            label: 'Họ và tên *',
            hint: 'Nguyễn Văn A',
            initialValue: fullName,
            keyboardType: TextInputType.name,
            errorText: fullNameError,
            prefixIcon: Icons.badge_outlined,
            onChanged: onFullNameChanged,
          ),
          const SizedBox(height: 14),

          // Số điện thoại
          _buildTextField(
            label: 'Số điện thoại *',
            hint: '0901234567',
            initialValue: phone,
            keyboardType: TextInputType.phone,
            errorText: phoneError,
            prefixIcon: Icons.phone_outlined,
            onChanged: onPhoneChanged,
          ),
          const SizedBox(height: 16),

          // Bộ chọn số lượng khách (Stepper)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Số lượng khách *',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Còn $maxParticipants chỗ trống',
                    style: TextStyle(
                      fontSize: 12,
                      color: maxParticipants <= 3 ? AppColors.error : AppColors.textSecondary,
                      fontWeight: maxParticipants <= 3 ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                  color: AppColors.surface,
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove, size: 18),
                      color: participants > 1 ? AppColors.textPrimary : AppColors.textMuted,
                      onPressed: participants > 1 ? () => onParticipantsChanged(participants - 1) : null,
                      visualDensity: VisualDensity.compact,
                    ),
                    Container(
                      constraints: const BoxConstraints(minWidth: 32),
                      alignment: Alignment.center,
                      child: Text(
                        '$participants',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add, size: 18),
                      color: participants < maxParticipants ? AppColors.primary : AppColors.textMuted,
                      onPressed: participants < maxParticipants ? () => onParticipantsChanged(participants + 1) : null,
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Ghi chú
          _buildTextField(
            label: 'Ghi chú cho chuyến đi (Tùy chọn)',
            hint: 'Yêu cầu phòng, dị ứng thức ăn hoặc lưu ý đặc biệt...',
            initialValue: notes,
            maxLines: 2,
            prefixIcon: Icons.notes_outlined,
            onChanged: onNotesChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required String hint,
    required String initialValue,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
    String? errorText,
    required IconData prefixIcon,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          initialValue: initialValue,
          keyboardType: keyboardType,
          maxLines: maxLines,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 14, color: AppColors.textMuted),
            prefixIcon: Icon(prefixIcon, size: 18, color: AppColors.textSecondary),
            filled: true,
            fillColor: AppColors.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            errorText: errorText,
            errorStyle: const TextStyle(color: AppColors.error, fontSize: 12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: errorText != null ? AppColors.error : AppColors.border,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: errorText != null ? AppColors.error : AppColors.primary,
                width: 1.5,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
