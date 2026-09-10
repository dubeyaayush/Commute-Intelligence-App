import 'dart:math';
import '../models/sensor_sample.dart';
import '../models/location_sample.dart';
import '../models/activity_sample.dart';
import '../models/mode_estimate.dart';

/// Fuses accelerometer variance + GPS speed + Google activity recognition
/// into a live MotionClass estimate. Keeps short rolling windows and
/// recomputes on demand (the controller ticks it every ~2s).
///
/// Thresholds are FIRST GUESSES — expect to tune them on-device.
class ModeDetector {
  static const _accelWindow = Duration(seconds: 6);
  static const _speedWindow = Duration(seconds: 12);
  static const _speedMaxAccuracy = 40.0; // ignore GPS fixes worse than this (m)

  // Tunables (m/s and m/s^2):
  static const double kStillSpeed = 0.7;      // below → basically not moving
  static const double kWalkSpeedMax = 2.2;    // ~8 km/h
  static const double kVehicleSpeedMin = 5.5; // ~20 km/h
  static const double kAccelStillMax = 0.5;   // std-dev below → smooth/still
  static const double kAccelWalkMin = 1.1;    // std-dev above → foot bouncing

  final List<(DateTime, double)> _accelMag = [];
  final List<(DateTime, double)> _speeds = [];
  ActivitySample? _activity;

  void addAccel(SensorSample s) =>
      _accelMag.add((s.timestamp, sqrt(s.x * s.x + s.y * s.y + s.z * s.z)));

  void addSpeed(LocationSample s) {
    if (s.accuracy <= _speedMaxAccuracy && s.speed >= 0) {
      _speeds.add((s.timestamp, s.speed));
    }
  }

  void setActivity(ActivitySample a) => _activity = a;

  void clear() {
    _accelMag.clear();
    _speeds.clear();
    _activity = null;
  }

  ModeEstimate compute() {
    final now = DateTime.now().toUtc();
    _trim(now);
    final activity = _activity?.type.toLowerCase() ?? '';
    final hasSignal =
        _accelMag.isNotEmpty || _speeds.isNotEmpty || activity.isNotEmpty;
    if (!hasSignal) {
      return ModeEstimate(
          motion: MotionClass.unknown,
          confidence: 0,
          reason: 'Waiting for sensor data…',
          at: now);
    }
    return classify(
      accelStd: _stdDev(_accelMag.map((e) => e.$2).toList()),
      meanSpeed: _mean(_speeds.map((e) => e.$2).toList()),
      activity: activity,
      at: now,
    );
  }

  void _trim(DateTime now) {
    _accelMag.removeWhere((e) => now.difference(e.$1) > _accelWindow);
    _speeds.removeWhere((e) => now.difference(e.$1) > _speedWindow);
  }

  /// Pure classifier — no state, so it's unit-testable in isolation.
  /// Cycling folded into vehicle (sensors can't separate road vehicles).
  static ModeEstimate classify({
    required double accelStd,
    required double? meanSpeed,
    required String activity,
    required DateTime at,
  }) {
    final isStill = activity.contains('still');
    final isWalk = activity.contains('walk') || activity.contains('foot');
    final isRun = activity.contains('run');
    // bicycle activity now counts toward vehicle, not its own class
    final isVeh = activity.contains('vehicle') ||
        activity.contains('bicycle') ||
        activity.contains('cycl');

    final s = meanSpeed;
    final lowMotion = accelStd < kAccelStillMax;
    final highMotion = accelStd > kAccelWalkMin;
    final spd = s == null ? '' : ', ${s.toStringAsFixed(1)} m/s';

    // 1) Stationary
    if (lowMotion && (s == null || s < kStillSpeed) && !isVeh) {
      return ModeEstimate(
        motion: MotionClass.stationary,
        confidence: isStill ? 0.9 : 0.65,
        reason: 'Low motion$spd${isStill ? ', activity=still' : ''}',
        at: at,
      );
    }
    // 2) Walking / running (running maps to walk for now)
    if (isWalk || isRun || (highMotion && (s == null || s < kWalkSpeedMax))) {
      final agree = isWalk || isRun;
      return ModeEstimate(
        motion: MotionClass.walking,
        confidence:
            (agree && highMotion) ? 0.9 : (agree || highMotion ? 0.72 : 0.55),
        reason: 'Foot motion$spd${agree ? ', activity=walk' : ''}',
        at: at,
      );
    }
    // 3) Vehicle — now covers everything from cycling speed upward. Any road
    //    motion above walking pace, or an activity-recognition vehicle/bicycle
    //    signal, reads as "vehicle".
    if (isVeh || (s != null && s >= kWalkSpeedMax)) {
      final fast = s != null && s >= kVehicleSpeedMin;
      final agree = isVeh && (s == null || fast);
      return ModeEstimate(
        motion: MotionClass.vehicle,
        confidence: agree ? 0.85 : (fast ? 0.75 : 0.6),
        reason: 'Vehicle motion$spd — confirm type',
        at: at,
      );
    }
    return ModeEstimate(
        motion: MotionClass.unknown,
        confidence: 0,
        reason: 'Mixed signals',
        at: at);
  }

  static double? _mean(List<double> xs) =>
      xs.isEmpty ? null : xs.reduce((a, b) => a + b) / xs.length;

  static double _stdDev(List<double> xs) {
    if (xs.length < 2) return 0;
    final m = xs.reduce((a, b) => a + b) / xs.length;
    final v =
        xs.map((x) => (x - m) * (x - m)).reduce((a, b) => a + b) / xs.length;
    return sqrt(v);
  }
}