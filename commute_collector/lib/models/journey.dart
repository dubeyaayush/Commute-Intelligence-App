/// The backend engine's reconstruction of a trip — legs, modes, events.
/// Mirrors the JSON from GET /commute/:id.
class Journey {
  final String tripId;
  final String volunteerCode;
  final DateTime startedAt;
  final DateTime? endedAt;
  final double? totalMinutes;
  final int gpsSamples;
  final List<JourneyLeg> legs;
  final List<MetroArrival> metroArrivals;

  Journey({
    required this.tripId,
    required this.volunteerCode,
    required this.startedAt,
    required this.endedAt,
    required this.totalMinutes,
    required this.gpsSamples,
    required this.legs,
    required this.metroArrivals,
  });

  factory Journey.fromJson(Map<String, dynamic> j) {
    final events = (j['events'] as Map<String, dynamic>?) ?? const {};
    return Journey(
      tripId: j['tripId'] as String,
      volunteerCode: j['volunteerCode'] as String? ?? '',
      startedAt: DateTime.parse(j['startedAt'] as String).toLocal(),
      endedAt: j['endedAt'] == null
          ? null
          : DateTime.parse(j['endedAt'] as String).toLocal(),
      totalMinutes: (j['totalMinutes'] as num?)?.toDouble(),
      gpsSamples: (j['gpsSamples'] as num?)?.toInt() ?? 0,
      legs: ((j['legs'] as List?) ?? const [])
          .map((e) => JourneyLeg.fromJson(e as Map<String, dynamic>))
          .toList(),
      metroArrivals: ((events['metroArrivals'] as List?) ?? const [])
          .map((e) => MetroArrival.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class JourneyLeg {
  final String kind; // walking | moving | waiting | stopped
  final DateTime startedAt;
  final DateTime endedAt;
  final int seconds;
  final double medianSpeedKmh;
  final double maxSpeedKmh;
  final double? confidence;
  final String? modeLabel; // 'vehicle' | 'e-rickshaw' | 'car' | 'metro'
  final String? modeLean; // best guess even when label is 'vehicle'
  final double? modeConfidence;

  JourneyLeg({
    required this.kind,
    required this.startedAt,
    required this.endedAt,
    required this.seconds,
    required this.medianSpeedKmh,
    required this.maxSpeedKmh,
    required this.confidence,
    required this.modeLabel,
    required this.modeLean,
    required this.modeConfidence,
  });

  factory JourneyLeg.fromJson(Map<String, dynamic> j) {
    final mode = j['mode'] as Map<String, dynamic>?;
    return JourneyLeg(
      kind: j['kind'] as String,
      startedAt: DateTime.parse(j['startedAt'] as String).toLocal(),
      endedAt: DateTime.parse(j['endedAt'] as String).toLocal(),
      seconds: (j['seconds'] as num?)?.toInt() ?? 0,
      medianSpeedKmh: (j['medianSpeedKmh'] as num?)?.toDouble() ?? 0,
      maxSpeedKmh: (j['maxSpeedKmh'] as num?)?.toDouble() ?? 0,
      confidence: (j['confidence'] as num?)?.toDouble(),
      modeLabel: mode?['label'] as String?,
      modeLean: mode?['lean'] as String?,
      modeConfidence: (mode?['confidence'] as num?)?.toDouble(),
    );
  }

  double get minutes => seconds / 60.0;
}

class MetroArrival {
  final DateTime at;
  final String station;
  final double confidence;

  MetroArrival({required this.at, required this.station, required this.confidence});

  factory MetroArrival.fromJson(Map<String, dynamic> j) => MetroArrival(
        at: DateTime.parse(j['at'] as String).toLocal(),
        station: j['station'] as String? ?? 'Unknown station',
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
      );
}