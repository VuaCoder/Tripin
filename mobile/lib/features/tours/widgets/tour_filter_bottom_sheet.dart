import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/category_model.dart';
import '../models/tour_filter_criteria.dart';

/// Bottom Sheet Bộ lọc nâng cao đa tiêu chí phong cách Airbnb Mobile (Ảnh 2)
/// Thứ tự:
/// 1. Khoảng giá (Price) với Biểu đồ Histogram dạng cột màu hồng đỏ + RangeSlider + 2 ô Tối thiểu/Tối đa
/// 2. Danh mục du lịch (Categories) dạng Dropdown sổ xuống với Custom Checkbox tinh tế
/// 3. Đánh giá (Rating) từ 3★, 4★, 4.5★, 5★
class TourFilterBottomSheet extends StatefulWidget {
  final TourFilterCriteria initialCriteria;
  final List<CategoryModel> categories;
  final ValueChanged<TourFilterCriteria> onApply;
  final VoidCallback onReset;
  final int? matchingCount;

  const TourFilterBottomSheet({
    super.key,
    required this.initialCriteria,
    required this.categories,
    required this.onApply,
    required this.onReset,
    this.matchingCount,
  });

  static Future<void> show(
    BuildContext context, {
    required TourFilterCriteria initialCriteria,
    required List<CategoryModel> categories,
    required ValueChanged<TourFilterCriteria> onApply,
    required VoidCallback onReset,
    int? matchingCount,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TourFilterBottomSheet(
        initialCriteria: initialCriteria,
        categories: categories,
        onApply: onApply,
        onReset: onReset,
        matchingCount: matchingCount,
      ),
    );
  }

  @override
  State<TourFilterBottomSheet> createState() => _TourFilterBottomSheetState();
}

class _TourFilterBottomSheetState extends State<TourFilterBottomSheet> {
  // Giới hạn giá mặc định: 0đ - 30.000.000đ
  static const double _defaultMinPrice = 0.0;
  static const double _defaultMaxPrice = 30000000.0;

  // Dữ liệu mô phỏng phân bố tần suất giá theo dạng hình chuông (Histogram) như Airbnb
  static const List<double> _histogramDistribution = [
    6, 8, 12, 16, 22, 30, 42, 58, 74, 88, 95, 92, 85, 90, 78, 84, 72, 68,
    62, 65, 56, 50, 44, 38, 34, 28, 24, 20, 16, 14, 12, 10, 8, 6, 5, 4,
  ];

  late double _minPrice;
  late double _maxPrice;
  late Set<String> _selectedCategoryIds;
  double? _selectedRating;



  // Trạng thái mở/đóng dropdown danh mục du lịch
  bool _isCategoriesOpen = true;

  final _currencyFormat = NumberFormat('#,###', 'vi_VN');

  @override
  void initState() {
    super.initState();
    _minPrice = widget.initialCriteria.minPrice ?? _defaultMinPrice;
    _maxPrice = widget.initialCriteria.maxPrice ?? _defaultMaxPrice;
    _selectedCategoryIds = Set.from(widget.initialCriteria.categoryIds);
    _selectedRating = widget.initialCriteria.minRating;
  }

  void _resetLocal() {
    setState(() {
      _minPrice = _defaultMinPrice;
      _maxPrice = _defaultMaxPrice;
      _selectedCategoryIds.clear();
      _selectedRating = null;
    });
    widget.onReset();
  }

