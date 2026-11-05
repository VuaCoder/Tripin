import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/constants/app_colors.dart';
import '../cubit/earnings_cubit.dart';
import '../models/earnings_models.dart';

/// Form for the payout account, saved with `PATCH /users/me { bankAccount }`.
class BankAccountSheet extends StatefulWidget {
  const BankAccountSheet({super.key, this.initial});

  final BankAccount? initial;

  @override
  State<BankAccountSheet> createState() => _BankAccountSheetState();
}

class _BankAccountSheetState extends State<BankAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _bankController;
  late final TextEditingController _numberController;
  late final TextEditingController _holderController;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bankController = TextEditingController(text: widget.initial?.bankName ?? '');
    _numberController = TextEditingController(text: widget.initial?.accountNumber ?? '');
    _holderController = TextEditingController(text: widget.initial?.accountHolder ?? '');
  }

  @override
  void dispose() {
    _bankController.dispose();
    _numberController.dispose();
    _holderController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final message = await context.read<EarningsCubit>().saveBankAccount(
          BankAccount(
            bankName: _bankController.text.trim(),
            accountNumber: _numberController.text.trim(),
            accountHolder: _holderController.text.trim(),
          ),
        );
    if (!mounted) return;
    if (message == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _saving = false;
      _error = message;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Tài khoản nhận thù lao',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ),
                    IconButton(
                      onPressed: _saving ? null : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close, color: AppColors.textSecondary),
                      tooltip: 'Đóng',
                    ),
                  ],
                ),
                const Text(
                  'Thông tin dùng để công ty chuyển thù lao quyết toán. Vui lòng kiểm tra kỹ trước khi lưu.',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _bankController,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Ngân hàng',
                    hintText: 'Ví dụ: Vietcombank',
                  ),
                  validator: (value) =>
                      (value ?? '').trim().length < 2 ? 'Nhập tên ngân hàng' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _numberController,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(32),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Số tài khoản',
                    hintText: 'Chỉ gồm chữ số',
                  ),
                  validator: (value) {
                    final number = (value ?? '').trim();
                    if (!RegExp(r'^\d{6,32}$').hasMatch(number)) {
                      return 'Số tài khoản gồm 6–32 chữ số';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _holderController,
                  textCapitalization: TextCapitalization.characters,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _save(),
                  decoration: const InputDecoration(
                    labelText: 'Tên chủ thẻ',
                    hintText: 'Ví dụ: NGUYEN VAN A',
                  ),
                  validator: (value) =>
                      (value ?? '').trim().length < 2 ? 'Nhập tên chủ thẻ' : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.error, fontSize: 13),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Lưu tài khoản'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
