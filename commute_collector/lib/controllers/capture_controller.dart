import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/location_service.dart';
import '../services/sensor_service.dart';
import '../services/activity_service.dart';
import '../services/database_service.dart';
import '../repositories/capture_repository.dart';
import '../models/location_sample.dart';
import '../models/sensor_sample.dart';
import '../models/activity_sample.dart';
import '../models/trip.dart';
import '../models/label.dart';
import '../models/travel_mode.dart';
import '../models/mode_estimate.dart';
import 'trip_session.dart';
import '../models/detected_leg.dart';
import '../models/detected_track.dart';
import 'trip_recorder.dart';
import 'mode_detector.dart';

class CaptureController extends ChangeNotifier {
  CaptureController({
    LocationService? location,
    SensorService? sensors,
    ActivityService? activity,
    CaptureRepository? repository,
  })  : _location = location ?? LocationService(),
        _sensors = sensors ?? SensorService(),
        _activity = activity ?? ActivityService(),
        _repository = repository ?? CaptureRepository(DatabaseService()) {
    _recorder = TripRecorder(_repository);
  }

  final LocationService _location;
  final SensorService _sensors;
  final ActivityService _activity;
  final CaptureRepository _repository;
  late final TripRecorder _recorder;

  final List<StreamSubscription> _subs = [];
  final TripSession _session = TripSession();
  final DetectedTrack _detectedTrack = DetectedTrack();
  final ModeDetector _detector = ModeDetector();

  static const double _autoConf = 0.7;
  static const Duration _autoDebounce = Duration(seconds: 6);

  VoidCallback? onTripSaved;

  Timer? _detectTimer;
  ModeEstimate? _estimate;
  MotionClass? _stableClass;
  DateTime? _stableSince;
  bool _autoAccept = false;

  bool _capturing = false;
  String? _error;
  StorageSummary? _summary;
  String? _volunteerCode;
  int _tripsToday = 0;

  LocationSample? _loc;
  SensorSample? _accel;
  SensorSample? _gyro;
  SensorSample? _mag;
  ActivitySample? _act;

  int _locCount = 0;
  int _accelCount = 0;
  int _gyroCount = 0;
  int _magCount = 0;
  int _actCount = 0;

  // capture state
  bool get capturing => _capturing;
  String? get error => _error;
  StorageSummary? get savedSummary => _summary;
  int get tripsToday => _tripsToday;
  LocationSample? get location => _loc;
  SensorSample? get accelerometer => _accel;
  SensorSample? get gyroscope => _gyro;
  SensorSample? get magnetometer => _mag;
  ActivitySample? get activity => _act;
  int get locationCount => _locCount;
  int get accelerometerCount => _accelCount;
  int get gyroscopeCount => _gyroCount;
  int get magnetometerCount => _magCount;
  int get activityCount => _actCount;

  // detection + manual labels
  ModeEstimate? get estimate => _estimate;
  bool get autoAccept => _autoAccept;
  Trip? get trip => _session.trip;
  List<Label> get labels => _session.labels;
  TravelMode? get currentMode => _session.currentMode;
  String get currentSource => _session.currentSource;
  DateTime? get legStartedAt => _session.legStartedAt;

  // app-detected track
  List<DetectedLeg> get detectedLegs => _detectedTrack.legs;
  MotionClass? get detectedCurrentMotion => _detectedTrack.currentMotion;
  DateTime? get detectedLegStartedAt => _detectedTrack.legStartedAt;
  double? get detectedCurrentConfidence => _detectedTrack.currentConfidence;

  Future<void> loadSummary() async {
    _summary = await _repository.summarize();
    notifyListeners();
  }

  /// Load per-volunteer daily stats (call on launch once the code is known).
  Future<void> loadDailyStats(String volunteerCode) async {
    _volunteerCode = volunteerCode;
    _tripsToday = await _repository.tripsToday(volunteerCode);
    notifyListeners();
  }

  Future<void> _refreshDailyStats() async {
    final code = _volunteerCode;
    if (code == null) return;
    _tripsToday = await _repository.tripsToday(code);
    notifyListeners();
  }

