import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

enum _SearchStep { destination, time, guests }

enum _TimeMode { exact, flexible }

enum FlexibleDuration { weekend, week, month }

/// Kết quả người dùng đã cấu hình trong Search Modal
class SearchModalResult {
  final String destination;
  final String categoryTab;
  final DateTime? startDate;
  final DateTime? endDate;
  final String datePrecisionChip;
  final FlexibleDuration? flexibleDuration;
  final List<String> flexibleMonths;
  final int adults;
  final int children;
  final int infants;
  final int pets;

  const SearchModalResult({
    required this.destination,
    this.categoryTab = 'Chỗ ở',
    this.startDate,
    this.endDate,
    this.datePrecisionChip = 'Ngày chính xác',
    this.flexibleDuration,
    this.flexibleMonths = const [],
    this.adults = 0,
    this.children = 0,
    this.infants = 0,
    this.pets = 0,
  });

  int get totalGuests => adults + children;

  String get guestsSummary {
    final total = totalGuests;
    if (total == 0) return 'Thêm khách';
    final buffer = StringBuffer('$total khách');
    if (infants > 0) buffer.write(', $infants em bé');
    if (pets > 0) buffer.write(', $pets thú cưng');
    return buffer.toString();
  }
}

/// Search Modal dạng Accordion/Expandable Sheet đa bước (phong cách Airbnb Mobile)
/// 100% tiếng Việt tự nhiên, bo góc lớn rounded-3xl, shadow mềm mại
class AirbnbSearchModal extends StatefulWidget {
  final String? initialDestination;
  final ValueChanged<SearchModalResult>? onSearch;

  const AirbnbSearchModal({
    super.key,
    this.initialDestination,
    this.onSearch,
  });

  /// Hàm tiện ích mở màn hình tìm kiếm toàn màn hình chuẩn Airbnb Mobile
  static Future<SearchModalResult?> show(
    BuildContext context, {
    String? initialDestination,
  }) {
    return Navigator.of(context).push<SearchModalResult>(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => AirbnbSearchModal(
          initialDestination: initialDestination,
          onSearch: (result) => Navigator.of(context).pop(result),
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.fastOutSlowIn,
            reverseCurve: Curves.fastOutSlowIn,
          );
          return FadeTransition(
            opacity: curved,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, 0.04),
                end: Offset.zero,
              ).animate(curved),
              child: child,
            ),
          );
        },
        transitionDuration: const Duration(milliseconds: 280),
        reverseTransitionDuration: const Duration(milliseconds: 220),
        fullscreenDialog: true,
      ),
    );
  }

  @override
  State<AirbnbSearchModal> createState() => _AirbnbSearchModalState();
}

class _AirbnbSearchModalState extends State<AirbnbSearchModal> {
  // Tab danh mục trên cùng
  int _selectedCategoryIndex = 0;
  final List<String> _categoryTabs = const ['Chỗ ở', 'Trải nghiệm', 'Dịch vụ'];

  // Khối Accordion đang mở rộng
  _SearchStep _activeStep = _SearchStep.destination;

  // Dữ liệu Khối 1: Điểm đến
  late TextEditingController _destinationController;
  String _selectedDestination = 'Tôi linh hoạt';
  double _destinationListHeight = 240.0; // Chiều cao có thể vuốt/kéo (Draggable/Swipe)

  // Dữ liệu Khối 2: Thời gian
  _TimeMode _timeMode = _TimeMode.exact;
  DateTime _displayedMonth = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime? _startDate;
  DateTime? _endDate;
  String _selectedPrecisionChip = 'Ngày chính xác';
  FlexibleDuration _flexibleDuration = FlexibleDuration.weekend;
  final Set<String> _selectedFlexibleMonths = {};

  // Dữ liệu Khối 3: Khách
  int _adults = 0;
  int _children = 0;
  int _infants = 0;
  int _pets = 0;

