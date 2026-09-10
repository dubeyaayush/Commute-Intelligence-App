import 'detected_leg.dart';
import 'mode_estimate.dart';

/// Builds an INDEPENDENT timeline of what the detector saw, parallel to the
/// volunteer's manual labels — but resolved by WEIGHT OF EVIDENCE, not by
/// reacting to each 2s estimate.
///
/// Three mechanisms kill the flip-flopping:
///  1. Rolling confidence-weighted vote over [_window]: the "current best"
///     class is whichever has the most confidence-summed support recently, so
///     isolated low-confidence blips can't define a leg.
///  2. Hysteresis: to SWITCH the committed leg, the challenger must beat the
///     incumbent's weighted score by [_margin] — merely tying isn't enough, so
///     the track resists leaving a stable state.
///  3. Short-leg absorption on close: a leg shorter than [_minLeg] that sits
///     between two same-class legs is noise and gets merged away.
class DetectedTrack {
  DetectedTrack({
    Duration window = const Duration(seconds: 16),
    double margin = 1.4, // challenger must exceed incumbent score ×1.4 to win
    Duration minLeg = const Duration(seconds: 10),
  })  : _window = window,
        _margin = margin,
        _minLeg = minLeg;

  final Duration _window;
  final double _margin;
  final Duration _minLeg;

  final List<DetectedLeg> legs = [];
  String? _tripId;

  // committed (currently-open) leg
  MotionClass? currentMotion;
  DateTime? legStartedAt;
  double? currentConfidence;

  // rolling evidence: recent (class, confidence, at)
  final List<_Vote> _votes = [];

  void begin(String tripId) {
    legs.clear();
    _votes.clear();
    _tripId = tripId;
    currentMotion = null;
    legStartedAt = null;
    currentConfidence = null;
  }

  void onEstimate(ModeEstimate est) {
    if (_tripId == null) return;
    // 'unknown' carries no evidence — record nothing, decide nothing.
    if (est.motion == MotionClass.unknown || est.confidence <= 0) return;

    _votes.add(_Vote(est.motion, est.confidence, est.at));
    _trim(est.at);

    final tally = _tally(); // class -> summed confidence over window
    if (tally.isEmpty) return;

    // winner = highest weighted support in the window
    final winner =
        tally.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
    final winnerScore = tally[winner]!;

    // No committed leg yet → open with the current winner.
    if (currentMotion == null) {
      _open(winner, est.at, _avgConf(winner));
      return;
    }

    // Winner is the incumbent → just refresh confidence, stay put.
    if (winner == currentMotion) {
      currentConfidence = _avgConf(winner);
      return;
    }

    // Winner differs → HYSTERESIS: only switch if it clearly beats the
    // incumbent's own support (challenger must exceed incumbent × margin).
    final incumbentScore = tally[currentMotion] ?? 0.0;
    if (winnerScore >= incumbentScore * _margin) {
      _closeOpenLeg(est.at);
      _open(winner, est.at, _avgConf(winner));
    }
    // else: challenger not dominant enough — hold the current leg.
  }

  void end(DateTime at) {
    _closeOpenLeg(at);
    currentMotion = null;
    legStartedAt = null;
    currentConfidence = null;
    _absorbShortLegs(); // final cleanup pass
  }

  // --- internals ---

  void _open(MotionClass m, DateTime at, double conf) {
    currentMotion = m;
    legStartedAt = at;
    currentConfidence = conf;
  }

  void _closeOpenLeg(DateTime at) {
    if (_tripId == null || currentMotion == null || legStartedAt == null) return;
    if (!at.isAfter(legStartedAt!)) return;
    legs.add(DetectedLeg(
      tripId: _tripId!,
      motion: currentMotion!.name,
      startedAt: legStartedAt!,
      endedAt: at,
      confidence: currentConfidence,
    ));
  }

  void _trim(DateTime now) {
    _votes.removeWhere((v) => now.difference(v.at) > _window);
  }

  Map<MotionClass, double> _tally() {
    final t = <MotionClass, double>{};
    for (final v in _votes) {
      t[v.motion] = (t[v.motion] ?? 0) + v.confidence;
    }
    return t;
  }

  double _avgConf(MotionClass m) {
    final xs = _votes.where((v) => v.motion == m).map((v) => v.confidence);
    if (xs.isEmpty) return 0;
    return xs.reduce((a, b) => a + b) / xs.length;
  }

  /// Merge any leg shorter than _minLeg that is flanked by the SAME class on
  /// both sides (classic noise sliver), collapsing the three into one. Repeats
  /// until stable. Runs once at end().
  void _absorbShortLegs() {
    bool changed = true;
    while (changed && legs.length >= 3) {
      changed = false;
      for (int i = 1; i < legs.length - 1; i++) {
        final prev = legs[i - 1], mid = legs[i], next = legs[i + 1];
        if (mid.duration < _minLeg &&
            prev.motion == next.motion &&
            mid.motion != prev.motion) {
          // fold prev+mid+next into one leg of prev's class
          final merged = DetectedLeg(
            tripId: prev.tripId,
            motion: prev.motion,
            startedAt: prev.startedAt,
            endedAt: next.endedAt,
            confidence: prev.confidence,
          );
          legs
            ..removeRange(i - 1, i + 2)
            ..insert(i - 1, merged);
          changed = true;
          break; // list mutated — restart the scan
        }
      }
    }
  }
}

class _Vote {
  final MotionClass motion;
  final double confidence;
  final DateTime at;
  _Vote(this.motion, this.confidence, this.at);
}