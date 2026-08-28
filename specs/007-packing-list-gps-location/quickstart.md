# Quickstart Validation: Packing List GPS Location Tracking

**Feature**: 007-packing-list-gps-location
**Contracts**: [contracts/packing-list-location-api.yaml](./contracts/packing-list-location-api.yaml)
**Data model**: [data-model.md](./data-model.md)

---

## Prerequisites

- PostgreSQL reachable via `backend/.env` `DATABASE_URL`.
- Backend on port 3001, frontend dev server on 5173, Expo on 8081.
- A physical Android device (or an emulator with a mock location set) — location cannot be meaningfully validated on a device with no location provider.
- At least one open moving file with an associated job.
- Optional: `VITE_GOOGLE_MAPS_API_KEY` set in `frontend/.env` for the interactive map picker. Without it, the coordinate text input and link-paste path must still work (see Scenario D3).

## Setup

```powershell
# Schema
Set-Location backend
npx prisma db push
npx prisma generate

# Backend
npm run start:dev
```

```powershell
# Frontend
Set-Location frontend
npm run dev
```

```powershell
# Mobile
Set-Location mobile
npx expo start --port 8081 --clear
```

On first launch after this feature, accept the location permission prompt on the device.

---

## Validation Scenarios

### Scenario A: Location captured at every lifecycle stage

**Covers**: FR-001 to FR-006, FR-010, SC-001

1. With location enabled and permission granted, create a new packing list from the mobile app.
2. Start travel to the client.
3. Confirm arrival to start work (capture both signatures).
4. Close the workday, then start a new workday.
5. Add at least one box with a barcode, then complete the job.

**Expected**:

- Each of the six stages completes normally.
- Every resulting lifecycle event has a stored position with latitude, longitude, accuracy and a capture time.
- Positions differ appropriately if the device physically moved; they are not copies of one another.

### Scenario B: Location unavailable never blocks the flow

**Covers**: FR-007, FR-008, FR-009, FR-014, SC-002, SC-003

1. Turn off device location services (or deny the permission).
2. Repeat a full lifecycle: create list, start travel, start work, close day, complete.

**Expected**:

- Every stage completes with no error dialog, no hang, and no visible delay beyond a couple of seconds.
- Each event records an explicit unavailability reason (`SERVICES_DISABLED` or `PERMISSION_DENIED`).
- No stage is retried or rolled back because of location.

### Scenario C: Offline capture and retry preserve the original position

**Covers**: FR-010, FR-011, FR-022

1. With location enabled, put the device in airplane mode.
2. Record a workday start at location X.
3. Physically move to a clearly different location Y (or change the mock location).
4. Restore connectivity and let the app sync.

**Expected**:

- The synced event reports location X, the place where the stage actually happened, not Y.
- Re-syncing or reopening the list does not change the stored position.

### Scenario D: Job service coordinates in the web

**Covers**: FR-015 to FR-019, SC-006, SC-007

**D1 — Paste a shared link**

1. Open a job for editing in the web app.
2. Paste `https://maps.google.com/maps?q=9.9776154%2C-84.1246276&z=17&hl=es` into the coordinates field.
3. Save, then reopen the job.

**Expected**: coordinates are extracted, persisted, shown on the map, and the job is marked as having exact coordinates.

**D2 — Select on the map**

1. Edit the job and choose a different point on the map.
2. Save and reopen.

**Expected**: the newly selected coordinates persist.

**D3 — Invalid and boundary input**

1. Paste text with no coordinates (for example a place name only).
2. Enter latitude `95`.
3. Enter only a latitude with no longitude.

**Expected**: each is rejected with a clear message, previously saved coordinates remain unchanged, and the job is not corrupted.

**D4 — Clearing coordinates**

1. Clear the coordinates and save.

**Expected**: the job reverts to text-address identification and no longer shows the exact-coordinates indicator.

**D5 — Full-object PUT safety**

1. Set coordinates on a job from the job form.
2. Edit and save the same job from the inline job document editor, changing only an unrelated field.
3. Reopen the job.

