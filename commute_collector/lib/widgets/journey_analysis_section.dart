import 'package:flutter/material.dart';
import '../models/journey.dart';
import '../services/analysis_service.dart';

/// Fetches and renders the BACKEND ENGINE's reconstruction of a trip.
class JourneyAnalysisSection extends StatefulWidget {
  const JourneyAnalysisSection({
    super.key,
    required this.tripId,
    required this.baseUrl,
    required this.apiKey,
    required this.uploaded,
  });

  final String tripId;
  final String? baseUrl;
  final String? apiKey;
  final bool uploaded;

  @override
  State<JourneyAnalysisSection> createState() => _JourneyAnalysisSectionState();
}

enum _Phase { idle, loading, error, done }

class _JourneyAnalysisSectionState extends State<JourneyAnalysisSection> {
  _Phase _phase = _Phase.idle;
  String? _error;
  Journey? _journey;

  Future<void> _analyse() async {
    final url = widget.baseUrl;
    if (url == null || url.isEmpty) {
      setState(() {
        _phase = _Phase.error;
        _error = 'Set the server URL in settings first.';
      });
      return;
    }
    setState(() {
      _phase = _Phase.loading;
      _error = null;
    });
    try {
      final journey = await AnalysisService(
        baseUrl: url,
        apiKey: widget.apiKey,
      ).fetchJourney(widget.tripId);
      if (!mounted) return;
      setState(() {
        _journey = journey;
        _phase = _Phase.done;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights, size: 18, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'Server analysis',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'The backend engine\'s reconstruction of this trip.',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
          ),
          const SizedBox(height: 12),
          _body(theme),
        ],
      ),
    );
  }

  Widget _body(ThemeData theme) {
    if (!widget.uploaded && _phase == _Phase.idle) {
      return Text(
        'This trip hasn\'t been uploaded yet — upload it first, then analyse.',
        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
      );
    }
    switch (_phase) {
      case _Phase.idle:
        return SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: _analyse,
            icon: const Icon(Icons.play_arrow, size: 18),
            label: const Text('Analyse this trip'),
          ),
        );
      case _Phase.loading:
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Text('Analysing on server…'),
            ],
          ),
        );
      case _Phase.error:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.error_outline, size: 18, color: Colors.red.shade400),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error ?? 'Something went wrong.',
                    style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: _analyse, child: const Text('Retry')),
          ],
        );
      case _Phase.done:
        return _JourneyResult(journey: _journey!);
    }
  }
}

class _JourneyResult extends StatelessWidget {
  const _JourneyResult({required this.journey});
  final Journey journey;

  @override
  Widget build(BuildContext context) {
    final j = journey;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${j.totalMinutes?.toStringAsFixed(0) ?? '—'} min · '
          '${j.legs.length} leg${j.legs.length == 1 ? '' : 's'} · '
          '${j.gpsSamples} GPS points',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 10),
        for (final leg in j.legs) _LegRow(leg: leg),
        if (j.metroArrivals.isNotEmpty) ...[
          const SizedBox(height: 10),
          for (final a in j.metroArrivals)
            Row(
              children: [
                const Icon(Icons.subway, size: 18, color: Colors.indigo),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Metro arrival · ${a.station}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
                Text(
                  '${(a.confidence * 100).round()}%',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
        ],
      ],
    );
  }
}

class _LegRow extends StatelessWidget {
  const _LegRow({required this.leg});
  final JourneyLeg leg;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_icon, size: 20, color: Colors.grey.shade700),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _fmtDur(leg.seconds),
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  _subtitle,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData get _icon {
    switch (leg.kind) {
      case 'walking':
        return Icons.directions_walk;
      case 'waiting':
        return Icons.hourglass_empty;
      case 'moving':
        return Icons.commute; // generic vehicle — not a specific mode
      case 'stopped':
      default:
        return Icons.place;
    }
  }

  String get _title {
    switch (leg.kind) {
      case 'walking':
        return 'Walking';
      case 'waiting':
        return 'Waiting';
      case 'stopped':
        return 'Stopped';
      case 'moving':
        // 'vehicle' (or missing) → generic; a named mode only if the engine committed.
        if (leg.modeLabel == null || leg.modeLabel == 'vehicle')
          return 'Vehicle';
        return _cap(leg.modeLabel!);
      default:
        return leg.kind;
    }
  }

  String get _subtitle {
    if (leg.kind != 'moving') {
      return leg.confidence != null
          ? '${(leg.confidence! * 100).round()}% confidence'
          : '—';
    }
    final parts = <String>[
      '${leg.medianSpeedKmh.toStringAsFixed(0)} km/h median',
    ];
    // When we didn't name a specific mode, show which way it leaned — honest detail.
    if ((leg.modeLabel == null || leg.modeLabel == 'vehicle') &&
        leg.modeLean != null) {
      final pct = leg.modeConfidence != null
          ? ' ${(leg.modeConfidence! * 100).round()}%'
          : '';
      parts.add('leaning ${leg.modeLean}$pct');
    } else if (leg.modeConfidence != null) {
      parts.add('${(leg.modeConfidence! * 100).round()}% mode');
    }
    return parts.join('  ·  ');
  }

  String _fmtDur(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return s == 0 ? '${m}m' : '${m}m ${s}s';
  }

  String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
