import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Widget mô phỏng hiệu ứng thuyền buồm thương hiệu Tripri.
/// Thuyền buồm lướt sóng từ trái qua phải như thanh tiến trình (Loading Progress),
/// với kích thước lớn nổi bật, lắc lư và dập dềnh theo sóng biển sống động.
class BoatPreloaderWidget extends StatefulWidget {
  final String? subtitle;
  final double size;

  const BoatPreloaderWidget({
    super.key,
    this.subtitle = 'Khám phá hành trình cùng Tripri',
    this.size = 280.0,
  });

  @override
  State<BoatPreloaderWidget> createState() => _BoatPreloaderWidgetState();
}

class _BoatPreloaderWidgetState extends State<BoatPreloaderWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Chu kỳ 3.2s để thuyền lướt từ trái sang phải như một loading bar hoàn hảo
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Cụm biển và thuyền lướt toàn chiều rộng màn hình
            SizedBox(
              width: screenWidth,
              height: 190,
              child: CustomPaint(
                painter: _SailingBoatProgressPainter(
                  progress: t,
                  screenWidth: screenWidth,
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Typography: LOADING . . .
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                const Text(
                  'LOADING',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 4.5,
                    color: AppColors.primaryDark,
                  ),
                ),
                const SizedBox(width: 2),
                _buildBouncingDot(t, 0),
                _buildBouncingDot(t, 1),
                _buildBouncingDot(t, 2),
              ],
            ),

            const SizedBox(height: 8),

            // Subtitle
            Text(
              widget.subtitle ?? 'Khám phá hành trình cùng Tripri',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
                letterSpacing: 0.3,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildBouncingDot(double t, int index) {
    final cycle = (t * (3.2 / 0.8) - (index * 0.16)) % 1.0;
    final sinVal = math.sin(cycle * math.pi);
    final yOffset = sinVal > 0 ? -sinVal * 5.5 : 0.0;
    final opacity = 0.35 + (sinVal > 0 ? sinVal * 0.65 : 0.0);

    return Transform.translate(
      offset: Offset(0, yOffset),
      child: Opacity(
        opacity: opacity.clamp(0.2, 1.0),
        child: const Text(
          '.',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: AppColors.secondary,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}

class _SailingBoatProgressPainter extends CustomPainter {
  final double progress;
  final double screenWidth;

  const _SailingBoatProgressPainter({
    required this.progress,
    required this.screenWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = screenWidth > 0 ? screenWidth : size.width;
    final h = size.height;

    // Chiếc thuyền lướt từ trái sang phải qua toàn bộ màn hình
    // Bắt đầu từ mép trái (-70px) đến mép phải (w + 70px)
    final boatX = (progress * (w + 140.0)) - 70.0;

    // Dao động dập dềnh khi lướt sóng (tần số nhanh tự nhiên)
    final boatY = math.sin(progress * 2 * math.pi * 5.0) * 4.5;
    final boatAngle = math.sin(progress * 2 * math.pi * 3.5) * (4.2 * math.pi / 180.0);

    // Cờ đuôi nheo phấp phới trong gió biển
    final flagScaleX = 0.9 + 0.18 * math.sin(progress * 2 * math.pi * 8.0);

    // Trôi dạt sóng nền
    final waveShiftBack = -((progress * 4.0) % 1.0) * 120.0;
    final waveShiftMid = -((progress * 5.5) % 1.0) * 120.0;
    final waveShiftFront = -((progress * 7.0) % 1.0) * 120.0;

    const baselineY = 135.0;

    // =========================================================================
    // LAYER 0: VỆT NƯỚC TIẾN TRÌNH (WATER TRAIL / LOADING WAKE)
    // =========================================================================
    if (boatX > 0) {
      final trailWidth = boatX.clamp(0.0, w);
      final trailPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            AppColors.primaryLight.withValues(alpha: 0.1),
            AppColors.secondary.withValues(alpha: 0.35),
            Colors.white.withValues(alpha: 0.6),
          ],
        ).createShader(Rect.fromLTWH(0, baselineY - 4, trailWidth, 8))
        ..strokeWidth = 3.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

      final trailPath = Path()
        ..moveTo(0, baselineY + 2)
        ..lineTo(trailWidth, baselineY + 2);
      canvas.drawPath(trailPath, trailPaint);
    }

    // =========================================================================
    // LAYER 1: TẦNG SÓNG XA (BACK WATER WAVES)
    // =========================================================================
    final backWavePaint = Paint()
      ..color = const Color(0xFF79D4E2).withValues(alpha: 0.35)
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(waveShiftBack, 0);
    final backWavePath = _buildTiledWavePath(
      width: w,
      baseline: baselineY - 8.0,
      amplitude: 6.0,
      wavelength: 120.0,
      bottom: h,
    );
    canvas.drawPath(backWavePath, backWavePaint);
    canvas.restore();

    // =========================================================================
    // LAYER 2: TẦNG SÓNG GIỮA (MID WATER WAVES)
    // =========================================================================
    final midWavePaint = Paint()
      ..color = const Color(0xFF087E8B).withValues(alpha: 0.45)
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(waveShiftMid, 0);
    final midWavePath = _buildTiledWavePath(
      width: w,
      baseline: baselineY - 2.0,
      amplitude: 7.0,
      wavelength: 110.0,
      bottom: h,
    );
    canvas.drawPath(midWavePath, midWavePaint);
    canvas.restore();

    // =========================================================================
    // LAYER 3: CHIẾC THUYỀN BUỒM LỚN NỔI BẬT LƯỚT TỪ TRÁI SANG PHẢI
    // =========================================================================
    canvas.save();
    // Di chuyển thuyền theo tọa độ boatX trên hành trình lướt sóng
    canvas.translate(boatX, baselineY - 8.0 + boatY);
    canvas.rotate(boatAngle);
    // Phóng to kích thước thuyền lên 1.55x để nổi bật, không còn bị nhỏ
    canvas.scale(1.55, 1.55);
    // Đưa tâm quay về đáy thuyền (tọa độ gốc thuyền 130, 115)
    canvas.translate(-130.0, -115.0);

    _drawSailingBoat(canvas, flagScaleX);
    canvas.restore();

    // =========================================================================
    // LAYER 4: TẦNG SÓNG TRƯỚC (FRONT WATER WAVES - LƯỚT ĐÈ LÊN MẠN THUYỀN)
    // =========================================================================
    final frontWavePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xF2087E8B), // 95% opacity
          const Color(0xFA003E44), // 98% opacity
        ],
      ).createShader(Rect.fromLTWH(0, baselineY + 4, w, h - baselineY))
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(waveShiftFront, 0);
    final frontWavePath = _buildTiledWavePath(
      width: w,
      baseline: baselineY + 5.0,
      amplitude: 8.0,
      wavelength: 100.0,
      bottom: h,
    );
    canvas.drawPath(frontWavePath, frontWavePaint);

    // Bọt sóng trắng nổi bật theo mép sóng
    final foamPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.65)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    for (double x = -100; x <= w + 100; x += 100) {
      final foamPath = Path()
        ..moveTo(x + 25, baselineY + 4)
        ..cubicTo(x + 40, baselineY, x + 65, baselineY, x + 80, baselineY + 4);
      canvas.drawPath(foamPath, foamPaint);
    }
    canvas.restore();
  }

  Path _buildTiledWavePath({
    required double width,
    required double baseline,
    required double amplitude,
    required double wavelength,
    required double bottom,
  }) {
    final path = Path()..moveTo(-140, baseline);
    final step = wavelength / 2.0;

    for (double x = -140; x <= width + 140; x += wavelength) {
      path.cubicTo(
        x + step * 0.35,
        baseline - amplitude,
        x + step * 0.65,
        baseline - amplitude,
        x + step,
        baseline,
      );
      path.cubicTo(
        x + step * 1.35,
        baseline + amplitude,
        x + step * 1.65,
        baseline + amplitude,
        x + wavelength,
        baseline,
      );
    }

    path.lineTo(width + 140, bottom);
    path.lineTo(-140, bottom);
    path.close();
    return path;
  }

  void _drawSailingBoat(Canvas canvas, double flagScaleX) {
    // 1. Dây chằng buồm (Rigging wires)
    final wirePaint = Paint()
      ..color = const Color(0xFF004F57).withValues(alpha: 0.4)
      ..strokeWidth = 1.3
      ..style = PaintingStyle.stroke;

    canvas.drawLine(const Offset(125, 34), const Offset(80, 99), wirePaint);
    canvas.drawLine(const Offset(125, 34), const Offset(174, 99), wirePaint);

    // 2. Buồm trước / Buồm tam giác phụ (Foresail / Jib)
    final jibPath = Path()
      ..moveTo(122, 39)
      ..cubicTo(105, 56, 88, 74, 80, 87)
      ..lineTo(122, 87)
      ..close();

    final jibPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFF5FCFD), Color(0xFFCEE9EE)],
      ).createShader(const Rect.fromLTWH(80, 39, 42, 48))
      ..style = PaintingStyle.fill;

    final sailStrokePaint = Paint()
      ..color = const Color(0xFF004F57)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(jibPath, jibPaint);
    canvas.drawPath(jibPath, sailStrokePaint);

    // 3. Buồm chính (Mainsail)
    final mainSailPath = Path()
      ..moveTo(127, 34)
      ..cubicTo(144, 54, 164, 73, 174, 87)
      ..lineTo(127, 87)
      ..close();

    final mainSailPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFFFFFF), Color(0xFFE2F0F2)],
      ).createShader(const Rect.fromLTWH(127, 34, 47, 53))
      ..style = PaintingStyle.fill;

    canvas.drawPath(mainSailPath, mainSailPaint);
    canvas.drawPath(mainSailPath, sailStrokePaint);

    // 4. Cột buồm chính (Main mast)
    final mastPaint = Paint()
      ..color = const Color(0xFF00353A)
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(125, 28), const Offset(125, 100), mastPaint);

    // 5. Cờ đuôi nheo (Pennant Flag at mast peak)
    canvas.save();
    canvas.translate(125, 28);
    canvas.scale(flagScaleX, 1.0);
    final flagPath = Path()
      ..moveTo(0, 0)
      ..lineTo(16, 5)
      ..lineTo(0, 10)
      ..close();

    final flagPaint = Paint()
      ..color = const Color(0xFFF5A623)
      ..style = PaintingStyle.fill;
    final flagStroke = Paint()
      ..color = const Color(0xFFD98A0D)
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(flagPath, flagPaint);
    canvas.drawPath(flagPath, flagStroke);
    canvas.restore();

    // 6. Buồng lái trên boong (Deck Cabin)
    final cabinPath = Path()
      ..moveTo(112, 99)
      ..lineTo(112, 92)
      ..cubicTo(112, 90, 114, 89, 116, 89)
      ..lineTo(138, 89)
      ..cubicTo(140, 89, 142, 90, 142, 92)
      ..lineTo(142, 99)
      ..close();

    final cabinPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final cabinStroke = Paint()
      ..color = const Color(0xFF004F57)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    canvas.drawPath(cabinPath, cabinPaint);
    canvas.drawPath(cabinPath, cabinStroke);

    // Cửa sổ tròn buồng lái (Cabin porthole)
    final portholePaint = Paint()
      ..color = const Color(0xFF087E8B)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(const Offset(127, 94), 2.2, portholePaint);

    // 7. Thân thuyền (Boat Hull)
    final hullPath = Path()
      ..moveTo(74, 103)
      ..cubicTo(84, 122, 116, 128, 130, 128)
      ..cubicTo(144, 128, 176, 122, 186, 103)
      ..lineTo(178, 98)
      ..cubicTo(158, 100, 102, 100, 82, 98)
      ..close();

    final hullPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        stops: [0.0, 0.6, 1.0],
        colors: [
          Color(0xFF087E8B),
          Color(0xFF004F57),
          Color(0xFF00353A),
        ],
      ).createShader(const Rect.fromLTWH(74, 98, 112, 30))
      ..style = PaintingStyle.fill;

    final hullStroke = Paint()
      ..color = const Color(0xFF00353A)
      ..strokeWidth = 1.6
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(hullPath, hullPaint);
    canvas.drawPath(hullPath, hullStroke);

    // 8. Vạch sơn mạ vàng mạn thuyền (Waterline golden stripe)
    final goldStripePath = Path()
      ..moveTo(78, 105)
      ..cubicTo(96, 117, 118, 121, 130, 121)
      ..cubicTo(142, 121, 164, 117, 182, 105);

    final goldStripePaint = Paint()
      ..color = const Color(0xFFF5A623)
      ..strokeWidth = 2.4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(goldStripePath, goldStripePaint);

    // 9. Vạch sáng mép boong thuyền (Hull highlight rim)
    final highlightPaint = Paint()
      ..color = const Color(0xFFE2F0F2).withValues(alpha: 0.8)
      ..strokeWidth = 1.3
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(const Offset(83, 99), const Offset(177, 99), highlightPaint);
  }

  @override
  bool shouldRepaint(covariant _SailingBoatProgressPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.screenWidth != screenWidth;
  }
}
