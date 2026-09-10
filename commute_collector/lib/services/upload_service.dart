import 'package:dio/dio.dart';

/// Sends one trip payload to the ingest endpoint. Permanent upload client —
/// same contract for the throwaway server and the real NestJS backend. Now
/// sends the API key the backend requires.
class UploadService {
  UploadService({required this.baseUrl, this.apiKey, Dio? dio})
      : _dio = dio ?? Dio();

  final String baseUrl;
  final String? apiKey;
  final Dio _dio;

  Future<void> uploadTrip(Map<String, Object?> payload) async {
    final Response res;
    try {
      res = await _dio.post(
        '$baseUrl/ingest',
        data: payload,
        options: Options(
          headers: {
            'Content-Type': 'application/json',
            if (apiKey != null && apiKey!.isNotEmpty) 'x-api-key': apiKey,
          },
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
      );
    } on DioException catch (e) {
      throw e.response != null
          ? 'Server error ${e.response?.statusCode}'
          : 'Cannot reach server: ${e.type.name}';
    }
    final code = res.statusCode ?? 0;
    if (code != 200 && code != 201) {
      throw 'Server returned $code';
    }
  }
}