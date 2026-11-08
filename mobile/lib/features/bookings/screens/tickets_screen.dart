import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/booking_models.dart';

class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});
  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

typedef _TicketsPage = ({List<ETicket> items, int totalPages, bool cached});

class _TicketsScreenState extends State<TicketsScreen> {
  String _status = '';
  int _page = 1;
  late Future<_TicketsPage> _future = _load('', 1);
  Future<_TicketsPage> _load(String status, int page) async {
    final user = await TokenStorage().getUserInfo();
    final owner = user['id'];
    if (owner == null || owner.isEmpty) {
      throw StateError('Đăng nhập để xem vé.');
    }
    final prefs = await SharedPreferences.getInstance();
    final key = 'tripri_ticket_list_v1_${owner}_${status}_$page';
    Map<String, dynamic> body;
    var cached = false;
    try {
      final response = await ApiClient().get<Map<String, dynamic>>(
        '/e-tickets',
        queryParameters: {
          'page': page,
          'limit': 20,
          if (status.isNotEmpty) 'status': status,
        },
      );
      body = response.data!;
      try {
        await prefs.setString(key, jsonEncode(body));
      } catch (_) {
        /* Online tickets remain available. */
      }
    } on DioException catch (error) {
      final offline = [
        DioExceptionType.connectionError,
        DioExceptionType.connectionTimeout,
        DioExceptionType.receiveTimeout,
        DioExceptionType.sendTimeout,
      ].contains(error.type);
      final saved = prefs.getString(key);
      if (!offline || saved == null) rethrow;
      body = jsonDecode(saved) as Map<String, dynamic>;
      cached = true;
    }
    return (
      items: (body['data'] as List)
          .map((row) => ETicket.fromJson(row as Map<String, dynamic>))
          .toList(),
      totalPages: (body['meta']['totalPages'] as num).toInt(),
      cached: cached,
    );
  }

  void _change(String status, int page) => setState(() {
    _status = status;
    _page = page;
    _future = _load(status, page);
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Vé điện tử của tôi'),
      actions: [
        IconButton(
          onPressed: () => _change(_status, _page),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Trạng thái vé'),
            items: const [
              DropdownMenuItem(value: '', child: Text('Tất cả')),
              DropdownMenuItem(value: 'VALID', child: Text('Vé hợp lệ')),
              DropdownMenuItem(value: 'USED', child: Text('Đã hoàn tất')),
              DropdownMenuItem(value: 'CANCELLED', child: Text('Đã hủy')),
            ],
            onChanged: (value) => _change(value!, 1),
          ),
        ),
        Expanded(
          child: FutureBuilder<_TicketsPage>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Center(
                  child: Text(
                    'Không tải được vé. Kiểm tra kết nối hoặc đăng nhập lại.',
                  ),
                );
              }
              final data = snapshot.data;
              if (data == null) {
                return const Center(child: CircularProgressIndicator());
              }
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (data.cached)
                    const Text(
                      'Vé lưu trên thiết bị. Trạng thái sẽ được kiểm tra khi quét.',
                    ),
                  if (data.items.isEmpty) const Text('Chưa có vé phù hợp.'),
                  for (final ticket in data.items)
                    Card(
                      child: ExpansionTile(
                        title: Text(ticket.tourTitle),
                        subtitle: Text(
                          '${ticket.departureDate.toLocal()} · ${ticket.status.label}',
                        ),
                        childrenPadding: const EdgeInsets.all(16),
                        children: [
                          Text(
                            '${ticket.holderName} · ${ticket.participants} khách',
                          ),
                          if (ticket.meetingPoint != null)
                            Text('Điểm đón: ${ticket.meetingPoint}'),
                          SelectableText(ticket.code),
                          if (ticket.status == ETicketStatus.valid)
                            QrImageView(data: ticket.code, size: 240),
                        ],
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: _page > 1
                            ? () => _change(_status, _page - 1)
                            : null,
                        child: const Text('Trang trước'),
                      ),
                      Text('Trang $_page'),
                      TextButton(
                        onPressed: _page < data.totalPages
                            ? () => _change(_status, _page + 1)
                            : null,
                        child: const Text('Trang sau'),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}
