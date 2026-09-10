enum SensorType { accelerometer, gyroscope, magnetometer }

class SensorSample {
  final SensorType type;
  final double x;
  final double y;
  final double z;
  final DateTime timestamp; // UTC — shared clock with location/labels

  SensorSample({
    required this.type,
    required this.x,
    required this.y,
    required this.z,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() => {
        'type': type.name,
        'x': x,
        'y': y,
        'z': z,
        'timestamp': timestamp.toIso8601String(),
      };
}