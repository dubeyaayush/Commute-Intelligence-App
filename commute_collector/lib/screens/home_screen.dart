import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'auth_screen.dart';
import 'my_trips_screen.dart';
import 'trip_detail_screen.dart';
import '../controllers/capture_controller.dart';
import '../controllers/upload_controller.dart';
import '../services/database_service.dart';
import '../repositories/capture_repository.dart';
import '../widgets/idle_view.dart';
import '../widgets/recording_view.dart';
import '../theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _dbService = DatabaseService();
  late final CaptureRepository _repository = CaptureRepository(_dbService);
  late final CaptureController _controller =
      CaptureController(repository: _repository);
  late final UploadController _upload =
      UploadController(repository: _repository);

  String? _code;
  int _recorded = 0;

  @override
  void initState() {
    super.initState();
    _loadCode();
    _controller.loadSummary();
    _controller.onTripSaved = () {
      _upload.refreshPending();
      _loadRecorded();
    };
    _upload.init();
  }

  @override
  void dispose() {
    _controller.dispose();
    _upload.dispose();
    super.dispose();
  }

  Future<void> _loadCode() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString('volunteer_code');
    if (!mounted) return;
    setState(() => _code = code);
    if (code != null) {
      _controller.loadDailyStats(code);
      _loadRecorded();
    }
  }

  Future<void> _loadRecorded() async {
    final code = _code;
    if (code == null) return;
    final trips = await _repository.tripsForVolunteer(code);
    if (!mounted) return;
    setState(() => _recorded = trips.length);
  }

  // Resolve server config (prefs override → baked-in default).
  String get _baseUrl => _upload.serverUrl;
  String get _apiKey => _upload.apiKey;

  Future<void> _stopAndShow() async {
    final tripId = _controller.trip?.id;
    await _controller.stop();
    if (!mounted || tripId == null) return;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => TripDetailScreen(
        repository: _repository,
        tripId: tripId,
        baseUrl: _baseUrl,
        apiKey: _apiKey,
      ),
    ));
    _loadRecorded();
    _upload.refreshPending();
  }

  void _openMyTrips() {
    if (_code == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => MyTripsScreen(
        repository: _repository,
        volunteerCode: _code!,
        baseUrl: _baseUrl,
        apiKey: _apiKey,
      ),
    )).then((_) => _loadRecorded());
  }

  Future<void> _uploadNow() async {
    await _upload.uploadPending();
    if (mounted) _loadRecorded();
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text(
            'You\'ll need your volunteer code to log back in. Your recorded '
            'trips stay on this phone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Log out')),
        ],
      ),
    );
    if (ok != true) return;
    await _controller.stop();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('volunteer_code');
    await prefs.remove('volunteer_name');
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Commute Collector'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'My trips',
            onPressed: _openMyTrips,
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'logout') _logout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'logout', child: Text('Log out')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ListenableBuilder(
            listenable: Listenable.merge([_controller, _upload]),
            builder: (_, __) {
              final capturing = _controller.capturing;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_controller.error != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(_controller.error!,
                          style: TextStyle(color: Colors.red.shade900)),
                    ),
                  Expanded(
                    child: capturing
                        ? RecordingView(controller: _controller)
                        : IdleView(controller: _controller, code: _code),
                  ),
                  if (!capturing) ...[
                    const SizedBox(height: 8),
                    _StatusCard(
                      recorded: _recorded,
                      upload: _upload,
                      onUpload: _uploadNow,
                    ),
                  ],
                  const SizedBox(height: 8),
                  _CaptureButton(
                    controller: _controller,
                    code: _code,
                    onStop: _stopAndShow,
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// "You've recorded N trips" + upload status/button. Idle-state footer.
class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.recorded,
    required this.upload,
    required this.onUpload,
  });
  final int recorded;
  final UploadController upload;
  final VoidCallback onUpload;

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
              Icon(Icons.route, size: 18, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'You\'ve recorded $recorded trip${recorded == 1 ? '' : 's'}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _uploadRow(context),
          if (upload.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(upload.error!,
                  style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
            )
          else if (upload.status != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(upload.status!,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _uploadRow(BuildContext context) {
    if (upload.uploading) {
      return Row(children: const [
        SizedBox(
            width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
        SizedBox(width: 10),
        Text('Uploading…'),
      ]);
    }
    if (upload.pending > 0) {
      return Row(
        children: [
          Icon(Icons.cloud_upload_outlined,
              size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${upload.pending} trip${upload.pending == 1 ? '' : 's'} waiting to upload',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
            ),
          ),
          FilledButton.tonal(
            onPressed: onUpload,
            child: const Text('Upload'),
          ),
        ],
      );
    }
    return Row(children: [
      const Icon(Icons.cloud_done, size: 18, color: Colors.green),
      const SizedBox(width: 8),
      Text('All trips uploaded',
          style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
    ]);
  }
}

class _CaptureButton extends StatelessWidget {
  const _CaptureButton({
    required this.controller,
    required this.code,
    required this.onStop,
  });
  final CaptureController controller;
  final String? code;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    final capturing = controller.capturing;
    final ready = code != null;
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: FilledButton.icon(
        onPressed: !ready
            ? null
            : (capturing ? onStop : () => controller.start(code!)),
        icon: Icon(capturing ? Icons.stop_rounded : Icons.play_arrow_rounded),
        style: FilledButton.styleFrom(
          backgroundColor: capturing ? AppTheme.recording : null,
          textStyle:
              const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        label: Text(capturing ? 'Stop recording' : 'Start recording'),
      ),
    );
  }
}