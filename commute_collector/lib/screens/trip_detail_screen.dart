import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../models/label.dart';
import '../models/detected_leg.dart';
import '../repositories/capture_repository.dart';
import '../widgets/journey_timeline.dart';
import '../widgets/journey_analysis_section.dart';
import '../widgets/mode_visuals.dart';

/// Read-only view of one completed trip: summary stats + both local timelines,
/// plus the backend engine's reconstruction (fetched on demand).
class TripDetailScreen extends StatefulWidget {
  const TripDetailScreen({
    super.key,
    required this.repository,
    required this.tripId,
    this.baseUrl,
    this.apiKey,
  });

  final CaptureRepository repository;
  final String tripId;
  final String? baseUrl; // server config (from UploadController) for analysis
  final String? apiKey;

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  Trip? _trip;
  List<Label> _labels = [];
  List<DetectedLeg> _detected = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final trip = await widget.repository.tripById(widget.tripId);
    final labels = await widget.repository.labelsForTrip(widget.tripId);
    final detected =
        await widget.repository.detectedLegsForTrip(widget.tripId);
    if (!mounted) return;
    setState(() {
      _trip = trip;
      _labels = labels;
      _detected = detected;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trip')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _trip == null
                ? const Center(child: Text('Trip not found'))
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _SummaryHeader(
                          trip: _trip!,
                          legCount: _labels.length,
                          detectedCount: _detected.length),
                      const SizedBox(height: 16),
                      JourneyView(
                        start: _trip!.startedAt,
                        labels: _labels,
                        detectedLegs: _detected,
                      ),
                      const SizedBox(height: 16),
                      JourneyAnalysisSection(
                        tripId: widget.tripId,
                        baseUrl: widget.baseUrl,
                        apiKey: widget.apiKey,
                        uploaded: _trip!.uploaded,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: FilledButton.styleFrom(
                            padding:
                                const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: const Text('Done'),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  const _SummaryHeader({
    required this.trip,
    required this.legCount,
    required this.detectedCount,
  });
  final Trip trip;
  final int legCount;
  final int detectedCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dur = trip.duration ?? Duration.zero;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.check_circle, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Text('Trip complete',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const Spacer(),
              Icon(
                  trip.uploaded ? Icons.cloud_done : Icons.cloud_upload_outlined,
                  size: 18,
                  color: trip.uploaded
                      ? Colors.green
                      : Colors.grey.shade500),
            ],
          ),
          const SizedBox(height: 10),
          Text('${_date(trip.startedAt)} · ${fmtClock(trip.startedAt)}'
              '${trip.endedAt != null ? ' → ${fmtClock(trip.endedAt!)}' : ''}'),
          const SizedBox(height: 4),
          Text(
            'Duration ${fmtDuration(dur)}  ·  '
            'You labeled $legCount leg${legCount == 1 ? '' : 's'}  ·  '
            'App detected $detectedCount',
            style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
          ),
        ],
      ),
    );
  }

  String _date(DateTime utc) {
    final t = utc.toLocal();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${t.day} ${months[t.month - 1]}';
  }
}