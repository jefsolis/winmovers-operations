# Phase 0 Research: Packing List GPS Location Tracking

**Feature**: 007-packing-list-gps-location
**Date**: 2026-08-25

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION` items remain.

---

## R1: Mobile location capture library

**Decision**: Use `expo-location` with `getCurrentPositionAsync`, wrapped in a single `captureStageLocation()` helper that never throws.

**Rationale**: The mobile app is Expo SDK 52 managed workflow. `expo-location` is the first-party module for this SDK and matches the existing pattern of first-party modules already in use (`expo-camera`, `expo-network`, `expo-crypto`, `expo-sqlite`). It is not currently a dependency and must be added, plus permission declarations in `mobile/app.json` (Android `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`, iOS `NSLocationWhenInUseUsageDescription`).

**Alternatives considered**:
- `react-native-geolocation-service`: rejected, requires bare workflow / config plugin work and duplicates a first-party capability.
- Background location (`startLocationUpdatesAsync`): rejected, the spec explicitly scopes out continuous tracking and background permissions materially raise app-store review burden.

---

## R2: Non-blocking capture guarantee

**Decision**: `captureStageLocation()` returns a settled result object, never rejects, and is bounded by an explicit timeout race (≈5s) plus `Location.Accuracy.Balanced`. Callers always proceed regardless of the outcome.

**Rationale**: FR-007/FR-009 and SC-002/SC-003 require that no stage blocks, hangs, or errors because of location. A helper that returns `{ status: 'CAPTURED', ... } | { status: 'UNAVAILABLE', reason }` makes the non-blocking behavior structural rather than dependent on each call site remembering a `try/catch`.

**Alternatives considered**:
- `try/catch` at each call site: rejected, six call sites means six chances to regress the guarantee.
- Awaiting a high-accuracy fix: rejected, GPS cold start can exceed the 2s budget in SC-003.

---

## R3: Unavailability reason values

**Decision**: A language-neutral enum persisted as a string: `PERMISSION_DENIED`, `SERVICES_DISABLED`, `TIMEOUT`, `UNSUPPORTED`, `ERROR`.

**Rationale**: Constitution Principle I requires shared domain values to stay language-neutral, with translation only at the presentation boundary. This mirrors the existing pattern used for `progressStatus`, `eventType` and `barcodeState`.

**Alternatives considered**:
- Storing a human-readable message: rejected, violates Principle I and cannot be localized per viewer.
- A boolean `locationAvailable`: rejected, FR-008 requires distinguishing reasons.

---

## R4: Where stage locations are persisted

**Decision**: Add nullable location columns directly to the three existing event tables — `PackingProgressTransition`, `PackingWorkdayEvent` — and to `PackingList` for the creation event. No new table.

**Rationale**: Each location belongs to exactly one event with a 1:1 lifetime and is immutable after confirmation (FR-022). Inlining columns preserves the existing idempotency and serializer flow, avoids extra joins in the already-heavy `GET /:id` include tree, and is the smallest change consistent with Principle VII. `PackingList` already carries the creation moment (`createdAt`), so creation coordinates belong on that row.

**Alternatives considered**:
- A polymorphic `StageLocation` table keyed by (entityType, entityId): rejected, adds join complexity and referential looseness for a strict 1:1 relationship.
- A `PackingDailySignaturePair`-style side table per event type: rejected, three near-identical tables for four scalar fields.

**Column set** (identical on each host row, prefixed to avoid collisions where needed): `latitude` (Float?), `longitude` (Float?), `locationAccuracy` (Float?), `locationCapturedAt` (DateTime?), `locationUnavailableReason` (String?).

---

## R5: Preserving the original capture moment across retries

**Decision**: The mobile SQLite row stores the captured location at enqueue time; sync sends those stored values. The backend accepts location fields only on the initial create of an idempotent event and ignores them on the idempotent replay path.

**Rationale**: FR-011/FR-022. The existing events are already idempotent by `idempotencyKey`, and the workday/transition handlers already short-circuit on replay. Capturing at enqueue rather than at send time is also what makes offline capture correct (FR-010).

**Alternatives considered**:
- Capturing at send time: rejected, an event synced hours later would record the wrong place.
- Allowing updates on replay: rejected, breaks immutability.

---

## R6: Job coordinate storage and parsing

**Decision**: Add `serviceLatitude` (Float?) and `serviceLongitude` (Float?) to `Job`. Parse user input on the frontend through a shared pure helper that accepts a Google Maps `?q=<lat>,<lng>` URL (including URL-encoded `%2C`), a bare `lat,lng` pair, and `@lat,lng` map URLs; the backend independently validates ranges.

**Rationale**: FR-015 to FR-019. A single pair matches the spec assumption of one service location. Frontend parsing gives immediate feedback; backend validation is authoritative because the API is reachable independently of the form.

**Alternatives considered**:
- A single `serviceCoordinates` string column: rejected, unqueryable and pushes parsing into every consumer.
- Geocoding free-text addresses server-side: rejected, out of scope and introduces an external dependency and cost.
- Adding coordinates to `MovingFile` as well: rejected for now; `getServiceContext()` already resolves job data for the packing list, so `Job` is the single source.

**Validation rule**: latitude ∈ [-90, 90], longitude ∈ [-180, 180]; both must be present or both null. Values outside range or unparseable input are rejected without mutating stored values.

---

## R7: Full-object PUT compatibility for jobs

**Decision**: Add the two coordinate fields to the existing destructured field list in `POST /api/jobs` and `PUT /api/jobs/:id`, and add them to every frontend payload that already submits a full job object.

**Rationale**: Constitution Principle VI states backend update handlers destructure the full body and partial payloads null out omitted fields. `frontend/src/pages/Jobs/JobForm.jsx` and the inline editor in `frontend/src/pages/Jobs/JobDocument.jsx` both submit jobs and must both carry the new fields, or saving from one screen would erase coordinates set in the other.

**Alternatives considered**:
- A dedicated `PATCH /jobs/:id/coordinates` endpoint: rejected, adds a route for two fields and diverges from the established job update contract.

---

## R8: Web map picker

**Decision**: Render the picker with the Google Maps Embed/iframe plus a coordinate text input and a "select on map" affordance backed by the Google Maps JavaScript API loaded from a `VITE_`-prefixed key; when no key is configured, the coordinate text input and the link-paste path remain fully functional and the interactive map degrades to a static preview link.

**Rationale**: The spec names Google Maps as the required surface. The frontend has no maps dependency today and Vite only exposes `VITE_`-prefixed variables. Degrading gracefully keeps the feature usable in environments where the key is absent, which also keeps local development and the existing build pipeline working without new required secrets.

**Alternatives considered**:
- Leaflet/OpenStreetMap: rejected, spec explicitly requires Google Maps.
- Making the API key a hard requirement: rejected, would break the job form wherever the key is unset.

---

## R9: Opening a recorded location from the web

**Decision**: Render a small map-pin control per history event that opens `https://www.google.com/maps?q=<lat>,<lng>` in a new tab via `target="_blank"` with `rel="noopener noreferrer"`.

