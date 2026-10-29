import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../api/guide_check_in_api.dart';
import '../cubit/guide_tours_cubit.dart';
import '../models/guide_models.dart';
import '../utils/guide_format.dart';
import 'guide_assignment_detail_screen.dart';
import 'guide_tour_detail_screen.dart';

class GuideToursScreen extends StatefulWidget {
  const GuideToursScreen({super.key, this.api});

  /// Injected in tests; production uses the real Dio client.
  final GuideCheckInApi? api;

  @override
  State<GuideToursScreen> createState() => _GuideToursScreenState();
}

class _GuideToursScreenState extends State<GuideToursScreen> {
  late final GuideCheckInApi _api = widget.api ?? DioGuideCheckInApi();

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GuideToursCubit(_api)..load(),
      child: _GuideToursView(api: _api),
    );
  }
}

class _GuideToursView extends StatelessWidget {
  const _GuideToursView({required this.api});

  final GuideCheckInApi api;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: BlocBuilder<GuideToursCubit, GuideToursState>(
        builder: (context, state) {
          final pending = state.pendingTours;
          final upcoming = state.upcomingTours;
          return Scaffold(
            appBar: AppBar(
              title: const Text('Lịch Tour'),
              bottom: TabBar(
                tabs: [
                  Tab(text: 'Chờ xác nhận (${pending.length})'),
                  Tab(text: 'Lịch sắp tới (${upcoming.length})'),
                ],
              ),
            ),
            body: _body(context, state, pending, upcoming),
          );
        },
      ),
    );
  }

  Widget _body(
    BuildContext context,
    GuideToursState state,
    List<GuideAssignedTour> pending,
    List<GuideAssignedTour> upcoming,
  ) {
    if (state.loading && state.tours.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null) {
      return _ErrorState(
        message: state.error!,
        onRetry: () => context.read<GuideToursCubit>().load(),
      );
    }
    return TabBarView(
      children: [
        _TourList(
          tours: pending,
          emptyIcon: Icons.mark_email_unread_outlined,
          emptyTitle: 'Không có yêu cầu phân công mới',
          emptyDescription: 'Khi đại lý phân công bạn phụ trách một tour, yêu cầu sẽ xuất hiện tại đây.',
          onOpen: (tour) => _openAssignment(context, tour),
        ),
        _TourList(
          tours: upcoming,
          emptyIcon: Icons.map_outlined,
          emptyTitle: 'Chưa có tour sắp tới',
          emptyDescription:
              'Tour bạn đã nhận sẽ xuất hiện tại đây kèm danh sách đoàn.',
          onOpen: (tour) => _openTour(context, tour),
        ),
      ],
    );
  }

  Future<void> _openAssignment(
    BuildContext context,
    GuideAssignedTour tour,
  ) async {
    final cubit = context.read<GuideToursCubit>();
    final accepted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: cubit,
          child: GuideAssignmentDetailScreen(tour: tour, api: api),
        ),
      ),
    );
    if (!context.mounted || accepted == null) return;
    if (accepted) {
      DefaultTabController.of(context).animateTo(1);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã nhận tour. Tour đã chuyển sang Lịch sắp tới.'),
        ),
      );
    } else {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Đã từ chối tour.')));
    }
  }

  void _openTour(BuildContext context, GuideAssignedTour tour) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GuideTourDetailScreen(tour: tour, api: api),
      ),
    );
  }
}

class _TourList extends StatelessWidget {
  const _TourList({
    required this.tours,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptyDescription,
    required this.onOpen,
  });

  final List<GuideAssignedTour> tours;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptyDescription;
  final ValueChanged<GuideAssignedTour> onOpen;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => context.read<GuideToursCubit>().load(),
      child: tours.isEmpty
          ? LayoutBuilder(
              builder: (context, constraints) => ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: constraints.maxHeight,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: _EmptyState(
                          icon: emptyIcon,
                          title: emptyTitle,
                          description: emptyDescription,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: tours.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final tour = tours[index];
                return _TourCard(tour: tour, onTap: () => onOpen(tour));
              },
            ),
    );
  }
}

class _TourCard extends StatelessWidget {
  const _TourCard({required this.tour, required this.onTap});

  final GuideAssignedTour tour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final departure = tour.nextDepartureDate;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
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
                '${tour.destination} · ${tour.durationDays} ngày'
                '${tour.agencyName == null ? '' : ' · ${tour.agencyName}'}',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(
                    Icons.event_outlined,
                    size: 16,
                    color: AppColors.primary,
                  ),
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
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Icons.payments_outlined,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Thù lao: ${formatVnd(tour.feePerBooking)}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
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
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 56, color: AppColors.textMuted),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          description,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textSecondary, height: 1.4),
        ),
      ],
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
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
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
