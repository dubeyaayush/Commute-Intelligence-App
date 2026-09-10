import 'dart:async';
import '../models/location_sample.dart';
import '../models/sensor_sample.dart';
import '../models/activity_sample.dart';
import '../models/trip.dart';
import '../models/label.dart';
import '../models/detected_leg.dart';
import '../repositories/capture_repository.dart';

/// Buffers capture data in memory and flushes it to the database in batches.
/// Trip row saved on begin(); samples flush on a timer; labels, detected legs,
/// and trip end are written on finish().
class TripRecorder {
  TripRecorder(this._repo);
  final CaptureRepository _repo;

  static const _flushInterval = Duration(seconds: 10);

  Trip? _trip;
  Timer? _flushTimer;
  final List<Map<String, Object?>> _locBuf = [];
  final List<Map<String, Object?>> _sensorBuf = [];
  final List<Map<String, Object?>> _activityBuf = [];

  Future<void> begin(Trip trip) async {
    _trip = trip;
    _locBuf.clear();
    _sensorBuf.clear();
    _activityBuf.clear();
    await _repo.insertTrip(trip);
    _flushTimer = Timer.periodic(_flushInterval, (_) => flush());
  }

  void addLocation(LocationSample s) {
    final t = _trip;
    if (t != null) _locBuf.add({'trip_id': t.id, ...s.toMap()});
  }

  void addSensor(SensorSample s) {
    final t = _trip;
    if (t != null) _sensorBuf.add({'trip_id': t.id, ...s.toMap()});
  }

  void addActivity(ActivitySample s) {
    final t = _trip;
    if (t != null) _activityBuf.add({'trip_id': t.id, ...s.toMap()});
  }

  Future<void> flush() async {
    if (_locBuf.isEmpty && _sensorBuf.isEmpty && _activityBuf.isEmpty) return;
    final loc = List<Map<String, Object?>>.from(_locBuf);
    final sensor = List<Map<String, Object?>>.from(_sensorBuf);
    final activity = List<Map<String, Object?>>.from(_activityBuf);
    _locBuf.clear();
    _sensorBuf.clear();
    _activityBuf.clear();
    await _repo.insertSamples(
        locations: loc, sensors: sensor, activities: activity);
  }

  Future<void> finish(
    Trip trip,
    List<Label> labels,
    List<DetectedLeg> detectedLegs,
  ) async {
    _flushTimer?.cancel();
    _flushTimer = null;
    await flush();
    await _repo.insertLabels(labels);
    await _repo.insertDetectedLegs(detectedLegs);
    await _repo.updateTripEnd(trip.id, trip.endedAt);
    _trip = null;
  }

  void dispose() {
    _flushTimer?.cancel();
    _flushTimer = null;
  }
}