import 'package:flutter/material.dart';
import '../controllers/capture_controller.dart';
import '../models/label.dart';
import '../models/travel_mode.dart';
import '../models/mode_estimate.dart';

/// Live ground-truth labeling with sensor-fusion suggestions.
class LabelingPanel extends StatelessWidget {
  const LabelingPanel({super.key, required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final capturing = controller.capturing;
    final labels = controller.labels;

    return Card(
      color: Colors.indigo.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('Ground-truth labeling',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                const Text('Auto', style: TextStyle(fontSize: 13)),
                Switch(
                  value: controller.autoAccept,
                  onChanged: capturing ? controller.setAutoAccept : null,
                ),
              ],
            ),
            if (!capturing)
              Text(
                labels.isEmpty
                    ? 'Start capture to begin labeling your journey legs.'
                    : 'Last trip: ${labels.length} leg(s) recorded.',
                style: const TextStyle(color: Colors.grey),
              )
            else ...[
              _DetectionBanner(controller: controller),
              const SizedBox(height: 10),
              _CurrentLeg(controller: controller),
              const SizedBox(height: 12),
              _ModeSelector(controller: controller),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: controller.currentMode == null
                      ? null
                      : controller.endCurrentLeg,
                  icon: const Icon(Icons.stop_circle_outlined),
                  label: const Text('End current leg'),
                ),
              ),
            ],
            if (labels.isNotEmpty) ...[
              const Divider(height: 24),
              Text('Legs this trip (${labels.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              for (final label in labels) _LegRow(label: label),
            ],
          ],
        ),
      ),
    );
  }
}

class _DetectionBanner extends StatelessWidget {
  const _DetectionBanner({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final est = controller.estimate;
    if (est == null || est.motion == MotionClass.unknown) {
      return _box(
        icon: Icons.motion_photos_on,
        color: Colors.grey,
        title: 'Detecting motion…',
        subtitle: est?.reason ?? 'Waiting for sensor data',
      );
    }

    final suggested = est.suggestedMode;
    final current = controller.currentMode;
    Widget? action;
    if (est.isVehicleAmbiguous) {
      action = const Text('In a vehicle — tap the type below',
          style: TextStyle(fontWeight: FontWeight.w600));
    } else if (suggested != null && suggested != current) {
      action = FilledButton(
        onPressed: controller.confirmSuggested,
        child: Text('Confirm: ${suggested.label}'),
      );
    } else if (suggested != null && suggested == current) {
      action = Text('✓ matches current leg',
          style: TextStyle(color: Colors.green.shade700));
    }

    return _box(
      icon: _iconFor(est.motion),
      color: Colors.indigo,
      title: 'Detected: ${est.motion.label} · ${est.confidencePct}%',
      subtitle: est.reason,
      action: action,
    );
  }

  Widget _box({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Expanded(
                child: Text(title,
                    style: const TextStyle(fontWeight: FontWeight.bold))),
          ]),
          const SizedBox(height: 2),
          Text(subtitle,
              style: const TextStyle(color: Colors.grey, fontSize: 12)),
          if (action != null) ...[const SizedBox(height: 8), action],
        ],
      ),
    );
  }

  IconData _iconFor(MotionClass m) => switch (m) {
        MotionClass.stationary => Icons.hourglass_bottom,
        MotionClass.walking => Icons.directions_walk,
        MotionClass.vehicle => Icons.directions_transit,
        MotionClass.unknown => Icons.help_outline,
      };
}

class _CurrentLeg extends StatelessWidget {
  const _CurrentLeg({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final mode = controller.currentMode;
    final start = controller.legStartedAt;
    if (mode == null || start == null) {
      return const Text('No leg in progress. Confirm the suggestion or tap a mode.');
    }
    final elapsed = DateTime.now().toUtc().difference(start);
    final auto = controller.currentSource == 'auto';
    return Row(
      children: [
        const Icon(Icons.play_circle_fill, color: Colors.green, size: 20),
        const SizedBox(width: 6),
        Text('Current: ${mode.label}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(width: 6),
        _tag(auto ? 'auto' : 'manual', auto ? Colors.orange : Colors.blueGrey),
        const Spacer(),
        Text(_fmtDuration(elapsed), style: const TextStyle(color: Colors.grey)),
      ],
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final current = controller.currentMode;
    final suggested = controller.estimate?.suggestedMode;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final mode in TravelMode.values)
          ChoiceChip(
            label: Text(mode.label),
            selected: current == mode,
            onSelected: (_) => controller.selectMode(mode),
            side: (suggested == mode && current != mode)
                ? const BorderSide(color: Colors.indigo, width: 1.5)
                : null,
          ),
      ],
    );
  }
}

class _LegRow extends StatelessWidget {
  const _LegRow({required this.label});
  final Label label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            child: Text(_modeLabel(label.mode),
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          if (label.source == 'auto') _tag('auto', Colors.orange),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '${_fmtClock(label.startedAt)} → ${_fmtClock(label.endedAt)}',
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
          ),
          Text(_fmtDuration(label.duration),
              style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }
}

Widget _tag(String text, Color c) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
          color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: TextStyle(fontSize: 11, color: c)),
    );

String _fmtDuration(Duration d) {
  final h = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
  if (h > 0) return '${h}h ${m}m';
  if (m > 0) return '${m}m ${s}s';
  return '${s}s';
}

String _fmtClock(DateTime utc) {
  final t = utc.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.hour)}:${two(t.minute)}:${two(t.second)}';
}

String _modeLabel(String modeName) {
  for (final m in TravelMode.values) {
    if (m.name == modeName) return m.label;
  }
  return modeName;
}