**Rationale**: FR-013 requires opening Google Maps in a separate window. `noopener noreferrer` prevents reverse tabnabbing (OWASP A01/A05 hygiene) since the target is an external origin.

**Alternatives considered**:
- Embedding an inline map per event: rejected, heavy for a history list and not requested.
- `window.open` in a click handler: rejected, an anchor is more accessible and keyboard-navigable by default.

---

## R10: Mobile navigation target selection

**Decision**: `openNavigation()` uses `destination=<lat>,<lng>` when the job has coordinates, otherwise keeps the existing encoded-address destination. `serviceContext` gains the coordinate fields so the mobile cache carries them.

**Rationale**: FR-020/FR-021. `getServiceContext()` in `backend/routes/packingLists.js` already assembles the address the mobile app consumes, so extending it is the smallest change and automatically flows through the existing `moving_file_ref` JSON cached in SQLite.

**Alternatives considered**:
- A separate mobile fetch of the job: rejected, extra network dependency for data already in the payload.

---

## R11: Audit and access control

**Decision**: No new audit call sites and no new access rules. Location fields ride along in the existing `logAudit(req, 'PackingList'|'Job', id, action, before, after)` snapshots, and all reads occur through endpoints already gated by the current middleware.

**Rationale**: FR-023/FR-024 and Constitution Principles II and III. `logAudit` snapshots whole records, so newly added columns are captured automatically without weakening or duplicating audit behavior.

---

## R12: Testing approach

**Decision**: Validation is manual through the quickstart scenarios plus the existing automated gates: `npx tsc --noEmit` and `npx expo export --platform android` for mobile, `node --check` for changed backend routes, and `npm run build` for the frontend. Pure helpers (coordinate parsing, maps URL building) are written as standalone exported functions so they are directly exercisable.

**Rationale**: The repository has no automated test runner configured for these surfaces; this matches the validation approach used by features 005 and 006 and the constitution's quality gates.

---

## Resolved Technical Context values

| Item | Value |
|---|---|
| Language/Version | Node.js + Express (backend), React 18 + Vite (web), React Native 0.76 / TypeScript on Expo SDK 52 (mobile) |
| Primary Dependencies | Prisma 5, `expo-location` (new), Google Maps JS API (new, optional key) |
| Storage | PostgreSQL via Prisma `getPrisma()`; mobile SQLite (`expo-sqlite`) for offline queueing |
| Testing | Manual quickstart scenarios + `tsc --noEmit`, `expo export`, `node --check`, `vite build` |
| Target Platform | Azure App Service container (web/API), Android device via Expo (mobile) |
| Project Type | Web application + mobile client against a shared API |
| Performance Goals | ≤2s added latency per stage (SC-003); location capture bounded by ~5s timeout that never blocks the stage |
| Constraints | Non-blocking capture; offline-capable; full-object PUT preserved; language-neutral enums; additive schema only |
| Scale/Scope | ~6 lifecycle stages, 3 backend routes touched, 1 job form, 1 web history panel, 4 mobile screens |
