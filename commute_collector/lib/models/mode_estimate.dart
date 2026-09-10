import 'travel_mode.dart';

/// What the sensor fusion can decide reliably. Cycling has been folded into
/// `vehicle`: phone sensors can't reliably separate a bicycle/motorbike from
/// other road vehicles, and keeping it caused constant vehicle↔cycling
/// flip-flopping. The volunteer's manual modes still include Bike — this only
/// coarsens what the MACHINE guesses.
enum MotionClass { stationary, walking, vehicle, unknown }

extension MotionClassLabel on MotionClass {
  String get label => switch (this) {
        MotionClass.stationary => 'Stationary',
        MotionClass.walking => 'Walking',
        MotionClass.vehicle => 'In vehicle',
        MotionClass.unknown => 'Unknown',
      };
}

/// A live guess from the fusion detector.
class ModeEstimate {
  final MotionClass motion;
  final double confidence; // 0..1
  final String reason;
  final DateTime at; // UTC

  const ModeEstimate({
    required this.motion,
    required this.confidence,
    required this.reason,
    required this.at,
  });

  /// Concrete mode to suggest, or null when a human must decide (vehicle type
  /// is ambiguous; unknown has no guess).
  TravelMode? get suggestedMode => switch (motion) {
        MotionClass.stationary => TravelMode.waiting,
        MotionClass.walking => TravelMode.walk,
        MotionClass.vehicle => null,
        MotionClass.unknown => null,
      };

  bool get isVehicleAmbiguous => motion == MotionClass.vehicle;
  int get confidencePct => (confidence * 100).round();
}