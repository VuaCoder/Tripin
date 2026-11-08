import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../api/guide_check_in_api.dart';
import '../cubit/guide_tours_cubit.dart';
import '../cubit/guide_check_in_cubit.dart';
import 'qr_check_in_screen.dart';
import '../models/guide_models.dart';
import '../utils/guide_format.dart';
import '../widgets/answer_assignment_dialog.dart';
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

class _GuideToursView extends StatefulWidget {
  const _GuideToursView({required this.api});

  final GuideCheckInApi api;

  @override
  State<_GuideToursView> createState() => _GuideToursViewState();
}

class _GuideToursViewState extends State<_GuideToursView> {
  DateTime _selectedDate = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  );
  late DateTime _displayedMonth = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    1,
  );
  bool _isMonthView = false;
  bool _showAllTours = false;
  String _tourFilter = 'UPCOMING';

  bool _isSameDay(DateTime? a, DateTime b) {
    if (a == null) return false;
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _formatDate(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GuideToursCubit, GuideToursState>(
      builder: (context, state) {
        final pending = state.pendingTours;
        final upcoming = state.upcomingTours;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            toolbarHeight: 64,
            title: const Text(
              'Lịch tour',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.6,
              ),
            ),
            automaticallyImplyLeading: false,
            centerTitle: false,
            backgroundColor: Colors.transparent,
            elevation: 0,
            scrolledUnderElevation: 0,
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: IconButton(
                  icon: const Icon(
                    Icons.refresh_rounded,
                    color: AppColors.textPrimary,
                    size: 24,
                  ),
                  tooltip: 'Làm mới',
                  onPressed: () => context.read<GuideToursCubit>().load(),
                ),
              ),
            ],
          ),
          body: _buildBody(context, state, pending, upcoming),
        );
      },
    );
  }

  Widget _buildBody(
    BuildContext context,
    GuideToursState state,
    List<GuideAssignedTour> pending,
    List<GuideAssignedTour> upcoming,
  ) {
    if (state.loading && state.tours.isEmpty) {
      return _buildSkeletonLoading();
    }
    if (state.error != null) {
      return _ErrorState(
        message: state.error!,
        onRetry: () => context.read<GuideToursCubit>().load(),
      );
    }

    final today = DateTime.now();
    final isSelectedToday = _isSameDay(_selectedDate, today);

    // Lời mời cần duyệt luôn hiển thị để HDV không bao giờ bỏ sót lời mời phân công tour
    final filteredPending = _tourFilter == 'UPCOMING'
        ? pending
        : <GuideAssignedTour>[];
    final visibleTours = _tourFilter == 'ONGOING'
        ? state.ongoingTours
        : _tourFilter == 'COMPLETED'
        ? state.completedTours
        : upcoming;
    final filteredUpcoming = _showAllTours || _tourFilter != 'UPCOMING'
        ? visibleTours
        : visibleTours
              .where(
                (t) =>
                    _isSameDay(t.nextDepartureDate, _selectedDate) ||
                    (isSelectedToday && t.nextDepartureDate == null),
              )
              .toList();

    final hasNoToursOnDay =
        _tourFilter == 'UPCOMING' &&
        !_showAllTours &&
        filteredPending.isEmpty &&
        filteredUpcoming.isEmpty;

    return RefreshIndicator(
      onRefresh: () => context.read<GuideToursCubit>().load(),
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          Wrap(
            spacing: 8,
            children: [
              for (final filter in const {
                'UPCOMING': 'Sắp diễn ra',
                'ONGOING': 'Đang diễn ra',
                'COMPLETED': 'Đã hoàn tất',
              }.entries)
                ChoiceChip(
                  label: Text(filter.value),
                  selected: _tourFilter == filter.key,
                  onSelected: (_) => setState(() {
                    _tourFilter = filter.key;
                    _showAllTours = true;
                  }),
                ),
            ],
          ),
          const SizedBox(height: 12),
          // 1. Giao diện Calendar tương tác có dấu chấm chỉ báo ngày có tour
          if (_tourFilter == 'UPCOMING')
            _buildCalendarLayout(pending, upcoming),
          const SizedBox(height: 16),

          // Trạng thái ngày được chọn không có tour nào
          if (hasNoToursOnDay) ...[
            _buildEmptyDaySchedule(_selectedDate),
          ] else ...[
            // 2. Lời mời phân công dẫn tour (Pending invitations)
            if (filteredPending.isNotEmpty) ...[
              _buildSectionHeader(
                title: 'Lời mời dẫn tour cần duyệt',
                count: filteredPending.length,
                countColor: AppColors.warning,
              ),
              const SizedBox(height: 10),
              ...filteredPending.map(
                (tour) => _InvitationCard(
                  tour: tour,
                  onAccept: () => _handleAnswer(context, tour, true),
                  onDecline: () => _handleAnswer(context, tour, false),
                  onTap: () => _openAssignment(context, tour),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // 3. Danh sách tour theo lịch trình (Todolist các chuyến đi)
            _buildSectionHeader(
              title: _tourFilter == 'UPCOMING'
                  ? 'Lịch trình sắp tới'
                  : _tourFilter == 'ONGOING'
                  ? 'Đang diễn ra'
                  : 'Đã hoàn tất',
              count: filteredUpcoming.length,
              countColor: AppColors.primary,
            ),
            const SizedBox(height: 10),

            if (filteredUpcoming.isEmpty)
              _buildEmptyUpcoming()
            else
              ...filteredUpcoming.map(
                (tour) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tour.hasEnded
                          ? 'Đã hoàn tất'
                          : tour.isOngoing
                          ? 'Đang diễn ra'
                          : 'Sắp diễn ra',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    _UpcomingTourCard(
                      tour: tour,
                      onTap: () => _openTour(context, tour),
                    ),
                    Wrap(
                      spacing: 8,
                      children: [
                        TextButton.icon(
                          onPressed: () => _openTour(context, tour),
                          icon: const Icon(Icons.people_outline),
                          label: const Text('Xem danh sách đoàn'),
                        ),
                        if (!tour.hasEnded)
                          TextButton.icon(
                            onPressed: () => _scanTour(context, tour),
                            icon: const Icon(Icons.qr_code_scanner),
                            label: const Text('Mở quét QR vé'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionHeader({
    required String title,
    required int count,
    required Color countColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: countColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            '$count',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: countColor,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCalendarLayout(
    List<GuideAssignedTour> pending,
    List<GuideAssignedTour> upcoming,
  ) {
    final today = DateTime.now();
    final todayNormalized = DateTime(today.year, today.month, today.day);

    String getWeekdayLabel(int weekday) {
      switch (weekday) {
        case DateTime.monday:
          return 'T2';
        case DateTime.tuesday:
          return 'T3';
        case DateTime.wednesday:
          return 'T4';
        case DateTime.thursday:
          return 'T5';
        case DateTime.friday:
          return 'T6';
        case DateTime.saturday:
          return 'T7';
        case DateTime.sunday:
          return 'CN';
        default:
          return '';
      }
    }

    final List<DateTime> daysToShow = [];
    if (_isMonthView) {
      final firstDayOfMonth = DateTime(
        _displayedMonth.year,
        _displayedMonth.month,
        1,
      );
      final lastDayOfMonth = DateTime(
        _displayedMonth.year,
        _displayedMonth.month + 1,
        0,
      );
      final startOffset = (firstDayOfMonth.weekday - DateTime.monday) % 7;
      final startDate = firstDayOfMonth.subtract(Duration(days: startOffset));
      final endOffset = (DateTime.sunday - lastDayOfMonth.weekday) % 7;
      final endDate = lastDayOfMonth.add(Duration(days: endOffset));

      var curr = startDate;
      while (!curr.isAfter(endDate)) {
        daysToShow.add(DateTime(curr.year, curr.month, curr.day));
        curr = curr.add(const Duration(days: 1));
      }
    } else {
      final mondayOffset = (_selectedDate.weekday - DateTime.monday) % 7;
      final monday = _selectedDate.subtract(Duration(days: mondayOffset));
      for (int i = 0; i < 7; i++) {
        daysToShow.add(
          DateTime(
            monday.year,
            monday.month,
            monday.day,
          ).add(Duration(days: i)),
        );
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Calendar: Tháng/Năm + Nút chuyển tháng + Nút mở rộng/thu gọn
          Row(
            children: [
              Text(
                'Tháng ${_displayedMonth.month}, ${_displayedMonth.year}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const Spacer(),
              if (_displayedMonth.year != today.year ||
                  _displayedMonth.month != today.month)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _displayedMonth = DateTime(today.year, today.month, 1);
                      _selectedDate = todayNormalized;
                      _showAllTours = false;
                    });
                  },
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                  child: const Text(
                    'Hôm nay',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              IconButton(
                icon: const Icon(
                  Icons.chevron_left_rounded,
                  size: 22,
                  color: AppColors.textPrimary,
                ),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                onPressed: () {
                  setState(() {
                    _displayedMonth = DateTime(
                      _displayedMonth.year,
                      _displayedMonth.month - 1,
                      1,
                    );
                  });
                },
              ),
              IconButton(
                icon: const Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: AppColors.textPrimary,
                ),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                onPressed: () {
                  setState(() {
                    _displayedMonth = DateTime(
                      _displayedMonth.year,
                      _displayedMonth.month + 1,
                      1,
                    );
                  });
                },
              ),
              const SizedBox(width: 4),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: IconButton(
                  icon: Icon(
                    _isMonthView
                        ? Icons.view_week_rounded
                        : Icons.calendar_view_month_rounded,
                    size: 18,
                    color: AppColors.textPrimary,
                  ),
                  tooltip: _isMonthView
                      ? 'Thu gọn thành tuần'
                      : 'Mở rộng cả tháng',
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.all(4),
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                  onPressed: () => setState(() => _isMonthView = !_isMonthView),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Nhãn các thứ trong tuần
          Row(
            children:
                [
                  DateTime.monday,
                  DateTime.tuesday,
                  DateTime.wednesday,
                  DateTime.thursday,
                  DateTime.friday,
                  DateTime.saturday,
                  DateTime.sunday,
                ].map((wd) {
                  return Expanded(
                    child: Center(
                      child: Text(
                        getWeekdayLabel(wd),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: wd == DateTime.sunday
                              ? const Color(0xFFEF4444)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  );
                }).toList(),
          ),
          const SizedBox(height: 8),

          // Lưới ngày trong tháng / tuần
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: daysToShow.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: 0.95,
            ),
            itemBuilder: (context, idx) {
              final date = daysToShow[idx];
              final isCurrentMonth = date.month == _displayedMonth.month;
              final isSelected =
                  !_showAllTours &&
                  date.year == _selectedDate.year &&
                  date.month == _selectedDate.month &&
                  date.day == _selectedDate.day;
              final isToday =
                  date.year == today.year &&
                  date.month == today.month &&
                  date.day == today.day;

              final hasUpcoming = upcoming.any(
                (t) => _isSameDay(t.nextDepartureDate, date),
              );
              final hasPending = pending.any(
                (t) => _isSameDay(t.nextDepartureDate, date),
              );

              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedDate = date;
                    _showAllTours = false;
                    if (date.month != _displayedMonth.month) {
                      _displayedMonth = DateTime(date.year, date.month, 1);
                    }
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary
                        : (isToday
                              ? AppColors.primary.withValues(alpha: 0.08)
                              : Colors.transparent),
                    borderRadius: BorderRadius.circular(10),
                    border: isToday && !isSelected
                        ? Border.all(color: AppColors.primary, width: 1.2)
                        : null,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${date.day}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: (isSelected || isToday)
                              ? FontWeight.w800
                              : FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : (!isCurrentMonth
                                    ? const Color(0xFFCBD5E1)
                                    : (isToday
                                          ? AppColors.primary
                                          : AppColors.textPrimary)),
                        ),
                      ),
                      const SizedBox(height: 3),
                      // Dấu chấm chỉ báo ngày có tour (•)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (hasUpcoming)
                            Container(
                              width: 5,
                              height: 5,
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                          if (hasPending)
                            Container(
                              width: 5,
                              height: 5,
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFFFDE68A)
                                    : AppColors.warning,
                                shape: BoxShape.circle,
                              ),
                            ),
                          if (!hasUpcoming && !hasPending)
                            const SizedBox(height: 5),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 10),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Chú thích & Thanh chuyển đổi xem "Theo ngày" / "Xem tất cả"
          Row(
            children: [
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'Lịch trình',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppColors.warning,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'Chờ duyệt',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyDaySchedule(DateTime date) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.2),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: CustomPaint(
        painter: _DashedRectPainter(
          color: AppColors.primaryLight,
          strokeWidth: 1.5,
          gap: 4.0,
          dash: 6.0,
          radius: 20.0,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.calendar_month_outlined,
                size: 42,
                color: Colors.white,
              ),
              const SizedBox(height: 14),
              const Text(
                'Không có lịch tour nào',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Ngày ${_formatDate(date)} bạn không có nhiệm vụ hay lời mời dẫn tour nào.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFFE6F3F4),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSkeletonLoading() {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        // Dải ngày skeleton
        Container(
          height: 68,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        const SizedBox(height: 20),
        // Thẻ nhiệm vụ skeleton
        ...List.generate(
          3,
          (i) => Container(
            margin: const EdgeInsets.only(bottom: 12),
            height: 120,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 180,
                  height: 16,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: 140,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const Spacer(),
                Container(
                  width: 110,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyUpcoming() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.calendar_today_outlined,
            size: 44,
            color: AppColors.textMuted,
          ),
          SizedBox(height: 12),
          Text(
            'Chưa có tour sắp tới',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          Text(
            'Tour bạn đã nhận sẽ xuất hiện tại đây kèm danh sách đoàn và điểm danh.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleAnswer(
    BuildContext context,
    GuideAssignedTour tour,
    bool accept,
  ) async {
    final note = await showAnswerAssignmentDialog(
      context,
      tour: tour,
      accept: accept,
    );
    if (note == null || !context.mounted) return;

    final outcome = await context.read<GuideToursCubit>().answer(
      tourId: tour.id,
      accept: accept,
      note: note,
    );
    if (!context.mounted || outcome == null) return;

    if (outcome is GuideAnswerSuccess) {
      await context.read<GuideToursCubit>().load();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept
                ? 'Đã duyệt nhận tour! Tour đã được thêm vào Lịch trình sắp tới.'
                : 'Đã từ chối lời mời dẫn tour.',
          ),
          backgroundColor: accept ? AppColors.success : AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else if (outcome is GuideAnswerFailure) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(outcome.message),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
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
          child: GuideAssignmentDetailScreen(tour: tour, api: widget.api),
        ),
      ),
    );
    if (!context.mounted || accepted == null) return;
    if (accepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã nhận tour. Tour đã chuyển sang Lịch sắp tới.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã từ chối tour.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openTour(BuildContext context, GuideAssignedTour tour) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GuideTourDetailScreen(tour: tour, api: widget.api),
      ),
    );
  }

  void _scanTour(BuildContext context, GuideAssignedTour tour) {
    final baseApi = widget.api;
    final scopedApi = baseApi is DioGuideCheckInApi
        ? baseApi.forDeparture(tour.departureId)
        : baseApi;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => GuideCheckInCubit(scopedApi, tour.id)..loadRoster(),
          child: QrCheckInScreen(tour: tour),
        ),
      ),
    );
  }
}

/// Thẻ Lời mời phân công dẫn tour (Pending assignment card)
class _InvitationCard extends StatelessWidget {
  const _InvitationCard({
    required this.tour,
    required this.onAccept,
    required this.onDecline,
    required this.onTap,
  });

  final GuideAssignedTour tour;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final departure = tour.nextDepartureDate;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFED7AA), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.amber.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
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
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.mail_outline_rounded,
                      color: AppColors.warning,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tour.title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${tour.destination} · ${tour.durationDays} ngày'
                          '${tour.agencyName == null ? '' : ' · ${tour.agencyName}'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textMuted,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.event_rounded,
                        size: 15,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        departure == null
                            ? 'Chưa xếp ngày'
                            : DateFormat('dd/MM/yyyy').format(departure),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Thù lao: ${formatVnd(tour.feePerBooking)}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onDecline,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(
                          color: AppColors.error,
                          width: 1.2,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text(
                        'Từ chối',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onAccept,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text(
                        'Chấp nhận',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
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

/// Thẻ Lịch trình Tour sắp tới (Todolist card)
class _UpcomingTourCard extends StatelessWidget {
  const _UpcomingTourCard({required this.tour, required this.onTap});

  final GuideAssignedTour tour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final departure = tour.nextDepartureDate;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.tour_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tour.title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${tour.destination} · ${tour.durationDays} ngày'
                          '${tour.agencyName == null ? '' : ' · ${tour.agencyName}'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textMuted,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.event_available_rounded,
                        size: 15,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        departure == null
                            ? 'Chưa có ngày'
                            : 'Khởi hành: ${DateFormat('dd/MM/yyyy').format(departure)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Thù lao: ${formatVnd(tour.feePerBooking)}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
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

class _DashedRectPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double gap;
  final double dash;
  final double radius;

  const _DashedRectPainter({
    required this.color,
    this.strokeWidth = 1.0,
    this.gap = 5.0,
    this.dash = 5.0,
    this.radius = 0.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0.0;
      while (distance < metric.length) {
        final len = (distance + dash < metric.length)
            ? dash
            : metric.length - distance;
        final extractPath = metric.extractPath(distance, distance + len);
        canvas.drawPath(extractPath, paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRectPainter oldDelegate) =>
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth ||
      dash != oldDelegate.dash ||
      gap != oldDelegate.gap ||
      radius != oldDelegate.radius;
}
