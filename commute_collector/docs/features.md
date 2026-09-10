# Feature Log — Commute Collector

Running record of what each feature does and how, appended per build step.

---

## Step 1 — Consent gate + volunteer code
**What:** Blocks every app screen until the volunteer enters a code and agrees to take part. Nothing is reachable until consent is stored.

**How:** On launch, `GateScreen` reads `consent_given` (bool) and `volunteer_code` (string) from shared_preferences. Both present → `HomeScreen`; otherwise → `ConsentScreen`. `ConsentScreen` persists the flag, code, and a UTC timestamp when the volunteer taps Continue, then routes to home.

**Volunteer code:** A plain identifier (not a password). Its only job is to stamp this phone's data so traces can be attributed to a person later.

**Files:**
- `lib/main.dart` — app entry + gate decision
- `lib/consent_screen.dart` — consent text, code field, agree checkbox
- `lib/home_screen.dart` — post-consent placeholder (becomes the capture dashboard)

**Storage keys:** `consent_given` (bool), `volunteer_code` (string), `consented_at` (ISO8601 UTC string)

**Status:** ✅ Tested on device

---

## Step 2 — Foreground GPS capture
**What:** Start/Stop button on the home screen that streams live location while the app is in the foreground, showing lat/lng/accuracy/speed and a running fix count.

**How:** `LocationService.ensureReady()` checks the location service is on and requests permission. `LocationService.stream()` wraps `Geolocator.getPositionStream` (high accuracy, distanceFilter 0 = every fix) and maps each `Position` to a `LocationSample`. `HomeScreen` subscribes on Start, updates UI per fix, cancels the subscription on Stop/dispose. Not persisted yet — in-memory only.

**Files:**
- `lib/location_sample.dart` — data model (lat, lng, accuracy, speed, altitude, UTC timestamp) + `toMap()`
- `lib/location_service.dart` — permission handling + position stream
- `lib/home_screen.dart` — Start/Stop UI, live readout, fix counter

