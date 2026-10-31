import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/booking_create_bloc.dart';
import '../bloc/booking_create_event.dart';
import '../bloc/booking_create_state.dart';
import '../widgets/booking_contact_form_widget.dart';
import '../widgets/booking_price_summary_widget.dart';
import '../widgets/booking_voucher_picker_modal.dart';
import 'booking_success_screen.dart';

class BookingCreateScreen extends StatefulWidget {
  final String tourId;
  final String departureId;
  final String tourTitle;
  final int departurePrice; // VND
  final int remainingSeats;
  final DateTime? departureDate;
  final String? initialFullName;
  final String? initialPhone;

  const BookingCreateScreen({
    super.key,
    required this.tourId,
    required this.departureId,
    required this.tourTitle,
    required this.departurePrice,
    required this.remainingSeats,
    this.departureDate,
    this.initialFullName,
    this.initialPhone,
  });

  @override
  State<BookingCreateScreen> createState() => _BookingCreateScreenState();
}

class _BookingCreateScreenState extends State<BookingCreateScreen> {
  late final BookingCreateBloc _bloc;

  @override
  void initState() {
    super.initState();
    _bloc = BookingCreateBloc()
      ..add(BookingCreateInitEvent(
        tourId: widget.tourId,
        departureId: widget.departureId,
        tourTitle: widget.tourTitle,
        departurePrice: widget.departurePrice,
        remainingSeats: widget.remainingSeats,
        departureDate: widget.departureDate,
        initialFullName: widget.initialFullName,
        initialPhone: widget.initialPhone,
      ));
  }

  @override
  void dispose() {
    _bloc.close();
    super.dispose();
  }

  void _showVoucherModal(BuildContext context, BookingCreateState state) {
    BookingVoucherPickerModal.show(
      context: context,
      vouchers: state.vouchers,
      selectedVoucher: state.selectedVoucher,
      currentSubtotal: state.estimatedSubtotal,
      isLoading: state.isLoadingVouchers,
      onApplyCode: (code) => _bloc.add(BookingCreateApplyVoucherCodeEvent(code)),
      onSelectVoucher: (voucher) => _bloc.add(BookingCreateSelectVoucherItemEvent(voucher)),
      onRemoveVoucher: () => _bloc.add(const BookingCreateRemoveVoucherEvent()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat('#,###', 'vi_VN');

    return BlocProvider.value(
      value: _bloc,
      child: BlocConsumer<BookingCreateBloc, BookingCreateState>(
        listener: (context, state) {
          if (state.submitSuccess && state.createdBooking != null) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => BookingSuccessScreen(booking: state.createdBooking!),
              ),
            );
          } else if (state.generalError != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.generalError!),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          return Scaffold(
            backgroundColor: AppColors.background,
            appBar: AppBar(
              title: const Text(
                'Hoàn tất đặt tour',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              backgroundColor: AppColors.surface,
              elevation: 0,
              centerTitle: true,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            body: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Card tóm tắt Tour & Ngày khởi hành
                    _buildTourSummaryCard(currencyFormat),
                    const SizedBox(height: 16),

                    // Form thông tin người liên hệ & số khách
                    BookingContactFormWidget(
                      fullName: state.fullName,
                      phone: state.phone,
                      notes: state.notes,
                      participants: state.participants,
                      maxParticipants: state.remainingSeats,
                      fullNameError: state.fullNameError,
                      phoneError: state.phoneError,
                      onFullNameChanged: (val) => _bloc.add(BookingCreateContactChangedEvent(fullName: val)),
                      onPhoneChanged: (val) => _bloc.add(BookingCreateContactChangedEvent(phone: val)),
                      onNotesChanged: (val) => _bloc.add(BookingCreateContactChangedEvent(notes: val)),
                      onParticipantsChanged: (val) => _bloc.add(BookingCreateParticipantsChangedEvent(val)),
                    ),
                    const SizedBox(height: 16),

                    // Card tóm tắt chi phí & voucher
                    BookingPriceSummaryWidget(
                      unitPrice: state.departurePrice,
                      participants: state.participants,
                      subtotal: state.estimatedSubtotal,
                      discountAmount: state.discountAmount,
                      totalAmount: state.estimatedTotal,
                      previewResult: state.previewResult,
                      voucherError: state.voucherError,
                      onOpenVoucherPicker: () => _showVoucherModal(context, state),
                      onRemoveVoucher: () => _bloc.add(const BookingCreateRemoveVoucherEvent()),
                    ),
                    const SizedBox(height: 100), // Khoảng trống cho bottom bar
                  ],
                ),
              ),
            ),
            bottomSheet: _buildBottomBar(state, currencyFormat),
          );
        },
      ),
    );
  }

  Widget _buildTourSummaryCard(NumberFormat currencyFormat) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.explore_outlined, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.tourTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (widget.departureDate != null)
                      Row(
                        children: [
                          const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Text(
                            'Khởi hành: ${DateFormat('dd/MM/yyyy').format(widget.departureDate!.toLocal())}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.border),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('Đơn giá: ', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  Text(
                    '${currencyFormat.format(widget.departurePrice)} ₫',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  const Text('/khách', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: widget.remainingSeats <= 3
                      ? AppColors.errorLight
                      : AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Còn ${widget.remainingSeats} chỗ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: widget.remainingSeats <= 3 ? AppColors.error : AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(BookingCreateState state, NumberFormat currencyFormat) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tạm tính',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  Text(
                    state.formattedTotal,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                // AC4: Nút bị disable khi đang gửi API
                onPressed: state.isSubmitting
                    ? null
                    : () => _bloc.add(const BookingCreateSubmitEvent()),
                style: ElevatedButton.styleFrom(
                  // AC4 & AC5: Nút Đặt tour dùng AppColors.secondary
                  backgroundColor: AppColors.secondary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.textMuted,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  elevation: 0,
                ),
                child: state.isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Đặt tour',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
