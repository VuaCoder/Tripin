import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/earnings/api/earnings_api.dart';
import 'package:mobile/features/earnings/cubit/earnings_cubit.dart';
import 'package:mobile/features/earnings/models/earnings_models.dart';

const _summary = EarningsSummary(
  totalAmount: 1500000,
  count: 2,
  byMonth: [EarningsMonth(month: '2026-10', totalAmount: 1500000, count: 2)],
);

const _earningA = Earning(
  id: 'e1',
  bookingCode: 'BK-1',
  tourId: 't1',
  tourTitle: 'Hạ Long 3N2Đ',
  amount: 750000,
);

const _earningB = Earning(
  id: 'e2',
  bookingCode: 'BK-2',
  tourId: 't2',
  tourTitle: 'Đà Nẵng 4N3Đ',
  amount: 1250000,
);

class FakeEarningsApi implements EarningsApi {
  FakeEarningsApi({
    this.items = const [],
    this.summary = const EarningsSummary(totalAmount: 0, count: 0, byMonth: []),
    this.bank,
    this.listError,
    this.summaryError,
    this.bankError,
    this.saveError,
  });

  final List<Earning> items;
  final EarningsSummary summary;
  final BankAccount? bank;
  final EarningsApiException? listError;
  final EarningsApiException? summaryError;
  final EarningsApiException? bankError;
  final EarningsApiException? saveError;

  int listCalls = 0;
  int lastPage = 1;
  int? lastLimit;
  String? lastFrom;
  String? lastTo;
  BankAccount? saved;

  @override
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  }) async {
    listCalls++;
    lastPage = page;
    lastLimit = limit;
    lastFrom = from;
    lastTo = to;
    if (listError != null) throw listError!;
    return EarningsPage(
      items: items,
      page: page,
      limit: limit,
      total: items.length,
      totalPages: 1,
    );
  }

  @override
  Future<EarningsSummary> fetchSummary({String? from, String? to}) async {
    if (summaryError != null) throw summaryError!;
    return summary;
  }

  @override
  Future<BankAccount?> fetchBankAccount() async {
    if (bankError != null) throw bankError!;
    return bank;
  }

  @override
  Future<BankAccount?> saveBankAccount(BankAccount account) async {
    if (saveError != null) throw saveError!;
    saved = account;
    return account;
  }
}

