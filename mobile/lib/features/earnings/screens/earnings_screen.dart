import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/constants/app_colors.dart';
import '../api/earnings_api.dart';
import '../cubit/earnings_cubit.dart';
import '../models/earnings_models.dart';
import '../utils/earnings_format.dart';
import '../widgets/bank_account_sheet.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key, this.api});

  /// Injected in tests; production uses the real Dio client.
  final EarningsApi? api;

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> with AutomaticKeepAliveClientMixin {
  late final EarningsApi _api = widget.api ?? DioEarningsApi();

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return BlocProvider(
      create: (_) => EarningsCubit(_api)..load(),
      child: const _EarningsView(),
    );
  }
}

class _EarningsView extends StatelessWidget {
  const _EarningsView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<EarningsCubit, EarningsState>(
      builder: (context, state) {
        final busy = state.listLoading || state.summaryLoading;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Thu nhập'),
            actions: [
              IconButton(
                onPressed: busy ? null : () => context.read<EarningsCubit>().refresh(),
                icon: const Icon(Icons.refresh),
                tooltip: 'Làm mới',
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () => context.read<EarningsCubit>().refresh(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (state.listLoading && state.items.isNotEmpty) ...[
                  const LinearProgressIndicator(minHeight: 2, color: AppColors.primary),
                  const SizedBox(height: 8),
                ],
                _SummaryCard(state: state),
                const SizedBox(height: 16),
                _FilterChips(state: state),
                if (state.summary != null && state.summary!.byMonth.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _EarningsChart(summary: state.summary!),
                ],
                const SizedBox(height: 16),
                _HistorySection(state: state),
                const SizedBox(height: 16),
                _BankSection(state: state),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.state});

  final EarningsState state;

  @override
  Widget build(BuildContext context) {
    final summary = state.summary;
    final Widget child;
    if (state.summaryError != null) {
      child = _InlineError(
        message: state.summaryError!,
        onRetry: () => context.read<EarningsCubit>().retrySummary(),
      );
    } else if (state.summaryLoading && summary == null) {
      child = const SizedBox(height: 150, child: Center(child: CircularProgressIndicator()));
    } else if (summary == null) {
      child = const SizedBox(height: 150);
    } else {
      child = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(color: AppColors.primarySurface, shape: BoxShape.circle),
                child: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Tổng quan thù lao',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Tổng thù lao ${_periodLabel(state.filter)}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(
            formatVnd(summary.totalAmount),
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _Metric(label: 'Tour đã hoàn thành', value: '${summary.count}'),
              ),
              Container(width: 1, height: 34, color: AppColors.border),
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.only(left: 16),
                  child: _Metric(label: 'Chờ quyết toán', value: 'Chưa theo dõi'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.borderLight),
          const SizedBox(height: 10),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, size: 14, color: AppColors.textMuted),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Thù lao được ghi nhận từ booking hoàn tất; hệ thống chưa theo dõi trạng thái chi trả.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.textMuted, height: 1.35),
                ),
              ),
            ],
          ),
        ],
      );
    }
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration,
      child: child,
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
      ],
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.state});

  final EarningsState state;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: EarningsFilter.values.map((filter) {
        final selected = filter == state.filter;
        return ChoiceChip(
          label: Text(filter.label),
          selected: selected,
          showCheckmark: false,
          onSelected: (_) => context.read<EarningsCubit>().selectFilter(filter),
          backgroundColor: AppColors.surface,
          selectedColor: AppColors.primarySurface,
          side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          labelStyle: TextStyle(
            fontSize: 13,
            color: selected ? AppColors.primaryDark : AppColors.textSecondary,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        );
      }).toList(),
    );
  }
}

class _EarningsChart extends StatefulWidget {
  const _EarningsChart({required this.summary});

  final EarningsSummary summary;

  @override
  State<_EarningsChart> createState() => _EarningsChartState();
}

class _EarningsChartState extends State<_EarningsChart> {
  /// Brand colours, cycled when there are more slices than colours.
  static const _sliceColors = [
    AppColors.primary,
    AppColors.secondary,
    AppColors.info,
    AppColors.success,
    AppColors.primaryLight,
    AppColors.warning,
  ];

