import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'consent_screen.dart';
import 'dev_panel_screen.dart';
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

  @override
  void initState() {
    super.initState();
    _loadCode();
    _controller.loadSummary();
    _controller.onTripSaved = _upload.refreshPending;
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
    if (code != null) _controller.loadDailyStats(code);
  }

  /// Stop capture, then show the just-finished trip's detail (nothing is lost).
  Future<void> _stopAndShow() async {
    final tripId = _controller.trip?.id;
    await _controller.stop();
    if (!mounted || tripId == null) return;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => TripDetailScreen(repository: _repository, tripId: tripId),
    ));
  }

  Future<void> _reset() async {
    await _controller.stop();
    await _controller.clearSavedData();
    await _upload.refreshPending();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const ConsentScreen()),
    );
  }

  void _openDevPanel() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => DevPanelScreen(
        controller: _controller,
        upload: _upload,
        onReset: _reset,
      ),
    ));
  }

  void _openMyTrips() {
    if (_code == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) =>
          MyTripsScreen(repository: _repository, volunteerCode: _code!),
    ));
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
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Developer panel',
            onPressed: _openDevPanel,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ListenableBuilder(
            listenable: _controller,
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