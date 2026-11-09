import 'package:flutter/material.dart';

import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/storage/token_storage.dart';

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
  String? _draftKey;
  bool _dirty = false;
  bool _submitted = false;
  Timer? _saveTimer;
  Future<void> _writes = Future.value();

  @override
  void initState() {
    super.initState();
    _commentController.addListener(_changed);
    _restoreDraft();
  }

  void _changed() {
    _dirty = true;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 300), _persistDraft);
  }

  Future<void> _restoreDraft() async {
    try {
      final owner = (await TokenStorage().getUserInfo())['id'];
      if (!mounted || owner == null || owner.isEmpty) return;
      _draftKey = 'review_draft_v1_${owner}_${widget.bookingId}';
      if (_submitted) {
        _clearDraft();
        return;
      }
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      if (_dirty) {
        _persistDraft();
        return;
      }
      final value = prefs.getString(_draftKey!);
      if (value == null) return;
      final draft = jsonDecode(value) as Map<String, dynamic>;
      final rating = draft['rating'] as int;
      if (rating < 1 || rating > 5) return;
      _commentController.removeListener(_changed);
      setState(() {
        _selectedRating = rating;
        _commentController.text = draft['comment'] as String;
      });
      _commentController.addListener(_changed);
    } catch (_) {
      /* Missing or broken storage must not block writing a review. */
    }
  }

  void _persistDraft() {
    final key = _draftKey;
    if (key == null || _submitted) return;
    final value = jsonEncode({
      'rating': _selectedRating,
      'comment': _commentController.text,
    });
    _writes = _writes
        .then((_) async {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(key, value);
        })
        .catchError((_) {});
  }

  void _clearDraft() {
    _submitted = true;
    _saveTimer?.cancel();
    final key = _draftKey;
    if (key != null) {
      _writes = _writes
          .then((_) async {
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove(key);
          })
          .catchError((_) {});
    }
  }

  static const List<String> _ratingLabels = [
    'Rất thất vọng',
    'Chưa hài lòng',
    'Bình thường',
    'Hài lòng',
    'Tuyệt vời',
  ];

  @override
  void dispose() {
    _saveTimer?.cancel();
    _persistDraft();
    _commentController.removeListener(_changed);
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
          _clearDraft();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Cảm ơn bạn đã gửi đánh giá chuyến đi!'),
              backgroundColor: AppColors.success,
            ),
          );
          widget.onSuccess?.call();
        } else if (state.submitError != null &&
            state.submitError!.contains('đã được đánh giá trước đó')) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Chuyến đi này đã có đánh giá. Trạng thái đã được cập nhật: Đã đánh giá.',
              ),
              backgroundColor: Color(0xFF0F766E),
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
                                _changed();
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
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
                      hintText: 'Chia sẻ trải nghiệm của bạn về hướng dẫn viên, dịch vụ, điểm tham quan... (tối thiểu 10 ký tự)',
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
                        borderSide: const BorderSide(
                          color: AppColors.primary,
                          width: 2,
                        ),
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
                          const Icon(
                            Icons.error_outline_rounded,
                            color: AppColors.error,
                            size: 20,
                          ),
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