**Permissions added:** `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (foreground only)

**Status:** ✅ Tested on device

---

## Step 3 — Motion sensors + activity recognition
**What:** While capturing, the app streams accelerometer, gyroscope, and magnetometer (~5Hz each) plus Android's activity recognition (walking/still/in-vehicle/etc.), showing latest values and per-stream counts.

**How:** `SensorService` wraps sensors_plus event streams (normalInterval ≈ 5Hz), mapping each to a `SensorSample` (type, x, y, z, UTC timestamp). `ActivityService` wraps flutter_activity_recognition — requests the ACTIVITY_RECOGNITION permission and maps its event-driven stream to `ActivitySample` (type, confidence, UTC timestamp). `HomeScreen` subscribes to all five streams on Start, holds subscriptions in a list, cancels them all on Stop/dispose. In-memory only — not persisted yet.

**Files:**
- `lib/models/sensor_sample.dart` — accel/gyro/mag reading
- `lib/models/activity_sample.dart` — detected activity + confidence
- `lib/services/sensor_service.dart` — three sensor streams
- `lib/services/activity_service.dart` — permission + activity stream
- `lib/screens/home_screen.dart` — drives all five streams, live readout

**Permissions added:** `ACTIVITY_RECOGNITION`, `com.google.android.gms.permission.ACTIVITY_RECOGNITION`

**Note:** Activity updates are event-driven (fire on change, can lag 30s+). Sensor timestamps stamped on arrival for version-safety.

**Status:** ✅ Tested on device

---

## Refactor — CaptureController + ReadingCard
**What:** Extracted all capture logic out of the home screen. No behavior change.

**How:** `CaptureController` (ChangeNotifier) now owns permissions, the five stream subscriptions, latest readings, and counts, exposing them via getters. `HomeScreen` observes it with `ListenableBuilder` and only composes UI. Reading cards moved to a reusable `ReadingCard` widget.

**New structure:**
- `lib/controllers/` — capture state + logic
- `lib/widgets/` — reusable UI pieces

**Files:**
- `lib/controllers/capture_controller.dart` — capture state/logic (new)
- `lib/widgets/reading_card.dart` — `ReadingCard` + `Reading` (new)
- `lib/screens/home_screen.dart` — now thin: composes controller + widgets

**Status:** ✅ Smoke-tested on device

---

## Step 4 — Ground-truth labeling (the critical piece)
**What:** During a capture session the volunteer marks their journey as a
sequence of contiguous "legs" (Walk → Metro → Auto → …). Each leg is a
timestamped interval on the same UTC clock as sensor/location samples, so
labels can be joined to raw data for model training later. This is the
project's non-negotiable feature.

**Data model (this is the schema Step 5 will persist):**
- `Trip` — one capture session. Fields: `id` (millisecondsSinceEpoch string,
  generated on Start), `volunteerCode`, `startedAt` (UTC), `endedAt` (UTC,
  null while active). `toMap()` keys: id, volunteer_code, started_at, ended_at.
- `Label` — one journey leg. Fields: `tripId`, `mode` (TravelMode.name),
  `startedAt` (UTC), `endedAt` (UTC). `duration` getter. `toMap()` keys:
  trip_id, mode, started_at, ended_at.
- `TravelMode` — enum: walk, metro, bus, auto, car, bike, waiting, other.
  Stored as `.name`; displayed as `.label`.

**Interval semantics (important invariant):** at most one leg is open at a
time. Selecting a new mode closes the open leg and opens the new one at the
SAME timestamp → legs are contiguous and non-overlapping. "End current leg"
closes without reopening (gaps allowed = unlabeled time). Stop closes any
open leg and stamps trip.endedAt. Re-selecting the current mode is a no-op.

**Architecture:**
- `TripSession` (lib/controllers/trip_session.dart) — plain (non-ChangeNotifier)
  state machine holding trip + open-leg + completed labels. Methods: begin(code),
  selectMode(mode), endCurrentLeg(), end(). No streams/UI → unit-testable.
- `CaptureController` — now also holds a TripSession, exposes trip/labels/
  currentMode/legStartedAt getters, and selectMode()/endCurrentLeg() actions
  (each calls the session then notifyListeners). start() now takes the
  volunteerCode and calls session.begin(); stop() calls session.end().
- `LabelingPanel` (lib/widgets/labeling_panel.dart) — pure view: detected-activity
  hint (confirm/correct context from activity recognition), current-leg + live
  timer, mode ChoiceChips, End-leg button, and the completed-legs list.

**Structure decision:** labeling is an inline panel on the home screen, NOT a
separate `labeling_screen.dart` as originally mapped — because labeling must
happen live during capture alongside the sensor streams. The reserved
labeling_screen.dart is therefore not used.

**Trip concept introduced here (earlier than the Step-5 map suggested)** because
labels require a trip_id. A trip = one Start→Stop capture session.

**Not done yet:** nothing is persisted — trip and labels live in memory and are
lost on app close or on the next Start (which clears for a fresh trip). Storage
is Step 5, which will save Trip + Label rows (schemas above) alongside sensor/
location rows keyed by trip_id.

**Current lib/ structure:**
  lib/
  ├── main.dart                         # gate: consent vs home
  ├── controllers/
  │   ├── capture_controller.dart       # session: streams + trip/labels (ChangeNotifier)
  │   └── trip_session.dart             # trip + label state machine (plain)
  ├── models/
  │   ├── location_sample.dart
  │   ├── sensor_sample.dart            # + SensorType enum
  │   ├── activity_sample.dart
  │   ├── trip.dart
  │   ├── label.dart
  │   └── travel_mode.dart              # TravelMode enum
  ├── screens/
  │   ├── consent_screen.dart
  │   └── home_screen.dart              # composes panel + reading cards + button
  ├── services/
  │   ├── location_service.dart         # geolocator
  │   ├── sensor_service.dart           # sensors_plus (accel/gyro/mag ~5Hz)
  │   └── activity_service.dart         # flutter_activity_recognition
  └── widgets/
      ├── reading_card.dart             # ReadingCard + Reading
      └── labeling_panel.dart           # live labeling UI

**Status:** ✅ Tested on device

---

## Step 4.5 — Sensor-fusion mode detection (suggest + confirm)
**What:** The app now auto-detects coarse motion and SUGGESTS a mode; the
volunteer confirms with one tap or corrects. Optional Auto-accept labels the
confident, unambiguous classes hands-free. Every label records provenance
(`manual` vs `auto`). This realises the locked "detect what it can, human
confirms/corrects" design — detection reduces effort without replacing the
human as the ground-truth source.

**Why not full auto:** Phone sensors cannot reliably separate metro/bus/auto/car
(worse in Hyderabad — elevated metro keeps GPS, so no tunnel signal-loss cue).
Auto-saving heuristic guesses as "ground truth" would poison the very dataset
Phase 1 exists to collect. So vehicle TYPE is always human-confirmed; that
confirmed answer is the training signal a future model will learn from.

**What the detector can/can't decide:**
- Reliable-ish: stationary, walking, in-vehicle (yes/no).
- Not reliable: vehicle type (metro/bus/auto/car), cycling (weak without the
  activity-recognition signal). These stay human-confirmed.

**How it works:**
- `ModeDetector` (lib/controllers/mode_detector.dart) keeps rolling windows:
  accel-magnitude std-dev (6s) + mean GPS speed (12s, ignores fixes with
  accuracy > 40m) + latest activity-recognition type. `classify()` is a PURE
  static function (features → ModeEstimate) so it's unit-testable. Thresholds
  are named constants at the top (kStillSpeed, kWalkSpeedMax, kVehicleSpeedMin,
  kAccelStillMax, kAccelWalkMin) — FIRST GUESSES, tune on-device.
- `ModeEstimate` (lib/models/mode_estimate.dart): MotionClass
  {stationary, walking, cycling, vehicle, unknown} + confidence (0..1) + reason
  + `suggestedMode` (maps class → TravelMode; returns null for vehicle/unknown
  so a human decides) + `isVehicleAmbiguous`.
- `CaptureController` feeds accel/speed/activity into the detector, runs a 2s
  Timer.periodic that recomputes the estimate, tracks class stability
  (_stableSince) for debounce, and exposes `estimate`, `autoAccept`,
  `currentSource`. Actions: `confirmSuggested()` (accept suggestion, manual),
  `selectMode()` (chip tap/correction, manual), auto-accept path calls
  session.selectMode(source:'auto') only when: suggestedMode != null,
  confidence ≥ 0.7, class stable ≥ 6s, and differs from current leg.
- `LabelingPanel` gains a detection banner (icon + "Detected: <class> · N%" +
  reason + Confirm button / vehicle prompt / "matches current leg"), an Auto
  switch, suggested-chip highlight, and per-leg auto/manual tags.

**Model/schema change:** `Label` gains `source` ('manual'|'auto', default
'manual'); `toMap()` now includes `source`. Step 5 storage MUST persist this
column — it's how we separate trustworthy human labels from auto ones.
`TripSession.selectMode(mode, {source})` and its open-leg tracking updated;
`currentSource` exposed.

**Signals not yet used:** gyroscope + magnetometer are captured/stored but not
fed to the classifier yet (possible future improvement: gyro for turn detection,
magnetometer for rail EM signature — both noisy, unproven). Running currently
maps to Walk.

**Not done:** still no persistence (Step 5). Thresholds unvalidated on real
commutes (tuning pass pending). Auto-accept default OFF.

**Status:** ✅ Pipeline tested on device (reacts to motion); thresholds need
real-commute tuning.

---

## Step 5a — Local persistence (sqflite)
**What:** Every captured trip, label, and sample is now written to an on-device
SQLite database and survives app restarts. Nothing is uploaded yet (that's 5b,
which needs the backend endpoint). Data is buffered in memory during capture and
flushed to disk in batches to avoid hammering SQLite at sensor frequency.

**Packages added:** sqflite, path.

**Database (commute_collector.db, version 1) — schema:**
- `trips`: id TEXT PK (millisecondsSinceEpoch), volunteer_code, started_at,
  ended_at (null while active), uploaded INTEGER default 0 (for 5b).
- `labels`: id PK autoinc, trip_id, mode, started_at, ended_at, source
  ('manual'|'auto'), detected_motion TEXT (MotionClass.name at leg start, nullable),
  detected_confidence REAL (0..1 at leg start, nullable).
- `location_samples`: id PK autoinc, trip_id, latitude, longitude, accuracy,
  speed, altitude, timestamp.
- `sensor_samples`: id PK autoinc, trip_id, type (accelerometer|gyroscope|
  magnetometer), x, y, z, timestamp. (All three sensors persisted, incl. gyro/mag
  which aren't used by the detector yet.)
- `activity_samples`: id PK autoinc, trip_id, type, confidence, timestamp.
- Indexes on trip_id for all four sample/label tables → fast per-trip export/upload.
- All timestamps are ISO8601 UTC — the shared clock that lets labels join to samples.

**Confidence storage (implements the spec's "store confidence"):** each Label now
records what the detector believed when the leg opened (detected_motion +
detected_confidence), regardless of whether the human agreed. This lets us compute
human-vs-machine agreement and debug the classifier later. Threaded through
TripSession.selectMode(..., detectedMotion, detectedConfidence) and set by
CaptureController on confirmSuggested / selectMode / auto-accept.

**Architecture (new pieces, each single-responsibility):**
- `DatabaseService` (lib/services/database_service.dart) — owns the sqflite
  connection + schema (onCreate). Lazy singleton via `database` getter. close().
- `CaptureRepository` (lib/repositories/capture_repository.dart) — domain DB ops:
  insertTrip, updateTripEnd, insertLabels (batch), insertSamples (transaction +
  batch), summarize() → StorageSummary, clearAll() (dev reset). NEW folder
  lib/repositories/.
- `TripRecorder` (lib/controllers/trip_recorder.dart) — buffers loc/sensor/activity
  in memory, flushes every 10s in a transaction, saves trip row on begin(), writes
  labels + trip end on finish(). Keeps CaptureController lean (it just forwards
  samples via addLocation/addSensor/addActivity).
- `StorageSummary` — row counts across tables; drives the "Saved on device" UI card.

**CaptureController changes:** constructs DatabaseService→CaptureRepository→
TripRecorder (all injectable for tests). start() calls recorder.begin(); each stream
listener forwards its sample to the recorder; stop() calls session.end() then
recorder.finish() then loadSummary(). New: savedSummary getter, loadSummary(),
clearSavedData(). All three sensor streams (accel/gyro/mag) are recorded.

**Home screen:** loads summary on launch (initState), shows green "Saved on device"
card (trips/labels/sample counts), Reset now also wipes the DB via clearSavedData().

**Flush/crash behaviour:** samples flush every 10s, so an app kill mid-trip loses at
most ~10s of buffered samples; the trip row (saved on begin) and earlier flushes
survive. Labels are written only on finish() — a mid-trip kill loses that trip's
labels (acceptable for the prototype; volunteers complete trips). Could be made
incremental later if needed.

**Not done:** no upload (5b — needs the minimal Express/NestJS ingest endpoint + a
way to reach it from the phone). No per-trip export/detail view yet. detected_* only
populated when an estimate existed at leg start (null for very early manual taps).

**Current lib/ structure:**
  lib/
  ├── main.dart
  ├── controllers/
  │   ├── capture_controller.dart   # streams + detection + recording (ChangeNotifier)
  │   ├── trip_session.dart         # trip + label state machine (+ detector context)
  │   ├── trip_recorder.dart        # buffered batch persistence
  │   └── mode_detector.dart        # sensor-fusion classifier
  ├── models/
  │   ├── location_sample.dart
  │   ├── sensor_sample.dart
  │   ├── activity_sample.dart
  │   ├── trip.dart
  │   ├── label.dart                # + source, detected_motion, detected_confidence
  │   ├── travel_mode.dart
  │   └── mode_estimate.dart
  ├── repositories/
  │   └── capture_repository.dart   # domain DB operations + StorageSummary
  ├── screens/
  │   ├── consent_screen.dart
  │   └── home_screen.dart          # + Saved-on-device card
  ├── services/
  │   ├── location_service.dart
  │   ├── sensor_service.dart
  │   ├── activity_service.dart
  │   └── database_service.dart     # sqflite connection + schema
  └── widgets/
      ├── reading_card.dart
      └── labeling_panel.dart

**Status:** ✅ Tested on device (data persists across full restart).

---

## Fix — sensor sampling rate enforced in software
**Problem:** The test Motorola ignored the sensors_plus samplingPeriod hint and
delivered ~50Hz per sensor instead of the requested 5Hz — ~154 samples/sec total.
A 34s capture produced 5207 sensor rows (~42k pretty-printed JSON lines). Android
treats the period as a hint; shared sensors + OEM defaults override it.

**Fix:** SensorService now throttles each sensor stream in software to
`storePeriod` (default 200ms = 5Hz), keeping one sample per interval and dropping
the rest, so the stored rate is deterministic regardless of device. `storePeriod`
is the single knob — lower it (e.g. 40ms = 25Hz) when the ML phase needs richer
signal. Higher rate = better classification signal but heavier storage/upload/
battery; 5Hz chosen now as the light default (can raise before real collection,
since you can downsample later but can't recover un-collected data).

**Files:** lib/services/sensor_service.dart (throttle added; hardware still hinted
at normalInterval as a best-effort battery saver).

**Status:** ✅ Fixed — verify sensor count ≈ 15/sec on device.

---

---

## Step 5b — Upload (throwaway receiver + permanent client)
**What:** Completed trips upload from the phone to a server over the local
network. The Flutter upload client and the JSON contract are permanent; the
server is a throwaway Express receiver that writes each trip to a file. Moving
to the real PostGIS backend later is a server-only swap behind the same contract.

**How:** `UploadService` (dio) POSTs one trip to `{baseUrl}/ingest`.
`UploadController` (ChangeNotifier) holds the server URL (in shared_preferences),
the pending count, and the upload loop: for each unuploaded completed trip →
`exportTrip` → POST → `markUploaded`, stopping on first failure. Repository gains
`unuploadedTrips`, `unuploadedTripCount`, `markUploaded`, `exportTrip` (assembles
the contract shape, strips the local autoincrement id). `CaptureController` fires
an `onTripSaved` callback after Stop so the upload card refreshes. Home screen
creates one DatabaseService + CaptureRepository shared by both controllers, and
shows an Upload card (server URL, pending count, Upload button).

**Contract (POST /ingest, one trip):** `{ trip, labels[], location_samples[],
sensor_samples[], activity_samples[] }`, ISO-8601 UTC timestamps. lat/lng sent as
plain numbers — the server decides storage (throwaway = JSON file; real = PostGIS).

**Two-DB architecture:** phone SQLite (offline outbox) → HTTP POST → backend API →
Postgres/PostGIS (warehouse). Phone never connects to Postgres directly.

**Added:** dio (Flutter); `usesCleartextTraffic="true"` in manifest (prototype
only — remove for HTTPS backend).

**Files:** lib/services/upload_service.dart, lib/controllers/upload_controller.dart,
lib/repositories/capture_repository.dart (+upload queries), lib/screens/home_screen.dart
(+Upload card), lib/controllers/capture_controller.dart (+onTripSaved).
Server (separate folder): commute_ingest/server.js, package.json.

**Gotcha:** Windows Firewall was managed by Avast — Avast allowed Node outbound
but blocked inbound from the phone. Fix: trust the local Wi-Fi as Private/Trusted
in Avast. Test gate: open http://<laptop-ip>:3000 in the PHONE browser — loads =
app upload will work; fails = network/firewall, not the app.

**Status:** ✅ Tested end-to-end — phone → Express → data/trip_<id>.json, uploaded
flag flips, pending → 0, survives relaunch.

## Step 6 — Background capture (foreground service)
**What:** Capture now continues when the screen is off / app is backgrounded, so a
volunteer can start capture, pocket the phone, and commute. Implemented via
geolocator's built-in foreground service — NOT a new package, and NOT the
commercial flutter_background_geolocation (which needs a paid release license).

**How it works:** LocationService.stream() now uses AndroidSettings with
foregroundNotificationConfig. Providing that config makes geolocator run a
foreground service with a persistent notification, which keeps the whole app
PROCESS alive in the background. Because our sensor streams (sensors_plus),
activity recognition, the 2s detector timer, and the recorder's 10s flush timer
all run in the same main isolate, they keep running too — the foreground service
keeps everything alive, not just location. enableWakeLock:true holds a CPU wake
lock so sensors keep sampling during screen-off doze (without it they stall).
setOngoing:true stops the user swiping the notification away mid-capture. The
service starts when the position stream is listened to (capture Start) and stops
when the subscription is cancelled (Stop) — maps onto existing lifecycle, no new
state.

**Package:** added geolocator_android (direct import of AndroidSettings /
ForegroundNotificationConfig; already a transitive dep of geolocator). Note:
LocationService is now Android-specific (uses AndroidSettings) — fine, project is
Android-only.

**Manifest permissions added:** ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE,
FOREGROUND_SERVICE_LOCATION (required Android 14+), POST_NOTIFICATIONS (13+),
WAKE_LOCK. geolocator declares the <service> component itself.

**Per-phone manual settings (the "whitelisting" checklist — why battery notes in
the handoff matter):** (1) Location = "Allow all the time" (background location;
can't be requested via dialog on Android 11+, must be set in app settings).
(2) Battery = Unrestricted / disable battery optimization — CRITICAL on Motorola,
which aggressively kills background apps; this is the main reason a capture would
flatline mid-commute. (3) Notifications enabled so the FGS notification shows.
LocationService.openSettings() (Geolocator.openAppSettings) opens the page.

**OEM caveat:** foreground service is necessary but not always sufficient on
aggressive OEMs (Motorola/Xiaomi/etc.). If the process is killed mid-commute the
fix is battery/auto-launch settings, per phone — hence manual whitelisting rather
than a code fix. Acceptable for a whitelisted-volunteer research prototype; would
need hardening (or a more robust background strategy) for a wide consumer release.

**Battery cost:** a CPU wake lock + high-accuracy GPS + ~15 sensor rows/sec for a
full commute is heavy — expected and accepted for Phase 1 (volunteers know they're
collecting). The docs' event-driven/adaptive-sampling battery optimization remains
a deferred Phase 2 concern.

**Test gate:** Start → lock screen → pocket → move ~3-4 min → Stop. Pass = Saved
counts + uploaded JSON sensor timestamps span the whole screen-off window with no
multi-minute gap. Gap = process was suspended (fix via battery settings).

**Files:** lib/services/location_service.dart (foreground service config +
openSettings()); AndroidManifest.xml (5 permissions).

**Status:** ⏳ Built — pending on-device screen-off test on the Motorola.

**Status:** ✅ Tested on device (Motorola) — 131s screen-off capture, 1641 sensor
rows at 12.5/s, biggest inter-sample gap 0.2s (no suspension). Foreground service
+ wake lock hold background capture. TODO before rollout: one long (20-30 min)
screen-off test to confirm no OEM clamp-down over longer idle.

---

## UI Step 1 — Dev panel extraction
**What:** Split the single cluttered home screen into a clean volunteer view + a
hidden developer panel. All diagnostic/researcher UI (5 live reading cards, Saved-
on-device counts, Upload + Server URL, Reset) moved off the home screen into a new
DevPanelScreen reached by a gear icon in the app bar. No pipeline/logic change —
pure UI reorganization.

**Why:** Home was showing ~8 equal-weight cards mixing volunteer actions with
developer telemetry; volunteers can't tell what to do vs what's debug noise.

**How:** New `DevPanelScreen` (lib/screens/dev_panel_screen.dart) takes the EXISTING
CaptureController + UploadController instances (passed from HomeScreen, not
recreated) plus an onReset callback. It uses ListenableBuilder on those shared
controllers, so telemetry updates live even while capture runs and the panel is
open. It does NOT own/dispose the controllers (HomeScreen still does). Moved into
it: _Telemetry (the 5 ReadingCards + error), _SavedCard, _UploadCard, the Server
URL dialog, and the Reset button.
HomeScreen now: app bar has a gear IconButton → pushes DevPanelScreen; body shows
only "Enrolled as X", the LabelingPanel, and the capture button (+ a user-facing
error banner if start fails). Reset removed from home (now in dev panel; its
callback still lives in HomeScreen because it navigates + clears prefs).

**Files:** lib/screens/dev_panel_screen.dart (new); lib/screens/home_screen.dart
(stripped to volunteer view + gear).

**Status:** ✅ Done — hot-restart verified: home decluttered, gear opens dev panel,
live telemetry works there, upload/reset work there.

**Next (UI Step 2):** restructure home into two states — Idle ("Ready to record" +
big Start) and Recording (recording indicator + elapsed time + prominent current
mode + big thumb-friendly mode buttons + quiet leg history + Stop). Then UI Step 3:
polish (state colors, mode icons, spacing).

---

## UI Step 2 — Idle / Recording redesign
**What:** Replaced the single cluttered body with two purpose-built states that
swap on controller.capturing: a calm IdleView ("Ready to record" + big Start) and
a focused RecordingView (recording indicator + elapsed timer + big current-mode
card + suggestion banner + 4×2 icon mode grid + End-leg + "Journey so far" history
+ Auto toggle). No pipeline/logic change — pure re-composition of existing
controller state.

**Files:**
- lib/widgets/idle_view.dart (new) — ready state; shows enrolled code + last-trip
  leg count.
- lib/widgets/recording_view.dart (new) — active-capture UI. Sub-widgets:
  _RecordingHeader (red dot + "Recording" + elapsed + Auto switch), _CurrentModeCard
  (big mode icon/label/leg-timer, or "No mode selected" prompt; auto tag when
  source=='auto'), _SuggestionBanner (vehicle→"tap type" prompt, or
  Confirm-<mode> button when detector suggestion differs from current),
  _ModeGrid/_ModeTile (GridView.count 4-wide, icon+label, selected=filled,
  suggested=outlined), _LegHistory (quiet completed-legs list). File-scoped helpers:
  _modeIcon (TravelMode→Material icon), _modeFromName, _fmtDuration, _fmtClock,
  _tag, _banner.
- lib/screens/home_screen.dart — body now switches IdleView/RecordingView inside
  one ListenableBuilder; capture button enlarged. Everything else unchanged.

**Retired:** lib/widgets/labeling_panel.dart is now UNUSED (replaced by idle/recording
views) — safe to delete; nothing imports it.

**Mode icons:** walk=directions_walk, metro=train, bus=directions_bus,
auto=local_taxi, car=directions_car, bike=directions_bike, waiting=hourglass_empty,
other=more_horiz.

**Note:** RecordingView rebuilds on controller notify (~15/s during capture), so the
elapsed/leg timers tick live without a dedicated Timer. Red recording dot is static
for now — pulse animation comes in UI Step 3 (polish).

**Status:** ✅ Done — hot-restart verified: idle↔recording swap, mode tiles set legs,
suggestion confirm works, journey history builds, gear/dev panel intact.

**Next (UI Step 3 — polish):** state-driven colors (calm idle vs active recording),
pulsing record dot, spacing/typography pass, maybe a distinct Stop-button treatment.  

---

## UI Step 2.5 — Journey timeline, dual track (manual vs detected), trips-today
**What:** (1) The recording screen now shows the journey as a connected vertical
TIMELINE (started → leg → leg → live current leg), not a flat list. (2) A
"Your labels / App detected" toggle switches between the volunteer's manual labels
and the app's INDEPENDENT detected track. (3) Idle screen shows "N trips recorded
today" per volunteer.

**Two-track design (Option A — independent detected track):** alongside the manual
TripSession, a new DetectedTrack builds its own leg timeline from the detector's
2s estimates: opens a leg immediately on first signal, switches when a different
MotionClass persists ≥6s (debounce vs flapping), ignores 'unknown'. This is a
separate journey (its legs don't share the manual leg boundaries), which is what
makes it a real human-vs-machine comparison for Phase 2 training/eval.

**Data model + storage:**
- New `DetectedLeg` (lib/models/detected_leg.dart): trip_id, motion
  (MotionClass.name), started_at, ended_at, confidence.
- New `DetectedTrack` (lib/models/detected_track.dart): pure state machine,
  begin(tripId)/onEstimate(est)/end(at). Debounce = 6s.
- DB bumped to **v2**: new `detected_legs` table + idx_detected_trip, created in
  onCreate AND onUpgrade (existing installs migrate, data preserved). CLEARLY
  a schema migration — verify existing trips survive.
- Repository: insertDetectedLegs(), detected_legs included in exportTrip() (so the
  upload contract gains a `detected_legs` array — additive, server unchanged),
  tripsToday(volunteerCode) (local-midnight→UTC compare), clearAll() wipes it too.
- TripRecorder.finish(trip, labels, detectedLegs) now persists detected legs.
- CaptureController: holds DetectedTrack, feeds it in _onDetectTick, exposes
  detectedLegs/detectedCurrentMotion/detectedLegStartedAt/detectedCurrentConfidence;
  new tripsToday + loadDailyStats(code) + _refreshDailyStats (called after stop);
  stores _volunteerCode.

**UI:**
- New `lib/widgets/mode_visuals.dart`: shared modeIcon/motionIcon/modeFromName/
  motionFromName/fmtDuration/fmtClock (removes duplication; recording_view now
  imports these instead of private copies).
- New `lib/widgets/journey_timeline.dart`: JourneyPanel (SegmentedButton toggle,
  defaults to "Your labels") + _Timeline (start node + per-leg nodes with icon,
  duration, clock range, confidence note for detected; live leg has a "live" badge
  and ticks because RecordingView rebuilds ~15/s).
- recording_view.dart: replaced _LegHistory with JourneyPanel; uses shared helpers.
- idle_view.dart: trips-today pill + last-trip legs.
- home_screen.dart: calls loadDailyStats once the volunteer code loads.

**Retired:** labeling_panel.dart still unused (safe to delete).

**Detected track = independent journey** (Option A); NOT the per-label detector
annotations (detected_motion/detected_confidence on Label) — those still exist on
manual labels separately.

**Status:** ✅ Done — hot-restart verified: timeline builds + ticks, toggle shows
both tracks, trips-today increments, detected_legs in uploaded JSON, DB migrated
v1→v2 with existing data intact.

**Next (UI Step 3 — polish):** state colors, pulsing record dot, spacing/typography.

---

## UI Step 2.6 — My Trips history + land-on-detail after Stop
**What:** (1) After Stop, the volunteer lands on a read-only Trip Detail screen
showing the just-finished trip (summary + both timelines) — nothing disappears.
(2) New "My trips" screen (history icon in the home app bar) lists this
volunteer's completed trips, newest first, and opens any of them. All trips are
stored (already were) and now reviewable anytime, surviving app restarts.

**Reads from DB (new capability):** previously trips were only written + counted;
now they're read back and reconstructed. Added fromMap() to Trip, Label,
DetectedLeg; Trip gained `uploaded` (bool) + `duration`. Repository added:
tripsForVolunteer(code) (completed, newest first), tripById(id), labelsForTrip(id),
detectedLegsForTrip(id).

**Screens:**
- lib/screens/trip_detail_screen.dart (new) — loads one trip by id from the repo,
  shows _SummaryHeader (date, time range, duration, "you labeled N / app detected M",
  upload status icon) + JourneyView (both timelines) + Done. Used both after Stop
  and from My Trips.
- lib/screens/my_trips_screen.dart (new) — per-volunteer list (filtered by code,
  read-only, no delete), each card = date/time + duration + upload ✓/pending;
  empty state; taps into detail.
- journey_timeline.dart: split into JourneyPanel (LIVE, reads controller — recording
  screen) and JourneyView (STATIC, reads passed-in stored legs — detail screen),
  sharing one _TimelineFrame + _Timeline renderer. TimelineEntry is now public.
- home_screen.dart: added history IconButton; Stop now routes through _stopAndShow()
  which stops then pushes TripDetailScreen for the finished trip id.

**Scope decisions:** land-on-detail after Stop = option A; My Trips shows only the
current volunteer's trips; no volunteer-facing delete (dataset integrity — deletion
stays a dev/Reset concern).

**No schema/native change** — pure reads over the existing v2 DB. Hot restart only.

**Backend note (clarified for future-me):** real backend (NestJS + Postgres/PostGIS)
is deliberately NOT built yet. Trigger to build it = multiple volunteers uploading OR
starting Phase 2 analysis (querying data, training detector, OSM journey view). Until
then the throwaway Express receiver (writes data/trip_<id>.json) is sufficient; the
permanent upload contract means swapping it for the real backend is server-only. First
pilot can collect into JSON files and import to Postgres later — nothing lost.

**Status:** ✅ Done — hot-restart verified: land-on-detail after Stop, My Trips lists
per-volunteer trips + survives restart, detail loads both timelines from DB.

**Next (UI Step 3 — polish):** state colors, pulsing record dot, spacing/typography.

---

## UI Step 3 — Visual polish
**What:** Pure visual pass — no features/logic changed. Introduced a single app
theme so every screen is consistent; added state-driven color, a pulsing record
dot, cleaner cards, and a warmer consent screen. Removed the DEBUG banner.

**Theme (lib/theme.dart, new):** AppTheme.light() — M3 ColorScheme.fromSeed(indigo),
soft off-white scaffold, flat app bar, white cards with a thin grey border + 16
radius (replaces heavy default shadows), rounded filled/segmented buttons. Constants
AppTheme.seed + AppTheme.recording (red). Gap class = shared spacing scale
(xs/s/m/l/xl). Applied via MaterialApp.theme in main.dart;
debugShowCheckedModeBanner:false.

**Record dot (lib/widgets/pulsing_dot.dart, new):** PulsingDot — a filled dot with a
soft breathing halo (AnimationController, 1.1s repeat/reverse). Used in the recording
header to signal "live" at a glance.

**State color:** capture button now indigo "Start recording" → red
(AppTheme.recording) "Stop recording"; rounded icons. Recording header uses PulsingDot
+ elapsed-time pill.

**Consent screen redesign:** icon badge, centered heading, 3 bulleted assurances
(recording only when started / stored then uploaded / voluntary), filled rounded code
field, prominent Continue. Same logic/keys as before.

**Automatic propagation:** reading cards, saved/upload cards, trip cards, timelines all
pick up the new card/divider style via the theme — no per-widget edits needed.

**Files:** lib/theme.dart (new), lib/widgets/pulsing_dot.dart (new), lib/main.dart
(theme + no debug banner), lib/screens/consent_screen.dart (redesign),
lib/widgets/recording_view.dart (_RecordingHeader → PulsingDot + pill; +imports),
lib/screens/home_screen.dart (_CaptureButton → state color; +theme import).

**Status:** ✅ Done — hot-restart verified: cohesive theme, no debug banner, pulsing
record dot, state-colored Start/Stop, redesigned consent.

---

## Detector overhaul — merge cycling→vehicle + evidence-based track builder
**Problem:** On a real ~20-min trip, one steady Bike leg (manual) produced 31
detected legs — the detector thrashed Vehicle↔Cycling↔Walking every 10–30s.
Root causes: (a) cycling is genuinely inseparable from other road vehicles by
sensors, so it flip-flopped; (b) the old 6s debounce only gated *timing*, didn't
weigh evidence or confidence, so confident-looking blips still flipped it, and a
45% reading could override an 85% one.

**Fix 1 — cycling merged into vehicle at the SOURCE.** MotionClass drops `cycling`
(now: stationary/walking/vehicle/unknown). ModeDetector.classify folds the old
cycling branch + bicycle activity-recognition signal into `vehicle`. Manual modes
UNCHANGED — volunteer can still label Bike; only the machine guess is coarsened.
Updated motionIcon() + mode_estimate label/suggestedMode.

**Fix 2 — DetectedTrack rewritten from timer-debounce to evidence-based:**
  1. Rolling confidence-weighted VOTE over a 16s window → "current best" class is
     whichever has most confidence-summed support; isolated low-conf blips can't
     define a leg.
  2. HYSTERESIS: switching the committed leg requires the challenger's window
     score ≥ incumbent's × margin (1.4) — tying isn't enough, so a stable state
     resists leaving (thermostat-style).
  3. Short-leg ABSORPTION at end(): any leg < minLeg (10s) flanked by the same
     class both sides is merged away (noise sliver), repeated until stable.
  Knobs are principled (window=evidence, margin=stickiness, minLeg=sliver floor),
  not one arbitrary timer.

**Effect:** bike ride now reads as stable "In vehicle" (honestly generalized),
detected track mirrors manual Walk→Vehicle→Walk instead of 31 flips. Still
smoothing, not intelligence — true bike/auto separation remains Phase 2 (trained
model). Detected track = clean, presentable, comparable.

**Files:** models/mode_estimate.dart (drop cycling), controllers/mode_detector.dart
(classify folds cycling→vehicle), models/detected_track.dart (rewrite),
widgets/mode_visuals.dart (motionIcon).

**Status:** ⏳ Built — verify on a real trip: no Cycling, bike = stable vehicle,
leg count collapses from ~31 to single digits.