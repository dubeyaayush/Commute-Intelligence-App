class LocationSample {
  final double latitude;
  final double longitude;
  final double accuracy; // metres; lower = better
  final double speed;    // m/s
  final double altitude; // metres
  final DateTime timestamp; // UTC — shared clock with sensors/labels later

  LocationSample({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.speed,
    required this.altitude,
    required this.timestamp,
  });

  /// For sqflite/JSON in Step 5. trip_id gets added there.
  Map<String, dynamic> toMap() => {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'speed': speed,
        'altitude': altitude,
        'timestamp': timestamp.toIso8601String(),
      };
}