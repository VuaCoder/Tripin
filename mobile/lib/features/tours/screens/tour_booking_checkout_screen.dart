import 'dart:math';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../bookings/storage/pending_booking_storage.dart';
import '../../payments/screens/payment_screen.dart';
import '../../vouchers/models/voucher_model.dart';
import '../../vouchers/services/voucher_storage_service.dart';
import '../../vouchers/widgets/voucher_bottom_sheet.dart';
import '../models/tour_detail_model.dart';

/// Màn hình Đặt tour đa bước phong cách Airbnb & Shopee:
/// - Bước 1: Kiểm tra thông tin (Tour, ngày, khách, bảng giá, Nút áp dụng voucher)
/// - Bước 2: Chọn cổng thanh toán (PayOS, Thẻ ATM, Thẻ Quốc tế, Ví MoMo)
/// - Bước 3: Màn hình tổng thể cuối cùng (Xác nhận mọi thông tin, cho phép Thay đổi trực tiếp, Nút Thanh toán ngay)
class TourBookingCheckoutScreen extends StatefulWidget {
  final TourDetailModel tour;
  final TourDepartureModel initialDeparture;
  final List<TourDepartureModel>? availableDepartures;
  final ApiClient? apiClient;
  final int initialAdults;
  final int initialChildren;
  final int initialInfants;
  final int initialStep;

  const TourBookingCheckoutScreen({
    super.key,
    required this.tour,
    required this.initialDeparture,
    this.availableDepartures,
    this.apiClient,
    this.initialAdults = 1,
    this.initialChildren = 0,
    this.initialInfants = 0,
    this.initialStep = 1,
  });

  @override
  State<TourBookingCheckoutScreen> createState() => _TourBookingCheckoutScreenState();
}

class _TourBookingCheckoutScreenState extends State<TourBookingCheckoutScreen> {
  int _currentStep = 1; // 1: Kiểm tra thông tin, 2: Chọn cổng thanh toán, 3: Xác nhận & Thanh toán

  // Phân loại khách
  int _adultsCount = 1;
  int _childrenCount = 0;
  int _infantsCount = 0;

  // Cổng thanh toán đã chọn (payos, atm, international, momo)
  String _selectedPaymentMethod = 'payos';

  // Voucher đã áp dụng (Shopee single-use rule)
  VoucherModel? _selectedVoucher;

  // Thông tin liên hệ
  String _contactName = 'Khách hàng Tripri';
  String _contactPhone = '0901234567';

  late TourDepartureModel _selectedDeparture;
  late final List<TourDepartureModel> _departuresList;
  bool _isCreatingBooking = false;

  final NumberFormat _priceFormatter = NumberFormat('#,###', 'vi_VN');
  final PendingBookingStorage _draftStorage = PendingBookingStorage();
  final VoucherStorageService _voucherStorage = VoucherStorageService();

  @override
  void initState() {
    super.initState();
    _currentStep = widget.initialStep;
    _adultsCount = widget.initialAdults;
    _childrenCount = widget.initialChildren;
    _infantsCount = widget.initialInfants;
    _selectedDeparture = widget.initialDeparture;
    _loadUserInfo();
    _saveDraft();

    // Cố định danh sách ngày khởi hành một lần duy nhất
    final initialList = widget.availableDepartures ?? widget.tour.departures;
    if (initialList.isNotEmpty) {
      _departuresList = List.from(initialList);
    } else {
      _departuresList = [
        widget.initialDeparture,
        TourDepartureModel(
          id: 'dep_opt_1',
          date: widget.initialDeparture.date.add(const Duration(days: 7)),
          capacity: 25,
          remaining: 12,
          price: widget.tour.basePrice,
          isOpen: true,
        ),
        TourDepartureModel(
          id: 'dep_opt_2',
          date: widget.initialDeparture.date.add(const Duration(days: 14)),
          capacity: 25,
          remaining: 8,
          price: widget.tour.basePrice,
          isOpen: true,
        ),
        TourDepartureModel(
          id: 'dep_opt_3',
          date: widget.initialDeparture.date.add(const Duration(days: 21)),
          capacity: 25,
          remaining: 15,
          price: widget.tour.basePrice,
          isOpen: true,
        ),
      ];
    }
  }

