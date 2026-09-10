import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../repositories/capture_repository.dart';
import '../widgets/mode_visuals.dart';
import 'trip_detail_screen.dart';

/// Per-volunteer history of completed trips, newest first. Read-only.
class MyTripsScreen extends StatefulWidget {
  const MyTripsScreen({
    super.key,
    required this.repository,
    required this.volunteerCode,
  });

  final CaptureRepository repository;
  final String volunteerCode;

  @override
  State<MyTripsScreen> createState() => _MyTripsScreenState();
}

class _MyTripsScreenState extends State<MyTripsScreen> {
  List<Trip> _trips = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final trips =
        await widget.repository.tripsForVolunteer(widget.volunteerCode);
    if (!mounted) return;
    setState(() {
      _trips = trips;
      _loading = false;
    });
  }

  Future<void> _open(Trip t) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => TripDetailScreen(
          repository: widget.repository, tripId: t.id),
    ));
    _load(); // refresh (e.g. uploaded flag may have changed elsewhere)
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My trips')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _trips.isEmpty
                ? _empty(context)
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _trips.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) =>
                        _TripCard(trip: _trips[i], onTap: () => _open(_trips[i])),
                  ),
      ),
    );
  }

  Widget _empty(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.map_outlined, size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            const Text('No trips yet',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Your recorded commutes will appear here.',
                style: TextStyle(color: Colors.grey.shade600)),
          ],
        ),
      );
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip, required this.onTap});
  final Trip trip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dur = trip.duration ?? Duration.zero;
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor:
              Theme.of(context).colorScheme.primary.withOpacity(0.12),
          child: Icon(Icons.route,
              color: Theme.of(context).colorScheme.primary, size: 20),
        ),
        title: Text('${_dateTime(trip.startedAt)}',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Duration ${fmtDuration(dur)}'),
        trailing: Icon(
          trip.uploaded ? Icons.cloud_done : Icons.cloud_upload_outlined,
          size: 18,
          color: trip.uploaded ? Colors.green : Colors.grey.shade400,
        ),
      ),
    );
  }

  String _dateTime(DateTime utc) {
    final t = utc.toLocal();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    String two(int n) => n.toString().padLeft(2, '0');
    return '${t.day} ${months[t.month - 1]}, ${two(t.hour)}:${two(t.minute)}';
  }
}