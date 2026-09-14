import 'package:dio/dio.dart';
import '../models/journey.dart';

/// Fetches the backend engine's reconstruction of a trip.
/// Same base URL + API key the app already uses for uploads.
class AnalysisService {
  AnalysisService({required this.baseUrl, this.apiKey, Dio? dio})
      : _dio = dio ?? Dio();

  final String baseUrl;
  final String? apiKey;
  final Dio _dio;

  Future<Journey> fetchJourney(String tripId) async {
    final Response res;
    try {
      res = await _dio.get(
        '$baseUrl/commute/$tripId',
        options: Options(
          headers: {
            if (apiKey != null && apiKey!.isNotEmpty) 'x-api-key': apiKey,
          },
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
      );
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      if (code == 404) throw 'This trip hasn\'t been analysed yet (not found on server).';
      if (code == 401) throw 'Server rejected the API key.';
      throw e.response != null
          ? 'Server error $code'
          : 'Cannot reach server: ${e.type.name}';
    }
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw 'Unexpected response from server.';
    }
    return Journey.fromJson(data);
  }
}