  // Danh sách điểm đến gợi ý kèm icon văn hóa / địa lý tương ứng (fallback về icon địa điểm mặc định)
  static const List<Map<String, dynamic>> _suggestedDestinations = [
    {
      'name': 'Tôi linh hoạt',
      'desc': 'Khám phá mọi miền đất nước',
      'icon': Icons.travel_explore_rounded,
    },
    {
      'name': 'Đà Nẵng',
      'desc': 'Bãi biển Mỹ Khê & Cầu Vàng',
      'icon': Icons.beach_access_rounded, // Biển
    },
    {
      'name': 'TP. Hồ Chí Minh',
      'desc': 'Đô thị phồn hoa & Toà nhà Landmark',
      'icon': Icons.location_city_rounded, // Toà nhà
    },
    {
      'name': 'Hà Nội',
      'desc': 'Thủ đô nghìn năm văn hiến & Phố cổ',
      'icon': Icons.temple_buddhist_rounded, // Chùa chiền
    },
    {
      'name': 'Hạ Long',
      'desc': 'Vịnh di sản thiên nhiên thế giới',
      'icon': Icons.directions_boat_rounded, // Du thuyền / vịnh đảo
    },
    {
      'name': 'Phú Quốc',
      'desc': 'Thiên đường đảo ngọc & Hoàng hôn',
      'icon': Icons.surfing_rounded, // Bãi biển / lướt sóng
    },
    {
      'name': 'Sa Pa',
      'desc': 'Ruộng bậc thang & Đỉnh Fansipan',
      'icon': Icons.terrain_rounded, // Núi đồi
    },
    {
      'name': 'Hội An',
      'desc': 'Phố cổ đèn lồng sông Hoài',
      'icon': Icons.lightbulb_outline_rounded, // Đèn lồng
    },
    {
      'name': 'Huế',
      'desc': 'Cố đô di sản Đại Nội & Ca Huế',
      'icon': Icons.account_balance_rounded, // Cung điện di sản
    },
    {
      'name': 'Đà Lạt',
      'desc': 'Thành phố ngàn hoa & Rừng thông',
      'icon': Icons.forest_rounded, // Rừng thông
    },
    {
      'name': 'Nha Trang',
      'desc': 'Vịnh biển san hô nhiệt đới',
      'icon': Icons.waves_rounded, // Sóng biển
    },
    {
      'name': 'Điểm đến khác',
      'desc': 'Tự do khám phá địa điểm mới',
      'icon': null, // Fallback về icon địa điểm mặc định (pin marker)
    },
  ];

  @override
  void initState() {
    super.initState();
    _destinationController = TextEditingController(
      text: widget.initialDestination ?? '',
    );
    if (widget.initialDestination != null && widget.initialDestination!.isNotEmpty) {
      _selectedDestination = widget.initialDestination!;
    }
    // Mặc định chọn 2 tháng tiếp theo cho tab linh hoạt
    final now = DateTime.now();
    final m1 = DateTime(now.year, now.month + 1);
    final m2 = DateTime(now.year, now.month + 2);
    _selectedFlexibleMonths.add('Tháng ${m1.month}');
    _selectedFlexibleMonths.add('Tháng ${m2.month}');
  }

  @override
  void dispose() {
    _destinationController.dispose();
    super.dispose();
  }

  bool get _hasSelections {
    return _selectedDestination != 'Tôi linh hoạt' ||
        _startDate != null ||
        _selectedFlexibleMonths.isNotEmpty ||
        _adults > 0 ||
        _children > 0 ||
        _infants > 0 ||
        _pets > 0;
  }

  bool get _hasSelectionsInActiveStep {
    switch (_activeStep) {
      case _SearchStep.destination:
        return _selectedDestination != 'Tôi linh hoạt' || _destinationController.text.isNotEmpty;
      case _SearchStep.time:
        return _startDate != null || _selectedFlexibleMonths.isNotEmpty;
      case _SearchStep.guests:
        return _adults > 0 || _children > 0 || _infants > 0 || _pets > 0;
    }
  }

  bool get _hasSelectionsOtherSteps {
    switch (_activeStep) {
      case _SearchStep.destination:
        return _startDate != null || _selectedFlexibleMonths.isNotEmpty || _adults > 0 || _children > 0 || _infants > 0 || _pets > 0;
      case _SearchStep.time:
        return _selectedDestination != 'Tôi linh hoạt' || _adults > 0 || _children > 0 || _infants > 0 || _pets > 0;
      case _SearchStep.guests:
        return _selectedDestination != 'Tôi linh hoạt' || _startDate != null || _selectedFlexibleMonths.isNotEmpty;
    }
  }

