import 'dart:async';
import 'package:flutter/material.dart';
import '../ai/screens/ai_chat_screen.dart';
import '../bookings/screens/my_bookings_screen.dart';
import '../chat/bloc/chat_socket.dart';
import '../chat/screens/conversations_screen.dart';
import '../notifications/bloc/notifications_repository.dart';
import '../notifications/screens/notifications_screen.dart';

/// Khung chính với thanh điều hướng: Trang chủ, Đơn đặt, Tin nhắn, Trợ lý AI, Thông báo.
class MainShell extends StatefulWidget {
  /// Nội dung tab "Trang chủ".
  final Widget home;
  final NotificationsRepository? notificationsRepository;
  final ChatSocket? socket;

  const MainShell({super.key, required this.home, this.notificationsRepository, this.socket});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  static const int _notificationsTab = 4;

  late final NotificationsRepository _notifications = widget.notificationsRepository ?? NotificationsRepository();
  late final ChatSocket _socket = widget.socket ?? ChatSocketHub.instance;
  StreamSubscription<Map<String, dynamic>>? _liveSub;

  int _index = 0;
  int _unread = 0;

  /// Tab chỉ được dựng khi mở lần đầu để không tải dữ liệu thừa lúc khởi động.
  final Set<int> _opened = {0};

  @override
  void initState() {
    super.initState();
    _refreshUnread();
    _liveSub = _socket.notifications.listen((_) {
      if (mounted && _index != _notificationsTab) setState(() => _unread++);
    });
  }

  @override
  void dispose() {
    _liveSub?.cancel();
    super.dispose();
  }

  Future<void> _refreshUnread() async {
    try {
      final count = await _notifications.unreadCount();
      if (mounted) setState(() => _unread = count);
    } catch (_) {
      // Chưa đăng nhập hoặc mất mạng: giữ nguyên số hiện tại.
    }
  }

  void _select(int i) {
    final leavingNotifications = _index == _notificationsTab && i != _notificationsTab;
    setState(() {
      _index = i;
      _opened.add(i);
      if (i == _notificationsTab) _unread = 0;
    });
    if (leavingNotifications) _refreshUnread();
  }

  Widget _tab(int i, Widget Function() build) => _opened.contains(i) ? build() : const SizedBox.shrink();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          widget.home,
          _tab(1, () => const MyBookingsScreen()),
          _tab(2, () => ConversationsScreen(socket: widget.socket)),
          _tab(3, () => const AiChatScreen()),
          _tab(4, () => NotificationsScreen(socket: widget.socket)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _select,
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Trang chủ'),
          const NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Đơn đặt',
          ),
          const NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Tin nhắn',
          ),
          const NavigationDestination(
            icon: Icon(Icons.auto_awesome_outlined),
            selectedIcon: Icon(Icons.auto_awesome),
            label: 'Trợ lý AI',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 99 ? '99+' : '$_unread'),
              child: const Icon(Icons.notifications_none_rounded),
            ),
            selectedIcon: const Icon(Icons.notifications_rounded),
            label: 'Thông báo',
          ),
        ],
      ),
    );
  }
}
