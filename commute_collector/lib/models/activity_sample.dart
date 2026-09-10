class ActivitySample {
  final String type;       // still, walking, running, onBicycle, inVehicle, unknown
  final String confidence; // high, medium, low
  final DateTime timestamp; // UTC

  ActivitySample({
    required this.type,
    required this.confidence,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() => {
        'type': type,
        'confidence': confidence,
        'timestamp': timestamp.toIso8601String(),
      };
}