  bool _quarterly = false;

  @override
  Widget build(BuildContext context) {
    final periods = earningsPeriods(widget.summary.byMonth, quarterly: _quarterly);
    if (periods.isEmpty) return const SizedBox.shrink();
    final total = periods.fold<int>(0, (sum, p) => sum + p.totalAmount);
    final colors = [for (var i = 0; i < periods.length; i++) _sliceColors[i % _sliceColors.length]];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Thu nhập theo thời gian',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
              ),
              _ChartModeChip(
                label: 'Tháng',
                selected: !_quarterly,
                onTap: () => setState(() => _quarterly = false),
              ),
              const SizedBox(width: 6),
              _ChartModeChip(
                label: 'Quý',
                selected: _quarterly,
                onTap: () => setState(() => _quarterly = true),
              ),
            ],
          ),
          const SizedBox(height: 2),
          const Text(
            'Nhóm theo tháng UTC của hệ thống.',
            style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          Center(
            child: Semantics(
              label: 'Biểu đồ tròn thu nhập theo thời gian',
              child: SizedBox(
                width: 148,
                height: 148,
                child: CustomPaint(
                  painter: _PiePainter(values: [for (final p in periods) p.totalAmount], colors: colors),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < periods.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _PieLegend(period: periods[i], color: colors[i], total: total),
          ],
        ],
      ),
    );
  }
}

class _PiePainter extends CustomPainter {
  _PiePainter({required this.values, required this.colors});

  final List<int> values;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<int>(0, (sum, value) => sum + value);
    final rect = Offset.zero & size;
    final paint = Paint()..style = PaintingStyle.fill;
    final gap = values.length > 1 ? 0.02 : 0.0;
    var start = -math.pi / 2;
    for (var i = 0; i < values.length; i++) {
      final sweep = total == 0 ? 0.0 : 2 * math.pi * values[i] / total;
      if (sweep <= 0) continue;
      paint.color = colors[i];
      canvas.drawArc(rect, start, math.max(sweep - gap, 0.004), true, paint);
      start += sweep;
    }
    canvas.drawCircle(size.center(Offset.zero), size.shortestSide * 0.29, Paint()..color = AppColors.surface);
  }

  /// Cheap to redraw, and every parent rebuild carries new slices.
  @override
  bool shouldRepaint(_PiePainter oldDelegate) => true;
}

class _PieLegend extends StatelessWidget {
  const _PieLegend({required this.period, required this.color, required this.total});

  final EarningsPeriod period;
  final Color color;
  final int total;

  @override
  Widget build(BuildContext context) {
    final percent = total == 0 ? '0%' : '${(period.totalAmount * 100 / total).round()}%';
    return Row(
      children: [
        Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(
          period.label,
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(width: 6),
        Text(percent, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        const Spacer(),
        Text(
          formatVnd(period.totalAmount),
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
        ),
      ],
    );
  }
}

class _ChartModeChip extends StatelessWidget {
  const _ChartModeChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      onSelected: (_) => onTap(),
      visualDensity: VisualDensity.compact,
      backgroundColor: AppColors.surface,
      selectedColor: AppColors.primarySurface,
      side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      labelStyle: TextStyle(
        fontSize: 11.5,
        color: selected ? AppColors.primaryDark : AppColors.textSecondary,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
    );
  }
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({required this.state});

  final EarningsState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<EarningsCubit>();
    final hasItems = state.items.isNotEmpty;
    final Widget body;
    if (state.listError != null && !hasItems) {
      body = _InlineError(message: state.listError!, onRetry: cubit.retryList);
    } else if (state.listLoading && !hasItems) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(child: CircularProgressIndicator()),
      );
    } else if (!hasItems) {
      body = _EmptyEarnings(filter: state.filter);
    } else {
      body = Column(
        children: [
          // A failed refresh/retry keeps the rows the guide already loaded, with the error above them.
          if (state.listError != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: _InlineError(message: state.listError!, onRetry: cubit.retryList),
            ),
          for (var i = 0; i < state.items.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.borderLight),
            _EarningTile(earning: state.items[i]),
          ],
          if (state.loadingMore)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (state.canLoadMore)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: TextButton(
                onPressed: cubit.loadMore,
                child: const Text('Tải thêm'),
              ),
            ),
        ],
      );
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Lịch sử thu nhập',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
              ),
              if (state.items.isNotEmpty)
                Text(
                  '${state.items.length} mục',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                ),
            ],
          ),
          const SizedBox(height: 4),
          body,
        ],
      ),
    );
  }
}

