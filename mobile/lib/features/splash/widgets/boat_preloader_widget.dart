import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Widget mô phỏng 100% hiệu ứng Boat Preloader thương hiệu của Tripri trên Web.
/// Bao gồm:
/// - Thuyền buồm 2D tối giản dập dềnh và lắc lư theo sóng nước.
/// - Lá cờ đuôi nheo phấp phới trong gió biển.
/// - 3 tầng sóng nước chuyển động liên tục, mượt mà với các tần số khác nhau.
/// - Các dải bọt sóng trắng và ánh sáng phản chiếu.
/// - Chữ LOADING với 3 dấu chấm nảy so le (staggered bounce).
/// - Phụ đề "Khám phá hành trình cùng Tripri".
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
    // Chu kỳ 12 giây để đồng bộ hoàn hảo các bội số tần số sóng (4.4s, 3.3s, 2.4s)
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Ambient Radial Glow + Animated Boat Canvas
            Stack(
              alignment: Alignment.center,
              children: [
                // Soft Ambient Radial Glow Backdrop
                Container(
                  width: widget.size * 0.95,
                  height: widget.size * 0.75,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.primaryLight.withValues(alpha: 0.14),
                        AppColors.secondary.withValues(alpha: 0.09),
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.55, 1.0],
                    ),
                  ),
                ),

                // ShaderMask làm mờ 2 rìa biên sóng (tương ứng waterFadeMask của Web SVG)
                ShaderMask(
                  shaderCallback: (rect) {
                    return const LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [
                        Colors.transparent,
                        Colors.black,
                        Colors.black,
                        Colors.transparent,
                      ],
                      stops: [0.0, 0.08, 0.92, 1.0],
                    ).createShader(rect);
                  },
                  blendMode: BlendMode.dstIn,
                  child: SizedBox(
                    width: widget.size,
                    height: widget.size * (170.0 / 260.0),
                    child: CustomPaint(
                      painter: _BoatPreloaderPainter(progress: t),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

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
    // Tần số nảy ~0.9s mỗi chu kỳ, lệch pha 0.16 giữa các dấu chấm
    final cycle = (t * (12.0 / 0.9) - (index * 0.16)) % 1.0;
    final sinVal = math.sin(cycle * math.pi);
    // Nhảy lên trên tối đa 5px
    final yOffset = sinVal > 0 ? -sinVal * 5.5 : 0.0;
    final opacity = 0.35 + (sinVal > 0 ? sinVal * 0.65 : 0.0);

    return Transform.translate(
      offset: Offset(0, yOffset),
      child: Opacity(
        opacity: opacity.clamp(0.2, 1.0),
        child: const Text(
          '.',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: AppColors.primaryDark,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}

/// CustomPainter vẽ toàn bộ Thuyền và Sóng chuẩn theo SVG gốc của Web.
class _BoatPreloaderPainter extends CustomPainter {
  final double progress;

  _BoatPreloaderPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 260.0;
    canvas.save();
    canvas.scale(scale, scale);

    final t = progress;

    // Kinematics:
    // Wave back: 4.4s -> shift -130px
    final dxBack = -((t * (12.0 / 4.4)) % 1.0) * 130.0;
    // Wave mid: 3.3s -> shift -130px
    final dxMid = -((t * (12.0 / 3.3)) % 1.0) * 130.0;
    // Wave front: 2.4s -> shift -130px
    final dxFront = -((t * (12.0 / 2.4)) % 1.0) * 130.0;

    // Boat bobbing (dập dềnh thẳng đứng: +/- 3.5px)
    final boatY = math.sin(t * 2 * math.pi * (12.0 / 1.5)) * 3.5;

    // Boat sway (nghiêng lắc lư: +/- 3.2 độ)
    final boatAngle = math.sin(t * 2 * math.pi * (12.0 / 2.1)) * (3.2 * math.pi / 180.0);

    // Pennant Flag flutter (co dãn lá cờ: 0.82 ~ 1.0)
    final flagScaleX = 0.91 + 0.12 * math.sin(t * 2 * math.pi * (12.0 / 0.42));

    // =========================================================================
    // LAYER 1: BACK WATER WAVES
    // =========================================================================
    final backWavePaint = Paint()
      ..color = const Color(0xFF79D4E2).withValues(alpha: 0.32)
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(dxBack, 0);
    final backWavePath = _createWavePath(
      baseline: 110.0,
      cp1Offset: -6.0,
      cp2Offset: 6.0,
    );
    canvas.drawPath(backWavePath, backWavePaint);
    canvas.restore();

    // =========================================================================
    // LAYER 2: MID WATER WAVES
    // =========================================================================
    final midWavePaint = Paint()
      ..color = const Color(0xFF087E8B).withValues(alpha: 0.45)
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(dxMid, 0);
    final midWavePath = _createWavePath(
      baseline: 116.0,
      cp1Offset: 6.0,
      cp2Offset: -6.0,
    );
    canvas.drawPath(midWavePath, midWavePaint);
    canvas.restore();

    // =========================================================================
    // LAYER 3: 2D SAILING BOAT
    // =========================================================================
    canvas.save();
    // Quay và dao động quanh tâm đáy thuyền (130, 115)
    canvas.translate(130.0, 115.0 + boatY);
    canvas.rotate(boatAngle);
    canvas.translate(-130.0, -115.0);

    _drawSailingBoat(canvas, flagScaleX);
    canvas.restore();

    // =========================================================================
    // LAYER 4: FRONT WATER WAVES (Overlaps lower hull)
    // =========================================================================
    final frontWavePaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xF2087E8B), // 95% opacity
          Color(0xFA00464D), // 98% opacity
        ],
      ).createShader(const Rect.fromLTWH(0, 112, 260, 58))
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(dxFront, 0);
    final frontWavePath = _createWavePath(
      baseline: 122.0,
      cp1Offset: -8.0,
      cp2Offset: 7.0,
    );
    canvas.drawPath(frontWavePath, frontWavePaint);

    // Bọt sóng trắng & vệt nước gợn sáng
    final whiteRipplePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.65)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    final tealRipplePaint = Paint()
      ..color = const Color(0xFF79D4E2).withValues(alpha: 0.50)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;

    for (double rx = -130; rx <= 390; rx += 130) {
      final r1 = Path()
        ..moveTo(rx + 40, 121)
        ..cubicTo(rx + 52, 117, rx + 78, 117, rx + 90, 121);
      canvas.drawPath(r1, whiteRipplePaint);

      final r2 = Path()
        ..moveTo(rx + 170, 121)
        ..cubicTo(rx + 182, 117, rx + 208, 117, rx + 220, 121);
      canvas.drawPath(r2, whiteRipplePaint);

      final r3 = Path()
        ..moveTo(rx + 105, 124)
        ..cubicTo(rx + 117, 122, rx + 138, 122, rx + 150, 124);
      canvas.drawPath(r3, tealRipplePaint);
    }

    canvas.restore();

    canvas.restore();
  }

  Path _createWavePath({
    required double baseline,
    required double cp1Offset,
    required double cp2Offset,
  }) {
    final path = Path()..moveTo(-130, baseline);

    // Lặp chu kỳ 130px từ -130 đến 455 (tổng cộng 4.5 bước sóng hoàn hảo)
    for (double x = -130; x < 455; x += 130) {
      // Nửa sóng đầu
      path.cubicTo(
        x + 32.5,
        baseline + cp1Offset,
        x + 65.0,
        baseline + cp1Offset,
        x + 97.5,
        baseline,
      );
      // Nửa sóng sau
      path.cubicTo(
        x + 130.0,
        baseline + cp2Offset,
        x + 162.5,
        baseline + cp2Offset,
        x + 195.0 - 65.0,
        baseline,
      );
    }

    path.lineTo(455, 170);
    path.lineTo(-130, 170);
    path.close();
    return path;
  }

  void _drawSailingBoat(Canvas canvas, double flagScaleX) {
    // 1. Dây chằng buồm (Rigging wires)
    final wirePaint = Paint()
      ..color = const Color(0xFF004F57).withValues(alpha: 0.35)
      ..strokeWidth = 1.2
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
      ..strokeWidth = 1.2
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
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(125, 28), const Offset(125, 100), mastPaint);

    // 5. Cờ đuôi nheo (Pennant Flag at mast peak)
    canvas.save();
    canvas.translate(125, 28);
    canvas.scale(flagScaleX, 1.0);
    final flagPath = Path()
      ..moveTo(0, 0)
      ..lineTo(15, 5)
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
      ..strokeWidth = 1.5
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
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(goldStripePath, goldStripePaint);

    // 9. Vạch sáng mép boong thuyền (Hull highlight rim)
    final highlightPaint = Paint()
      ..color = const Color(0xFFE2F0F2).withValues(alpha: 0.75)
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(const Offset(83, 99), const Offset(177, 99), highlightPaint);
  }

  @override
  bool shouldRepaint(covariant _BoatPreloaderPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
