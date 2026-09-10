/// One capture session. Ties every sample and label together via [id].
class Trip {
  final String id;
  final String volunteerCode;
  final DateTime startedAt; // UTC
  DateTime? endedAt;        // UTC — null while active
  final bool uploaded;

  Trip({
    required this.id,
    required this.volunteerCode,
    required this.startedAt,
    this.endedAt,
    this.uploaded = false,
  });

  bool get isActive => endedAt == null;
  Duration? get duration =>
      endedAt == null ? null : endedAt!.difference(startedAt);

  Map<String, dynamic> toMap() => {
        'id': id,
        'volunteer_code': volunteerCode,
        'started_at': startedAt.toIso8601String(),
        'ended_at': endedAt?.toIso8601String(),
      };

  factory Trip.fromMap(Map<String, Object?> m) => Trip(
        id: m['id'] as String,
        volunteerCode: m['volunteer_code'] as String,
        startedAt: DateTime.parse(m['started_at'] as String),
        endedAt: m['ended_at'] == null
            ? null
            : DateTime.parse(m['ended_at'] as String),
        uploaded: ((m['uploaded'] as int?) ?? 0) == 1,
      );
}