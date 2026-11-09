import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

class GuideAvatarActions extends StatelessWidget {
  const GuideAvatarActions({
    super.key,
    this.avatarUrl,
    this.onUpload,
    this.onRemove,
  });
  final String? avatarUrl;
  final VoidCallback? onUpload;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      CircleAvatar(
        radius: 40,
        backgroundImage: avatarUrl == null ? null : NetworkImage(avatarUrl!),
        child: avatarUrl == null ? const Icon(Icons.person, size: 40) : null,
      ),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        children: [
          TextButton.icon(
            onPressed: onUpload,
            icon: const Icon(Icons.photo_library_outlined),
            label: const Text('Chọn ảnh đại diện'),
          ),
          if (avatarUrl != null)
            TextButton.icon(
              onPressed: onRemove,
              icon: const Icon(Icons.delete_outline),
              label: const Text('Xóa ảnh'),
            ),
        ],
      ),
    ],
  );
}

@Preview(name: 'Guide avatar actions')
Widget guideAvatarActionsPreview() => const MaterialApp(
  home: Scaffold(body: Center(child: GuideAvatarActions())),
);
