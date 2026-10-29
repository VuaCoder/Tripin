import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../chat/bloc/chat_socket.dart';
import '../bloc/notifications_cubit.dart';
import '../bloc/notifications_repository.dart';
import '../models/notification_models.dart';

final DateFormat _fmt = DateFormat('HH:mm dd/MM');

IconData _icon(AppNotification n) {
  if (n.isChat) return Icons.chat_bubble_outline_rounded;
  if (n.isBooking) return Icons.confirmation_number_outlined;
  return Icons.notifications_none_rounded;
}

/// Trung tâm thông báo: tin nhắn mới, cập nhật trạng thái đơn đặt… Cập nhật ngay khi có thông báo mới.
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
      child: const _View(),
    );
  }
}

class _View extends StatelessWidget {
  const _View();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<NotificationsCubit, NotificationsState>(
      listenWhen: (a, b) => b.latest != null && a.latest != b.latest,
      listener: (context, state) {
        final n = state.latest!;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text('${n.title}\n${n.body}', maxLines: 3, overflow: TextOverflow.ellipsis)));
      },
      builder: (context, state) => Scaffold(
        appBar: AppBar(
          title: Text(
            state.unread > 0 ? 'Thông báo (${state.unread})' : 'Thông báo',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          actions: [
            if (state.unread > 0)
              TextButton(
                onPressed: () => context.read<NotificationsCubit>().markAllRead(),
                child: const Text('Đọc tất cả'),
              ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () => context.read<NotificationsCubit>().load(silent: true),
          child: _body(context, state),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, NotificationsState state) {
    if (state.loading) return const Center(child: CircularProgressIndicator());
    if (state.items.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Text(
                  state.error ?? 'Chưa có thông báo nào.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: () => context.read<NotificationsCubit>().load(), child: const Text('Thử lại')),
                ],
              ],
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      itemCount: state.items.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final n = state.items[i];
        return ListTile(
          key: Key('notif-${n.id}'),
          onTap: () => context.read<NotificationsCubit>().markRead(n),
          tileColor: n.isRead ? null : AppColors.primary.withValues(alpha: 0.07),
          leading: Icon(_icon(n), color: n.isRead ? AppColors.textSecondary : AppColors.primary),
          title: Text(
            n.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold),
          ),
          subtitle: Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis),
          trailing: Text(_fmt.format(n.createdAt), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        );
      },
    );
  }
}
