import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../api/guide_check_in_api.dart';
import '../cubit/guide_tours_cubit.dart';
import '../models/guide_models.dart';
import 'guide_tour_detail_screen.dart';

class GuideToursScreen extends StatelessWidget {
  const GuideToursScreen({super.key, this.api});

  /// Injected in tests; production uses the real Dio client.
  final GuideCheckInApi? api;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GuideToursCubit(api ?? DioGuideCheckInApi())..load(),
      child: const _GuideToursView(),
    );
  }
}

class _GuideToursView extends StatelessWidget {
  const _GuideToursView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tour đang dẫn')),
      body: BlocBuilder<GuideToursCubit, GuideToursState>(
        builder: (context, state) {
          if (state.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.error != null) {
            return _ErrorState(
              message: state.error!,
              onRetry: () => context.read<GuideToursCubit>().load(),
            );
          }
          if (state.tours.isEmpty) {
            return const _EmptyState();
          }
          return RefreshIndicator(
            onRefresh: () => context.read<GuideToursCubit>().load(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: state.tours.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final tour = state.tours[index];
                return _TourCard(tour: tour);
              },
            ),
          );
        },
      ),
    );
  }
}

class _TourCard extends StatelessWidget {
  const _TourCard({required this.tour});

  final GuideAssignedTour tour;

  @override
  Widget build(BuildContext context) {
    final departure = tour.nextDepartureDate;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => GuideTourDetailScreen(tour: tour)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      tour.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppColors.textMuted),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${tour.destination} · ${tour.durationDays} ngày',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.event_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    departure == null
                        ? 'Chưa có ngày khởi hành'
                        : 'Khởi hành ${DateFormat('dd/MM/yyyy').format(departure)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.map_outlined, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'Chưa có tour đang dẫn',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Tour cần được đại lý phân công và bạn đã chấp nhận.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 56, color: AppColors.error),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}
