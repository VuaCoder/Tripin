import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/storage/token_storage.dart';
import '../models/ai_models.dart';

class AiStorage {
  final SharedPreferences? prefs;
  final TokenStorage _tokenStorage = TokenStorage();

  AiStorage({this.prefs});

  Future<SharedPreferences> _getPrefs() async =>
      prefs ?? await SharedPreferences.getInstance();

  Future<String> _getMessagesKey() async {
    try {
      final info = await _tokenStorage.getUserInfo();
      final uid = info['id'];
      if (uid != null && uid.isNotEmpty) {
        return 'ai_chat_messages_v1_$uid';
      }
    } catch (_) {}
    return 'ai_chat_messages_v1_guest';
  }

  Future<String> _getConvoKey() async {
    try {
      final info = await _tokenStorage.getUserInfo();
      final uid = info['id'];
      if (uid != null && uid.isNotEmpty) {
        return 'ai_chat_conversation_id_$uid';
      }
    } catch (_) {}
    return 'ai_chat_conversation_id_guest';
  }

  Future<String?> getConversationId() async {
    try {
      final prefs = await _getPrefs();
      final key = await _getConvoKey();
      return prefs.getString(key);
    } catch (_) {
      return null;
    }
  }

  Future<List<AiMessage>> getMessages() async {
    try {
      final prefs = await _getPrefs();
      final key = await _getMessagesKey();
      final raw = prefs.getString(key);
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => AiMessage.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveMessages({
    required List<AiMessage> messages,
    String? conversationId,
  }) async {
    try {
      final prefs = await _getPrefs();
      final msgKey = await _getMessagesKey();
      final raw = jsonEncode(messages.map((m) => m.toJson()).toList());
      await prefs.setString(msgKey, raw);
      if (conversationId != null) {
        final convoKey = await _getConvoKey();
        await prefs.setString(convoKey, conversationId);
      }
    } catch (_) {}
  }

  Future<void> clear() async {
    try {
      final prefs = await _getPrefs();
      final msgKey = await _getMessagesKey();
      final convoKey = await _getConvoKey();
      await prefs.remove(msgKey);
      await prefs.remove(convoKey);
    } catch (_) {}
  }
}
