import 'package:flutter_activity_recognition/flutter_activity_recognition.dart';
import '../models/activity_sample.dart';

class ActivityService {
  final _ar = FlutterActivityRecognition.instance;

  /// Requests the ACTIVITY_RECOGNITION runtime permission.
  /// Throws a readable message if not granted.
  Future<void> ensureReady() async {
    var perm = await _ar.checkPermission();
    if (perm == ActivityPermission.PERMANENTLY_DENIED) {
      throw 'Activity permission permanently denied. Enable it in app settings.';
    }
    if (perm == ActivityPermission.DENIED) {
      perm = await _ar.requestPermission();
      if (perm != ActivityPermission.GRANTED) {
        throw 'Activity permission denied.';
      }
    }
  }

  /// Event-driven: emits only when the detected activity CHANGES, not on a
  /// fixed interval. The first event can take a while to arrive.
  Stream<ActivitySample> stream() => _ar.activityStream.map(
        (a) => ActivitySample(
          type: a.type.name,
          confidence: a.confidence.name,
          timestamp: DateTime.now().toUtc(),
        ),
      );
}