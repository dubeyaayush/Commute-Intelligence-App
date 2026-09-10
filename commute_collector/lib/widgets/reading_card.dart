import 'package:flutter/material.dart';

/// One labelled value inside a ReadingCard.
class Reading {
  final String label;
  final String? value;
  const Reading(this.label, this.value);
}

/// A titled card showing a stream's live readings and its running count.
class ReadingCard extends StatelessWidget {
  const ReadingCard({
    super.key,
    required this.title,
    required this.count,
    required this.rows,
  });

  final String title;
  final int count;
  final List<Reading> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$title  ($count)',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold)),
            const Divider(),
            for (final r in rows) _ReadingRow(reading: r),
          ],
        ),
      ),
    );
  }
}

class _ReadingRow extends StatelessWidget {
  const _ReadingRow({required this.reading});
  final Reading reading;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(reading.label,
                style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(child: Text(reading.value ?? '—')),
        ],
      ),
    );
  }
}