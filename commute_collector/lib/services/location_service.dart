import 'package:geolocator/geolocator.dart';
import 'package:geolocator_android/geolocator_android.dart';
import '../models/location_sample.dart';

class LocationService {
  /// Ensures location is usable: service on + permission granted.
  /// Throws with a readable message if not, so the UI can show it.
  Future<void> ensureReady() async {
    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) {
      throw 'Location is turned off. Enable it in system settings.';
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw 'Location permission denied.';
    }
    if (permission == LocationPermission.deniedForever) {
      throw 'Location permission permanently denied. '
          'Enable it in app settings.';
    }
    // whileInUse is enough to START the foreground service. For reliable
    // screen-off capture over a full commute, the volunteer should also set
    // "Allow all the time" (background location) — a manual per-phone step.
  }

  /// Live stream of location fixes, running under a FOREGROUND SERVICE so the
  /// app process (and therefore our sensor/activity streams too) keeps running
  /// when the screen is off or the app is backgrounded. enableWakeLock keeps
  /// the CPU awake so sensors keep sampling; without it they stall in doze.
  Stream<LocationSample> stream() {
    final settings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 0,
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Commute Collector',
        notificationText: 'Recording your commute…',
        enableWakeLock: true,
        setOngoing: true, // user can't swipe the notification away mid-capture
      ),
    );
    return Geolocator.getPositionStream(locationSettings: settings)
        .map((p) => LocationSample(
              latitude: p.latitude,
              longitude: p.longitude,
              accuracy: p.accuracy,
              speed: p.speed,
              altitude: p.altitude,
              timestamp: p.timestamp.toUtc(),
            ));
  }

  /// Opens this app's system settings page — used to grant "Allow all the
  /// time" and disable battery optimization during phone whitelisting.
  Future<bool> openSettings() => Geolocator.openAppSettings();
}