  void _resetActiveStep() {
    setState(() {
      switch (_activeStep) {
        case _SearchStep.destination:
          _selectedDestination = 'Tôi linh hoạt';
          _destinationController.clear();
          break;
        case _SearchStep.time:
          _startDate = null;
          _endDate = null;
          _selectedPrecisionChip = 'Ngày chính xác';
          _selectedFlexibleMonths.clear();
          break;
        case _SearchStep.guests:
          _adults = 0;
          _children = 0;
          _infants = 0;
          _pets = 0;
          break;
      }
    });
  }

  void _clearAll() {
    setState(() {
      _selectedDestination = 'Tôi linh hoạt';
      _destinationController.clear();
      _startDate = null;
      _endDate = null;
      _selectedPrecisionChip = 'Ngày chính xác';
      _selectedFlexibleMonths.clear();
      _adults = 0;
      _children = 0;
      _infants = 0;
      _pets = 0;
      _activeStep = _SearchStep.destination;
    });
  }

  void _nextStep() {
    setState(() {
      if (_activeStep == _SearchStep.destination) {
        _activeStep = _SearchStep.time;
      } else if (_activeStep == _SearchStep.time) {
        _activeStep = _SearchStep.guests;
      }
    });
  }

  bool get _isFullyConfigured {
    return _selectedDestination != 'Tôi linh hoạt' &&
        (_startDate != null || _selectedFlexibleMonths.isNotEmpty) &&
        (_adults > 0 || _children > 0);
  }

  bool get _showSearchButton => _activeStep == _SearchStep.guests || _isFullyConfigured;

  void _submitSearch() {
    final result = SearchModalResult(
      destination: _selectedDestination,
      categoryTab: _categoryTabs[_selectedCategoryIndex],
      startDate: _startDate,
      endDate: _endDate,
      datePrecisionChip: _selectedPrecisionChip,
      flexibleDuration: _timeMode == _TimeMode.flexible ? _flexibleDuration : null,
      flexibleMonths: _timeMode == _TimeMode.flexible ? _selectedFlexibleMonths.toList() : const [],
      adults: _adults,
      children: _children,
      infants: _infants,
      pets: _pets,
    );
    widget.onSearch?.call(result);
  }

  String get _timeSummaryText {
    if (_timeMode == _TimeMode.exact && _startDate != null) {
      final startStr = '${_startDate!.day} thg ${_startDate!.month}';
      if (_endDate != null) {
        final endStr = '${_endDate!.day} thg ${_endDate!.month}';
        return '$startStr – $endStr';
      }
      return startStr;
    } else if (_timeMode == _TimeMode.flexible && _selectedFlexibleMonths.isNotEmpty) {
      return _selectedFlexibleMonths.join(', ');
    }
    return 'Tuần bất kỳ';
  }

