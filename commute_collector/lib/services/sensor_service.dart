import 'package:sensors_plus/sensors_plus.dart';
import '../models/sensor_sample.dart';

class SensorService {
  /// The rate we actually STORE, enforced in software below. Many Android
  /// devices ignore the hardware sampling-period hint and deliver much faster
  /// (the test Motorola gave ~50Hz for a 5Hz request), so we can't trust the
  /// hardware rate — we gate it ourselves. This is the single knob: lower the
  /// period (e.g. 40ms = 25Hz) when the ML phase needs richer signal.
  static const Duration storePeriod = Duration(milliseconds: 200); // 5 Hz

  // Best-effort hint to the hardware (saves battery if the device honors it;
  // the software gate guarantees the ceiling if it doesn't).
  static const _hint = SensorInterval.normalInterval;

  Stream<SensorSample> accelerometer() => _throttled(
        accelerometerEventStream(samplingPeriod: _hint),
        SensorType.accelerometer,
        (e) => (e.x, e.y, e.z),
      );

  Stream<SensorSample> gyroscope() => _throttled(
        gyroscopeEventStream(samplingPeriod: _hint),
        SensorType.gyroscope,
        (e) => (e.x, e.y, e.z),
      );

  Stream<SensorSample> magnetometer() => _throttled(
        magnetometerEventStream(samplingPeriod: _hint),
        SensorType.magnetometer,
        (e) => (e.x, e.y, e.z),
      );

  /// Map raw events to samples (timestamp on arrival) and drop any that arrive
  /// less than [storePeriod] after the last KEPT one — enforcing our rate
  /// regardless of how fast the device fires.
  Stream<SensorSample> _throttled<T>(
    Stream<T> source,
    SensorType type,
    (double, double, double) Function(T) xyz,
  ) {
    DateTime? lastKept;
    return source
        .map((e) {
          final (x, y, z) = xyz(e);
          return SensorSample(
            type: type,
            x: x,
            y: y,
            z: z,
            timestamp: DateTime.now().toUtc(),
          );
        })
        .where((s) {
          if (lastKept == null ||
              s.timestamp.difference(lastKept!) >= storePeriod) {
            lastKept = s.timestamp;
            return true;
          }
          return false;
        });
  }
}