**Expected**: the coordinates are still present. Losing them here indicates a partial-payload defect.

### Scenario E: Viewing stage locations from the web

**Covers**: FR-012, FR-013, FR-014, SC-004, SC-005

1. Open the moving file's packing list panel and expand the history for the list from Scenario A.
2. Inspect each event.
3. Select a location indicator.
4. Repeat with the list from Scenario B.

**Expected**:

- Events with a position show a clickable location indicator.
- Selecting it opens Google Maps in a new tab centered on those coordinates.
- Events from Scenario B show an explicit unavailable state and no map link.
- The indicator is reachable and understandable via keyboard and screen reader.

### Scenario F: Mobile navigation target

**Covers**: FR-020, FR-021, SC-008

1. For a job with coordinates (Scenario D), open the packing list and start navigation.
2. For a job without coordinates, start navigation.

**Expected**:

- The first navigates to the exact point.
- The second behaves exactly as before, using the text address.
- The operator can tell which one is in use.

### Scenario G: Language surfaces

**Covers**: Language Surface Requirements, Constitution Principle I

1. Switch the web app between English and Spanish and review the job coordinate field, its validation messages, the exact-coordinates indicator, the history location indicator, and the unavailable-location state.
2. Review new operator-facing mobile text.
3. Complete a client-facing signature flow in each language.

**Expected**:

- All new web text is translated in both languages with no hardcoded labels.
- New operator-facing mobile text is Spanish.
- Client-facing flows remain fully consistent in the selected language.
- Stored values (unavailability reasons, statuses) remain language-neutral regardless of the UI language.

### Scenario H: Audit and access

**Covers**: FR-023, FR-024, Constitution Principles II and III

1. Change a job's coordinates and review the job's audit history.
2. Attempt to view a packing list's locations as a role that cannot access the record.

**Expected**:

- The coordinate change appears in the existing audit trail.
- Access is refused exactly as it is for the record today; locations add no new access path.

---

## Regression Focus

- Existing packing list creation, travel, arrival, workday, and completion flows behave identically when location succeeds and when it fails.
- The missing-barcode completion gate and dual-signature requirements are unaffected.
- Idempotent replays of transitions and workday events still return the original event.
- Job create and update continue to persist every existing field; no field is nulled out by the new payload.
- Pre-existing packing lists and jobs created before this feature render correctly with no location data.

---

## Automated Gates

```powershell
Set-Location backend
node --check routes\packingLists.js
node --check routes\jobs.js

Set-Location ..\mobile
npx tsc --noEmit
npx expo export --platform android --output-dir .expo-diagnostic-export
Remove-Item .expo-diagnostic-export -Recurse -Force

Set-Location ..\frontend
npm run build
```

All must pass before the feature is considered complete.

---

## Results Log

| Scenario | Date | Result | Notes |
|---|---|---|---|
| A — capture at every stage | 2026-08-25 | ✅ PASS | All six stages captured with position, accuracy and timestamps |
| B — unavailable never blocks | 2026-08-25 | ✅ PASS | Fixed: backend parseStageLocation now correctly checks for null before Number conversion to avoid 0,0 trap |
| C — offline preserves position | 2026-08-25 | ✅ PASS | Offline queueing preserves original capture time through sync |
| D — job coordinates | 2026-08-25 | ✅ PASS | Web accepts link paste, map selection, and coordinate entry; validation rejects invalid input |
| E — web map viewing | 2026-08-25 | ✅ PASS | Map pin indicator opens Google Maps; unavailable state displays reason |
| F — mobile navigation | 2026-08-25 | ✅ PASS | Navigation uses coordinates when available, falls back to address |
| G — language surfaces | 2026-08-25 | ✅ PASS | All web strings in i18n.jsx EN/ES; mobile operator text Spanish |
| H — audit and access | 2026-08-25 | ✅ PASS | Audit snapshots capture location columns; no new access paths introduced |
