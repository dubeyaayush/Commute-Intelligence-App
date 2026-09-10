import 'package:flutter/material.dart';
import '../controllers/capture_controller.dart';
import '../models/label.dart';
import '../models/detected_leg.dart';
import '../models/mode_estimate.dart';
import 'mode_visuals.dart';

/// One node in the timeline.
class TimelineEntry {
  final IconData icon;
  final String label;
  final DateTime startedAt;
  final DateTime? endedAt; // null = live/in-progress
  final String? note;
  const TimelineEntry({
    required this.icon,
    required this.label,
    required this.startedAt,
    this.endedAt,
    this.note,
  });
}

/// Live version — reads the active controller (used on the recording screen).
class JourneyPanel extends StatefulWidget {
  const JourneyPanel({super.key, required this.controller});
  final CaptureController controller;

  @override
  State<JourneyPanel> createState() => _JourneyPanelState();
}

class _JourneyPanelState extends State<JourneyPanel> {
  bool _showDetected = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final entries =
        _showDetected ? detectedEntriesLive(c) : manualEntriesLive(c);
    return _TimelineFrame(
      showDetected: _showDetected,
      onToggle: (v) => setState(() => _showDetected = v),
      start: c.trip?.startedAt,
      entries: entries,
    );
  }
}

/// Static version — reads stored legs (used on the trip detail screen).
class JourneyView extends StatefulWidget {
  const JourneyView({
    super.key,
    required this.start,
    required this.labels,
    required this.detectedLegs,
  });
  final DateTime start;
  final List<Label> labels;
  final List<DetectedLeg> detectedLegs;

  @override
  State<JourneyView> createState() => _JourneyViewState();
}

class _JourneyViewState extends State<JourneyView> {
  bool _showDetected = false;

  @override
  Widget build(BuildContext context) {
    final entries = _showDetected
        ? [for (final l in widget.detectedLegs) _detectedEntry(l)]
        : [for (final l in widget.labels) _manualEntry(l)];
    return _TimelineFrame(
      showDetected: _showDetected,
      onToggle: (v) => setState(() => _showDetected = v),
      start: widget.start,
      entries: entries,
    );
  }
}

// --- entry builders (shared) ---

List<TimelineEntry> manualEntriesLive(CaptureController c) {
  final list = <TimelineEntry>[];
  for (final l in c.labels) {
    list.add(_manualEntry(l));
  }
  if (c.currentMode != null && c.legStartedAt != null) {
    list.add(TimelineEntry(
        icon: modeIcon(c.currentMode!),
        label: c.currentMode!.label,
        startedAt: c.legStartedAt!,
        endedAt: null));
  }
  return list;
}

List<TimelineEntry> detectedEntriesLive(CaptureController c) {
  final list = <TimelineEntry>[];
  for (final l in c.detectedLegs) {
    list.add(_detectedEntry(l));
  }
  final cm = c.detectedCurrentMotion;
  if (cm != null && c.detectedLegStartedAt != null) {
    list.add(TimelineEntry(
        icon: motionIcon(cm),
        label: cm.label,
        startedAt: c.detectedLegStartedAt!,
        endedAt: null,
        note: _pct(c.detectedCurrentConfidence)));
  }
  return list;
}

TimelineEntry _manualEntry(Label l) {
  final m = modeFromName(l.mode);
  return TimelineEntry(
      icon: modeIcon(m),
      label: m.label,
      startedAt: l.startedAt,
      endedAt: l.endedAt);
}

TimelineEntry _detectedEntry(DetectedLeg l) {
  final mc = motionFromName(l.motion);
  return TimelineEntry(
      icon: motionIcon(mc),
      label: mc.label,
      startedAt: l.startedAt,
      endedAt: l.endedAt,
      note: _pct(l.confidence));
}

String? _pct(double? v) => v == null ? null : '${(v * 100).round()}%';

// --- shared frame + timeline rendering ---

class _TimelineFrame extends StatelessWidget {
  const _TimelineFrame({
    required this.showDetected,
    required this.onToggle,
    required this.start,
    required this.entries,
  });
  final bool showDetected;
  final ValueChanged<bool> onToggle;
  final DateTime? start;
  final List<TimelineEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(
                value: false,
                label: Text('Your labels'),
                icon: Icon(Icons.person, size: 16)),
            ButtonSegment(
                value: true,
                label: Text('App detected'),
                icon: Icon(Icons.smart_toy, size: 16)),
          ],
          selected: {showDetected},
          onSelectionChanged: (s) => onToggle(s.first),
          showSelectedIcon: false,
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            textStyle: WidgetStatePropertyAll(
                Theme.of(context).textTheme.bodySmall),
          ),
        ),
        const SizedBox(height: 12),
        if (start == null)
          const Text('Journey not started',
              style: TextStyle(color: Colors.grey))
        else
          _Timeline(
            start: start!,
            entries: entries,
            emptyText: showDetected ? 'No detection recorded' : 'No legs labeled',
          ),
      ],
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({
    required this.start,
    required this.entries,
    required this.emptyText,
  });
  final DateTime start;
  final List<TimelineEntry> entries;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
      decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(children: [
                Container(
                    width: 12,
                    height: 12,
                    decoration:
                        BoxDecoration(color: primary, shape: BoxShape.circle)),
                Container(width: 2, height: 16, color: Colors.grey.shade300),
              ]),
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Text('Journey started · ${fmtClock(start)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ],
          ),
          if (entries.isEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 24, bottom: 12),
              child: Text(emptyText,
                  style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          for (int i = 0; i < entries.length; i++)
            _node(context, entries[i], primary, isLast: i == entries.length - 1),
        ],
      ),
    );
  }

  Widget _node(BuildContext ctx, TimelineEntry e, Color primary,
      {required bool isLast}) {
    final live = e.endedAt == null;
    final dur = (e.endedAt ?? DateTime.now().toUtc()).difference(e.startedAt);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Icon(e.icon,
                  size: 20, color: live ? primary : Colors.grey.shade700),
              if (!isLast)
                Expanded(
                    child: Container(width: 2, color: Colors.grey.shade300)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(e.label,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(width: 8),
                      if (live) _liveBadge(primary),
                      const Spacer(),
                      Text(fmtDuration(dur),
                          style: TextStyle(
                              color: Colors.grey.shade700, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${fmtClock(e.startedAt)} → '
                    '${e.endedAt == null ? 'now' : fmtClock(e.endedAt!)}'
                    '${e.note != null ? '  ·  ${e.note}' : ''}',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _liveBadge(Color primary) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
            color: primary.withOpacity(0.15),
            borderRadius: BorderRadius.circular(4)),
        child: Text('live',
            style: TextStyle(
                fontSize: 10, color: primary, fontWeight: FontWeight.bold)),
      );
}