  Future<void> start(String volunteerCode) async {
    if (_capturing) return;
    _error = null;
    _volunteerCode = volunteerCode;
    notifyListeners();

    try {
      await _location.ensureReady();
      await _activity.ensureReady();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return;
    }

    _resetCounts();
    _session.begin(volunteerCode);
    _detector.clear();
    _estimate = null;
    _stableClass = null;
    _stableSince = null;
    await _recorder.begin(_session.trip!);
    _detectedTrack.begin(_session.trip!.id);

    _subs.add(_location.stream().listen(
      (s) {
        _loc = s;
        _locCount++;
        _detector.addSpeed(s);
        _recorder.addLocation(s);
        notifyListeners();
      },
      onError: _onError,
    ));
    _subs.add(_sensors.accelerometer().listen((s) {
      _accel = s;
      _accelCount++;
      _detector.addAccel(s);
      _recorder.addSensor(s);
      notifyListeners();
    }));
    _subs.add(_sensors.gyroscope().listen((s) {
      _gyro = s;
      _gyroCount++;
      _recorder.addSensor(s);
      notifyListeners();
    }));
    _subs.add(_sensors.magnetometer().listen((s) {
      _mag = s;
      _magCount++;
      _recorder.addSensor(s);
      notifyListeners();
    }));
    _subs.add(_activity.stream().listen(
      (s) {
        _act = s;
        _actCount++;
        _detector.setActivity(s);
        _recorder.addActivity(s);
        notifyListeners();
      },
      onError: _onError,
    ));

    _detectTimer =
        Timer.periodic(const Duration(seconds: 2), (_) => _onDetectTick());

    _capturing = true;
    notifyListeners();
  }

  Future<void> stop() async {
    if (!_capturing && _subs.isEmpty) return;
    _detectTimer?.cancel();
    _detectTimer = null;
    for (final s in _subs) {
      await s.cancel();
    }
    _subs.clear();

    final trip = _session.trip;
    _session.end();
    _detectedTrack.end(DateTime.now().toUtc());
    if (trip != null) {
      await _recorder.finish(trip, _session.labels, _detectedTrack.legs);
    }

    _estimate = null;
    _capturing = false;
    notifyListeners();
    await loadSummary();
    await _refreshDailyStats();
    onTripSaved?.call();
  }

  void setAutoAccept(bool v) {
    _autoAccept = v;
    notifyListeners();
  }

  void confirmSuggested() {
    final est = _estimate;
    final m = est?.suggestedMode;
    if (est == null || m == null || !_capturing) return;
    _session.selectMode(m,
        source: 'manual',
        detectedMotion: est.motion.name,
        detectedConfidence: est.confidence);
    notifyListeners();
  }

  void selectMode(TravelMode mode) {
    if (!_capturing) return;
    final est = _estimate;
    _session.selectMode(mode,
        source: 'manual',
        detectedMotion: est?.motion.name,
        detectedConfidence: est?.confidence);
    notifyListeners();
  }

  void endCurrentLeg() {
    if (!_capturing) return;
    _session.endCurrentLeg();
    notifyListeners();
  }

  Future<void> clearSavedData() async {
    await _repository.clearAll();
    await loadSummary();
    await _refreshDailyStats();
  }

  void _onDetectTick() {
    if (!_capturing) return;
    final est = _detector.compute();
    _estimate = est;
    if (est.motion != _stableClass) {
      _stableClass = est.motion;
      _stableSince = est.at;
    }
    _detectedTrack.onEstimate(est);
    if (_autoAccept) _maybeAutoAccept(est);
    notifyListeners();
  }

  void _maybeAutoAccept(ModeEstimate est) {
    final mode = est.suggestedMode;
    if (mode == null || est.confidence < _autoConf) return;
    final since = _stableSince;
    if (since == null || est.at.difference(since) < _autoDebounce) return;
    if (_session.currentMode == mode) return;
    _session.selectMode(mode,
        source: 'auto',
        detectedMotion: est.motion.name,
        detectedConfidence: est.confidence);
  }

  void _onError(Object e) {
    _error = e.toString();
    notifyListeners();
  }

  void _resetCounts() {
    _locCount = _accelCount = _gyroCount = _magCount = _actCount = 0;
  }

  @override
  void dispose() {
    _detectTimer?.cancel();
    _recorder.dispose();
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    super.dispose();
  }
}