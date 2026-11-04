import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../chat/bloc/chat_socket.dart';
import '../bloc/notifications_cubit.dart';
import '../bloc/notifications_repository.dart';
import '../models/notification_models.dart';

/// Màn hình thông báo chuẩn thiết kế Ảnh 4:
/// - Header chuẩn với nút Back tròn, Tiêu đề tiếng Việt "Thông báo", nút "Xem tất cả" không icon
/// - Trạng thái trống (Empty state) 1:1 theo Ảnh 4 với chuông và thông điệp tiếng Việt
/// - Phân chia theo các cột mốc thời gian: "Hôm nay", "Hôm qua", "Tuần này", "Trước đó"
class NotificationsScreen extends StatelessWidget {
  final NotificationsRepository? repository;
  final ChatSocket? socket;

  const NotificationsScreen({super.key, this.repository, this.socket});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => NotificationsCubit(
        repository: repository ?? NotificationsRepository(),
        socket: socket ?? ChatSocketHub.instance,
      )..start(),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatelessWidget {
  const _NotificationsView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<NotificationsCubit, NotificationsState>(
      listenWhen: (a, b) => b.latest != null && a.latest != b.latest,
      listener: (context, state) {
        final n = state.latest!;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text('${n.title}\n${n.body}', maxLines: 3, overflow: TextOverflow.ellipsis),
              behavior: SnackBarBehavior.floating,
              backgroundColor: const Color(0xFF0F172A),
            ),
          );
      },
      builder: (context, state) {
        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. TOP HEADER (Ảnh 4): Nút quay lại tròn bên trái, nút "Xem tất cả" bên phải
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Nút quay lại tròn (Ảnh 4)
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFF1F5F9),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.arrow_back_rounded, size: 20, color: Color(0xFF0F172A)),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ),

                      // Nút "Xem tất cả" (theo yêu cầu: "không cần phải làm cầu kỳ, chỉ cần nút xem tất cả là được rồi, không icon gì nhé")
                      TextButton(
                        onPressed: () {
                          context.read<NotificationsCubit>().markAllRead();
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF0F766E),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        ),
                        child: const Text(
                          'Xem tất cả',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // 2. Tiêu đề "Thông báo" lớn (Ảnh 4)
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 16),
                  child: Text(
                    'Thông báo',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.6,
                    ),
                  ),
                ),

                // 3. Danh sách thông báo hoặc Trạng thái trống (Empty state Ảnh 4)
                Expanded(
                  child: RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => context.read<NotificationsCubit>().load(silent: true),
                    child: _buildContent(context, state),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildContent(BuildContext context, NotificationsState state) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Giao diện khi chưa có thông báo nào (Ảnh 4 1:1)
    if (state.items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.16),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 36),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Icon chuông rỗng (Ảnh 4)
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFF8FAFC),
                    ),
                    child: const Icon(
                      Icons.notifications_none_rounded,
                      size: 40,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Tiêu đề: "Chưa có thông báo nào" (Ảnh 4)
                  const Text(
                    'Chưa có thông báo nào',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),

                  // Mô tả tiếng Việt: "Hộp thư thông báo của bạn hiện đang trống..." (Ảnh 4)
                  const Text(
                    'Bạn chưa có thông báo nào mới. Chúng tôi sẽ cập nhật cho bạn ngay khi có thông tin mới về chuyến đi, xác nhận thanh toán hoặc phiên bản cập nhật.',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF64748B),
                      height: 1.45,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    // Nhóm thông báo theo các cột mốc thời gian: "Hôm nay", "Hôm qua", "Tuần này", "Trước đó"
    final now = DateTime.now();
    final today = <AppNotification>[];
    final yesterday = <AppNotification>[];
    final thisWeek = <AppNotification>[];
    final earlier = <AppNotification>[];

    for (final item in state.items) {
      final diff = now.difference(item.createdAt);
      final isSameDay = item.createdAt.year == now.year &&
          item.createdAt.month == now.month &&
          item.createdAt.day == now.day;
      final isYesterday = item.createdAt.year == now.year &&
          item.createdAt.month == now.month &&
          item.createdAt.day == now.day - 1;

      if (isSameDay) {
        today.add(item);
      } else if (isYesterday) {
        yesterday.add(item);
      } else if (diff.inDays < 7) {
        thisWeek.add(item);
      } else {
        earlier.add(item);
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      children: [
        if (today.isNotEmpty) ...[
          _buildTimelineHeader('Hôm nay'),
          ...today.map((n) => _buildNotificationCard(context, n)),
          const SizedBox(height: 14),
        ],
        if (yesterday.isNotEmpty) ...[
          _buildTimelineHeader('Hôm qua'),
          ...yesterday.map((n) => _buildNotificationCard(context, n)),
          const SizedBox(height: 14),
        ],
        if (thisWeek.isNotEmpty) ...[
          _buildTimelineHeader('Tuần này'),
          ...thisWeek.map((n) => _buildNotificationCard(context, n)),
          const SizedBox(height: 14),
        ],
        if (earlier.isNotEmpty) ...[
          _buildTimelineHeader('Trước đó'),
          ...earlier.map((n) => _buildNotificationCard(context, n)),
        ],
      ],
    );
  }

  Widget _buildTimelineHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: Color(0xFF64748B),
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  Widget _buildNotificationCard(BuildContext context, AppNotification n) {
    final timeStr = DateFormat('HH:mm').format(n.createdAt);
    final dateStr = DateFormat('dd/MM').format(n.createdAt);

    IconData iconData = Icons.notifications_none_rounded;
    Color iconColor = const Color(0xFF0F766E);
    Color iconBg = const Color(0xFFF0FDFA);

    if (n.type == 'BOOKING_PAID') {
      iconData = Icons.check_circle_rounded;
      iconColor = const Color(0xFF16A34A);
      iconBg = const Color(0xFFDCFCE7);
    } else if (n.type == 'TOUR_COMPLETED') {
      iconData = Icons.rate_review_rounded;
      iconColor = const Color(0xFF0F766E);
      iconBg = const Color(0xFFCCFBF1);
    } else if (n.type == 'SYSTEM_UPDATE') {
      iconData = Icons.campaign_rounded;
      iconColor = const Color(0xFF2563EB);
      iconBg = const Color(0xFFDBEAFE);
    } else if (n.isChat) {
      iconData = Icons.chat_bubble_outline_rounded;
      iconColor = const Color(0xFF6366F1);
      iconBg = const Color(0xFFEEF2FF);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: n.isRead ? Colors.white : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: n.isRead ? const Color(0xFFF1F5F9) : const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: n.isRead ? 0.02 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          context.read<NotificationsCubit>().markRead(n);
          _showDetailDialog(context, n);
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon thông báo
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: iconBg,
                ),
                child: Icon(iconData, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),

              // Nội dung
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            n.title,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: n.isRead ? FontWeight.w600 : FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        if (!n.isRead) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      n.body,
                      style: const TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF475569),
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$timeStr · $dateStr',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetailDialog(BuildContext context, AppNotification n) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          n.title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: Text(
          n.body,
          style: const TextStyle(fontSize: 14.5, color: Color(0xFF334155), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Đóng', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF0F766E))),
          ),
        ],
      ),
    );
  }
}
