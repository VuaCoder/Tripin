import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../payments/screens/payment_screen.dart';
import '../bloc/bookings_list_cubit.dart';
import '../bloc/bookings_repository.dart';
import '../models/booking_models.dart';
import '../widgets/booking_card.dart';
import 'cancel_booking_screen.dart';
import 'e_ticket_screen.dart';

/// Tab "Đơn đặt": 4 tab theo trạng thái, mỗi tab phân trang từ `GET /bookings/me`.
class MyBookingsScreen extends StatefulWidget {
  final BookingsRepository? repository;
  const MyBookingsScreen({super.key, this.repository});

  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> with SingleTickerProviderStateMixin {
  late final BookingsRepository _repo = widget.repository ?? BookingsRepository();
  late final TabController _tabs = TabController(length: BookingStatus.values.length, vsync: this);
  late final List<BookingsListCubit> _cubits = [
    for (final s in BookingStatus.values) BookingsListCubit(status: s, repository: _repo)..refresh(),
  ];

  @override
  void dispose() {
    _tabs.dispose();
    for (final c in _cubits) {
      c.close();
    }
    super.dispose();
  }

  void _refreshAll() {
    for (final c in _cubits) {
      c.refresh();
    }
  }

  Future<void> _open(BookingItem b) async {
    switch (b.status) {
      case BookingStatus.confirmed || BookingStatus.completed || BookingStatus.cancelled:
        // Đơn đã hủy vẫn mở vé để người dùng thấy vé đã bị vô hiệu hóa.
        final cancelled = await Navigator.of(context).push<bool>(
          MaterialPageRoute(builder: (_) => ETicketScreen(booking: b, repository: _repo)),
        );
        _afterChange(cancelled);
      case BookingStatus.pending:
        await _pay(b);
    }
  }

  Future<void> _pay(BookingItem b) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PaymentScreen(bookingId: b.id)));
    _refreshAll();
  }

  Future<void> _cancel(BookingItem b) async {
    final cancelled = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CancelBookingScreen(booking: b, repository: _repo)),
    );
    _afterChange(cancelled);
  }

  /// Sau khi hủy thành công: làm mới và chuyển sang tab "Đã hủy" (AC5).
  void _afterChange(bool? cancelled) {
    _refreshAll();
    if (cancelled == true) _tabs.animateTo(BookingStatus.cancelled.index);
  }

  bool _canCancel(BookingItem b) =>
      (b.status == BookingStatus.pending || b.status == BookingStatus.confirmed) && b.departureDate.isAfter(DateTime.now());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn đặt', style: TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [for (final s in BookingStatus.values) Tab(text: s.label)],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          for (var i = 0; i < _cubits.length; i++)
            BlocProvider.value(
              value: _cubits[i],
              child: _BookingsTab(onOpen: _open, onPay: _pay, onCancel: _cancel, canCancel: _canCancel),
            ),
        ],
      ),
    );
  }
}

class _BookingsTab extends StatelessWidget {
  final void Function(BookingItem) onOpen;
  final void Function(BookingItem) onPay;
  final void Function(BookingItem) onCancel;
  final bool Function(BookingItem) canCancel;

  const _BookingsTab({required this.onOpen, required this.onPay, required this.onCancel, required this.canCancel});

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<BookingsListCubit>();
    return BlocBuilder<BookingsListCubit, BookingsListState>(
      builder: (context, state) {
        if (state.loading) return const Center(child: CircularProgressIndicator());
        if (state.items.isEmpty) {
          return _Message(
            text: state.error ?? 'Chưa có đơn nào ở trạng thái "${cubit.status.label}".',
            isError: state.error != null,
            onRetry: cubit.refresh,
          );
        }
        return RefreshIndicator(
          onRefresh: cubit.refresh,
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.extentAfter < 300) cubit.loadMore();
              return false;
            },
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: state.items.length + 1,
              itemBuilder: (context, i) {
                if (i == state.items.length) {
                  if (state.loadingMore) {
                    return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
                  }
                  if (state.error != null) {
                    return TextButton(onPressed: cubit.loadMore, child: Text('${state.error} Bấm để thử lại'));
                  }
                  return const SizedBox.shrink();
                }
                final b = state.items[i];
                return BookingCard(
                  booking: b,
                  onTap: () => onOpen(b),
                  onPay: b.status == BookingStatus.pending ? () => onPay(b) : null,
                  onCancel: canCancel(b) ? () => onCancel(b) : null,
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  final bool isError;
  final VoidCallback onRetry;
  const _Message({required this.text, required this.isError, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isError ? Icons.wifi_off_rounded : Icons.inbox_outlined, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Tải lại')),
          ],
        ),
      ),
    );
  }
}
