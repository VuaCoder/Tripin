import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

class TypingBubble extends StatefulWidget {
  const TypingBubble({super.key});
  @override
  State<TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<TypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animation = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _animation.stop();
    } else {
      _animation.repeat();
    }
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Đang soạn tin nhắn',
    liveRegion: true,
    child: ExcludeSemantics(
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, _) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Đang soạn tin ', style: TextStyle(fontSize: 12)),
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Opacity(
                  opacity: MediaQuery.disableAnimationsOf(context)
                      ? 1
                      : 0.35 +
                            0.65 *
                                (0.5 +
                                    0.5 *
                                        math.sin(
                                          (_animation.value - i / 3) *
                                              math.pi *
                                              2,
                                        )),
                  child: Container(
                    width: 4,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: Colors.teal,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

@Preview(name: 'Typing indicator')
Widget typingBubblePreview() => const MaterialApp(
  home: Scaffold(body: Center(child: TypingBubble())),
);
