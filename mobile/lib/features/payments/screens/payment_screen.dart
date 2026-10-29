import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/payment_cubit.dart';
import '../bloc/payments_repository.dart';
import '../widgets/copy_row.dart';
import '../widgets/qr_card.dart';
import 'payment_success_screen.dart';

final _vnd = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

/// Màn hình thanh toán PayOS: tạo giao dịch, hiện QR VietQR, đếm ngược 15 phút, tự phát hiện thanh toán.
class PaymentScreen extends StatelessWidget {
  final String bookingId;
  final PaymentsRepository? repository;

  const PaymentScreen({super.key, required this.bookingId, this.repository});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => PaymentCubit(bookingId: bookingId, repository: repository)..start(),
      child: const _PaymentView(),
    );
  }
}

class _PaymentView extends StatelessWidget {
  const _PaymentView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<PaymentCubit, PaymentState>(
      listener: (context, state) {
        if (state is PaymentPaid) {
          // AC4: tự chuyển sang màn hình xác nhận ngay khi thanh toán thành công.
          Navigator.of(context).pushReplacement(MaterialPageRoute(
            builder: (_) => PaymentSuccessScreen(bookingId: state.bookingId),
          ));
        }
      },
      builder: (context, state) => Scaffold(
        appBar: AppBar(title: const Text('Thanh toán PayOS')),
        body: SafeArea(
          child: switch (state) {
            PaymentLoading() || PaymentPaid() => const Center(child: CircularProgressIndicator()),
            PaymentFailure() => _ErrorBody(message: state.message),
            PaymentExpired() => const _ExpiredBody(),
            PaymentAwaiting() => _AwaitingBody(state: state),
          },
        ),
      ),
    );
  }
}

class _AwaitingBody extends StatelessWidget {
  final PaymentAwaiting state;
  const _AwaitingBody({required this.state});

  String _clock(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _openBankApp(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await launchUrl(Uri.parse(state.checkout.checkoutUrl), mode: LaunchMode.externalApplication);
    if (!ok) {
      messenger.showSnackBar(const SnackBar(content: Text('Không mở được ứng dụng ngân hàng')));
    }
  }

  Future<void> _copyAll(BuildContext context, String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã sao chép')));
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<PaymentCubit>();
    final bank = state.checkout.bankTransfer;
    final urgent = state.remaining.inMinutes < 3;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(
            color: urgent ? AppColors.errorLight : AppColors.secondaryLight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.timer_outlined, color: urgent ? AppColors.error : AppColors.warning),
              const SizedBox(width: 8),
              const Text('Thời gian còn lại: '),
              Text(
                _clock(state.remaining),
                key: const Key('countdown'),
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: urgent ? AppColors.error : AppColors.warning,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: QrCard(
            data: (bank != null && bank.qrCode.isNotEmpty) ? bank.qrCode : state.checkout.checkoutUrl,
            fileName: 'tripri_payos_qr_${state.checkout.paymentId}',
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                if (bank != null) ...[
                  CopyRow(label: 'Số tài khoản', value: bank.accountNumber),
                  if (bank.accountName.isNotEmpty) CopyRow(label: 'Chủ tài khoản', value: bank.accountName),
                  CopyRow(label: 'Nội dung chuyển khoản', value: bank.description),
                ],
                CopyRow(
                  label: 'Số tiền',
                  value: _vnd.format(state.checkout.amount),
                  emphasize: true,
                ),
              ],
            ),
          ),
        ),
        if (bank == null)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text(
              'Chưa có thông tin tài khoản, hãy bấm "Mở ứng dụng ngân hàng" để thanh toán trên trang PayOS.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ),
        const SizedBox(height: 16),
        if (bank != null)
          OutlinedButton.icon(
            onPressed: () => _copyAll(
              context,
              'Số tài khoản: ${bank.accountNumber}\nNội dung: ${bank.description}\nSố tiền: ${state.checkout.amount}',
            ),
            icon: const Icon(Icons.content_copy_rounded),
            label: const Text('Sao chép số tài khoản & nội dung'),
          ),
        const SizedBox(height: 8),
        ElevatedButton.icon(
          onPressed: () => _openBankApp(context),
          icon: const Icon(Icons.account_balance_rounded),
          label: const Text('Mở ứng dụng ngân hàng'),
        ),
        const SizedBox(height: 8),
        FilledButton.tonal(
          onPressed: state.checking ? null : () => cubit.check(manual: true),
          child: state.checking
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Tôi đã chuyển khoản'),
        ),
        if (state.notPaidYet)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text(
              'Chưa nhận được thanh toán. Nếu bạn vừa chuyển khoản, vui lòng đợi vài giây rồi thử lại.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
      ],
    );
  }
}

class _ExpiredBody extends StatelessWidget {
  const _ExpiredBody();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.timer_off_outlined, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            const Text('Đơn đã hết hạn thanh toán', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Đã quá 15 phút nên giao dịch này không còn hiệu lực. Vui lòng quay lại và tạo đơn đặt chỗ mới. '
              'Nếu bạn đã chuyển khoản, hệ thống sẽ tự đối soát và liên hệ với bạn.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
              child: const Text('Tạo đơn mới'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  final String message;
  const _ErrorBody({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 56, color: AppColors.error),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.read<PaymentCubit>().start(),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}
