/// App-wide server config. Local default is your PC's LAN IP; override at build
/// time for the hosted volunteer build:
///   flutter build apk --release --dart-define=SERVER_URL=https://your-host --dart-define=API_KEY=...
/// Prefs (if ever set) still take precedence over these at runtime.
class AppConfig {
  static const String defaultServerUrl = String.fromEnvironment(
    'SERVER_URL',
    defaultValue: 'https://commute-collector-app.onrender.com',
  );

  static const String defaultApiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: 'dev-secret-change-me',
  );
}