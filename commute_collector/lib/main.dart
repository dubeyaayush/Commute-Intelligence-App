import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme.dart';
import 'screens/consent_screen.dart';
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

/// Decides on launch whether to show consent or home.
class GateScreen extends StatefulWidget {
  const GateScreen({super.key});

  @override
  State<GateScreen> createState() => _GateScreenState();
}

class _GateScreenState extends State<GateScreen> {
  bool _loading = true;
  bool _consented = false;

  @override
  void initState() {
    super.initState();
    _checkConsent();
  }

  Future<void> _checkConsent() async {
    final prefs = await SharedPreferences.getInstance();
    final consented = prefs.getBool('consent_given') ?? false;
    final code = prefs.getString('volunteer_code');
    if (!mounted) return;
    setState(() {
      _consented = consented && code != null && code.isNotEmpty;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _consented ? const HomeScreen() : const ConsentScreen();
  }
}