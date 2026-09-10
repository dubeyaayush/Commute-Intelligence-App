import 'package:flutter/material.dart';

/// One place for the app's look. Everything else reads from Theme.of(context),
/// so colors/spacing stay consistent and are changeable in a single spot.
class AppTheme {
  static const seed = Color(0xFF3F51B5); // indigo
  static const recording = Color(0xFFE53935); // red — active capture accent

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: seed);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF7F8FB),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: Color(0xFFF7F8FB),
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(color: Colors.grey.shade200, thickness: 1),
    );
  }
}

/// Shared spacing scale — use instead of scattered magic numbers.
class Gap {
  static const xs = SizedBox(height: 4);
  static const s = SizedBox(height: 8);
  static const m = SizedBox(height: 16);
  static const l = SizedBox(height: 24);
  static const xl = SizedBox(height: 32);
}