import '../models/trip.dart';
import '../models/label.dart';
import '../models/travel_mode.dart';

/// Pure state machine for one capture session's ground-truth data.
class TripSession {
  Trip? trip;
  TravelMode? currentMode;
  String currentSource = 'manual';
  String? currentDetectedMotion;
  double? currentDetectedConfidence;
  DateTime? legStartedAt;
  final List<Label> labels = [];

  bool get isActive => trip?.isActive ?? false;

  void begin(String volunteerCode) {
    labels.clear();
    currentMode = null;
    currentSource = 'manual';
    currentDetectedMotion = null;
    currentDetectedConfidence = null;
    legStartedAt = null;
    final now = DateTime.now().toUtc();
    trip = Trip(
      id: now.millisecondsSinceEpoch.toString(),
      volunteerCode: volunteerCode,
      startedAt: now,
    );
  }

  /// Switch mode: close the open leg and open a new one at the SAME instant.
  /// [detectedMotion]/[detectedConfidence] capture what the detector believed
  /// when this leg opened, for later human-vs-machine comparison.
  void selectMode(
    TravelMode mode, {
    String source = 'manual',
    String? detectedMotion,
    double? detectedConfidence,
  }) {
    if (trip == null || currentMode == mode) return;
    final now = DateTime.now().toUtc();
    _closeOpenLeg(now);
    currentMode = mode;
    currentSource = source;
    currentDetectedMotion = detectedMotion;
    currentDetectedConfidence = detectedConfidence;
    legStartedAt = now;
  }

  void endCurrentLeg() {
    _closeOpenLeg(DateTime.now().toUtc());
    _clearOpenLeg();
  }

  void end() {
    _closeOpenLeg(DateTime.now().toUtc());
    _clearOpenLeg();
    trip?.endedAt = DateTime.now().toUtc();
  }

  void _clearOpenLeg() {
    currentMode = null;
    legStartedAt = null;
    currentDetectedMotion = null;
    currentDetectedConfidence = null;
  }

  void _closeOpenLeg(DateTime at) {
    if (trip == null || currentMode == null || legStartedAt == null) return;
    labels.add(Label(
      tripId: trip!.id,
      mode: currentMode!.name,
      startedAt: legStartedAt!,
      endedAt: at,
      source: currentSource,
      detectedMotion: currentDetectedMotion,
      detectedConfidence: currentDetectedConfidence,
    ));
  }
}