import 'package:flutter/material.dart';
import '../controllers/capture_controller.dart';
import '../controllers/upload_controller.dart';
import '../models/sensor_sample.dart';
import '../repositories/capture_repository.dart';
import '../widgets/reading_card.dart';

/// Developer/researcher panel: live telemetry, saved-data counts, upload, and
/// reset. Hidden from volunteers behind the gear icon. Reads the SAME controller
/// instances as the home screen (passed in), so telemetry updates live even
/// while capture runs. Does not own or dispose the controllers.
class DevPanelScreen extends StatelessWidget {
  const DevPanelScreen({
    super.key,
    required this.controller,
    required this.upload,
    required this.onReset,
  });

  final CaptureController controller;
  final UploadController upload;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Developer panel')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ListenableBuilder(
              listenable: controller,
              builder: (_, __) => _Telemetry(controller: controller),
            ),
            const SizedBox(height: 8),
            ListenableBuilder(
              listenable: controller,
              builder: (_, __) => _SavedCard(summary: controller.savedSummary),
            ),
            const SizedBox(height: 8),
            ListenableBuilder(
              listenable: upload,
              builder: (_, __) => _UploadCard(
                controller: upload,
                onEditUrl: () => _editServerUrl(context),
                onEditApiKey: () => _editApiKey(context),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).pop();
                onReset();
              },
              icon: const Icon(Icons.restart_alt),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              label: const Text('Reset (dev only)'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _editServerUrl(BuildContext context) async {
    final ctrl = TextEditingController(
      text: upload.serverUrl ?? 'http://:3000',
    );
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Server URL'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            hintText: 'http://192.168.1.5:3000',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != null) await upload.setServerUrl(result);
  }

  Future<void> _editApiKey(BuildContext context) async {
    final ctrl = TextEditingController(text: upload.apiKey ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('API key'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'dev-secret-change-me'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != null) await upload.setApiKey(result);
  }
}

/// The five live reading cards (location + 3 sensors + activity) and any error.
class _Telemetry extends StatelessWidget {
  const _Telemetry({required this.controller});
  final CaptureController controller;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final l = c.location;
    return Column(
      children: [
        if (c.error != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 8),
            color: Colors.red.shade50,
            child: Text(c.error!, style: TextStyle(color: Colors.red.shade900)),
          ),
        ReadingCard(
          title: 'Location',
          count: c.locationCount,
          rows: [
            Reading('Lat', l?.latitude.toStringAsFixed(6)),
            Reading('Lng', l?.longitude.toStringAsFixed(6)),
            Reading(
              'Accuracy',
              l != null ? '${l.accuracy.toStringAsFixed(1)} m' : null,
            ),
            Reading(
              'Speed',
              l != null ? '${l.speed.toStringAsFixed(1)} m/s' : null,
            ),
          ],
        ),
        ReadingCard(
          title: 'Accelerometer',
          count: c.accelerometerCount,
          rows: [_vec(c.accelerometer)],
        ),
        ReadingCard(
          title: 'Gyroscope',
          count: c.gyroscopeCount,
          rows: [_vec(c.gyroscope)],
        ),
        ReadingCard(
          title: 'Magnetometer',
          count: c.magnetometerCount,
          rows: [_vec(c.magnetometer)],
        ),
        ReadingCard(
          title: 'Activity',
          count: c.activityCount,
          rows: [
            Reading('Type', c.activity?.type),
            Reading('Confidence', c.activity?.confidence),
          ],
        ),
      ],
    );
  }

  Reading _vec(SensorSample? s) => Reading(
    'x / y / z',
    s == null
        ? null
        : '${s.x.toStringAsFixed(2)}, ${s.y.toStringAsFixed(2)}, ${s.z.toStringAsFixed(2)}',
  );
}

class _SavedCard extends StatelessWidget {
  const _SavedCard({required this.summary});
  final StorageSummary? summary;

  @override
  Widget build(BuildContext context) {
    final s = summary;
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Saved on device',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const Divider(),
            if (s == null)
              const Text('Loading…', style: TextStyle(color: Colors.grey))
            else
              Text(
                '${s.trips} trip(s) · ${s.labels} label(s)\n'
                '${s.locationSamples} location · ${s.sensorSamples} sensor · '
                '${s.activitySamples} activity samples',
                style: const TextStyle(fontSize: 13, height: 1.4),
              ),
          ],
        ),
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({
    required this.controller,
    required this.onEditUrl,
    required this.onEditApiKey,
  });
  final UploadController controller;
  final VoidCallback onEditUrl;
  final VoidCallback onEditApiKey;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final canUpload = !c.uploading && c.pending > 0 && c.serverUrl != null;
    return Card(
      color: Colors.blue.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Upload',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
                TextButton(
                  onPressed: onEditUrl,
                  child: const Text('Server URL'),
                ),
                TextButton(
                  onPressed: onEditApiKey,
                  child: const Text('API key'),
                ),
              ],
            ),
            Text(
              c.serverUrl ?? 'No server URL set',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            Text(
              c.apiKey == null || c.apiKey!.isEmpty
                  ? 'No API key set'
                  : 'API key set',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Text('${c.pending} trip(s) pending upload'),
            if (c.status != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  c.status!,
                  style: TextStyle(color: Colors.green.shade800),
                ),
              ),
            if (c.error != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  c.error!,
                  style: TextStyle(color: Colors.red.shade800),
                ),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: canUpload ? controller.uploadPending : null,
                icon: c.uploading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cloud_upload),
                label: Text(c.uploading ? 'Uploading…' : 'Upload pending'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
