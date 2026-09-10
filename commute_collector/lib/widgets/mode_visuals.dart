import 'package:flutter/material.dart';
import '../models/travel_mode.dart';
import '../models/mode_estimate.dart';

IconData modeIcon(TravelMode m) => switch (m) {
      TravelMode.walk => Icons.directions_walk,
      TravelMode.metro => Icons.train,
      TravelMode.bus => Icons.directions_bus,
      TravelMode.auto => Icons.local_taxi,
      TravelMode.car => Icons.directions_car,
      TravelMode.bike => Icons.directions_bike,
      TravelMode.waiting => Icons.hourglass_empty,
      TravelMode.other => Icons.more_horiz,
    };

IconData motionIcon(MotionClass m) => switch (m) {
      MotionClass.stationary => Icons.hourglass_empty,
      MotionClass.walking => Icons.directions_walk,
      MotionClass.vehicle => Icons.directions_transit,
      MotionClass.unknown => Icons.help_outline,
    };

TravelMode modeFromName(String name) => TravelMode.values
    .firstWhere((m) => m.name == name, orElse: () => TravelMode.other);

MotionClass motionFromName(String name) => MotionClass.values
    .firstWhere((m) => m.name == name, orElse: () => MotionClass.unknown);

String fmtDuration(Duration d) {
  final h = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
  if (h > 0) return '${h}h ${m}m';
  if (m > 0) return '${m}m ${s}s';
  return '${s}s';
}

String fmtClock(DateTime utc) {
  final t = utc.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.hour)}:${two(t.minute)}:${two(t.second)}';
}