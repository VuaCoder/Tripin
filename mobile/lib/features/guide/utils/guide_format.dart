import 'package:intl/intl.dart';

import '../models/guide_models.dart';

String formatVnd(int amount) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(amount);

String formatGuestCounts(GuideGuestCounts? guests, int fallbackParticipants) {
  if (guests == null) return '$fallbackParticipants khách';
  final parts = <String>['${guests.adults} người lớn'];
  if (guests.children > 0) parts.add('${guests.children} trẻ em');
  if (guests.infants > 0) parts.add('${guests.infants} em bé');
  return parts.join(' · ');
}
