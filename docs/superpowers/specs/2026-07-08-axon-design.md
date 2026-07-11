# Axon — Design Spec

Date: 2026-07-08
Status: Approved (v1 scope locked)

## 1. Summary

Axon: single Android app, three modules (Money, Tasks, Focus) + home dashboard. Personal-use sideload (not Play Store), so no store review constraints on sensitive permissions.

**Platform decision:** Android-only. iOS blocks SMS read, overlay-over-other-apps, and cross-app usage tracking — all three are core features. Not portable to iOS without dropping the core value prop.

## 2. Architecture

```
┌─────────────────────────────────────────┐
│  HOME  (dashboard: spend + tasks +       │
│         screen-time, one daily score)    │
├──────────┬──────────┬────────────────────┤
│  MONEY   │  TASKS   │   FOCUS            │  ← bottom tabs
└──────────┴──────────┴────────────────────┘
```

- **Shell:** Expo Router (existing scaffold), TypeScript, React Native 0.86, Reanimated for motion.
- **Build target:** Expo **dev client** (`expo-dev-client`) + prebuild, NOT Expo Go — SMS/overlay/usage-stats require custom native Android code Expo Go can't load. Sideload the built APK directly (`eas build --local` or Android Studio), install once per device.
- **Native Android modules** (Kotlin, Expo Modules API):
  1. `SmsReader` — `RECEIVE_SMS`/`READ_SMS`, parses bank/UPI transaction SMS in-memory.
  2. `NotificationListener` — `NotificationListenerService`, parses UPI app notifications (GPay/PhonePe/Paytm often skip SMS).
  3. `OverlayService` — `SYSTEM_ALERT_WINDOW`, floating pill + nudge popups over other apps.
  4. `UsageTracker` — `AccessibilityService` (foreground-app detection, real-time) + `PACKAGE_USAGE_STATS` (historical stats for reports).
- **Local DB:** SQLite via **op-sqlite with SQLCipher** (encrypted at rest). No server, no sync.
- **Outbound network:** exactly one call type in the whole app — Tasks module → Claude API (`claude-haiku-4-5`) for subtask splitting. Sends task text only, never financial/usage data. Everything else fully offline.

## 3. Security architecture (hard requirement, drives design)

Motivation: SMS/notification content and usage data are sensitive; loss/leak must be minimized structurally, not just by policy.

- **No raw sensitive text at rest.** `SmsReader`/`NotificationListener` parse in native memory, emit only structured fields (amount, merchant, type, date, dedup ref). Raw SMS/notification string is never written to JS, disk, or logs — discarded right after parse.
- **Encrypted DB.** SQLCipher-backed SQLite; key generated and held in Android Keystore (hardware-backed where available), never in source, prefs, or JS-reachable storage.
- **App lock.** Biometric/PIN gate (`expo-local-authentication`) required to open the app — financial + usage data sits behind it.
- **No cloud backup of app data.** `android:allowBackup="false"` in manifest — blocks Google auto-backup from exfiltrating the encrypted DB (and its key material risk) off-device.
- **No analytics/crash SDKs.** Skip Firebase/Crashlytics-style telemetry by default (common leak vector). If crash reporting is added later, self-hosted or explicit opt-in only.
- **Minimal network surface.** Only Tasks→Claude call leaves device; scoped to task text, no auth token tied to personal identity beyond the API key itself (stored via secure config, not committed to repo).
- **Manual encrypted export only.** Backup/export (Money module) is a password-protected local file the user explicitly triggers — never automatic, never cloud.

## 4. Module — MONEY (expense tracker, no AI)

- Sources: SMS (`SmsReader`) + UPI app notifications (`NotificationListener`), same parsing pipeline.
- Rule-based parser (regex/string match) for Indian bank/UPI formats (HDFC, SBI, ICICI, GPay, PhonePe, Paytm, etc.): extracts amount, debit/credit, merchant/VPA, date, account tail.
- De-dupe by (amount, timestamp window, ref no.) — a single UPI txn often fires both an SMS and a notification.
- Categorization: keyword→category lookup table, refined by user's manual corrections over time (still rule-based, no ML/AI — explicit user requirement).
- User-facing: reviewable parsed feed, tap to fix category/merchant, month/category/trend charts.
- Extras: recurring-charge detection (subscription alerts — "Netflix ₹500 renews in 3 days"), bill-split helper, manual encrypted export.

## 5. Module — FOCUS (screen-time control)

- `UsageTracker` (Accessibility) detects foreground app entering user's configured "distraction list" (e.g. Instagram, YouTube, X, Reddit).
- `OverlayService` renders:
  - **Floating pill**, live session timer, draggable, always on top of the distracting app.
  - **Nudge popup** every N minutes (user-configurable): "12 min on Reels. Worth it?" → [Keep going] [Close app] [Snooze].
- **v1 feature set (locked):**
  - **Escalating friction** — nudge visual weight/dismiss-difficulty increases with session length.
  - **Daily budget** — per-app minute cap; pill turns red past budget; optional hard block to home screen.
  - **Streak/score** — "3 days under budget," shown on dashboard.
  - **Focus Mode** — one-tap block of the whole distraction list for N hours (deep work/exam), overlay shows countdown instead of pill.
- **Deferred to v2:** grayscale-nudge deep link, cooldown lock after close, weekly report deep-dive.

## 6. Module — TASKS (voice to-do)

- Mic → Android on-device speech-to-text → task text.
- Task text → Claude API (`claude-haiku-4-5`) → 3 suggested subtasks.
- Subtask card actions: [+ split further] (re-calls AI on that subtask), [− merge], [✎ edit], [✓ done].
- Local notification nagging on a user-set schedule ("Update on 'Book flight'?").
- v1 extra: voice reply to nag ("done" / "push to tomorrow") via on-device STT, no AI call needed for that path.
- All task data local (SQLite, same encrypted store as Money — no financial data crosses modules, but same DB engine).

## 7. Home dashboard

- At-a-glance cards: month spend, task completion, screen-time today.
- Single blended "today score" (spend-pace + task-completion + screen-time) as the one-glance number.

## 8. Design language

- Dark-first, near-black background, one accent per module: Money = green, Tasks = violet, Focus = amber.
- Big rounded cards, generous whitespace, soft shadows, Reanimated spring motion.
- One clean sans (Inter or similar), consistent 8pt spacing scale.
- Exact palette/type/spacing tokens to be finalized in implementation plan.

## 9. Out of scope (v1)

- iOS support (platform-infeasible for core features, see §1).
- Any AI involvement in Money (expense parsing/categorization) — explicit no.
- Cloud sync/backup, multi-device.
- Grayscale-nudge automation, cooldown lock, weekly deep-dive report (Focus v2).
- Analytics/telemetry/crash reporting.

## 10. Risks / open implementation questions (for planning phase)

- Expo dev-client + 4 custom native modules (Accessibility, overlay, SMS, notification-listener) — nontrivial prebuild/config-plugin work; needs its own implementation plan.
- Android AccessibilityService for usage tracking can be battery-heavy; needs measurement during implementation.
- SQLCipher + op-sqlite integration path with Expo prebuild needs verification against current Expo 57 native module APIs (per project's own AGENTS.md note: Expo has changed, check versioned docs before coding).
