/// A ground-truth journey leg: one [mode] over a closed time interval,
/// on the same UTC clock as sensor/location samples (joined via [tripId]).
class Label {
  final String tripId;
  final String mode; // TravelMode.name
  final DateTime startedAt; // UTC
  final DateTime endedAt;   // UTC
  final String source; // 'manual' or 'auto'
  final String? detectedMotion;
  final double? detectedConfidence;

  Label({
    required this.tripId,
    required this.mode,
    required this.startedAt,
    required this.endedAt,
    this.source = 'manual',
    this.detectedMotion,
    this.detectedConfidence,
  });

  Duration get duration => endedAt.difference(startedAt);

  Map<String, dynamic> toMap() => {
        'trip_id': tripId,
        'mode': mode,
        'started_at': startedAt.toIso8601String(),
        'ended_at': endedAt.toIso8601String(),
        'source': source,
        'detected_motion': detectedMotion,
        'detected_confidence': detectedConfidence,
      };

  factory Label.fromMap(Map<String, Object?> m) => Label(
        tripId: m['trip_id'] as String,
        mode: m['mode'] as String,
        startedAt: DateTime.parse(m['started_at'] as String),
        endedAt: DateTime.parse(m['ended_at'] as String),
        source: (m['source'] as String?) ?? 'manual',
        detectedMotion: m['detected_motion'] as String?,
        detectedConfidence: (m['detected_confidence'] as num?)?.toDouble(),
      );
}