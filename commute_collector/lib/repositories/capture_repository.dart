import 'package:sqflite/sqflite.dart';
import '../models/trip.dart';
import '../models/label.dart';
import '../models/detected_leg.dart';
import '../services/database_service.dart';

class StorageSummary {
  final int trips;
  final int locationSamples;
  final int sensorSamples;
  final int activitySamples;
  final int labels;

  const StorageSummary({
    required this.trips,
    required this.locationSamples,
    required this.sensorSamples,
    required this.activitySamples,
    required this.labels,
  });

  int get totalSamples =>
      locationSamples + sensorSamples + activitySamples;
}

class CaptureRepository {
  CaptureRepository(this._dbService);
  final DatabaseService _dbService;

  // --- writes during capture ---

  Future<void> insertTrip(Trip trip) async {
    final db = await _dbService.database;
    await db.insert('trips', trip.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> updateTripEnd(String tripId, DateTime? endedAt) async {
    final db = await _dbService.database;
    await db.update('trips', {'ended_at': endedAt?.toIso8601String()},
        where: 'id = ?', whereArgs: [tripId]);
  }

  Future<void> insertLabels(List<Label> labels) async {
    if (labels.isEmpty) return;
    final db = await _dbService.database;
    final batch = db.batch();
    for (final l in labels) {
      batch.insert('labels', l.toMap());
    }
    await batch.commit(noResult: true);
  }

  Future<void> insertDetectedLegs(List<DetectedLeg> legs) async {
    if (legs.isEmpty) return;
    final db = await _dbService.database;
    final batch = db.batch();
    for (final l in legs) {
      batch.insert('detected_legs', l.toMap());
    }
    await batch.commit(noResult: true);
  }

  Future<void> insertSamples({
    required List<Map<String, Object?>> locations,
    required List<Map<String, Object?>> sensors,
    required List<Map<String, Object?>> activities,
  }) async {
    final db = await _dbService.database;
    await db.transaction((txn) async {
      final batch = txn.batch();
      for (final row in locations) {
        batch.insert('location_samples', row);
      }
      for (final row in sensors) {
        batch.insert('sensor_samples', row);
      }
      for (final row in activities) {
        batch.insert('activity_samples', row);
      }
      await batch.commit(noResult: true);
    });
  }

  // --- daily stats ---

  /// Trips this volunteer started today (LOCAL day, e.g. IST). Timestamps are
  /// stored UTC, so we convert local midnight → UTC and compare as ISO strings
  /// (ISO-8601 UTC sorts lexicographically).
  Future<int> tripsToday(String volunteerCode) async {
    final db = await _dbService.database;
    final now = DateTime.now();
    final localMidnight = DateTime(now.year, now.month, now.day);
    final sinceUtc = localMidnight.toUtc().toIso8601String();
    return Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM trips '
          'WHERE volunteer_code = ? AND started_at >= ?',
          [volunteerCode, sinceUtc],
        )) ??
        0;
  }

  // --- upload support ---

  Future<List<String>> unuploadedTrips() async {
    final db = await _dbService.database;
    final rows = await db.query('trips',
        columns: ['id'],
        where: 'uploaded = 0 AND ended_at IS NOT NULL',
        orderBy: 'started_at');
    return rows.map((r) => r['id'] as String).toList();
  }

  Future<int> unuploadedTripCount() async {
    final db = await _dbService.database;
    return Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM trips '
          'WHERE uploaded = 0 AND ended_at IS NOT NULL',
        )) ??
        0;
  }

  Future<void> markUploaded(String tripId) async {
    final db = await _dbService.database;
    await db.update('trips', {'uploaded': 1},
        where: 'id = ?', whereArgs: [tripId]);
  }

  /// Assemble one trip's full payload in the upload contract's shape.
  Future<Map<String, Object?>> exportTrip(String tripId) async {
    final db = await _dbService.database;

    final tripRows =
        await db.query('trips', where: 'id = ?', whereArgs: [tripId]);
    if (tripRows.isEmpty) throw 'Trip $tripId not found';
    final t = tripRows.first;

    Future<List<Map<String, Object?>>> rowsFor(String table) async {
      final rows = await db.query(table,
          where: 'trip_id = ?', whereArgs: [tripId], orderBy: 'timestamp');
      return rows.map((r) => {...r}..remove('id')).toList();
    }

    final labelRows = await db.query('labels',
        where: 'trip_id = ?', whereArgs: [tripId], orderBy: 'started_at');
    final detectedRows = await db.query('detected_legs',
        where: 'trip_id = ?', whereArgs: [tripId], orderBy: 'started_at');

    return {
      'trip': {
        'id': t['id'],
        'volunteer_code': t['volunteer_code'],
        'started_at': t['started_at'],
        'ended_at': t['ended_at'],
      },
      'labels': labelRows.map((r) => {...r}..remove('id')).toList(),
      'detected_legs': detectedRows.map((r) => {...r}..remove('id')).toList(),
      'location_samples': await rowsFor('location_samples'),
      'sensor_samples': await rowsFor('sensor_samples'),
      'activity_samples': await rowsFor('activity_samples'),
    };
  }

    // --- history reads (My Trips) ---

  /// Completed trips for one volunteer, newest first.
  Future<List<Trip>> tripsForVolunteer(String volunteerCode) async {
    final db = await _dbService.database;
    final rows = await db.query('trips',
        where: 'volunteer_code = ? AND ended_at IS NOT NULL',
        whereArgs: [volunteerCode],
        orderBy: 'started_at DESC');
    return rows.map((r) => Trip.fromMap(r)).toList();
  }

  Future<Trip?> tripById(String tripId) async {
    final db = await _dbService.database;
    final rows =
        await db.query('trips', where: 'id = ?', whereArgs: [tripId], limit: 1);
    return rows.isEmpty ? null : Trip.fromMap(rows.first);
  }

  Future<List<Label>> labelsForTrip(String tripId) async {
    final db = await _dbService.database;
    final rows = await db.query('labels',
        where: 'trip_id = ?', whereArgs: [tripId], orderBy: 'started_at');
    return rows.map((r) => Label.fromMap(r)).toList();
  }

  Future<List<DetectedLeg>> detectedLegsForTrip(String tripId) async {
    final db = await _dbService.database;
    final rows = await db.query('detected_legs',
        where: 'trip_id = ?', whereArgs: [tripId], orderBy: 'started_at');
    return rows.map((r) => DetectedLeg.fromMap(r)).toList();
  }

  // --- summary + reset ---

  Future<StorageSummary> summarize() async {
    final db = await _dbService.database;
    Future<int> count(String table) async =>
        Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM $table')) ??
        0;
    return StorageSummary(
      trips: await count('trips'),
      locationSamples: await count('location_samples'),
      sensorSamples: await count('sensor_samples'),
      activitySamples: await count('activity_samples'),
      labels: await count('labels'),
    );
  }

  Future<void> clearAll() async {
    final db = await _dbService.database;
    await db.transaction((txn) async {
      for (final t in [
        'labels',
        'detected_legs',
        'location_samples',
        'sensor_samples',
        'activity_samples',
        'trips',
      ]) {
        await txn.delete(t);
      }
    });
  }
}