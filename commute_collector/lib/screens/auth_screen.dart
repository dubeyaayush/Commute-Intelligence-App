import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../services/auth_service.dart';
import 'home_screen.dart';

/// Sign up (backend assigns a code) or log in (with an existing code).
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isSignup = true;
  bool _busy = false;
  String? _error;
  String? _assignedCode;

  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController(text: 'Delhi');
  final _code = TextEditingController();

  String _serverUrl = AppConfig.defaultServerUrl;
  String _apiKey = AppConfig.defaultApiKey;

  @override
  void initState() {
    super.initState();
    _loadServerConfig();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _loadServerConfig() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _serverUrl = prefs.getString('server_url') ?? AppConfig.defaultServerUrl;
      _apiKey = prefs.getString('api_key') ?? AppConfig.defaultApiKey;
    });
  }

  Future<void> _finish(String code, String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('volunteer_code', code);
    await prefs.setString('volunteer_name', name);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = AuthService(baseUrl: _serverUrl, apiKey: _apiKey);
    try {
      if (_isSignup) {
        if (_name.text.trim().isEmpty) throw 'Please enter your name.';
        final v = await auth.signup(
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          city: _city.text.trim(),
        );
        if (!mounted) return;
        setState(() {
          _assignedCode = v.code;
          _busy = false;
        });
      } else {
        if (_code.text.trim().isEmpty) throw 'Please enter your code.';
        final v = await auth.login(code: _code.text.trim());
        await _finish(v.code, v.name);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_assignedCode != null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle,
                    size: 64, color: theme.colorScheme.primary),
                const SizedBox(height: 16),
                const Text('You\'re registered',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Your volunteer code is',
                    style: TextStyle(color: Colors.grey.shade700)),
                const SizedBox(height: 8),
                SelectableText(
                  _assignedCode!,
                  style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please save this code — you\'ll use it to log in next time.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: () => _finish(_assignedCode!, _name.text.trim()),
                    child: const Text('Continue',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(_isSignup ? 'Sign up' : 'Log in')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('New — sign up')),
                ButtonSegment(value: false, label: Text('Have a code')),
              ],
              selected: {_isSignup},
              onSelectionChanged: (s) => setState(() {
                _isSignup = s.first;
                _error = null;
              }),
            ),
            const SizedBox(height: 24),
            if (_isSignup) ...[
              _field(_name, 'Name', TextInputType.name),
              const SizedBox(height: 12),
              _field(_phone, 'Phone (optional)', TextInputType.phone),
              const SizedBox(height: 12),
              _field(_city, 'City', TextInputType.text),
            ] else
              _field(_code, 'Volunteer code', TextInputType.text,
                  caps: TextCapitalization.characters),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: TextStyle(color: Colors.red.shade700)),
            ],
            const SizedBox(height: 24),
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(_isSignup ? 'Create my code' : 'Log in',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, TextInputType type,
          {TextCapitalization caps = TextCapitalization.none}) =>
      TextField(
        controller: c,
        keyboardType: type,
        textCapitalization: caps,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          border:
              OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
}