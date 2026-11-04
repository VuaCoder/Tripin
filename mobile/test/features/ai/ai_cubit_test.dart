import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/ai/bloc/ai_cubit.dart';
import 'package:mobile/features/ai/bloc/ai_repository.dart';
import 'package:mobile/features/ai/models/ai_models.dart';

class _Repo extends AiRepository {
  Object? failWith;
  final List<String?> conversationIds = [];
  Completer<void>? gate;

  @override
  Future<AiReply> chat(String message, {String? conversationId}) async {
    conversationIds.add(conversationId);
    await gate?.future;
    final error = failWith;
    if (error != null) throw error;
    return AiReply(
      conversationId: 'conv-1',
      reply: AiMessage(role: AiRole.assistant, content: 'Trả lời: $message', createdAt: DateTime(2026)),
    );
  }
}

void main() {
  test('shows the typing indicator while waiting, then the reply (AC3)', () async {
    final repo = _Repo()..gate = Completer<void>();
    final cubit = AiCubit(repository: repo);
    final future = cubit.ask('Nên mang gì đi Đà Lạt?');
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state.typing, isTrue);
    expect(cubit.state.messages.single.role, AiRole.user);

    repo.gate!.complete();
    await future;
    expect(cubit.state.typing, isFalse);
    expect(cubit.state.messages.last.content, 'Trả lời: Nên mang gì đi Đà Lạt?');
    await cubit.close();
  });

  test('keeps the same conversation for follow-up questions', () async {
    final repo = _Repo();
    final cubit = AiCubit(repository: repo);
    await cubit.ask('Một');
    await cubit.ask('Hai');
    expect(repo.conversationIds, [null, 'conv-1']);
    await cubit.close();
  });

  test('a lost connection becomes an error and the question can be retried without duplicating it (AC3)', () async {
    final repo = _Repo()..failWith = const AiException('Mất kết nối. Kiểm tra mạng rồi thử lại.');
    final cubit = AiCubit(repository: repo);
    await cubit.ask('Thời tiết Huế?');
    expect(cubit.state.typing, isFalse);
    expect(cubit.state.error, contains('Mất kết nối'));

    repo.failWith = null;
    await cubit.retry();
    expect(cubit.state.error, isNull);
    expect(cubit.state.messages.where((m) => m.role == AiRole.user).length, 1);
    expect(cubit.state.messages.last.role, AiRole.assistant);
    await cubit.close();
  });

  test('ignores empty questions and a second question while one is pending', () async {
    final repo = _Repo()..gate = Completer<void>();
    final cubit = AiCubit(repository: repo);
    await cubit.ask('   ');
    expect(cubit.state.messages, isEmpty);

    final first = cubit.ask('Câu một');
    await Future<void>.delayed(Duration.zero);
    await cubit.ask('Câu hai');
    expect(cubit.state.messages.length, 1);
    repo.gate!.complete();
    await first;
    await cubit.close();
  });
}
