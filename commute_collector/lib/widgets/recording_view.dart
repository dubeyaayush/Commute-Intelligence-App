import 'package:flutter/material.dart';
import '../controllers/capture_controller.dart';
import '../models/travel_mode.dart';
import '../models/mode_estimate.dart';
import 'journey_timeline.dart';
import 'mode_visuals.dart';
import 'pulsing_dot.dart';

/// The active-capture screen: recording state, current mode, mode buttons,
/// and the journey timeline (with the labels/detected toggle). No telemetry.
class RecordingView extends StatelessWidget {
  const RecordingView({super.key, required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        _RecordingHeader(controller: controller),
        const SizedBox(height: 16),
        _CurrentModeCard(controller: controller),
        const SizedBox(height: 12),
        _SuggestionBanner(controller: controller),
        const SizedBox(height: 8),
        Text('SET YOUR TRAVEL MODE',
            style: TextStyle(
                fontSize: 12,
                letterSpacing: 0.5,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        _ModeGrid(controller: controller),
        if (controller.currentMode != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: controller.endCurrentLeg,
              icon: const Icon(Icons.stop_circle_outlined, size: 18),
              label: const Text('End current leg'),
            ),
          ),
        const SizedBox(height: 8),
        JourneyPanel(controller: controller),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _RecordingHeader extends StatelessWidget {
  const _RecordingHeader({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final start = controller.trip?.startedAt;
    final elapsed =
        start == null ? Duration.zero : DateTime.now().toUtc().difference(start);
    return Row(
      children: [
        const PulsingDot(),
        const SizedBox(width: 4),
        const Text('Recording',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(fmtDuration(elapsed),
              style: TextStyle(
                  color: Colors.grey.shade700,
                  fontWeight: FontWeight.w600,
                  fontSize: 13)),
        ),
        const Spacer(),
        const Text('Auto', style: TextStyle(fontSize: 13)),
        Switch(
          value: controller.autoAccept,
          onChanged: controller.setAutoAccept,
        ),
      ],
    );
  }
}

class _CurrentModeCard extends StatelessWidget {
  const _CurrentModeCard({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final mode = controller.currentMode;
    final start = controller.legStartedAt;

    if (mode == null || start == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(Icons.touch_app, size: 38, color: Colors.grey.shade500),
            const SizedBox(height: 8),
            Text('No mode selected', style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Pick your travel mode below to start a leg',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          ],
        ),
      );
    }

    final elapsed = DateTime.now().toUtc().difference(start);
    final auto = controller.currentSource == 'auto';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withOpacity(0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.primary.withOpacity(0.30)),
      ),
      child: Column(
        children: [
          Icon(modeIcon(mode), size: 46, color: theme.colorScheme.primary),
          const SizedBox(height: 8),
          Text(mode.label,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('${fmtDuration(elapsed)} in this leg',
              style: TextStyle(color: Colors.grey.shade700)),
          if (auto) ...[
            const SizedBox(height: 8),
            _tag('auto-detected', Colors.orange),
          ],
        ],
      ),
    );
  }
}

class _SuggestionBanner extends StatelessWidget {
  const _SuggestionBanner({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final est = controller.estimate;
    if (est == null || est.motion == MotionClass.unknown) {
      return const SizedBox.shrink();
    }
    final suggested = est.suggestedMode;
    final current = controller.currentMode;

    if (est.isVehicleAmbiguous) {
      return _banner(
        icon: Icons.directions_transit,
        color: Colors.deepPurple,
        text: 'Looks like you’re in a vehicle — tap the exact type below.',
      );
    }
    if (suggested != null && suggested != current) {
      return _banner(
        icon: Icons.lightbulb_outline,
        color: Colors.indigo,
        text: 'Detected ${est.motion.label.toLowerCase()} '
            '(${est.confidencePct}%)',
        action: FilledButton(
          onPressed: controller.confirmSuggested,
          child: Text('Confirm ${suggested.label}'),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _ModeGrid extends StatelessWidget {
  const _ModeGrid({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final current = controller.currentMode;
    final suggested = controller.estimate?.suggestedMode;
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 0.95,
      children: [
        for (final mode in TravelMode.values)
          _ModeTile(
            mode: mode,
            selected: current == mode,
            suggested: suggested == mode && current != mode,
            onTap: () => controller.selectMode(mode),
          ),
      ],
    );
  }
}

class _ModeTile extends StatelessWidget {
  const _ModeTile({
    required this.mode,
    required this.selected,
    required this.suggested,
    required this.onTap,
  });
  final TravelMode mode;
  final bool selected;
  final bool suggested;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final bg = selected ? primary : Colors.grey.shade100;
    final fg = selected ? Colors.white : Colors.grey.shade800;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: suggested ? Border.all(color: primary, width: 2) : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(modeIcon(mode), color: fg, size: 26),
              const SizedBox(height: 4),
              Text(mode.label,
                  style: TextStyle(
                      color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _banner({
  required IconData icon,
  required Color color,
  required String text,
  Widget? action,
}) {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withOpacity(0.08),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: color.withOpacity(0.30)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Expanded(
                child: Text(text,
                    style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
        if (action != null) ...[
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: action),
        ],
      ],
    ),
  );
}

Widget _tag(String text, Color c) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(fontSize: 11, color: c)),
    );