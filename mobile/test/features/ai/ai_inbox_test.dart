import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/ai/bloc/ai_cubit.dart';
import 'package:mobile/features/ai/bloc/ai_repository.dart';
import 'package:mobile/features/ai/models/ai_models.dart';

class _Repository extends AiRepository {
  final reads = <String>[];
  @override
  Future<List<AiMessage>> getConversation(String id) async => [
    AiMessage(
      id: '$id-reply',
      role: AiRole.assistant,
      content: 'Reply for $id',
      createdAt: DateTime(2030),
      incomplete: true,
    ),
  ];
  @override
  Future<void> markRead(String id, String throughMessageId) async {
    reads.add('$id:$throughMessageId');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'switches server transcripts and marks only the visible reply boundary read',
    () async {
      SharedPreferences.setMockInitialValues({'tripri_user_id': 'owner'});
      final repository = _Repository();
      final cubit = AiCubit(repository: repository);
      try {
        await cubit.openConversation('one');
        expect(cubit.state.messages.single.content, 'Reply for one');
        expect(cubit.state.messages.single.incomplete, isTrue);
        expect(repository.reads, isEmpty);
        await cubit.markVisibleRead();
        await cubit.markVisibleRead();
        expect(repository.reads, ['one:one-reply']);
        await cubit.openConversation('two');
        await cubit.markVisibleRead();
        expect(cubit.state.messages.single.content, 'Reply for two');
        expect(repository.reads.last, 'two:two-reply');
      } finally {
        await cubit.close();
      }
    },
  );
}