class _EarningTile extends StatelessWidget {
  const _EarningTile({required this.earning});

  final Earning earning;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(color: AppColors.primarySurface, shape: BoxShape.circle),
            child: const Icon(Icons.payments_outlined, size: 19, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  earning.tourTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  '${earning.bookingCode} · ${formatEarnedAt(earning.earnedAt)}',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatVnd(earning.amount),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class _EmptyEarnings extends StatelessWidget {
  const _EmptyEarnings({required this.filter});

  final EarningsFilter filter;

  @override
  Widget build(BuildContext context) {
    final filtered = filter != EarningsFilter.all;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 26),
      child: Column(
        children: [
          const Icon(Icons.receipt_long_outlined, size: 48, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text(
            filtered ? 'Không có thu nhập trong kỳ này' : 'Chưa có thu nhập',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 6),
          Text(
            filtered
                ? 'Thù lao được ghi nhận sau khi booking hoàn tất. Thử chọn "Toàn bộ" để xem tất cả.'
                : 'Thu nhập sẽ được ghi nhận khi booking hoàn tất và bạn đã chấp nhận phân công tour.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _BankSection extends StatelessWidget {
  const _BankSection({required this.state});

  final EarningsState state;

  @override
  Widget build(BuildContext context) {
    final bank = state.bankAccount;
    final cubit = context.read<EarningsCubit>();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_outlined, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Tài khoản nhận thù lao',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
              ),
              TextButton(
                onPressed: state.savingBank ? null : () => _openBankSheet(context, state),
                child: Text(bank == null ? 'Cập nhật' : 'Sửa'),
              ),
            ],
          ),
          if (state.bankLoading)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: LinearProgressIndicator(minHeight: 2, color: AppColors.primary),
            )
          else if (state.bankError != null)
            _InlineError(message: state.bankError!, onRetry: cubit.retryBank)
          else if (bank == null)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'Chưa cập nhật tài khoản nhận thù lao. Thêm tài khoản để công ty chuyển thù lao quyết toán.',
                style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
              ),
            )
          else ...[
            const SizedBox(height: 8),
            _BankRow(label: 'Ngân hàng', value: bank.bankName),
            _BankRow(label: 'Số tài khoản', value: maskAccountNumber(bank.accountNumber)),
            _BankRow(label: 'Tên chủ thẻ', value: bank.accountHolder),
          ],
        ],
      ),
    );
  }

  Future<void> _openBankSheet(BuildContext context, EarningsState state) async {
    final cubit = context.read<EarningsCubit>();
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: BankAccountSheet(initial: state.bankAccount),
      ),
    );
    if (saved == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã cập nhật tài khoản nhận thù lao.')),
      );
    }
  }
}

class _BankRow extends StatelessWidget {
  const _BankRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 92,
            child: Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Icon(Icons.error_outline, size: 18, color: AppColors.error),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(fontSize: 12.5, color: AppColors.error, height: 1.35),
          ),
        ),
        TextButton(onPressed: onRetry, child: const Text('Thử lại')),
      ],
    );
  }
}

String _periodLabel(EarningsFilter filter) {
  switch (filter) {
    case EarningsFilter.thisMonth:
      return 'tháng này';
    case EarningsFilter.lastMonth:
      return 'tháng trước';
    case EarningsFilter.all:
      return 'toàn bộ';
  }
}

final BoxDecoration _cardDecoration = BoxDecoration(
  color: AppColors.surface,
  borderRadius: BorderRadius.circular(20),
  border: Border.all(color: AppColors.border),
);
