import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../api/guide_check_in_api.dart';
import '../cubit/guide_tours_cubit.dart';
import '../models/guide_models.dart';
import '../utils/guide_format.dart';
import '../widgets/answer_assignment_dialog.dart';

class GuideAssignmentDetailScreen extends StatefulWidget {
  const GuideAssignmentDetailScreen({
    super.key,
    required this.tour,
    required this.api,
  });

  final GuideAssignedTour tour;
  final GuideCheckInApi api;

  @override
  State<GuideAssignmentDetailScreen> createState() =>
      _GuideAssignmentDetailScreenState();
}

class _GuideAssignmentDetailScreenState
    extends State<GuideAssignmentDetailScreen> {
  late final Future<GuideTourPublicDetail?> _detail;

  @override
  void initState() {
    super.initState();
    _detail = _loadDetail();
  }

  Future<GuideTourPublicDetail?> _loadDetail() async {
    try {
      return await widget.api.fetchTourDetail(widget.tour.id);
    } catch (_) {
      return null;
    }
  }

  Future<void> _answer(bool accept) async {
    final note = await showAnswerAssignmentDialog(
      context,
      tour: widget.tour,
      accept: accept,
    );
    if (note == null || !mounted) return;

    final outcome = await context.read<GuideToursCubit>().answer(
      tourId: widget.tour.id,
      accept: accept,
      note: note,
    );
    if (!mounted || outcome == null) return;

    if (outcome is GuideAnswerSuccess) {
      Navigator.of(context).pop(accept);
    } else if (outcome is GuideAnswerFailure) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(outcome.message),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết phân công')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Header(tour: widget.tour),
          const SizedBox(height: 16),
          _Facts(tour: widget.tour, detail: _detail),
          const SizedBox(height: 16),
          FutureBuilder<GuideTourPublicDetail?>(
            future: _detail,
            builder: (context, snapshot) {
              final description = snapshot.data?.description;
              if (description == null || description.isEmpty) {
                return const SizedBox.shrink();
              }
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Giới thiệu',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        style: const TextStyle(
                          height: 1.4,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
      bottomNavigationBar: BlocBuilder<GuideToursCubit, GuideToursState>(
        builder: (context, state) {
          return SafeArea(
            minimum: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: state.answering ? null : () => _answer(false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(
                        color: AppColors.error,
                        width: 1.5,
                      ),
                    ),
                    child: const Text('Từ chối'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: state.answering ? null : () => _answer(true),
                    child: state.answering
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Chấp nhận'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.tour});

  final GuideAssignedTour tour;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tour.title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${tour.destination} · ${tour.durationDays} ngày'
          '${tour.agencyName == null ? '' : ' · ${tour.agencyName}'}',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.secondaryLight,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text(
            'Chờ xác nhận',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.warning,
            ),
          ),
        ),
      ],
    );
  }
}

class _Facts extends StatelessWidget {
  const _Facts({required this.tour, required this.detail});

  final GuideAssignedTour tour;
  final Future<GuideTourPublicDetail?> detail;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<GuideTourPublicDetail?>(
      future: detail,
      builder: (context, snapshot) {
        final publicDetail = snapshot.data;
        final booked = publicDetail?.bookedSeatsFor(tour.nextDepartureDate);
        final maxGroupSize = publicDetail?.maxGroupSize;
        final departure = tour.nextDepartureDate;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _FactRow(
                  label: 'Khởi hành',
                  value: departure == null
                      ? 'Chưa có lịch'
                      : DateFormat('dd/MM/yyyy').format(departure),
                ),
                const Divider(height: 20),
                _FactRow(
                  label: 'Thù lao/chuyến',
                  value: formatVnd(tour.feePerBooking),
                ),
                const Divider(height: 20),
                _FactRow(
                  label: 'Đoàn khách',
                  value: booked == null
                      ? 'Chưa có dữ liệu'
                      : '$booked khách đã đặt',
                ),
                if (maxGroupSize != null) ...[
                  const Divider(height: 20),
                  _FactRow(
                    label: 'Quy mô tối đa',
                    value: '$maxGroupSize khách',
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FactRow extends StatelessWidget {
  const _FactRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary),
          ),
        ),
        const SizedBox(width: 12),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    );
  }
}