  String get _guestsSummaryText {
    final total = _adults + _children;
    if (total == 0) return 'Thêm khách';
    final parts = <String>['$total khách'];
    if (_infants > 0) parts.add('$_infants em bé');
    if (_pets > 0) parts.add('$_pets thú cưng');
    return parts.join(', ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F7),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // 1. Header trên cùng: Nút đóng (X) & Tabs danh mục
            _buildTopHeader(),

            // 2. Nội dung 3 khối Accordion (Where - When - Who)
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 20),
                child: Column(
                  children: [
                    // Khối 1: Điểm đến (Where)
                    _buildDestinationAccordion(),
                    const SizedBox(height: 12),

                    // Khối 2: Thời gian (When)
                    _buildTimeAccordion(),
                    const SizedBox(height: 12),

                    // Khối 3: Số lượng khách (Who)
                    _buildGuestsAccordion(),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),

            // 3. Thanh Bottom Bar động
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // 1. TOP HEADER & CATEGORY TABS
  // ==========================================
  Widget _buildTopHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      color: const Color(0xFFF7F7F7),
      child: Row(
        children: [
          // Nút đóng (X) bo tròn chuẩn Airbnb Mobile
          InkWell(
            onTap: () => Navigator.of(context).pop(),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF222222)),
            ),
          ),
          const SizedBox(width: 8),

          // Tabs danh mục: "Chỗ ở", "Trải nghiệm", "Dịch vụ"
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_categoryTabs.length, (index) {
                final isSelected = _selectedCategoryIndex == index;
                return InkWell(
                  onTap: () => setState(() => _selectedCategoryIndex = index),
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _categoryTabs[index],
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                            color: isSelected ? const Color(0xFF222222) : const Color(0xFF717171),
                          ),
                        ),
                        const SizedBox(height: 4),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          height: 2.5,
                          width: isSelected ? 26 : 0,
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF222222) : Colors.transparent,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(width: 36), // Cân đối layout với nút đóng
        ],
      ),
    );
  }

  // ==========================================
  // KHỐI 1: ĐIỂM ĐẾN (WHERE)
  // ==========================================
  Widget _buildDestinationAccordion() {
    final isExpanded = _activeStep == _SearchStep.destination;

    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.fastOutSlowIn,
      alignment: Alignment.topCenter,
      child: isExpanded ? _buildDestinationExpanded() : _buildDestinationCollapsed(),
    );
  }

  Widget _buildDestinationCollapsed() {
    return InkWell(
      onTap: () => setState(() => _activeStep = _SearchStep.destination),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 58,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFEBEBEB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Điểm đến',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF717171),
              ),
            ),
            Text(
              _selectedDestination,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDestinationExpanded() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bạn muốn đi đâu?',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color(0xFF222222),
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 16),

          // Ô tìm kiếm điểm đến
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F7F7),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, size: 22, color: Color(0xFF222222)),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _destinationController,
                    onChanged: (val) {
                      setState(() {
                        _selectedDestination = val.trim().isNotEmpty ? val.trim() : 'Tôi linh hoạt';
                      });
                    },
                    decoration: const InputDecoration(
                      hintText: 'Tìm kiếm điểm đến',
                      hintStyle: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF717171),
                        fontWeight: FontWeight.w400,
                      ),
                      border: InputBorder.none,
                    ),
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF222222),
                    ),
                  ),
                ),
                if (_destinationController.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.cancel_rounded, size: 18, color: Color(0xFF717171)),
                    onPressed: () {
                      _destinationController.clear();
                      setState(() => _selectedDestination = 'Tôi linh hoạt');
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Điểm đến gợi ý phổ biến',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF717171),
                ),
              ),
              InkWell(
                onTap: () {
                  setState(() {
                    _destinationListHeight = (_destinationListHeight > 260) ? 220.0 : 440.0;
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _destinationListHeight > 260 ? Icons.unfold_less_rounded : Icons.unfold_more_rounded,
                        size: 16,
                        color: const Color(0xFF717171),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _destinationListHeight > 260 ? 'Thu gọn' : 'Kéo rộng',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF717171),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Thanh kéo trượt (Draggable/Swipe Handle)
          GestureDetector(
            onVerticalDragUpdate: (details) {
              setState(() {
                _destinationListHeight = (_destinationListHeight - details.delta.dy).clamp(180.0, 480.0);
              });
            },
            onVerticalDragEnd: (details) {
              final velocity = details.primaryVelocity ?? 0;
              setState(() {
                if (velocity < -250) {
                  _destinationListHeight = 440.0;
                } else if (velocity > 250) {
                  _destinationListHeight = 220.0;
                }
              });
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 4),
              color: Colors.transparent,
              child: Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ),

          // Danh sách điểm đến gợi ý cuộn mượt mà kèm icon văn hóa / địa lý (có thể vuốt/kéo kích thước)
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            height: _destinationListHeight,
            child: ListView.separated(
              itemCount: _suggestedDestinations.length,
              separatorBuilder: (_, _) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (context, index) {
                final item = _suggestedDestinations[index];
                final name = item['name'] as String;
                final desc = item['desc'] as String;
                final icon = (item['icon'] as IconData?) ?? Icons.location_on_outlined;
                final isSelected = _selectedDestination == name;

                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedDestination = name;
                      _destinationController.text = name == 'Tôi linh hoạt' ? '' : name;
                      // Tự động chuyển qua bước tiếp theo
                      _activeStep = _SearchStep.time;
                    });
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF222222) : const Color(0xFFF7F7F7),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF222222) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Icon(
                            icon,
                            size: 22,
                            color: isSelected ? Colors.white : const Color(0xFF222222),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                  color: const Color(0xFF222222),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                desc,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF717171),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.check_circle_rounded, size: 20, color: Color(0xFF222222)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // KHỐI 2: THỜI GIAN (WHEN)
  // ==========================================
  Widget _buildTimeAccordion() {
    final isExpanded = _activeStep == _SearchStep.time;

    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.fastOutSlowIn,
      alignment: Alignment.topCenter,
      child: isExpanded ? _buildTimeExpanded() : _buildTimeCollapsed(),
    );
  }

  Widget _buildTimeCollapsed() {
    return InkWell(
      onTap: () => setState(() => _activeStep = _SearchStep.time),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 58,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFEBEBEB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Thời gian',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF717171),
              ),
            ),
            Text(
              _timeSummaryText,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeExpanded() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hai tab: "Ngày chính xác" và "Linh hoạt"
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFEBEBEB),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _timeMode = _TimeMode.exact),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: _timeMode == _TimeMode.exact ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: _timeMode == _TimeMode.exact
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Ngày chính xác',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: _timeMode == _TimeMode.exact ? FontWeight.w800 : FontWeight.w600,
                          color: const Color(0xFF222222),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _timeMode = _TimeMode.flexible),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: _timeMode == _TimeMode.flexible ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: _timeMode == _TimeMode.flexible
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Linh hoạt',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: _timeMode == _TimeMode.flexible ? FontWeight.w800 : FontWeight.w600,
                          color: const Color(0xFF222222),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Nội dung theo từng tab
          if (_timeMode == _TimeMode.exact) ...[
            _buildExactCalendarView(),
          ] else ...[
            _buildFlexibleTimeView(),
          ],
        ],
      ),
    );
  }

  /// Lịch tháng chính xác (Vô hiệu hoá hoàn toàn ngày trong quá khứ)
  Widget _buildExactCalendarView() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final currentRealMonth = DateTime(now.year, now.month);
    final canGoPrevious = _displayedMonth.isAfter(currentRealMonth);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Điều hướng tháng dạng Month Switcher (< Tháng X năm Y >)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_left_rounded, size: 24),
              onPressed: canGoPrevious
                  ? () {
                      setState(() {
                        _displayedMonth = DateTime(_displayedMonth.year, _displayedMonth.month - 1);
                      });
                    }
                  : null,
              color: canGoPrevious ? const Color(0xFF222222) : const Color(0xFFCBD5E1),
            ),
            Text(
              'Tháng ${_displayedMonth.month} năm ${_displayedMonth.year}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF222222),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right_rounded, size: 24),
              onPressed: () {
                setState(() {
                  _displayedMonth = DateTime(_displayedMonth.year, _displayedMonth.month + 1);
                });
              },
              color: const Color(0xFF222222),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // Tiêu đề thứ trong tuần: T2, T3, T4, T5, T6, T7, CN
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: const [
            Text('T2', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('T3', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('T4', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('T5', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('T6', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('T7', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
            Text('CN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF717171))),
          ],
        ),
        const SizedBox(height: 8),

        // Lưới ngày trong tháng
        _buildMonthDayGrid(_displayedMonth, today),

        const SizedBox(height: 18),
        const Divider(height: 1, color: Color(0xFFEBEBEB)),
        const SizedBox(height: 14),

        // Chips tùy chọn dung sai ngày: "Ngày chính xác", "± 1 ngày", "± 2 ngày", "± 3 ngày"
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['Ngày chính xác', '± 1 ngày', '± 2 ngày', '± 3 ngày'].map((chipText) {
              final isSelected = _selectedPrecisionChip == chipText;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(chipText),
                  selected: isSelected,
                  selectedColor: const Color(0xFF222222),
                  checkmarkColor: Colors.white,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? Colors.white : const Color(0xFF222222),
                  ),
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      color: isSelected ? const Color(0xFF222222) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  onSelected: (_) => setState(() => _selectedPrecisionChip = chipText),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildMonthDayGrid(DateTime monthDate, DateTime today) {
    final daysInMonth = DateTime(monthDate.year, monthDate.month + 1, 0).day;
    final firstWeekday = DateTime(monthDate.year, monthDate.month, 1).weekday; // 1 = Monday, 7 = Sunday
    final leadingEmpty = firstWeekday - 1;

    final List<Widget> dayWidgets = [];

    // Empty cells before start of month
    for (int i = 0; i < leadingEmpty; i++) {
      dayWidgets.add(const SizedBox(height: 38, width: 38));
    }

    // Days in month
    for (int day = 1; day <= daysInMonth; day++) {
      final cellDate = DateTime(monthDate.year, monthDate.month, day);
      final isPast = cellDate.isBefore(today); // QUAN TRỌNG: Vô hiệu hóa ngày quá khứ
      final isSelectedStart = _startDate != null &&
          _startDate!.year == cellDate.year &&
          _startDate!.month == cellDate.month &&
          _startDate!.day == cellDate.day;
      final isSelectedEnd = _endDate != null &&
          _endDate!.year == cellDate.year &&
          _endDate!.month == cellDate.month &&
          _endDate!.day == cellDate.day;
      final isInRange = _startDate != null &&
          _endDate != null &&
          cellDate.isAfter(_startDate!) &&
          cellDate.isBefore(_endDate!);

      dayWidgets.add(
        InkWell(
          onTap: isPast
              ? null // Vô hiệu hoá hoàn toàn không cho bấm
              : () {
                  setState(() {
                    if (_startDate == null || (_startDate != null && _endDate != null)) {
                      _startDate = cellDate;
                      _endDate = null;
                    } else if (_startDate != null && _endDate == null) {
                      if (cellDate.isBefore(_startDate!)) {
                        _startDate = cellDate;
                      } else {
                        _endDate = cellDate;
                      }
                    }
                  });
                },
          borderRadius: BorderRadius.circular(19),
          child: Container(
            height: 38,
            width: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelectedStart || isSelectedEnd
                  ? const Color(0xFF222222)
                  : (isInRange ? const Color(0xFFF1F5F9) : Colors.transparent),
            ),
            alignment: Alignment.center,
            child: Text(
              '$day',
              style: TextStyle(
                fontSize: 13,
                fontWeight: (isSelectedStart || isSelectedEnd)
                    ? FontWeight.w800
                    : (isPast ? FontWeight.w400 : FontWeight.w600),
                color: isPast
                    ? const Color(0xFFCBD5E1) // Màu xám nhạt cho ngày trong quá khứ
                    : ((isSelectedStart || isSelectedEnd) ? Colors.white : const Color(0xFF222222)),
                decoration: isPast ? TextDecoration.none : null,
              ),
            ),
          ),
        ),
      );
    }

    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: dayWidgets,
    );
  }

  /// Giao diện Thời gian Linh hoạt
  Widget _buildFlexibleTimeView() {
    final now = DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Bạn muốn đi trong bao lâu?',
          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(0xFF222222)),
        ),
        const SizedBox(height: 12),

        // Chọn kiểu thời lượng: "Cuối tuần", "Tuần", "Tháng"
        Row(
          children: [
            _buildFlexibleDurationPill('Cuối tuần', FlexibleDuration.weekend),
            const SizedBox(width: 8),
            _buildFlexibleDurationPill('Tuần', FlexibleDuration.week),
            const SizedBox(width: 8),
            _buildFlexibleDurationPill('Tháng', FlexibleDuration.month),
          ],
        ),
        const SizedBox(height: 22),

        const Text(
          'Khi nào bạn muốn đi?',
          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(0xFF222222)),
        ),
        const SizedBox(height: 12),

        // Cuộn ngang các tháng trong tương lai dạng cuộn ngang
        SizedBox(
          height: 125,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 8,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final m = DateTime(now.year, now.month + index);
              final monthStr = 'Tháng ${m.month}';
              final yearStr = '${m.year}';
              return _buildMonthCard(monthStr, yearStr);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFlexibleDurationPill(String title, FlexibleDuration duration) {
    final isSelected = _flexibleDuration == duration;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _flexibleDuration = duration),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF222222) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? const Color(0xFF222222) : const Color(0xFFE2E8F0),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? Colors.white : const Color(0xFF222222),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMonthCard(String month, String year) {
    final isSelected = _selectedFlexibleMonths.contains(month);
    return InkWell(
      onTap: () {
        setState(() {
          if (isSelected) {
            _selectedFlexibleMonths.remove(month);
          } else {
            _selectedFlexibleMonths.add(month);
          }
        });
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 105,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF7F7F7) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF222222) : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.calendar_month_rounded, size: 26, color: Color(0xFF717171)),
            const SizedBox(height: 6),
            Text(
              month,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF222222)),
            ),
            Text(
              year,
              style: const TextStyle(fontSize: 11, color: Color(0xFF717171)),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // KHỐI 3: SỐ LƯỢNG KHÁCH (WHO)
  // ==========================================
  Widget _buildGuestsAccordion() {
    final isExpanded = _activeStep == _SearchStep.guests;

    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.fastOutSlowIn,
      alignment: Alignment.topCenter,
      child: isExpanded ? _buildGuestsExpanded() : _buildGuestsCollapsed(),
    );
  }

  Widget _buildGuestsCollapsed() {
    return InkWell(
      onTap: () => setState(() => _activeStep = _SearchStep.guests),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 58,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFEBEBEB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Khách',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF717171),
              ),
            ),
            Text(
              _guestsSummaryText,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuestsExpanded() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ai sẽ đi cùng bạn?',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color(0xFF222222),
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 18),

          // 1. Người lớn (Từ 13 tuổi trở lên)
          _buildGuestStepperRow(
            title: 'Người lớn',
            subtitle: 'Từ 13 tuổi trở lên',
            count: _adults,
            onDecrement: () => setState(() => _adults = (_adults > 0) ? _adults - 1 : 0),
            onIncrement: () => setState(() => _adults++),
          ),
          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 2. Trẻ em (Độ tuổi 2–12)
          _buildGuestStepperRow(
            title: 'Trẻ em',
            subtitle: 'Độ tuổi 2–12',
            count: _children,
            onDecrement: () => setState(() => _children = (_children > 0) ? _children - 1 : 0),
            onIncrement: () {
              setState(() {
                _children++;
                if (_adults == 0) _adults = 1; // Tự động thêm ít nhất 1 người lớn
              });
            },
          ),
          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 3. Em bé (Dưới 2 tuổi)
          _buildGuestStepperRow(
            title: 'Em bé',
            subtitle: 'Dưới 2 tuổi',
            count: _infants,
            onDecrement: () => setState(() => _infants = (_infants > 0) ? _infants - 1 : 0),
            onIncrement: () {
              setState(() {
                _infants++;
                if (_adults == 0) _adults = 1;
              });
            },
          ),
          const Divider(height: 24, color: Color(0xFFF1F5F9)),

          // 4. Thú cưng (Mang theo thú cưng hỗ trợ?)
          _buildGuestStepperRow(
            title: 'Thú cưng',
            subtitle: 'Mang theo thú cưng hỗ trợ?',
            count: _pets,
            onDecrement: () => setState(() => _pets = (_pets > 0) ? _pets - 1 : 0),
            onIncrement: () => setState(() => _pets++),
          ),
        ],
      ),
    );
  }

  Widget _buildGuestStepperRow({
    required String title,
    required String subtitle,
    required int count,
    required VoidCallback onDecrement,
    required VoidCallback onIncrement,
  }) {
    final canDecrement = count > 0;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF222222),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF717171),
              ),
            ),
          ],
        ),
        Row(
          children: [
            // Minus button
            InkWell(
              onTap: canDecrement ? onDecrement : null,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: canDecrement ? const Color(0xFF717171) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Icon(
                  Icons.remove_rounded,
                  size: 16,
                  color: canDecrement ? const Color(0xFF222222) : const Color(0xFFCBD5E1),
                ),
              ),
            ),
            SizedBox(
              width: 36,
              child: Text(
                '$count',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF222222),
                ),
              ),
            ),
            // Plus button
            InkWell(
              onTap: onIncrement,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF717171)),
                ),
                child: const Icon(
                  Icons.add_rounded,
                  size: 16,
                  color: Color(0xFF222222),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ==========================================
  // 3. THANH BOTTOM BAR ĐỒNG BỘ
  // ==========================================
  Widget _buildBottomBar() {
    final showSearch = _showSearchButton;

    String leftText = 'Bỏ qua';
    VoidCallback leftAction = _nextStep;
    if (_hasSelections) {
      if (_hasSelectionsInActiveStep && !_hasSelectionsOtherSteps) {
        leftText = 'Đặt lại';
        leftAction = _resetActiveStep;
      } else {
        leftText = 'Xóa tất cả';
        leftAction = _clearAll;
      }
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFEBEBEB), width: 0.8)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Nút bên trái: thay đổi ngữ cảnh linh hoạt ("Xóa tất cả", "Đặt lại", "Bỏ qua")
            TextButton(
              onPressed: leftAction,
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF222222),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              ),
              child: Text(
                leftText,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  decoration: TextDecoration.underline,
                  color: Color(0xFF222222),
                ),
              ),
            ),

            // Nút bên phải: "Tiếp theo" hoặc nút "Tìm kiếm" màu hồng/đỏ
            if (!showSearch)
              ElevatedButton(
                onPressed: _nextStep,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF222222),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Tiếp theo',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: _submitSearch,
                icon: const Icon(Icons.search_rounded, size: 18),
                label: const Text(
                  'Tìm kiếm',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary, // Màu xanh ngọc thương hiệu Tripri (#005A64)
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  elevation: 2,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