  Future<void> _loadUserInfo() async {
    try {
      final info = await TokenStorage().getUserInfo();
      if (mounted) {
        setState(() {
          if (info['name'] != null && info['name']!.isNotEmpty) {
            _contactName = info['name']!;
          }
          if (info['email'] != null && info['email']!.isNotEmpty) {
            // Dùng số điện thoại mặc định hoặc đã lưu
          }
        });
      }
    } catch (_) {}
  }

  /// Số lượng khách tính vé (Người lớn + Trẻ em)
  int get _payingGuestsCount => _adultsCount + _childrenCount;

  /// Giá gốc (chưa trừ voucher)
  int get _subtotalPrice => _selectedDeparture.price * _payingGuestsCount;

  /// Số tiền giảm giá từ Voucher
  int get _discountAmount => _selectedVoucher?.calculateDiscount(_subtotalPrice) ?? 0;

  /// Tổng số tiền thanh toán thực tế sau khi trừ voucher
  int get _totalPrice => max(0, _subtotalPrice - _discountAmount);

  /// Chuỗi tóm tắt khách hiển thị trên card
  String get _guestsSummaryText {
    final List<String> parts = [];
    parts.add('$_adultsCount người lớn');
    if (_childrenCount > 0) parts.add('$_childrenCount trẻ em');
    if (_infantsCount > 0) parts.add('$_infantsCount em bé');
    return parts.join(', ');
  }

  String _formatDateRange(DateTime start, int durationDays) {
    final end = start.add(Duration(days: durationDays > 1 ? durationDays - 1 : 0));
    final startDay = start.day.toString().padLeft(2, '0');
    final startMonth = start.month.toString().padLeft(2, '0');
    final endDay = end.day.toString().padLeft(2, '0');
    final endMonth = end.month.toString().padLeft(2, '0');
    final year = end.year.toString();

    if (startMonth == endMonth) {
      return '$startDay – $endDay/$endMonth/$year';
    }
    return '$startDay/$startMonth – $endDay/$endMonth/$year';
  }

  Future<void> _saveDraft() async {
    try {
      final departureDate = _selectedDeparture.date;
      final duration = widget.tour.durationDays > 0 ? widget.tour.durationDays : 1;
      final endDate = departureDate.add(Duration(days: duration > 1 ? duration - 1 : 0));

      final draft = PendingBookingDraft(
        tourId: widget.tour.id,
        tourTitle: widget.tour.title,
        destination: widget.tour.destination,
        coverImage: widget.tour.coverImage,
        departureId: _selectedDeparture.id,
        departureDate: departureDate,
        endDate: endDate,
        durationDays: duration,
        adultsCount: _adultsCount,
        childrenCount: _childrenCount,
        infantsCount: _infantsCount,
        totalPrice: _totalPrice,
        savedAt: DateTime.now(),
      );
      await _draftStorage.saveDraft(draft);
    } catch (_) {}
  }

  /// Mở modal chọn/áp dụng voucher
  Future<void> _openVoucherModal() async {
    final result = await VoucherBottomSheet.show(
      context,
      orderTotal: _subtotalPrice,
      currentVoucher: _selectedVoucher,
    );
    if (mounted) {
      setState(() {
        _selectedVoucher = result;
      });
      _saveDraft();
    }
  }

