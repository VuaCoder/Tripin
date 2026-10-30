import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Bottom sheet tạo mới một Wishlist (Ảnh 1)
/// Có ô nhập Tên tối đa 50 ký tự, hiển thị 0/50 ký tự, nút Hủy và Tạo
class CreateWishlistSheet extends StatefulWidget {
  final ValueChanged<String> onCreate;

  const CreateWishlistSheet({
    super.key,
    required this.onCreate,
  });

  static Future<String?> show(BuildContext context) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: CreateWishlistSheet(
          onCreate: (name) => Navigator.of(ctx).pop(name),
        ),
      ),
    );
  }

  @override
  State<CreateWishlistSheet> createState() => _CreateWishlistSheetState();
}

class _CreateWishlistSheetState extends State<CreateWishlistSheet> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      setState(() {});
    });
    // Tự động focus sau khi mở modal
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = _controller.text;
    final isEnabled = text.trim().isNotEmpty && text.length <= 50;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Tiêu đề căn giữa
            const Center(
              child: Text(
                'Tạo danh sách yêu thích',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
              ),
            ),
            const SizedBox(height: 28),

            // Ô nhập Tên bo góc
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _focusNode.hasFocus ? AppColors.textPrimary : AppColors.border,
                  width: _focusNode.hasFocus ? 1.5 : 1.0,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                maxLength: 50,
                cursorColor: AppColors.textPrimary,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textPrimary,
                ),
                decoration: const InputDecoration(
                  labelText: 'Tên',
                  labelStyle: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 15,
                  ),
                  floatingLabelStyle: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                  border: InputBorder.none,
                  counterText: '',
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Đếm ký tự: 0/50 ký tự
            Text(
              '${text.length}/50 ký tự',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 32),

            // Hàng nút Hủy & Tạo
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Nút Hủy
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  child: const Text(
                    'Hủy',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),

                // Nút Tạo
                ElevatedButton(
                  onPressed: isEnabled
                      ? () {
                          widget.onCreate(text.trim());
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isEnabled ? AppColors.textPrimary : const Color(0xFFF3F4F6),
                    foregroundColor: isEnabled ? Colors.white : const Color(0xFF9CA3AF),
                    disabledBackgroundColor: const Color(0xFFF3F4F6),
                    disabledForegroundColor: const Color(0xFF9CA3AF),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Tạo',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Home indicator line
            Center(
              child: Container(
                width: 134,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
