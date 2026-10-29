import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/tour_search_cubit.dart';
import '../bloc/tour_search_state.dart';
import '../models/category_model.dart';
import '../models/tour_model.dart';
import '../widgets/tour_card_vertical.dart';

/// Màn hình Tìm kiếm & Lọc Tour du lịch (AC4)
class TourSearchScreen extends StatelessWidget {
  final String? initialCategoryId;
  final String? initialQuery;
  final List<CategoryModel>? categories;

  const TourSearchScreen({
    super.key,
    this.initialCategoryId,
    this.initialQuery,
    this.categories,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => TourSearchCubit()
        ..init(
          initialCategoryId: initialCategoryId,
          initialQuery: initialQuery,
          categories: categories,
        ),
      child: const _TourSearchView(),
    );
  }
}

class _TourSearchView extends StatefulWidget {
  const _TourSearchView();

  @override
  State<_TourSearchView> createState() => _TourSearchViewState();
}

class _TourSearchViewState extends State<_TourSearchView> {
  late TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    final cubit = context.read<TourSearchCubit>();
    _searchController = TextEditingController(text: cubit.state.searchQuery);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onTourTap(TourModel tour) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đang mở chi tiết: ${tour.title}'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Container(
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(21),
              border: Border.all(color: AppColors.border),
            ),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: (val) => context.read<TourSearchCubit>().search(),
              onChanged: (val) => context.read<TourSearchCubit>().updateQuery(val),
              style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Tìm kiếm tour, điểm đến...',
                hintStyle: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          context.read<TourSearchCubit>().updateQuery('');
                          context.read<TourSearchCubit>().search();
                          setState(() {});
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
        ),
      ),
      body: BlocBuilder<TourSearchCubit, TourSearchState>(
        builder: (context, state) {
          return Column(
            children: [
              // 1. Thanh lọc danh mục (Filter Chips)
              if (state.categories.isNotEmpty) _buildCategoryFilterBar(context, state),

              // 2. Thanh lọc sắp xếp (Sort Bar)
              _buildSortBar(context, state),

              const Divider(height: 1, color: AppColors.border),

              // 3. Danh sách kết quả tìm kiếm
              Expanded(
                child: _buildResultContent(context, state),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCategoryFilterBar(BuildContext context, TourSearchState state) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SizedBox(
        height: 38,
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          scrollDirection: Axis.horizontal,
          itemCount: state.categories.length + 1,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            if (index == 0) {
              final isAllSelected = state.selectedCategoryId == null;
              return FilterChip(
                label: const Text('Tất cả'),
                selected: isAllSelected,
                selectedColor: AppColors.primarySurface,
                checkmarkColor: AppColors.primary,
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: isAllSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isAllSelected ? AppColors.primary : AppColors.textSecondary,
                ),
                backgroundColor: AppColors.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(
                    color: isAllSelected ? AppColors.primary : AppColors.border,
                  ),
                ),
                onSelected: (_) => context.read<TourSearchCubit>().selectCategory(null),
              );
            }

            final category = state.categories[index - 1];
            final isSelected = state.selectedCategoryId == category.id;

            return FilterChip(
              avatar: Icon(
                category.iconData,
                size: 15,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
              ),
              label: Text(category.name),
              selected: isSelected,
              selectedColor: AppColors.primarySurface,
              checkmarkColor: AppColors.primary,
              labelStyle: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
              ),
              backgroundColor: AppColors.background,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.border,
                ),
              ),
              onSelected: (_) => context.read<TourSearchCubit>().selectCategory(category.id),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSortBar(BuildContext context, TourSearchState state) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '${state.tours.length} tour phù hợp',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          DropdownButton<String>(
            value: state.selectedSort,
            underline: const SizedBox.shrink(),
            isDense: true,
            icon: const Icon(Icons.swap_vert_rounded, size: 18, color: AppColors.primary),
            items: const [
              DropdownMenuItem(value: 'rating', child: Text('Đánh giá cao', style: TextStyle(fontSize: 12.5))),
              DropdownMenuItem(value: 'newest', child: Text('Mới nhất', style: TextStyle(fontSize: 12.5))),
              DropdownMenuItem(value: 'price_asc', child: Text('Giá thấp - cao', style: TextStyle(fontSize: 12.5))),
              DropdownMenuItem(value: 'price_desc', child: Text('Giá cao - thấp', style: TextStyle(fontSize: 12.5))),
            ],
            onChanged: (val) {
              if (val != null) {
                context.read<TourSearchCubit>().setSort(val);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildResultContent(BuildContext context, TourSearchState state) {
    if (state.status == TourSearchStatus.loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (state.status == TourSearchStatus.failure) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
              const SizedBox(height: 12),
              Text(
                state.errorMessage ?? 'Đã xảy ra lỗi tìm kiếm',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.read<TourSearchCubit>().search(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    if (state.tours.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.search_off_rounded, size: 36, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              const Text(
                'Không tìm thấy tour phù hợp',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Hãy thử thay đổi từ khóa hoặc bộ lọc danh mục xem sao nhé!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: state.tours.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final tour = state.tours[index];
        return TourCardVertical(
          tour: tour,
          onTap: () => _onTourTap(tour),
        );
      },
    );
  }
}
