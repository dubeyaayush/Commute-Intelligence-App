import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme.dart';
import 'screens/consent_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';

void main() => runApp(const CommuteCollectorApp());

class CommuteCollectorApp extends StatelessWidget {
  const CommuteCollectorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Commute Collector',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const GateScreen(),
    );
  }
}

/// On launch: not consented → consent; consented but no code → login;
/// otherwise → home. Keeps consent a one-time step and login repeatable.
class GateScreen extends StatefulWidget {
  const GateScreen({super.key});

  @override
  State<GateScreen> createState() => _GateScreenState();
}

class _GateScreenState extends State<GateScreen> {
  bool _loading = true;
  bool _consented = false;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final prefs = await SharedPreferences.getInstance();
    final consented = prefs.getBool('consent_given') ?? false;
    final code = prefs.getString('volunteer_code');
    if (!mounted) return;
    setState(() {
      _consented = consented;
      _loggedIn = code != null && code.isNotEmpty;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_consented) return const ConsentScreen();
    if (!_loggedIn) return const AuthScreen();
    return const HomeScreen();
  }
}