void main() {
  test('loads summary, list and bank account independently', () async {
    const bank = BankAccount(
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountHolder: 'NGUYEN VAN A',
    );
    final api = FakeEarningsApi(
      items: const [_earningA],
      summary: _summary,
      bank: bank,
    );
    final cubit = EarningsCubit(api, clock: () => DateTime.utc(2026, 10, 31, 12));

    await cubit.load();

    expect(cubit.state.summary?.totalAmount, 1500000);
    expect(cubit.state.summary?.count, 2);
    expect(cubit.state.items.single.tourTitle, 'Hạ Long 3N2Đ');
    expect(cubit.state.bankAccount?.bankName, 'Vietcombank');
    expect(cubit.state.listLoading, isFalse);
    expect(cubit.state.summaryLoading, isFalse);
    expect(cubit.state.bankLoading, isFalse);
    expect(api.lastFrom, '2026-09-30T17:00:00.000Z');
    expect(api.lastTo, '2026-10-31T16:59:59.999Z');
  });

  test('a summary failure does not empty the list and vice versa', () async {
    final summaryFail = FakeEarningsApi(
      items: const [_earningA],
      summaryError: const EarningsApiException(code: 'X', message: 'summary lỗi'),
    );
    final cubitA = EarningsCubit(summaryFail);
    await cubitA.load();
    expect(cubitA.state.items, hasLength(1));
    expect(cubitA.state.summaryError, 'summary lỗi');
    expect(cubitA.state.listError, isNull);

    final listFail = FakeEarningsApi(
      summary: _summary,
      listError: const EarningsApiException(code: 'X', message: 'list lỗi'),
    );
    final cubitB = EarningsCubit(listFail);
    await cubitB.load();
    expect(cubitB.state.summary?.count, 2);
    expect(cubitB.state.listError, 'list lỗi');
    expect(cubitB.state.summaryError, isNull);
  });

  test('retrying the summary does not drop an in-flight list request', () async {
    final api = _SlowApi();
    final cubit = EarningsCubit(api);

    final loading = cubit.load();
    await Future<void>.delayed(Duration.zero);
    await cubit.retrySummary();
    api.first.complete(
      const EarningsPage(items: [_earningA], page: 1, limit: 10, total: 1, totalPages: 1),
    );
    await loading;

    expect(cubit.state.items.map((item) => item.id), ['e1']);
    expect(cubit.state.listLoading, isFalse);
    expect(cubit.state.summaryLoading, isFalse);
  });

  test('changing the filter resets the page and drops the previous response', () async {
    final api = _SlowApi();
    final cubit = EarningsCubit(api, clock: () => DateTime.utc(2026, 10, 31, 12));

    final loading = cubit.load();
    await Future<void>.delayed(Duration.zero);
    final switching = cubit.selectFilter(EarningsFilter.all);
    api.second.complete(
      const EarningsPage(items: [_earningB], page: 1, limit: 10, total: 1, totalPages: 1),
    );
    await switching;
    api.first.complete(
      const EarningsPage(items: [_earningA], page: 1, limit: 10, total: 1, totalPages: 1),
    );
    await loading;

    expect(cubit.state.filter, EarningsFilter.all);
    expect(cubit.state.items.map((item) => item.id), ['e2']);
    expect(cubit.state.page, 1);
  });

  test('load more appends the next page without duplicates', () async {
    final api = _PagedApi();
    final cubit = EarningsCubit(api);
    await cubit.load();
    expect(cubit.state.items.map((item) => item.id), ['e1']);
    expect(cubit.state.canLoadMore, isTrue);

    await cubit.loadMore();

    expect(cubit.state.items.map((item) => item.id), ['e1', 'e2']);
    expect(cubit.state.page, 2);
    expect(cubit.state.canLoadMore, isFalse);
    expect(api.pages, [1, 2]);
  });

  test('saving the bank account reports success and failure', () async {
    const bank = BankAccount(
      bankName: 'Techcombank',
      accountNumber: '987654321',
      accountHolder: 'TRAN THI B',
    );
    final cubit = EarningsCubit(FakeEarningsApi());
    await cubit.load();

    expect(await cubit.saveBankAccount(bank), isNull);
    expect(cubit.state.bankAccount?.bankName, 'Techcombank');

    final failing = EarningsCubit(
      FakeEarningsApi(
        saveError: const EarningsApiException(code: 'VALIDATION_ERROR', message: 'Số tài khoản không hợp lệ'),
      ),
    );
    await failing.load();
    expect(await failing.saveBankAccount(bank), 'Số tài khoản không hợp lệ');
    expect(failing.state.bankError, 'Số tài khoản không hợp lệ');
    expect(failing.state.savingBank, isFalse);
  });
}

class _SlowApi implements EarningsApi {
  final first = Completer<EarningsPage>();
  final second = Completer<EarningsPage>();
  int _calls = 0;

  @override
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  }) {
    _calls++;
    return _calls == 1 ? first.future : second.future;
  }

  @override
  Future<EarningsSummary> fetchSummary({String? from, String? to}) async =>
      const EarningsSummary(totalAmount: 0, count: 0, byMonth: []);

  @override
  Future<BankAccount?> fetchBankAccount() async => null;

  @override
  Future<BankAccount?> saveBankAccount(BankAccount account) async => account;
}

class _PagedApi implements EarningsApi {
  final pages = <int>[];

  @override
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  }) async {
    pages.add(page);
    return EarningsPage(
      items: page == 1 ? const [_earningA] : const [_earningB],
      page: page,
      limit: limit,
      total: 2,
      totalPages: 2,
    );
  }

  @override
  Future<EarningsSummary> fetchSummary({String? from, String? to}) async =>
      const EarningsSummary(totalAmount: 0, count: 0, byMonth: []);

  @override
  Future<BankAccount?> fetchBankAccount() async => null;

  @override
  Future<BankAccount?> saveBankAccount(BankAccount account) async => account;
}
