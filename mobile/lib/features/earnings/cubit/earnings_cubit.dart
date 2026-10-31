import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../api/earnings_api.dart';
import '../models/earnings_models.dart';
import '../utils/earnings_format.dart';

class EarningsState extends Equatable {
  const EarningsState({
    this.filter = EarningsFilter.thisMonth,
    this.listLoading = false,
    this.loadingMore = false,
    this.summaryLoading = false,
    this.bankLoading = false,
    this.savingBank = false,
    this.listError,
    this.summaryError,
    this.bankError,
    this.items = const [],
    this.summary,
    this.bankAccount,
    this.page = 1,
    this.totalPages = 1,
  });

  final EarningsFilter filter;
  final bool listLoading;
  final bool loadingMore;
  final bool summaryLoading;
  final bool bankLoading;
  final bool savingBank;
  final String? listError;
  final String? summaryError;
  final String? bankError;
  final List<Earning> items;
  final EarningsSummary? summary;
  final BankAccount? bankAccount;
  final int page;
  final int totalPages;

  bool get canLoadMore => page < totalPages;

  EarningsState copyWith({
    EarningsFilter? filter,
    bool? listLoading,
    bool? loadingMore,
    bool? summaryLoading,
    bool? bankLoading,
    bool? savingBank,
    String? listError,
    String? summaryError,
    String? bankError,
    List<Earning>? items,
    EarningsSummary? summary,
    BankAccount? bankAccount,
    bool clearBankAccount = false,
    int? page,
    int? totalPages,
    bool clearListError = false,
    bool clearSummaryError = false,
    bool clearBankError = false,
  }) {
    return EarningsState(
      filter: filter ?? this.filter,
      listLoading: listLoading ?? this.listLoading,
      loadingMore: loadingMore ?? this.loadingMore,
      summaryLoading: summaryLoading ?? this.summaryLoading,
      bankLoading: bankLoading ?? this.bankLoading,
      savingBank: savingBank ?? this.savingBank,
      listError: clearListError ? null : (listError ?? this.listError),
      summaryError: clearSummaryError ? null : (summaryError ?? this.summaryError),
      bankError: clearBankError ? null : (bankError ?? this.bankError),
      items: items ?? this.items,
      summary: summary ?? this.summary,
      bankAccount: clearBankAccount ? null : (bankAccount ?? this.bankAccount),
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
    );
  }

  @override
  List<Object?> get props => [
        filter,
        listLoading,
        loadingMore,
        summaryLoading,
        bankLoading,
        savingBank,
        listError,
        summaryError,
        bankError,
        items,
        summary,
        bankAccount,
        page,
        totalPages,
      ];
}

class EarningsCubit extends Cubit<EarningsState> {
  EarningsCubit(this._api, {DateTime Function()? clock})
      : _clock = clock ?? DateTime.now,
        super(const EarningsState());

  final EarningsApi _api;
  final DateTime Function() _clock;

  /// Per-section counters: a retry of one section must not orphan another section's in-flight request.
  int _listGeneration = 0;
  int _summaryGeneration = 0;
  int _bankGeneration = 0;

  Future<void> load() async {
    final listGeneration = ++_listGeneration;
    final summaryGeneration = ++_summaryGeneration;
    final bankGeneration = ++_bankGeneration;
    emit(state.copyWith(
      listLoading: true,
      summaryLoading: true,
      bankLoading: true,
      page: 1,
      clearListError: true,
      clearSummaryError: true,
      clearBankError: true,
    ));
    await Future.wait([
      _fetchList(listGeneration, page: 1),
      _fetchSummary(summaryGeneration),
      _fetchBank(bankGeneration),
    ]);
  }

  Future<void> refresh() async {
    final listGeneration = ++_listGeneration;
    final summaryGeneration = ++_summaryGeneration;
    final bankGeneration = ++_bankGeneration;
    emit(state.copyWith(
      listLoading: true,
      summaryLoading: true,
      bankLoading: true,
      page: 1,
      clearListError: true,
      clearSummaryError: true,
      clearBankError: true,
    ));
    await Future.wait([
      _fetchList(listGeneration, page: 1),
      _fetchSummary(summaryGeneration),
      _fetchBank(bankGeneration),
    ]);
  }

  Future<void> retrySummary() async {
    final generation = ++_summaryGeneration;
    emit(state.copyWith(summaryLoading: true, clearSummaryError: true));
    await _fetchSummary(generation);
  }

  Future<void> retryList() async {
    final generation = ++_listGeneration;
    emit(state.copyWith(listLoading: true, clearListError: true));
    await _fetchList(generation, page: 1);
  }

