import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/chat_repository.dart';
import '../bloc/chat_socket.dart';
import '../models/chat_models.dart';
import 'chat_screen.dart';

final DateFormat _hm = DateFormat('HH:mm');
final DateFormat _dm = DateFormat('dd/MM');

String _when(DateTime? t) {
  if (t == null) return '';
  final now = DateTime.now();
  final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
  return sameDay ? _hm.format(t) : _dm.format(t);
}

/// Màn hình Tin nhắn chuẩn phong cách Airbnb & Messenger (Ảnh 3)
/// - Trạng thái trống: Đồ họa 3D bong bóng chat, dịch 100% tiếng Việt, nút CTA "Bắt đầu khám phá" màu xanh
/// - Trạng thái có tin: Danh sách phong cách Messenger với avatar tròn, chấm xanh online, xem trước tin và huy hiệu chưa đọc
/// - Thanh tìm kiếm: Bấm nút Search tròn sẽ mở rộng toàn phần, làm mờ nền để tập trung gõ
class ConversationsScreen extends StatefulWidget {
  final ChatRepository? repository;
  final ChatSocket? socket;
  final VoidCallback? onExploreTap;

  const ConversationsScreen({
    super.key,
    this.repository,
    this.socket,
    this.onExploreTap,
  });

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  late final ChatRepository _repo = widget.repository ?? ChatRepository();
  late final ChatSocket _socket = widget.socket ?? ChatSocketHub.instance;
  StreamSubscription<ChatMessage>? _sub;
  List<Conversation>? _items;
  String? _error;

  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _socket.connect();
    _sub = _socket.messages.listen((_) => _load());
    _load();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await _repo.listConversations();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } on ChatException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open(Conversation c) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChatScreen(
        conversationId: c.id,
        title: c.counterpart?.fullName ?? 'Trò chuyện',
        repository: widget.repository,
        socket: widget.socket,
      ),
    ));
    _load();
  }

  void _startSearch() {
    setState(() {
      _isSearching = true;
    });
    _searchFocusNode.requestFocus();
  }

  void _stopSearch() {
    setState(() {
      _isSearching = false;
      _searchController.clear();
    });
    _searchFocusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final allItems = _items;
    final filteredItems = allItems?.where((c) {
      if (query.isEmpty) return true;
      final name = c.counterpart?.fullName.toLowerCase() ?? '';
      final lastText = c.lastText?.toLowerCase() ?? '';
      return name.contains(query) || lastText.contains(query);
    }).toList();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header: Tiêu đề "Tin nhắn" & Nút tìm kiếm (Ảnh 3)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: !_isSearching
                        ? Row(
                            key: const ValueKey('header-title'),
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Tin nhắn',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.6,
                                ),
                              ),
                              // Nút tìm kiếm tròn (Nút settings đã được loại bỏ theo yêu cầu)
                              GestureDetector(
                                key: const Key('search-button'),
                                onTap: _startSearch,
                                child: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFF3F4F6),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.search_rounded,
                                    size: 20,
                                    color: Color(0xFF222222),
                                  ),
                                ),
                              ),
                            ],
                          )
                        : Row(
                            key: const ValueKey('header-search'),
                            children: [
                        // Thanh tìm kiếm mở rộng toàn phần khi bấm
                        Expanded(
                          child: Container(
                            height: 44,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: const Color(0xFF10B981),
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.search_rounded,
                                  color: Color(0xFF10B981),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _searchController,
                                    focusNode: _searchFocusNode,
                                    onChanged: (_) => setState(() {}),
                                    style: const TextStyle(
                                      fontSize: 15,
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    decoration: const InputDecoration(
                                      hintText: 'Tìm kiếm tin nhắn, hướng dẫn viên...',
                                      hintStyle: TextStyle(
                                        fontSize: 14,
                                        color: AppColors.textMuted,
                                      ),
                                      border: InputBorder.none,
                                      isDense: true,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                if (_searchController.text.isNotEmpty)
                                  GestureDetector(
                                    onTap: () {
                                      _searchController.clear();
                                      setState(() {});
                                    },
                                    child: const Icon(
                                      Icons.cancel_rounded,
                                      size: 18,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Nút Đóng tìm kiếm
                        GestureDetector(
                          key: const Key('close-search-button'),
                          onTap: _stopSearch,
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF3F4F6),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 20,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const Divider(height: 1, color: Color(0xFFF1F5F9)),

                // Thân màn hình: Trạng thái trống (Ảnh 3) hoặc Danh sách cuộc trò chuyện Messenger
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    color: const Color(0xFF10B981),
                    child: allItems == null
                        ? (_error == null
                            ? const Center(
                                child: CircularProgressIndicator(
                                  color: Color(0xFF10B981),
                                ),
                              )
                            : _ErrorMessage(text: _error!, onRetry: _load))
                        : (allItems.isEmpty
                            ? _buildEmptyState(context)
                            : _buildMessengerList(filteredItems ?? [])),
                  ),
                ),
              ],
            ),

            // Lớp phủ làm mờ nền khi đang mở tìm kiếm và chưa có kết quả gõ (để tập trung gõ như yêu cầu)
            if (_isSearching && query.isEmpty && (allItems?.isNotEmpty ?? false))
              Positioned.fill(
                top: 72,
                child: GestureDetector(
                  onTap: _stopSearch,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    color: Colors.black.withValues(alpha: 0.35),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Trạng thái chưa có tin nhắn: Thiết kế 1:1 theo Ảnh 3
  /// - Đồ họa 3D bong bóng chat xanh dương & trắng
  /// - Tiêu đề: "Chưa có cuộc trò chuyện nào"
  /// - Phụ đề: "Lên kế hoạch cho chuyến đi, trải nghiệm hoặc dịch vụ để kết nối với người tổ chức tại đây."
  /// - Nút CTA màu xanh: "Bắt đầu khám phá"
  /// - Không có mục "Past conversations"
  Widget _buildEmptyState(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      children: [
        const SizedBox(height: 60),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Đồ họa 3D bong bóng chat nổi bật phong cách Airbnb
                const _ChatBubbles3DGraphic(),
                const SizedBox(height: 36),

                // Tiêu đề dịch từ "Nothing to see here"
                const Text(
                  'Chưa có cuộc trò chuyện nào',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 12),

                // Phụ đề dịch từ "Plan a stay, experience, or service to connect with your host here."
                const Text(
                  'Lên kế hoạch cho chuyến đi, trải nghiệm hoặc dịch vụ để kết nối với người tổ chức tại đây.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14.5,
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 32),

                // Nút CTA đổi sang màu xanh (Green) theo yêu cầu
                GestureDetector(
                  onTap: () {
                    if (widget.onExploreTap != null) {
                      widget.onExploreTap!();
                    } else {
                      Navigator.of(context).popUntil((route) => route.isFirst);
                    }
                  },
                  child: Container(
                    key: const Key('get-started-button'),
                    padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981), // Màu xanh theo yêu cầu
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withValues(alpha: 0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Text(
                      'Bắt đầu khám phá',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Danh sách cuộc trò chuyện phong cách Messenger khi có tin nhắn
  Widget _buildMessengerList(List<Conversation> items) {
    if (items.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Không tìm thấy cuộc trò chuyện nào phù hợp',
            style: TextStyle(
              fontSize: 14.5,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Padding(
        padding: EdgeInsets.only(left: 82),
        child: Divider(height: 1, color: Color(0xFFF1F5F9)),
      ),
      itemBuilder: (context, i) {
        final c = items[i];
        final name = c.counterpart?.fullName ?? 'Người dùng';
        final unread = c.unreadCount > 0;

        return InkWell(
          onTap: () => _open(c),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                // Avatar tròn phong cách Messenger kèm chấm xanh Online
                Stack(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFFE0E7FF),
                            Color(0xFFC7D2FE),
                          ],
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        name.isEmpty ? '?' : name.characters.first.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF4338CA),
                        ),
                      ),
                    ),
                    // Chấm xanh trạng thái trực tuyến
                    Positioned(
                      right: 1,
                      bottom: 1,
                      child: Container(
                        width: 13,
                        height: 13,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white,
                            width: 2.2,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),

                // Nội dung: Tên người gửi, tin nhắn gần nhất
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        c.lastText ?? 'Chưa có tin nhắn',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: unread ? FontWeight.w700 : FontWeight.w400,
                          color: unread
                              ? AppColors.textPrimary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Cột bên phải: Thời gian & Huy hiệu tin nhắn chưa đọc
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _when(c.lastSentAt ?? c.updatedAt),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                        color: unread
                            ? const Color(0xFF10B981)
                            : AppColors.textMuted,
                      ),
                    ),
                    if (unread)
                      Container(
                        key: Key('unread-${c.id}'),
                        margin: const EdgeInsets.only(top: 6),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2.5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${c.unreadCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Đồ họa 3D bong bóng chat phong cách Airbnb (Ảnh 3)
class _ChatBubbles3DGraphic extends StatelessWidget {
  const _ChatBubbles3DGraphic();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      height: 150,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Bóng đổ phía dưới 3D
          Positioned(
            bottom: 6,
            child: Container(
              width: 110,
              height: 16,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(50),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 18,
                    spreadRadius: 2,
                    offset: const Offset(4, 6),
                  ),
                ],
              ),
            ),
          ),

          // Bong bóng xanh dương phía sau (Vibrant Blue 3D Bubble)
          Positioned(
            top: 10,
            right: 24,
            child: Transform.rotate(
              angle: 0.08,
              child: Container(
                width: 82,
                height: 86,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF38BDF8),
                      Color(0xFF0284C7),
                      Color(0xFF0369A1),
                    ],
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(26),
                    topRight: Radius.circular(26),
                    bottomRight: Radius.circular(26),
                    bottomLeft: Radius.circular(8),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bong bóng trắng phía trước (Glossy White 3D Bubble với 2 vạch tin nhắn xanh)
          Positioned(
            bottom: 16,
            left: 20,
            child: Transform.rotate(
              angle: -0.04,
              child: Container(
                width: 90,
                height: 94,
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.white,
                      Color(0xFFF8FAFC),
                      Color(0xFFE2E8F0),
                    ],
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                    bottomLeft: Radius.circular(8),
                    bottomRight: Radius.circular(28),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                    BoxShadow(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.1),
                      blurRadius: 10,
                      offset: const Offset(-2, -2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Dòng tin nhắn ngắn
                    Container(
                      width: 40,
                      height: 6.5,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Dòng tin nhắn dài
                    Container(
                      width: 54,
                      height: 6.5,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorMessage extends StatelessWidget {
  final String text;
  final VoidCallback? onRetry;
  const _ErrorMessage({required this.text, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 100),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Text(
                text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 14),
                ElevatedButton(
                  onPressed: onRetry,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: const Text('Thử lại'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
