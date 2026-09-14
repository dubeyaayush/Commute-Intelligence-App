import 'package:dio/dio.dart';

/// Volunteer info returned by the backend on signup/login.
class VolunteerInfo {
  final String code;
  final String name;
  final String? phone;
  final String? city;

  VolunteerInfo({required this.code, required this.name, this.phone, this.city});

  factory VolunteerInfo.fromJson(Map<String, dynamic> j) => VolunteerInfo(
        code: j['code'] as String,
        name: (j['name'] as String?) ?? '',
        phone: j['phone'] as String?,
        city: j['city'] as String?,
      );
}

/// Talks to the backend's /volunteers endpoints. Same base URL + API key the
/// app uses everywhere else.
class AuthService {
  AuthService({required this.baseUrl, this.apiKey, Dio? dio})
      : _dio = dio ?? Dio();

  final String baseUrl;
  final String? apiKey;
  final Dio _dio;

  Future<VolunteerInfo> signup({
    required String name,
    String? phone,
    String? city,
  }) async {
    return _post('/volunteers/signup', {
      'name': name,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (city != null && city.isNotEmpty) 'city': city,
    });
  }

  Future<VolunteerInfo> login({required String code}) async {
    return _post('/volunteers/login', {'code': code});
  }

  Future<VolunteerInfo> _post(String path, Map<String, dynamic> body) async {
    final Response res;
    try {
      res = await _dio.post(
        '$baseUrl$path',
        data: body,
        options: Options(
          headers: {
            'Content-Type': 'application/json',
            if (apiKey != null && apiKey!.isNotEmpty) 'x-api-key': apiKey,
          },
          sendTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      if (code == 404) throw 'No volunteer found with that code.';
      if (code == 400) {
        final msg = e.response?.data is Map ? e.response?.data['message'] : null;
        throw (msg?.toString() ?? 'Please check the details you entered.');
      }
      if (code == 401) throw 'Server rejected the API key.';
      throw e.response != null
          ? 'Server error $code'
          : 'Cannot reach server: ${e.type.name}';
    }
    final data = res.data;
    if (data is! Map<String, dynamic>) throw 'Unexpected response from server.';
    return VolunteerInfo.fromJson(data);
  }
}