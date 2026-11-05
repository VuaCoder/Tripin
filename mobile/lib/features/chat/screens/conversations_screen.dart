import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/storage/token_storage.dart';
import '../bloc/chat_repository.dart';
import '../bloc/chat_socket.dart';
import '../models/chat_models.dart';
import '../widgets/conversations_shimmer_loading.dart';
import '../../ai/models/ai_models.dart';
import '../../ai/screens/ai_chat_screen.dart';
import '../../ai/storage/ai_storage.dart';
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
  final bool showAiOption;

  const ConversationsScreen({
    super.key,
    this.repository,
    this.socket,
    this.onExploreTap,
    this.showAiOption = true,
  });

  @visibleForTesting
  static void resetCache() {}

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  final TokenStorage _tokenStorage = TokenStorage();

  late final ChatRepository _repo = widget.repository ?? ChatRepository();
  late final ChatSocket _socket = widget.socket ?? ChatSocketHub.instance;
  StreamSubscription<ChatMessage>? _sub;
  List<Conversation>? _items;
  String? _error;
  AiMessage? _lastAiMessage;

  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    if (widget.showAiOption) {
      _loadAiLastMessage();
    }

    if (widget.repository != null) {
      _socket.connect();
      _sub = _socket.messages.listen((_) => _load());
      _load();
      return;
    }

    _tokenStorage.getAccessToken().then((token) {
      if (token == null || token.isEmpty) {
        if (mounted) {
          setState(() {
            _items = [];
            _error = null;
          });
        }
      } else {
        _socket.connect();
        _sub = _socket.messages.listen((_) => _load());
        _load();
      }
    });
  }

  Future<void> _loadAiLastMessage() async {
    try {
      final storage = AiStorage();
      final msgs = await storage.getMessages();
      if (!mounted) return;
      setState(() {
        _lastAiMessage = msgs.isNotEmpty ? msgs.last : null;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _sub?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.showAiOption) {
      _loadAiLastMessage();
    }
    if (widget.repository == null) {
      final token = await _tokenStorage.getAccessToken();
      if (token == null || token.isEmpty) {
        if (!mounted) return;
        setState(() {
          _items = [];
          _error = null;
        });
        return;
      }
    }

    try {
      final items = await _repo.listConversations();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } on ChatException catch (e) {
      if (!mounted) return;
      // Nếu là lỗi chưa đăng nhập hoặc hết phiên, coi như trống thay vì hiện lỗi
      if (e.message.contains('đăng nhập') || e.message.contains('hết hạn')) {
        setState(() {
          _items = [];
          _error = null;
        });
      } else {
        setState(() => _error = e.message);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không thể kết nối máy chủ tin nhắn.');
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
      if (!widget.showAiOption && c.isAi) return false;
      if (query.isEmpty) return true;
      final name = c.counterpart?.fullName.toLowerCase() ?? '';
      final lastText = c.lastText?.toLowerCase() ?? '';
      return name.contains(query) || lastText.contains(query);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
                                color: AppColors.primary,
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.search_rounded,
                                  color: AppColors.primary,
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

                // Thân màn hình: Skeleton Loading hoặc Danh sách cuộc trò chuyện Messenger (luôn có Trợ lý AI ở đầu)
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () async {
                      await Future.wait([
                        _load(),
                        if (widget.showAiOption) _loadAiLastMessage(),
                      ]);
                    },
                    color: AppColors.primary,
                    child: allItems == null
                        ? (_error == null
                            ? const ConversationsShimmerLoading()
                            : _ErrorMessage(text: _error!, onRetry: _load))
                        : _buildMessengerList(filteredItems ?? []),
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


  String _cleanMarkdown(String text) {
    return text
        .replaceAll(RegExp(r'[*#_`~>]'), '')
        .replaceAll(RegExp(r'\n+'), ' ')
        .trim();
  }

  /// Mục Trợ lý AI Tripri (nằm ngay bên trong danh sách tin nhắn)
  Widget _buildAiConversationItem() {
    String previewText;
    String timeText;

    if (_lastAiMessage != null) {
      final msg = _lastAiMessage!;
      timeText = _when(msg.createdAt);
      if (msg.role == AiRole.user) {
        previewText = 'Bạn: ${msg.content}';
      } else {
        previewText = 'Trợ lý AI: ${_cleanMarkdown(msg.content)}';
      }
    } else {
      timeText = '24/7';
      previewText = 'Trợ lý AI: Sẵn sàng tư vấn lịch trình, tour & giải đáp thắc mắc';
    }

    return InkWell(
      key: const Key('ai-assistant-conversation-item'),
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => const AiChatScreen(),
        ));
        _loadAiLastMessage();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            // Avatar AI tròn với gradient và icon lấp lánh (không có chấm xanh online thừa)
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0D9488),
                    Color(0xFF2563EB),
                  ],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),

            // Tên & Tin nhắn gần nhất của AI
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Trợ lý AI Tripri',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF0D9488), Color(0xFF2563EB)],
                          ),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'AI',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    previewText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      color: _lastAiMessage != null ? AppColors.textSecondary : const Color(0xFF0D9488),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (timeText.isNotEmpty) ...[
              const SizedBox(width: 12),
              Text(
                timeText,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Định dạng nội dung tin nhắn preview:
  /// - Nếu mình gửi: Bạn: "nội dung..."
  /// - Nếu đối phương gửi: Tên họ: "abcxyz..."
  /// - Nếu là AI: Trợ lý AI: "..."
  String _formatLastMessagePreview(Conversation c) {
    final text = c.lastText;
    if (text == null || text.trim().isEmpty) {
      return 'Chưa có tin nhắn';
    }

    if (c.isAi) {
      if (text.startsWith('Bạn: ') || text.startsWith('Trợ lý AI: ')) {
        return text;
      }
      return 'Trợ lý AI: $text';
    }

    // Nếu đã có sẵn tiền tố 'Bạn: ' hoặc '<Name>: '
    if (text.startsWith('Bạn: ') || (c.counterpart != null && text.startsWith('${c.counterpart!.fullName}: '))) {
      return text;
    }

    if (c.lastSenderId != null && c.counterpart != null) {
      if (c.lastSenderId == c.counterpart!.id) {
        return '${c.counterpart!.fullName}: $text';
      } else {
        return 'Bạn: $text';
      }
    }

    return text;
  }

  /// Danh sách cuộc trò chuyện phong cách Messenger khi có tin nhắn
  Widget _buildMessengerList(List<Conversation> items) {
    final query = _searchController.text.trim().toLowerCase();
    final showAiItem = widget.showAiOption &&
        (query.isEmpty ||
            'trợ lý ai tripri'.contains(query) ||
            'ai'.contains(query));

    if (items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          if (showAiItem) ...[
            _buildAiConversationItem(),
            const Padding(
              padding: EdgeInsets.only(left: 82),
              child: Divider(height: 1, color: Color(0xFFF1F5F9)),
            ),
          ],
          _buildEmptyMessengerState(),
        ],
      );
    }

    final totalCount = items.length + (showAiItem ? 1 : 0);

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: totalCount,
      separatorBuilder: (_, _) => const Padding(
        padding: EdgeInsets.only(left: 82),
        child: Divider(height: 1, color: Color(0xFFF1F5F9)),
      ),
      itemBuilder: (context, i) {
        if (showAiItem && i == 0) {
          return _buildAiConversationItem();
        }
        final itemIndex = showAiItem ? i - 1 : i;
        if (itemIndex < 0 || itemIndex >= items.length) {
          return const SizedBox.shrink();
        }
        final c = items[itemIndex];
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
                  ],
                ),
                const SizedBox(width: 14),

                // Nội dung: Tên người gửi, tin nhắn gần nhất
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
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
                          ),
                          // Dấu chấm thông báo tin nhắn chưa đọc
                          if (unread)
                            Container(
                              key: Key('unread-dot-${c.id}'),
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(left: 6),
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatLastMessagePreview(c),
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
                            ? AppColors.primary
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
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          c.unreadCount > 5 ? '5+ tin nhắn mới' : '${c.unreadCount}',
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

  Widget _buildEmptyMessengerState() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const _ChatBubbles3DGraphic(),
          const SizedBox(height: 24),
          const Text(
            'Chưa có tin nhắn nào',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Khi du khách hoặc hướng dẫn viên nhắn tin, các cuộc trò chuyện sẽ xuất hiện tại đây.',
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
}

/// Đồ họa 3D bong bóng chat phong cách Airbnb (Ảnh 3)
class _ChatBubbles3DGraphic extends StatelessWidget {
  const _ChatBubbles3DGraphic();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      height: 140,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Bóng đổ phía dưới 3D
          Positioned(
            bottom: 4,
            child: Container(
              width: 100,
              height: 14,
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
            top: 8,
            right: 20,
            child: Transform.rotate(
              angle: 0.08,
              child: Container(
                width: 76,
                height: 80,
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
                    topLeft: Radius.circular(24),
                    topRight: Radius.circular(24),
                    bottomRight: Radius.circular(24),
                    bottomLeft: Radius.circular(8),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                      blurRadius: 14,
                      offset: const Offset(0, 7),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bong bóng trắng phía trước (Glossy White 3D Bubble với 2 vạch tin nhắn xanh)
          Positioned(
            bottom: 14,
            left: 18,
            child: Transform.rotate(
              angle: -0.04,
              child: Container(
                width: 84,
                height: 88,
                padding: const EdgeInsets.fromLTRB(14, 22, 14, 14),
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
                    topLeft: Radius.circular(26),
                    topRight: Radius.circular(26),
                    bottomLeft: Radius.circular(8),
                    bottomRight: Radius.circular(26),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.14),
                      blurRadius: 18,
                      offset: const Offset(0, 9),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 36,
                      height: 6,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 7),
                    Container(
                      width: 50,
                      height: 6,
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
                    backgroundColor: AppColors.primary,
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