  void _applyLocal() {
    final isPriceDefault = _minPrice == _defaultMinPrice && _maxPrice == _defaultMaxPrice;

    final criteria = widget.initialCriteria.copyWith(
      minPrice: isPriceDefault ? null : _minPrice,
      maxPrice: isPriceDefault ? null : _maxPrice,
      clearPrice: isPriceDefault,
      categoryIds: _selectedCategoryIds,
      minRating: _selectedRating,
      clearRating: _selectedRating == null,
    );

    widget.onApply(criteria);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      constraints: BoxConstraints(maxHeight: screenHeight * 0.90),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header: Tiêu đề "Bộ lọc" bên trái, nút đóng "X" bên phải (như Ảnh 2)
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 10, 14, 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Bộ lọc',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF222222),
                    letterSpacing: -0.4,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  splashRadius: 20,
                  icon: const Icon(
                    Icons.close_rounded,
                    color: Color(0xFF222222),
                    size: 22,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Nội dung bộ lọc cuộn mượt mà: Khoảng giá -> Danh mục -> Đánh giá
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─────────────────────────────────────────────────────────────
                  // 1. KHOẢNG GIÁ (Price) VỚI BIỂU ĐỒ CỘT VÀ RANGE SLIDER (ẢNH 2)
                  // ─────────────────────────────────────────────────────────────
                  const Text(
                    'Khoảng giá',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Biểu đồ Histogram dạng cột phân bố tần suất giá (Ảnh 2)
                  SizedBox(
                    height: 75,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: List.generate(_histogramDistribution.length, (index) {
                        final barHeight = _histogramDistribution[index] * 0.75;
                        final totalBars = _histogramDistribution.length;
                        final barPrice = _defaultMinPrice +
                            (index / totalBars) * (_defaultMaxPrice - _defaultMinPrice);

                        // Cột nằm trong khoảng chọn thì có màu xanh chủ đạo, ngoài thì màu xám nhạt
                        final isSelected = barPrice >= _minPrice && barPrice <= _maxPrice;

                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 1.0),
                            child: Container(
                              height: barHeight,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.primary
                                    : const Color(0xFFE2E8F0),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),

                  // Range Slider điều chỉnh khoảng giá màu xanh chủ đạo
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: AppColors.primary,
                      inactiveTrackColor: const Color(0xFFE2E8F0),
                      thumbColor: Colors.white,
                      overlayColor: AppColors.primary.withValues(alpha: 0.12),
                      trackHeight: 2.0,
                      thumbShape: const RoundSliderThumbShape(
                        enabledThumbRadius: 13.0,
                        elevation: 4.0,
                      ),
                      rangeThumbShape: const RoundRangeSliderThumbShape(
                        enabledThumbRadius: 13.0,
                        elevation: 4.0,
                      ),
                    ),
                    child: RangeSlider(
                      values: RangeValues(_minPrice, _maxPrice),
                      min: _defaultMinPrice,
                      max: _defaultMaxPrice,
                      divisions: 60,
                      onChanged: (values) {
                        setState(() {
                          _minPrice = values.start;
                          _maxPrice = values.end;
                        });
                      },
                    ),
                  ),

                  const SizedBox(height: 10),

                  // 2 ô nhập / hiển thị giá: Tối thiểu & Tối đa (Ảnh 2)
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Tối thiểu',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF717171),
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '₫${_currencyFormat.format(_minPrice.toInt())}',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF222222),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          '–',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w300,
                            color: Color(0xFF717171),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Tối đa',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF717171),
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '₫${_currencyFormat.format(_maxPrice.toInt())}${_maxPrice >= _defaultMaxPrice ? '+' : ''}',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF222222),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 28),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 24),

                  // ─────────────────────────────────────────────────────────────
                  // 2. DANH MỤC DU LỊCH DẠNG DROPDOWN & CUSTOM TICKBOX
                  // ─────────────────────────────────────────────────────────────
                  InkWell(
                    onTap: () => setState(() => _isCategoriesOpen = !_isCategoriesOpen),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Danh mục du lịch',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF222222),
                                ),
                              ),
                              if (_selectedCategoryIds.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF222222),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    '${_selectedCategoryIds.length}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          Icon(
                            _isCategoriesOpen
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            size: 26,
                            color: const Color(0xFF222222),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Danh sách danh mục sổ xuống
                  if (_isCategoriesOpen) ...[
                    const SizedBox(height: 12),
                    if (widget.categories.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          'Đang tải danh mục du lịch...',
                          style: TextStyle(color: Color(0xFF717171), fontSize: 13.5),
                        ),
                      )
                    else
                      Column(
                        children: widget.categories.map((cat) {
                          final isSelected = _selectedCategoryIds.contains(cat.id);

                          return InkWell(
                            onTap: () {
                              setState(() {
                                if (isSelected) {
                                  _selectedCategoryIds.remove(cat.id);
                                } else {
                                  _selectedCategoryIds.add(cat.id);
                                }
                              });
                            },
                            borderRadius: BorderRadius.circular(10),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                              child: Row(
                                children: [
                                  // Icon đại diện danh mục
                                  Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Icon(
                                      cat.iconData,
                                      size: 17,
                                      color: const Color(0xFF222222),
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Tên danh mục bên trái
                                  Expanded(
                                    child: Text(
                                      cat.name,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                        color: const Color(0xFF222222),
                                      ),
                                    ),
                                  ),

                                  // Ô Custom Tickbox đẹp mắt bên phải (bo góc 6px)
                                  _buildCustomCheckbox(isSelected),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                  ],

                  const SizedBox(height: 24),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 24),

                  // ─────────────────────────────────────────────────────────────
                  // 3. ĐÁNH GIÁ (Rating)
                  // ─────────────────────────────────────────────────────────────
                  const Text(
                    'Đánh giá tối thiểu',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 14),

                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _buildRatingChip(label: 'Bất kỳ', value: null),
                      _buildRatingChip(label: '3★ trở lên', value: 3.0),
                      _buildRatingChip(label: '4★ trở lên', value: 4.0),
                      _buildRatingChip(label: '4.5★ trở lên', value: 4.5),
                      _buildRatingChip(label: '5.0★ tuyệt đối', value: 5.0),
                    ],
                  ),

                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),

          // ─────────────────────────────────────────────────────────────
          // FOOTER: Nút "Xóa tất cả" gạch chân bên trái, nút đen lớn bên phải (Ảnh 2)
          // ─────────────────────────────────────────────────────────────
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 14, 22, 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Nút Xóa tất cả gạch chân (Clear all)
                TextButton(
                  onPressed: _resetLocal,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  ),
                  child: const Text(
                    'Xóa tất cả',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF222222),
                    ),
                  ),
                ),

                // Nút đen bo tròn lớn "Hiển thị ... tour" (Show places)
                ElevatedButton(
                  onPressed: _applyLocal,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF222222),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 15),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    widget.matchingCount != null
                        ? 'Hiển thị ${widget.matchingCount} tour'
                        : 'Hiển thị kết quả',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Ô Custom Checkbox tinh tế: bo tròn 6px, nền đen khi tick, checkmark trắng (Ảnh 2)
  Widget _buildCustomCheckbox(bool isChecked) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: isChecked ? const Color(0xFF222222) : Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isChecked ? const Color(0xFF222222) : const Color(0xFFCBD5E1),
          width: 1.5,
        ),
      ),
      child: isChecked
          ? const Icon(
              Icons.check_rounded,
              size: 16,
              color: Colors.white,
            )
          : null,
    );
  }

  Widget _buildRatingChip({required String label, double? value}) {
    final isSelected = _selectedRating == value;

    return InkWell(
      onTap: () => setState(() => _selectedRating = value),
      borderRadius: BorderRadius.circular(22),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF222222) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isSelected ? const Color(0xFF222222) : const Color(0xFFCBD5E1),
            width: 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : const Color(0xFF222222),
          ),
        ),
      ),
    );
  }
}
