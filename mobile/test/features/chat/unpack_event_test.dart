import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';

void main() {
  test('a plain event is passed through with no ack', () {
    final e = unpackEvent({'conversationId': 'c1'});
    expect((e.payload as Map)['conversationId'], 'c1');
    expect(e.ack, isNull);
  });

  test('an event with an ack arrives as [payload, ack] and the ack can be called (regression)', () {
    Object? acked;
    final e = unpackEvent([
      {'conversationId': 'c1'},
      (dynamic v) => acked = v,
    ]);
    expect((e.payload as Map)['conversationId'], 'c1');
    e.ack!.call(true);
    expect(acked, true);
  });

  test('a list with only the payload has no ack', () {
    final e = unpackEvent([
      {'a': 1},
    ]);
    expect((e.payload as Map)['a'], 1);
    expect(e.ack, isNull);
  });
}