  Future<void> retryBank() async {
    final generation = ++_bankGeneration;
    emit(state.copyWith(bankLoading: true, clearBankError: true));
    await _fetchBank(generation);
  }

  Future<void> selectFilter(EarningsFilter filter) async {
    if (filter == state.filter) return;
    final listGeneration = ++_listGeneration;
    final summaryGeneration = ++_summaryGeneration;
    // The old range's numbers must not be presented as the new range's result.
    emit(EarningsState(
      filter: filter,
      listLoading: true,
      summaryLoading: true,
      bankLoading: state.bankLoading,
      bankAccount: state.bankAccount,
      bankError: state.bankError,
    ));
    await Future.wait([
      _fetchList(listGeneration, page: 1),
      _fetchSummary(summaryGeneration),
    ]);
  }

  Future<void> loadMore() async {
    if (state.loadingMore || state.listLoading || !state.canLoadMore) return;
    final generation = _listGeneration;
    emit(state.copyWith(loadingMore: true, clearListError: true));
    await _fetchList(generation, page: state.page + 1, append: true);
  }

  /// Returns null on success, or the message to show when the save failed.
  Future<String?> saveBankAccount(BankAccount account) async {
    if (state.savingBank) return null;
    emit(state.copyWith(savingBank: true, clearBankError: true));
    try {
      final saved = await _api.saveBankAccount(account);
      emit(state.copyWith(
        savingBank: false,
        bankAccount: saved ?? account,
        bankLoading: false,
      ));
      return null;
    } on EarningsApiException catch (error) {
      emit(state.copyWith(savingBank: false, bankError: error.message));
      return error.message;
    } catch (_) {
      const message = 'Không lưu được tài khoản nhận thù lao. Vui lòng thử lại.';
      emit(state.copyWith(savingBank: false, bankError: message));
      return message;
    }
  }

  Future<void> _fetchList(int generation, {required int page, bool append = false}) async {
    final range = earningsRangeFor(state.filter, now: _clock());
    try {
      final result = await _api.fetchEarnings(
        from: range.from,
        to: range.to,
        page: page,
      );
      if (generation != _listGeneration) return;
      emit(state.copyWith(
        listLoading: false,
        loadingMore: false,
        items: append ? _append(state.items, result.items) : result.items,
        page: result.page,
        totalPages: result.totalPages,
        clearListError: true,
      ));
    } on EarningsApiException catch (error) {
      if (generation != _listGeneration) return;
      emit(state.copyWith(
        listLoading: false,
        loadingMore: false,
        listError: error.message,
      ));
    } catch (_) {
      if (generation != _listGeneration) return;
      emit(state.copyWith(
        listLoading: false,
        loadingMore: false,
        listError: 'Không tải được lịch sử thu nhập. Vui lòng thử lại.',
      ));
    }
  }

  Future<void> _fetchSummary(int generation) async {
    final range = earningsRangeFor(state.filter, now: _clock());
    try {
      final summary = await _api.fetchSummary(from: range.from, to: range.to);
      if (generation != _summaryGeneration) return;
      emit(state.copyWith(
        summaryLoading: false,
        summary: summary,
        clearSummaryError: true,
      ));
    } on EarningsApiException catch (error) {
      if (generation != _summaryGeneration) return;
      emit(state.copyWith(summaryLoading: false, summaryError: error.message));
    } catch (_) {
      if (generation != _summaryGeneration) return;
      emit(state.copyWith(
        summaryLoading: false,
        summaryError: 'Không tải được tổng hợp thu nhập. Vui lòng thử lại.',
      ));
    }
  }

  Future<void> _fetchBank(int generation) async {
    try {
      final bank = await _api.fetchBankAccount();
      if (generation != _bankGeneration) return;
      emit(state.copyWith(
        bankLoading: false,
        bankAccount: bank,
        clearBankAccount: bank == null,
        clearBankError: true,
      ));
    } on EarningsApiException catch (error) {
      if (generation != _bankGeneration) return;
      emit(state.copyWith(bankLoading: false, bankError: error.message));
    } catch (_) {
      if (generation != _bankGeneration) return;
      emit(state.copyWith(
        bankLoading: false,
        bankError: 'Không tải được tài khoản nhận thù lao.',
      ));
    }
  }

  List<Earning> _append(List<Earning> current, List<Earning> next) {
    final ids = current.map((earning) => earning.id).toSet();
    return [...current, ...next.where((earning) => ids.add(earning.id))];
  }
}
