import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../repositories/capture_repository.dart';
import '../services/upload_service.dart';

/// Owns upload state: the server URL, pending count, and the upload loop.
/// Separate from CaptureController so neither file gets heavy.
class UploadController extends ChangeNotifier {
  UploadController({
    required CaptureRepository repository,
    UploadService? uploader,
  }) : _repo = repository,
       _injectedUploader = uploader;

  final CaptureRepository _repo;
  final UploadService? _injectedUploader; // for tests

  String? _serverUrl;
  String? _apiKey;
  bool _uploading = false;
  String? _status;
  String? _error;
  int _pending = 0;

  String? get serverUrl => _serverUrl;
  String? get apiKey => _apiKey;
  bool get uploading => _uploading;
  String? get status => _status;
  String? get error => _error;
  int get pending => _pending;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _serverUrl = prefs.getString('server_url');
    _apiKey = prefs.getString('api_key');
    await refreshPending();
  }

  Future<void> setServerUrl(String url) async {
    final clean = url.trim();
    _serverUrl = clean.isEmpty ? null : clean;
    final prefs = await SharedPreferences.getInstance();
    if (_serverUrl == null) {
      await prefs.remove('server_url');
    } else {
      await prefs.setString('server_url', _serverUrl!);
    }
    notifyListeners();
  }

  Future<void> setApiKey(String key) async {
    final clean = key.trim();
    _apiKey = clean.isEmpty ? null : clean;
    final prefs = await SharedPreferences.getInstance();
    if (_apiKey == null) {
      await prefs.remove('api_key');
    } else {
      await prefs.setString('api_key', _apiKey!);
    }
    notifyListeners();
  }

  Future<void> refreshPending() async {
    _pending = await _repo.unuploadedTripCount();
    notifyListeners();
  }

  Future<void> uploadPending() async {
    if (_uploading) return;
    final url = _serverUrl;
    if (url == null || url.isEmpty) {
      _error = 'Set the server URL first.';
      notifyListeners();
      return;
    }

    _uploading = true;
    _error = null;
    _status = null;
    notifyListeners();

    final uploader =
        _injectedUploader ?? UploadService(baseUrl: url, apiKey: _apiKey);
    try {
      final tripIds = await _repo.unuploadedTrips();
      var ok = 0;
      for (final id in tripIds) {
        final payload = await _repo.exportTrip(id);
        await uploader.uploadTrip(payload);
        await _repo.markUploaded(id);
        ok++;
        await refreshPending();
      }
      _status = ok == 0 ? 'Nothing to upload.' : 'Uploaded $ok trip(s).';
    } catch (e) {
      _error = e.toString(); // stops on first failure; rest stay pending
    } finally {
      _uploading = false;
      notifyListeners();
    }
  }
}
