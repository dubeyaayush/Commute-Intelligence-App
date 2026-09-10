/// One leg of the app's INDEPENDENT detected journey (parallel to the
/// volunteer's manual labels). Motion is a MotionClass.name.
class DetectedLeg {
  final String tripId;
  final String motion;
  final DateTime startedAt; // UTC
  final DateTime endedAt;   // UTC
  final double? confidence;

  DetectedLeg({
    required this.tripId,
    required this.motion,
    required this.startedAt,
    required this.endedAt,
    this.confidence,
  });

  Duration get duration => endedAt.difference(startedAt);

  Map<String, dynamic> toMap() => {
        'trip_id': tripId,
        'motion': motion,
        'started_at': startedAt.toIso8601String(),
        'ended_at': endedAt.toIso8601String(),
        'confidence': confidence,
      };

  factory DetectedLeg.fromMap(Map<String, Object?> m) => DetectedLeg(
        tripId: m['trip_id'] as String,
        motion: m['motion'] as String,
        startedAt: DateTime.parse(m['started_at'] as String),
        endedAt: DateTime.parse(m['ended_at'] as String),
        confidence: (m['confidence'] as num?)?.toDouble(),
      );
}