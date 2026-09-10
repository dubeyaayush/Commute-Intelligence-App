import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Owns the SQLite connection + schema. One database, opened lazily and reused.
class DatabaseService {
  static const _dbName = 'commute_collector.db';
  static const _dbVersion = 2; // v2: added detected_legs

  Database? _db;

  Future<Database> get database async => _db ??= await _open();

  Future<Database> _open() async {
    final path = join(await getDatabasesPath(), _dbName);
    return openDatabase(path,
        version: _dbVersion, onCreate: _createSchema, onUpgrade: _upgrade);
  }

  Future<void> _createSchema(Database db, int version) async {
    await db.execute('''
      CREATE TABLE trips (
        id TEXT PRIMARY KEY,
        volunteer_code TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        uploaded INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        source TEXT NOT NULL,
        detected_motion TEXT,
        detected_confidence REAL
      )
    ''');
    await db.execute('''
      CREATE TABLE location_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        latitude REAL, longitude REAL, accuracy REAL,
        speed REAL, altitude REAL,
        timestamp TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE sensor_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        type TEXT NOT NULL,
        x REAL, y REAL, z REAL,
        timestamp TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE activity_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence TEXT,
        timestamp TEXT NOT NULL
      )
    ''');
    await _createDetectedLegs(db);

    await db.execute('CREATE INDEX idx_loc_trip ON location_samples(trip_id)');
    await db.execute('CREATE INDEX idx_sensor_trip ON sensor_samples(trip_id)');
    await db.execute('CREATE INDEX idx_act_trip ON activity_samples(trip_id)');
    await db.execute('CREATE INDEX idx_labels_trip ON labels(trip_id)');
  }

  /// Runs when an existing install opens with a newer _dbVersion. Preserves data.
  Future<void> _upgrade(Database db, int oldV, int newV) async {
    if (oldV < 2) {
      await _createDetectedLegs(db);
    }
  }

  Future<void> _createDetectedLegs(Database db) async {
    await db.execute('''
      CREATE TABLE detected_legs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        motion TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        confidence REAL
      )
    ''');
    await db.execute(
        'CREATE INDEX idx_detected_trip ON detected_legs(trip_id)');
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}