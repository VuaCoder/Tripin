import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

class BookingContactFormWidget extends StatelessWidget {
  final String fullName;
  final String phone;
  final String email;
  final String notes;
  final int adults;
  final int children;
  final int infants;
  final int maxParticipants;
  final String? fullNameError;
  final String? phoneError;
  final String? emailError;
  final ValueChanged<String> onFullNameChanged;
  final ValueChanged<String> onPhoneChanged;
  final ValueChanged<String> onEmailChanged;
  final ValueChanged<String> onNotesChanged;
  final ValueChanged<int> onAdultsChanged;
  final ValueChanged<int> onChildrenChanged;
  final ValueChanged<int> onInfantsChanged;

  const BookingContactFormWidget({
    super.key,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.notes,
    required this.adults,
    this.children = 0,
    this.infants = 0,
    required this.maxParticipants,
    this.fullNameError,
    this.phoneError,
    this.emailError,
    required this.onFullNameChanged,
    required this.onPhoneChanged,
    required this.onEmailChanged,
    required this.onNotesChanged,
    required this.onAdultsChanged,
    required this.onChildrenChanged,
    required this.onInfantsChanged,
  });

  int get totalGuests => adults + children + infants;

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
          const SizedBox(height: 14),

          // [FLOW-09 AC5] Email bắt buộc nhận vé điện tử
          _buildTextField(
            label: 'Địa chỉ Email *',
            hint: 'traveler@example.com',
            initialValue: email,
            keyboardType: TextInputType.emailAddress,
            errorText: emailError,
            prefixIcon: Icons.email_outlined,
            onChanged: onEmailChanged,
          ),
          const SizedBox(height: 18),

          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 16),

          // [FLOW-09 AC2] Phân loại hành khách 3 nhóm: Người lớn, Trẻ em, Em bé
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Hành khách tham gia *',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                'Còn $maxParticipants chỗ',
                style: TextStyle(
                  fontSize: 12,
                  color: maxParticipants <= 3 ? AppColors.error : AppColors.textSecondary,
                  fontWeight: maxParticipants <= 3 ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 1. Người lớn (>= 12 tuổi)
          _buildGuestRow(
            title: 'Người lớn',
            subtitle: 'Từ 12 tuổi trở lên',
            count: adults,
            minCount: 1,
            canAdd: totalGuests < maxParticipants,
            onChanged: onAdultsChanged,
          ),
          const SizedBox(height: 10),

          // 2. Trẻ em (2 - 11 tuổi)
          _buildGuestRow(
            title: 'Trẻ em',
            subtitle: 'Từ 2 đến dưới 12 tuổi (70% giá)',
            count: children,
            minCount: 0,
            canAdd: totalGuests < maxParticipants,
            onChanged: onChildrenChanged,
          ),
          const SizedBox(height: 10),

          // 3. Em bé (< 2 tuổi)
          _buildGuestRow(
            title: 'Em bé',
            subtitle: 'Dưới 2 tuổi (Miễn phí)',
            count: infants,
            minCount: 0,
            canAdd: totalGuests < maxParticipants,
            onChanged: onInfantsChanged,
          ),
          const SizedBox(height: 16),

          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 16),

          // Ghi chú
          _buildTextField(
            label: 'Ghi chú cho đoàn (Tùy chọn)',
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

  Widget _buildGuestRow({
    required String title,
    required String subtitle,
    required int count,
    required int minCount,
    required bool canAdd,
    required ValueChanged<int> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.remove, size: 18),
                color: count > minCount ? AppColors.textPrimary : AppColors.textMuted,
                onPressed: count > minCount ? () => onChanged(count - 1) : null,
                visualDensity: VisualDensity.compact,
              ),
              Container(
                constraints: const BoxConstraints(minWidth: 28),
                alignment: Alignment.center,
                child: Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add, size: 18),
                color: canAdd ? AppColors.primary : AppColors.textMuted,
                onPressed: canAdd ? () => onChanged(count + 1) : null,
                visualDensity: VisualDensity.compact,
              ),
            ],
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
