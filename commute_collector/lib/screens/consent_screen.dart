import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme.dart';
import 'auth_screen.dart';

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _agreed = false;
  bool _saving = false;

  bool get _canContinue => _agreed && !_saving;

  Future<void> _continue() async {
    setState(() => _saving = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('consent_given', true);
    await prefs.setString(
        'consented_at', DateTime.now().toUtc().toIso8601String());

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const AuthScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Gap.xl,
            Center(
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.10),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.commute,
                    size: 42, color: theme.colorScheme.primary),
              ),
            ),
            Gap.l,
            Text('Commute data collection',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            Gap.s,
            Text(
              'This app records your phone’s location and motion sensors during '
              'your commute, so we can study how multi-leg journeys '
              '(home → metro → last mile → office) can be reconstructed. '
              'We also store the name and contact details you provide at sign-up.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: Colors.grey.shade700, height: 1.4),
            ),
            Gap.m,
            _point(Icons.play_circle_outline,
                'Recording only runs when you start it.'),
            _point(Icons.lock_outline,
                'Data is stored on your phone, then uploaded to the research server.'),
            _point(Icons.volunteer_activism_outlined,
                'Taking part is voluntary — you can stop at any time.'),
            Gap.l,
            CheckboxListTile(
              value: _agreed,
              onChanged: (v) => setState(() => _agreed = v ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                  'I understand what data is collected and I agree to take part.'),
            ),
            Gap.m,
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _canContinue ? _continue : null,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Continue',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _point(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
                child: Text(text,
                    style: TextStyle(
                        color: Colors.grey.shade800, height: 1.3))),
          ],
        ),
      );
}