import 'package:dio/dio.dart';

/// Sends completed trips to the backend. One POST per trip to /ingest,
/// authenticated with the API key. Timeouts are deliberately generous:
/// a long trip is a large body, and Render free-tier can cold-start.
class UploadService {
  UploadService({required String baseUrl, required String apiKey})
      : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(minutes: 5),
            receiveTimeout: const Duration(minutes: 5),
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey, // <-- verify this matches ApiKeyGuard
            },
            validateStatus: (s) => s != null && s < 500,
          ),
        );

  final Dio _dio;

  /// Upload one trip payload (shape from CaptureRepository.exportTrip).
  /// Throws a human-readable message on failure.
  Future<void> uploadTrip(Map<String, Object?> payload) async {
    try {
      final res = await _dio.post('/ingest', data: payload);
      final code = res.statusCode ?? 0;
      if (code >= 200 && code < 300) return;
      if (code == 401 || code == 403) {
        throw 'Rejected by server (auth). Check the API key.';
      }
      if (code == 413) {
        throw 'Trip too large for the server to accept.';
      }
      throw 'Server error ($code). Please try again.';
    } on DioException catch (e) {
      throw 'Cannot reach server: ${_reason(e)}';
    }
  }

  String _reason(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
        return 'connectTimeout';
      case DioExceptionType.sendTimeout:
        return 'sendTimeout';
      case DioExceptionType.receiveTimeout:
        return 'receiveTimeout';
      case DioExceptionType.connectionError:
        return 'connectionError';
      case DioExceptionType.badResponse:
        return 'HTTP ${e.response?.statusCode}';
      default:
        return e.message ?? 'unknown';
    }
  }
}