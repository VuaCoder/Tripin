import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../api/guide_check_in_api.dart';
import '../cubit/guide_check_in_cubit.dart';
import '../models/guide_models.dart';
import '../widgets/manual_code_dialog.dart';
import '../widgets/roster_tile.dart';
import 'qr_check_in_screen.dart';

class GuideTourDetailScreen extends StatelessWidget {
  const GuideTourDetailScreen({super.key, required this.tour, this.api});

  final GuideAssignedTour tour;

  /// Injected in tests; production uses the real Dio client.
  final GuideCheckInApi? api;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GuideCheckInCubit(api ?? DioGuideCheckInApi(), tour.id)..loadRoster(),
      child: _GuideTourDetailView(tour: tour),
    );
  }
}

class _GuideTourDetailView extends StatelessWidget {
  const _GuideTourDetailView({required this.tour});

  final GuideAssignedTour tour;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Điểm danh đoàn')),
      body: BlocBuilder<GuideCheckInCubit, GuideCheckInState>(
        builder: (context, state) {
          if (state.loading && state.roster == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.error != null && state.roster == null) {
            return _ErrorState(
              message: state.error!,
              onRetry: () => context.read<GuideCheckInCubit>().loadRoster(),
            );
          }

          final roster = state.roster;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _TourHeader(tour: tour, roster: roster),
              const SizedBox(height: 16),
              _ProgressCard(roster: roster),
              if (roster?.allCheckedIn ?? false) ...[
                const SizedBox(height: 12),
                const _AllCheckedInBanner(),
              ],
              const SizedBox(height: 16),
              _RosterSection(roster: roster),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: state.submitting ? null : () => _openScanner(context),
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Quét QR Điểm Danh'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: state.submitting
                    ? null
                    : () => runManualCheckIn(context, context.read<GuideCheckInCubit>()),
                icon: const Icon(Icons.keyboard_outlined),
                label: const Text('Điểm danh thủ công'),
              ),
              const SizedBox(height: 20),
              _TripActions(state: state, roster: roster),
            ],
          );
        },
      ),
    );
  }

  void _openScanner(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<GuideCheckInCubit>(),
          child: QrCheckInScreen(tour: tour),
        ),
      ),
    );
  }
}

class _TourHeader extends StatelessWidget {
  const _TourHeader({required this.tour, required this.roster});

  final GuideAssignedTour tour;
  final GuideRoster? roster;

  @override
  Widget build(BuildContext context) {
    final departure = tour.nextDepartureDate;
    final totalGuests = roster?.items.fold<int>(0, (sum, item) => sum + item.participants) ?? 0;
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
        if (totalGuests > 0) ...[
          const SizedBox(height: 6),
          Text(
            'Đoàn: $totalGuests khách',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
        ],
        if (departure != null) ...[
          const SizedBox(height: 6),
          Text(
            'Khởi hành ${DateFormat('dd/MM/yyyy').format(departure)}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ],
      ],
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.roster});

  final GuideRoster? roster;

  @override
  Widget build(BuildContext context) {
    final total = roster?.total ?? 0;
    final checkedIn = roster?.checkedIn ?? 0;
    final value = total == 0 ? 0.0 : checkedIn / total;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tiến độ điểm danh', style: TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  '$checkedIn/$total vé',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: value,
                minHeight: 8,
                backgroundColor: AppColors.surfaceVariant,
                valueColor: const AlwaysStoppedAnimation<Color>(AppColors.success),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              total == 0 ? 'Tour chưa có vé nào.' : 'Đã điểm danh $checkedIn trên $total vé.',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _AllCheckedInBanner extends StatelessWidget {
  const _AllCheckedInBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success),
      ),
      child: const Row(
        children: [
          Icon(Icons.verified, color: AppColors.success),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Đã điểm danh đủ đoàn',
              style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.success),
            ),
          ),
        ],
      ),
    );
  }
}

class _RosterSection extends StatelessWidget {
  const _RosterSection({required this.roster});

  final GuideRoster? roster;

  @override
  Widget build(BuildContext context) {
    final items = roster?.items ?? const <GuideRosterItem>[];
    if (items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Text('Chưa có vé nào trong tour này.', style: TextStyle(color: AppColors.textSecondary)),
      );
    }
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            RosterTile(item: items[index]),
            if (index != items.length - 1) const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _TripActions extends StatelessWidget {
  const _TripActions({required this.state, required this.roster});

  final GuideCheckInState state;
  final GuideRoster? roster;

  @override
  Widget build(BuildContext context) {
    if (state.tripStarted) {
      return ElevatedButton.icon(
        onPressed: () => _finishTrip(context),
        icon: const Icon(Icons.flag_outlined),
        label: const Text('Hoàn thành chuyến đi'),
      );
    }

    final remaining = (roster?.total ?? 0) - (roster?.checkedIn ?? 0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          onPressed: state.allCheckedIn ? () => _startTrip(context) : null,
          icon: const Icon(Icons.play_arrow),
          label: const Text('Bắt đầu chuyến đi'),
        ),
        if (!state.allCheckedIn && roster != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              remaining > 0 ? 'Còn $remaining vé chưa điểm danh.' : 'Chưa có vé để bắt đầu.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ),
      ],
    );
  }

  Future<void> _startTrip(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bắt đầu chuyến đi?'),
        content: const Text('Toàn bộ vé đã được điểm danh. Bắt đầu chuyến đi ngay bây giờ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Bắt đầu')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      // shortcut: local UI state only; persist it when the backend exposes a trip state.
      context.read<GuideCheckInCubit>().startTrip();
    }
  }

  Future<void> _finishTrip(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hoàn thành chuyến đi?'),
        content: const Text('Xác nhận chuyến đi đã kết thúc.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Hoàn thành')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    // shortcut: local UI state only; the backend has no trip-state field yet.
    context.read<GuideCheckInCubit>().finishTrip();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Đã hoàn thành chuyến đi'),
        content: Text('Đoàn ${roster?.total ?? 0} vé đã điểm danh đủ.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Đóng')),
        ],
      ),
    );
    if (context.mounted) Navigator.of(context).pop();
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
            ElevatedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}
