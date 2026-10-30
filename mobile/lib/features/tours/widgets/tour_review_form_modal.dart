import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/tour_review_bloc.dart';
import '../bloc/tour_review_event.dart';
import '../bloc/tour_review_state.dart';

class TourReviewFormModal extends StatefulWidget {
  final String bookingId;
  final VoidCallback? onSuccess;

  const TourReviewFormModal({
    super.key,
    required this.bookingId,
    this.onSuccess,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String bookingId,
    required TourReviewBloc bloc,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => BlocProvider.value(
        value: bloc,
        child: TourReviewFormModal(
          bookingId: bookingId,
          onSuccess: () => Navigator.of(ctx).pop(true),
        ),
      ),
    );
  }

  @override
  State<TourReviewFormModal> createState() => _TourReviewFormModalState();
}

class _TourReviewFormModalState extends State<TourReviewFormModal> {
  int _selectedRating = 5;
  final TextEditingController _commentController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  static const List<String> _ratingLabels = [
    'Rất thất vọng',
    'Chưa hài lòng',
    'Bình thường',
    'Hài lòng',
    'Tuyệt vời',
  ];

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<TourReviewBloc>().add(
            TourReviewSubmitRequested(
              bookingId: widget.bookingId,
              rating: _selectedRating,
              comment: _commentController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return BlocConsumer<TourReviewBloc, TourReviewState>(
      listener: (context, state) {
        if (state.submitSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Cảm ơn bạn đã gửi đánh giá chuyến đi!'),
              backgroundColor: AppColors.success,
            ),
          );
          widget.onSuccess?.call();
        }
      },
      builder: (context, state) {
        return Container(
          padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Drag Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Đánh giá chuyến đi',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Rating Star Picker (AC3 - AppColors.secondary)
                  Center(
                    child: Column(
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(5, (index) {
                            final star = index + 1;
                            return GestureDetector(
                              onTap: () {
                                setState(() => _selectedRating = star);
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: Icon(
                                  star <= _selectedRating
                                      ? Icons.star_rounded
                                      : Icons.star_outline_rounded,
                                  size: 40,
                                  color: AppColors.secondary,
                                ),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _ratingLabels[_selectedRating - 1],
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.secondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Comment Input Field (min 10 characters)
                  TextFormField(
                    controller: _commentController,
                    maxLines: 4,
                    maxLength: 2000,
                    decoration: InputDecoration(
                      hintText:
                          'Chia sẻ trải nghiệm của bạn về hướng dẫn viên, dịch vụ, điểm tham quan... (tối thiểu 10 ký tự)',
                      hintStyle: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                      fillColor: AppColors.surfaceVariant,
                      filled: true,
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.primary, width: 2),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().length < 10) {
                        return 'Vui lòng viết nhận xét ít nhất 10 ký tự.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  // Submit Error Banner (AC4)
                  if (state.submitError != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.errorSurface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.error),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              state.submitError!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.error,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Submit Button (AppColors.primary)
                  ElevatedButton(
                    onPressed: state.isSubmitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: state.isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Gửi đánh giá',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