  /// Mở modal thay đổi ngày khởi hành
  void _openChangeDateModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.7,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD6D6D6),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Đổi ngày khởi hành',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF222222),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFF0F0F0)),
                Flexible(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(20),
                    shrinkWrap: true,
                    itemCount: _departuresList.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final dep = _departuresList[index];
                      final isSelected = dep.id == _selectedDeparture.id;
                      final dateFormatted = DateFormat('EEEE, dd/MM/yyyy', 'vi').format(dep.date);

                      return InkWell(
                        onTap: () {
                          setState(() => _selectedDeparture = dep);
                          _saveDraft();
                          Navigator.pop(ctx);
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFF8FAFC) : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF222222) : const Color(0xFFE5E7EB),
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                                color: isSelected ? const Color(0xFF222222) : const Color(0xFF9CA3AF),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      dateFormatted,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                        color: const Color(0xFF222222),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Còn ${dep.remaining} chỗ trống · ${_priceFormatter.format(dep.price)} VND / khách',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isSelected ? const Color(0xFF4B5563) : const Color(0xFF6B7280),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Mở modal thay đổi số lượng khách
  void _openChangeGuestsModal() {
    int tempAdults = _adultsCount;
    int tempChildren = _childrenCount;
    int tempInfants = _infantsCount;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final maxSeats = _selectedDeparture.capacity > 0 ? _selectedDeparture.capacity : 25;
            final canAddSeat = (tempAdults + tempChildren) < maxSeats;

            return Container(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD6D6D6),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Thay đổi khách',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF222222)),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(Icons.close_rounded, size: 24, color: Color(0xFF222222)),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Chuyến đi này có tối đa $maxSeats chỗ, không bao gồm em bé sơ sinh.',
                      style: const TextStyle(fontSize: 13.5, color: Color(0xFF717171), height: 1.4),
                    ),
                    const SizedBox(height: 18),
                    const Divider(height: 1, color: Color(0xFFF0F0F0)),
                    const SizedBox(height: 12),

                    _buildGuestRow(
                      title: 'Người lớn',
                      subtitle: 'Từ 13 tuổi trở lên',
                      count: tempAdults,
                      canDecrease: tempAdults > 1,
                      canIncrease: canAddSeat,
                      onDecrease: () => setModalState(() => tempAdults--),
                      onIncrease: () => setModalState(() => tempAdults++),
                    ),
                    const Divider(height: 24, color: Color(0xFFF0F0F0)),

                    _buildGuestRow(
                      title: 'Trẻ em',
                      subtitle: 'Độ tuổi 2 – 12',
                      count: tempChildren,
                      canDecrease: tempChildren > 0,
                      canIncrease: canAddSeat,
                      onDecrease: () => setModalState(() => tempChildren--),
                      onIncrease: () => setModalState(() => tempChildren++),
                    ),
                    const Divider(height: 24, color: Color(0xFFF0F0F0)),

                    _buildGuestRow(
                      title: 'Em bé / Sơ sinh',
                      subtitle: 'Dưới 2 tuổi',
                      count: tempInfants,
                      canDecrease: tempInfants > 0,
                      canIncrease: tempInfants < 5,
                      onDecrease: () => setModalState(() => tempInfants--),
                      onIncrease: () => setModalState(() => tempInfants++),
                    ),
                    const SizedBox(height: 28),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Hủy', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _adultsCount = tempAdults;
                              _childrenCount = tempChildren;
                              _infantsCount = tempInfants;
                            });
                            _saveDraft();
                            Navigator.pop(ctx);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF222222),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Lưu', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// Modal thay đổi thông tin liên hệ (ở Bước 3)
  void _openChangeContactModal() {
    final nameCtrl = TextEditingController(text: _contactName);
    final phoneCtrl = TextEditingController(text: _contactPhone);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFD6D6D6), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Sửa thông tin liên hệ', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                  IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Họ và tên người đặt tour',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Số điện thoại nhận vé & liên hệ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    if (nameCtrl.text.trim().isNotEmpty && phoneCtrl.text.trim().isNotEmpty) {
                      setState(() {
                        _contactName = nameCtrl.text.trim();
                        _contactPhone = phoneCtrl.text.trim();
                      });
                      Navigator.pop(ctx);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF222222),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cập nhật thông tin', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Dòng điều chỉnh số lượng từng loại khách
  Widget _buildGuestRow({
    required String title,
    required String subtitle,
    required int count,
    required bool canDecrease,
    required bool canIncrease,
    required VoidCallback onDecrease,
    required VoidCallback onIncrease,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 13, color: Color(0xFF717171))),
          ],
        ),
        Row(
          children: [
            _buildRoundCounterBtn(icon: Icons.remove, isEnabled: canDecrease, onTap: onDecrease),
            SizedBox(
              width: 38,
              child: Text(
                count.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF222222)),
              ),
            ),
            _buildRoundCounterBtn(icon: Icons.add, isEnabled: canIncrease, onTap: onIncrease),
          ],
        ),
      ],
    );
  }

  Widget _buildRoundCounterBtn({required IconData icon, required bool isEnabled, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isEnabled ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: isEnabled ? const Color(0xFFB0B0B0) : const Color(0xFFEBEBEB), width: 1),
          ),
          child: Icon(icon, size: 16, color: isEnabled ? const Color(0xFF222222) : const Color(0xFFD6D6D6)),
        ),
      ),
    );
  }

  /// Mở modal xem chi tiết giá
  void _openPriceDetailsModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Chi tiết giá', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF222222))),
                    IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${_priceFormatter.format(_selectedDeparture.price)} VND x $_payingGuestsCount khách', style: const TextStyle(fontSize: 15, color: Color(0xFF4B5563))),
                    Text('${_priceFormatter.format(_subtotalPrice)} VND', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  ],
                ),
                if (_discountAmount > 0) ...[
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Ưu đãi Voucher (${_selectedVoucher?.code})', style: const TextStyle(fontSize: 15, color: Colors.deepOrange, fontWeight: FontWeight.w600)),
                      Text('-${_priceFormatter.format(_discountAmount)} VND', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.deepOrange)),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Phí dịch vụ & VAT', style: TextStyle(fontSize: 14.5, color: Color(0xFF4B5563))),
                    Text('Đã bao gồm', style: TextStyle(fontSize: 14, color: AppColors.success, fontWeight: FontWeight.w600)),
                  ],
                ),
                const Divider(height: 28, color: Color(0xFFF0F0F0)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    Text(
                      '${_priceFormatter.format(_totalPrice)} VND',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary),
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

  /// Xử lý tạo booking và chuyển sang màn hình Thanh toán PayOS
  Future<void> _handleProceedToPayment() async {
    setState(() => _isCreatingBooking = true);

    try {
      final tokenStorage = TokenStorage();
      final token = await tokenStorage.getAccessToken();

      String bookingId = '';

      final isTourUuid = RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(widget.tour.id);
      final isDepUuid = RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(_selectedDeparture.id);

      if (token != null && token.isNotEmpty && isTourUuid && isDepUuid) {
        try {
          final api = widget.apiClient ?? ApiClient();
          final res = await api.post<Map<String, dynamic>>(
            ApiEndpoints.bookings,
            data: {
              'tourId': widget.tour.id,
              'departureId': _selectedDeparture.id,
              'participants': _payingGuestsCount,
              'contact': {
                'fullName': _contactName,
                'phone': _contactPhone,
              },
              if (_selectedVoucher != null) 'promotionCode': _selectedVoucher!.code,
            },
          );

          if (res.data != null && res.data!['data'] is Map) {
            bookingId = res.data!['data']['id']?.toString() ?? '';
          }
        } catch (err) {
          debugPrint('[TourBookingCheckoutScreen] create booking error: $err');
        }
      }

      if (bookingId.isEmpty) {
        bookingId = 'd3b07384-d113-46fb-9c8e-${DateTime.now().millisecondsSinceEpoch.toString().padLeft(12, '0').substring(0, 12)}';
      }

      // SHOPEE RULE: Đánh dấu voucher đã dùng để KHÔNG BAO GIỜ dùng lại được nữa!
      if (_selectedVoucher != null) {
        await _voucherStorage.markVoucherAsUsed(_selectedVoucher!.id, bookingId: bookingId);
      }

      final userInfo = await tokenStorage.getUserInfo();
      if (!mounted) return;
      final customerName = _contactName.isNotEmpty ? _contactName : (userInfo['name'] ?? 'Khách hàng Tripri');
      final customerAvatar = userInfo['avatarUrl'];

      // Mở màn hình Thanh toán PayOS
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => PaymentScreen(
            bookingId: bookingId,
            tourTitle: widget.tour.title,
            thumbnailUrl: widget.tour.coverImage,
            departureDate: _selectedDeparture.date,
            guestsCount: _adultsCount + _childrenCount + _infantsCount,
            totalAmount: _totalPrice,
            contactName: customerName,
            customerAvatarUrl: customerAvatar,
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isCreatingBooking = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentStep == 1,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          if (_currentStep == 3) {
            setState(() => _currentStep = 2);
          } else if (_currentStep == 2) {
            setState(() => _currentStep = 1);
          }
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. THANH TOP BAR
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (_currentStep > 1)
                      IconButton(
                        icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF222222)),
                        onPressed: () {
                          setState(() => _currentStep--);
                        },
                      )
                    else
                      const SizedBox(width: 48, height: 48),

                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Color(0xFF222222)),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // 2. TIÊU ĐỀ THEO BƯỚC
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 2, 20, 16),
                child: Text(
                  _currentStep == 1
                      ? 'Kiểm tra và tiếp tục'
                      : _currentStep == 2
                          ? 'Phương thức thanh toán'
                          : 'Xác nhận đơn đặt tour',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF222222),
                    letterSpacing: -0.5,
                  ),
                ),
              ),

              // 3. NỘI DUNG CUỘN THEO TỪNG BƯỚC
              Expanded(
                child: _currentStep == 1
                    ? _buildStep1ReviewAndContinue()
                    : _currentStep == 2
                        ? _buildStep2PaymentMethod()
                        : _buildStep3FinalOverview(),
              ),

              // 4. THANH TIẾN TRÌNH 3 BƯỚC & NÚT HÀNH ĐỘNG DƯỚI ĐÁY
              _buildBottomControls(),
            ],
          ),
        ),
      ),
    );
  }

  /// GIAO DIỆN BƯỚC 1: Kiểm tra thông tin & Áp dụng voucher
  Widget _buildStep1ReviewAndContinue() {
    final tour = widget.tour;
    final heroImg = tour.images.isNotEmpty ? tour.images.first : '';

    return SingleChildScrollView(
      key: const ValueKey(1),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card: Thumbnail + Tên tour + Rating
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: heroImg.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: heroImg,
                          width: 82,
                          height: 82,
                          fit: BoxFit.cover,
                          errorWidget: (context, url, error) => _buildPlaceholderImage(),
                        )
                      : _buildPlaceholderImage(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tour.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: Color(0xFF222222), height: 1.3),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, size: 16, color: Color(0xFF222222)),
                          const SizedBox(width: 3),
                          Text(
                            '${tour.ratingAvg > 0 ? tour.ratingAvg.toStringAsFixed(2) : "5.0"} (${tour.ratingCount > 0 ? tour.ratingCount : 2})',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF222222)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF0F0F0))),

            // Mục Ngày
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Ngày', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                      const SizedBox(height: 3),
                      Text(
                        _formatDateRange(_selectedDeparture.date, tour.durationDays),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF4B5563)),
                      ),
                    ],
                  ),
                ),
                _buildPillActionButton(label: 'Thay đổi', onPressed: _openChangeDateModal),
              ],
            ),

            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF0F0F0))),

            // Mục Khách
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Khách', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                      const SizedBox(height: 3),
                      Text(
                        _guestsSummaryText,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF4B5563)),
                      ),
                    ],
                  ),
                ),
                _buildPillActionButton(label: 'Thay đổi', onPressed: _openChangeGuestsModal),
              ],
            ),

            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF0F0F0))),

            // Mục Tổng giá & Áp dụng voucher
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tổng giá', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                      const SizedBox(height: 3),
                      Text(
                        '${_priceFormatter.format(_subtotalPrice)} VND',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: _discountAmount > 0 ? const Color(0xFF94A3B8) : AppColors.primary,
                          decoration: _discountAmount > 0 ? TextDecoration.lineThrough : null,
                        ),
                      ),
                    ],
                  ),
                ),
                _buildPillActionButton(label: 'Chi tiết', onPressed: _openPriceDetailsModal),
              ],
            ),

            // NÚT ÁP DỤNG VOUCHER (ĐẶT Ở DƯỚI PHẦN TOTAL PRICE THEO YÊU CẦU)
            const SizedBox(height: 14),
            InkWell(
              onTap: _openVoucherModal,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: _selectedVoucher != null ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _selectedVoucher != null ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
                    width: 1.2,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: _selectedVoucher != null ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.confirmation_number_rounded,
                        size: 18,
                        color: _selectedVoucher != null ? Colors.white : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text('Ưu đãi & Voucher', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                              if (_selectedVoucher != null) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
                                  child: Text(_selectedVoucher!.code, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _selectedVoucher != null
                                ? 'Đã giảm ${_priceFormatter.format(_discountAmount)} VND'
                                : 'Chọn hoặc nhập mã giảm giá',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: _selectedVoucher != null ? Colors.deepOrange : const Color(0xFF64748B),
                              fontWeight: _selectedVoucher != null ? FontWeight.w700 : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: _selectedVoucher != null ? const Color(0xFFF59E0B) : const Color(0xFF94A3B8),
                    ),
                  ],
                ),
              ),
            ),

            // Hiển thị tóm tắt sau khi đã trừ voucher
            if (_discountAmount > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tổng thanh toán sau giảm:', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF166534))),
                    Text(
                      '${_priceFormatter.format(_totalPrice)} VND',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.primary),
                    ),
                  ],
                ),
              ),
            ],

            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF0F0F0))),

            // Mục Hủy miễn phí
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hủy miễn phí', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF222222))),
                SizedBox(height: 4),
                Text(
                  'Hủy trước 5 ngày để được hoàn tiền đầy đủ theo chính sách của Tripri.',
                  style: TextStyle(fontSize: 13.5, color: Color(0xFF4B5563), height: 1.35),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// GIAO DIỆN BƯỚC 2: Chọn cổng thanh toán (Chỉ có PayOS, không bị tràn màn hình)
  Widget _buildStep2PaymentMethod() {
    final methods = [
      {
        'id': 'payos',
        'title': 'Cổng thanh toán PayOS',
        'subtitle': 'Quét mã VietQR chuyển khoản 24/7 · Xác nhận tự động',
        'icon': Icons.qr_code_scanner_rounded,
        'badge': 'Khuyên dùng',
      },
    ];

    return SingleChildScrollView(
      key: const ValueKey(2),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Cổng thanh toán trực tuyến được hỗ trợ:',
            style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          ...methods.map((m) {
            final id = m['id'] as String;
            final isSelected = _selectedPaymentMethod == id;

            return InkWell(
              onTap: () => setState(() => _selectedPaymentMethod = id),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF222222) : const Color(0xFFE5E7EB),
                    width: isSelected ? 2 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isSelected ? 0.05 : 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(m['icon'] as IconData, color: const Color(0xFF222222), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  m['title'] as String,
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF222222),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (m['badge'] != null) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    m['badge'] as String,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF166534),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            m['subtitle'] as String,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                      color: isSelected ? const Color(0xFF222222) : const Color(0xFF9CA3AF),
                      size: 22,
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  /// GIAO DIỆN BƯỚC 3: MÀN HÌNH TỔNG THỂ CUỐI CÙNG (Review tổng hợp, có nút Change, nút Thanh toán)
  Widget _buildStep3FinalOverview() {
    final tour = widget.tour;
    final heroImg = tour.images.isNotEmpty ? tour.images.first : '';

    String paymentMethodName = 'Cổng thanh toán PayOS';
    IconData paymentIcon = Icons.qr_code_scanner_rounded;
    if (_selectedPaymentMethod == 'atm') {
      paymentMethodName = 'Thẻ ATM & Ngân hàng nội địa';
      paymentIcon = Icons.account_balance_rounded;
    } else if (_selectedPaymentMethod == 'international') {
      paymentMethodName = 'Thẻ Quốc tế Visa/Mastercard';
      paymentIcon = Icons.credit_card_rounded;
    } else if (_selectedPaymentMethod == 'momo') {
      paymentMethodName = 'Ví điện tử MoMo';
      paymentIcon = Icons.account_balance_wallet_rounded;
    }

    return SingleChildScrollView(
      key: const ValueKey(3),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Kiểm tra lại toàn bộ thông tin đơn đặt tour trước khi thanh toán:',
            style: TextStyle(fontSize: 13.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),

          // 1. CARD THÔNG TIN TOUR & CHUYẾN ĐI
          _buildOverviewCard(
            title: 'Chuyến đi của bạn',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: heroImg.isNotEmpty
                          ? CachedNetworkImage(imageUrl: heroImg, width: 68, height: 68, fit: BoxFit.cover)
                          : _buildPlaceholderImage(),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tour.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(tour.destination, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 20, color: Color(0xFFF1F5F9)),

                // Ngày khởi hành (Có nút Change)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Ngày khởi hành', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        const SizedBox(height: 2),
                        Text(_formatDateRange(_selectedDeparture.date, tour.durationDays), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    _buildPillActionButton(label: 'Thay đổi', onPressed: _openChangeDateModal),
                  ],
                ),
                const Divider(height: 20, color: Color(0xFFF1F5F9)),

                // Số lượng khách (Có nút Change)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Số lượng khách', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        const SizedBox(height: 2),
                        Text(_guestsSummaryText, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    _buildPillActionButton(label: 'Thay đổi', onPressed: _openChangeGuestsModal),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 2. CARD THÔNG TIN NGƯỜI ĐẶT (LIÊN HỆ) (Có nút Change)
          _buildOverviewCard(
            title: 'Thông tin liên hệ',
            trailingAction: _buildPillActionButton(label: 'Thay đổi', onPressed: _openChangeContactModal),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.person_outline_rounded, size: 18, color: Color(0xFF64748B)),
                    const SizedBox(width: 8),
                    Text(_contactName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.phone_outlined, size: 18, color: Color(0xFF64748B)),
                    const SizedBox(width: 8),
                    Text(_contactPhone, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. CARD VOUCHER ĐÃ ÁP DỤNG (Có nút Change)
          _buildOverviewCard(
            title: 'Ưu đãi & Voucher',
            trailingAction: _buildPillActionButton(label: 'Thay đổi', onPressed: _openVoucherModal),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _selectedVoucher != null ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.confirmation_num_rounded,
                    color: _selectedVoucher != null ? const Color(0xFFB45309) : const Color(0xFF64748B),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedVoucher != null ? _selectedVoucher!.code : 'Chưa áp dụng voucher',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _selectedVoucher != null
                            ? 'Giảm ${_priceFormatter.format(_discountAmount)} VND'
                            : 'Bấm thay đổi để áp dụng mã ưu đãi',
                        style: TextStyle(
                          fontSize: 12,
                          color: _selectedVoucher != null ? Colors.deepOrange : const Color(0xFF64748B),
                          fontWeight: _selectedVoucher != null ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 4. CARD CỔNG THANH TOÁN (Có nút Change)
          _buildOverviewCard(
            title: 'Phương thức thanh toán',
            trailingAction: _buildPillActionButton(
              label: 'Thay đổi',
              onPressed: () => setState(() => _currentStep = 2),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8)),
                  child: Icon(paymentIcon, color: const Color(0xFF222222), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(paymentMethodName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 5. CARD CHI TIẾT TỔNG THANH TOÁN
          _buildOverviewCard(
            title: 'Chi tiết thanh toán',
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Giá vé ($_payingGuestsCount khách)', style: const TextStyle(fontSize: 13.5, color: Color(0xFF64748B))),
                    Text('${_priceFormatter.format(_subtotalPrice)} VND', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                  ],
                ),
                if (_discountAmount > 0) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Voucher giảm giá (${_selectedVoucher?.code})', style: const TextStyle(fontSize: 13.5, color: Colors.deepOrange, fontWeight: FontWeight.w600)),
                      Text('-${_priceFormatter.format(_discountAmount)} VND', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Colors.deepOrange)),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Phí dịch vụ & VAT', style: TextStyle(fontSize: 13.5, color: Color(0xFF64748B))),
                    Text('Đã bao gồm', style: TextStyle(fontSize: 13, color: AppColors.success, fontWeight: FontWeight.w600)),
                  ],
                ),
                const Divider(height: 20, color: Color(0xFFF1F5F9)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
                    Text(
                      '${_priceFormatter.format(_totalPrice)} VND',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.primary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewCard({required String title, required Widget child, Widget? trailingAction}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              if (trailingAction != null) trailingAction,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  /// Phần điều khiển dưới đáy: Steps (3 bước) & Nút hành động
  Widget _buildBottomControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFF0F0F0), width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. THANH TIẾN TRÌNH 3 BƯỚC
          Row(
            children: [
              // Bước 1
              Expanded(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(color: const Color(0xFF222222), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(width: 6),
              // Bước 2
              Expanded(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: _currentStep >= 2 ? const Color(0xFF222222) : const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              // Bước 3
              Expanded(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: _currentStep == 3 ? AppColors.primary : const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // 2. NÚT HÀNH ĐỘNG
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isCreatingBooking
                  ? null
                  : () {
                      if (_currentStep == 1) {
                        setState(() => _currentStep = 2);
                        _saveDraft();
                      } else if (_currentStep == 2) {
                        setState(() => _currentStep = 3);
                        _saveDraft();
                      } else {
                        // Bước 3: Nút thanh toán cuối cùng
                        _handleProceedToPayment();
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: _currentStep == 3 ? AppColors.primary : const Color(0xFF222222),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _isCreatingBooking
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                  : Text(
                      _currentStep == 1
                          ? 'Tiếp tục'
                          : _currentStep == 2
                              ? 'Tiếp tục'
                              : 'Thanh toán ngay · ${_priceFormatter.format(_totalPrice)} VND',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Nút nhỏ pill "Thay đổi" / "Chi tiết"
  Widget _buildPillActionButton({
    required String label,
    required VoidCallback onPressed,
  }) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F7F7),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 0.8),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Color(0xFF222222),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      width: 82,
      height: 82,
      color: const Color(0xFFF3F4F6),
      child: const Icon(Icons.image_outlined, color: AppColors.textMuted),
    );
  }
}
