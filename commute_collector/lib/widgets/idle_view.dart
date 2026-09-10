import 'package:flutter/material.dart';
import '../controllers/capture_controller.dart';

/// Calm "ready" screen shown before capture. Shows today's contribution and a
/// quiet last-trip summary.
class IdleView extends StatelessWidget {
  const IdleView({super.key, required this.controller, required this.code});

  final CaptureController controller;
  final String? code;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final today = controller.tripsToday;
    final lastLegs = controller.labels.length;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.route,
                size: 46, color: theme.colorScheme.primary),
          ),
          const SizedBox(height: 24),
          Text('Ready to record',
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Tap start when you begin your commute. '
              'You can pocket your phone once it’s recording.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: Colors.grey.shade600),
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withOpacity(0.10),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle,
                    size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  today == 0
                      ? 'No trips yet today'
                      : '$today trip${today == 1 ? '' : 's'} recorded today',
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.primary),
                ),
              ],
            ),
          ),
          if (lastLegs > 0) ...[
            const SizedBox(height: 12),
            Text('Last trip: $lastLegs leg(s) recorded',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: Colors.grey)),
          ],
          const SizedBox(height: 28),
          if (code != null)
            Text('Enrolled as $code',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}