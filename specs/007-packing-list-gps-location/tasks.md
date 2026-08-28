---

description: "Task list for Packing List GPS Location Tracking"
---

# Tasks: Packing List GPS Location Tracking

**Input**: Design documents from `/specs/007-packing-list-gps-location/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: No automated test suite was requested in the feature specification and none is configured for these surfaces. Validation uses the scenarios in [quickstart.md](./quickstart.md) plus the existing build/type gates.

**Organization**: Tasks are grouped by user story so each story can be implemented, validated and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: Which user story the task belongs to (US1–US4)
- Every task states an exact file path

## Path Conventions

Three-surface layout per [plan.md](./plan.md): `backend/` (Express + Prisma), `frontend/` (React + Vite), `mobile/` (Expo React Native).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the new dependencies and declare the permissions the feature needs.

- [X] T001 Add `expo-location` dependency to mobile/package.json using the SDK 52 compatible version via `npx expo install expo-location`
- [X] T002 Declare Android `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions and the iOS `NSLocationWhenInUseUsageDescription` string in mobile/app.json
- [X] T003 [P] Document the optional `VITE_GOOGLE_MAPS_API_KEY` environment variable in frontend/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, local store, and the shared helpers every user story depends on.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T004 Add nullable `latitude`, `longitude`, `locationAccuracy`, `locationCapturedAt`, `locationUnavailableReason` to models `PackingList`, `PackingProgressTransition` and `PackingWorkdayEvent`, and nullable `serviceLatitude`/`serviceLongitude` to model `Job` in backend/prisma/schema.prisma
- [X] T005 Run `npx prisma db push` then `npx prisma generate` from backend/ to apply the schema in backend/prisma/schema.prisma
- [X] T006 [P] Add the shared `location` request parser and range validator helper (both-or-neither coordinates, latitude −90..90, longitude −180..180, allowed unavailable-reason enum) in backend/routes/packingLists.js
- [X] T007 [P] Add the additive local columns for latitude, longitude, accuracy, captured-at and unavailable-reason on tables `packing_lists`, `packing_progress_transitions` and `packing_workday_events` using the existing `addColumnIfMissing` pattern in mobile/src/db/schema.ts
- [X] T008 Extend `PackingListRow`, `PackingProgressTransitionRow` and `PackingWorkdayEventRow` interfaces with the location fields in mobile/src/db/queries.ts (depends on T007)
- [X] T009 Create the non-throwing `captureStageLocation()` helper returning a settled captured/unavailable result with a bounded timeout in mobile/src/services/location.ts
- [X] T010 [P] Add `StageLocation`, `LocationUnavailableReason` and job coordinate types plus the `location` field on the workday, transition and completion payload interfaces in mobile/src/services/api.ts
- [X] T011 [P] Add the coordinate parsing helper accepting `maps.google.com/maps?q=<lat>,<lng>` links, `@lat,lng` URLs and plain `lat,lng` pairs, with range validation, in frontend/src/constants.js
- [X] T012 [P] Add EN and ES strings for location indicators, unavailable-location states, coordinate entry, validation messages and the exact-coordinates indicator in frontend/src/i18n.jsx

**Checkpoint**: Schema, local store, capture helper, parsing helper and translations exist. User stories can now proceed.

---

## Phase 3: User Story 1 - Capture Location at Every Packing List Stage (Priority: P1) 🎯 MVP

**Goal**: Every packing list lifecycle stage records the device position, and no stage is ever blocked or broken when location is unavailable.

**Independent Test**: Run a full lifecycle with location enabled and confirm all six stages carry a position; repeat with location disabled and confirm every stage still completes and records an explicit unavailable reason.

### Implementation for User Story 1

- [X] T013 [US1] Accept and persist the optional `location` object on packing list creation in backend/routes/packingLists.js
- [X] T014 [US1] Accept and persist `location` on first create only for `POST /:id/progress-transitions`, leaving the idempotent replay path returning the stored event unchanged, in backend/routes/packingLists.js
- [X] T015 [US1] Accept and persist `location` on first create only for `POST /:id/workday-events`, preserving the existing idempotency short-circuit, in backend/routes/packingLists.js
- [X] T016 [US1] Accept `location` on `PATCH /:id/complete` and attach it to the `FINAL_COMPLETE` workday event without allowing it to affect completion validation, in backend/routes/packingLists.js
- [X] T017 [US1] Include the serialized `location` object in `serializeTransition` and `serializeWorkdayEvent`, and expose `creationLocation` on the `GET /:id` detail payload, in backend/routes/packingLists.js
- [X] T018 [P] [US1] Persist and read the location columns when enqueuing and loading progress transitions and workday events in mobile/src/db/queries.ts
- [X] T019 [P] [US1] Persist the creation location on the local packing list row in mobile/src/db/queries.ts
- [X] T020 [US1] Capture location on packing list creation and on travel start, storing the result with the enqueued records, in mobile/src/screens/PackingListScreen.tsx
- [X] T021 [US1] Capture location when the workday event is enqueued for work start, day start and day close in mobile/src/screens/ArrivalAcknowledgementScreen.tsx
- [X] T022 [US1] Capture location at final completion and store it with the pending completion record in mobile/src/screens/SignatureScreen.tsx
- [X] T023 [US1] Send the stored location with transitions and workday events on the retry paths in mobile/src/services/cacheService.ts
- [X] T024 [US1] Send the stored location on the completion sync path in mobile/src/hooks/useLiveSync.ts
- [X] T025 [US1] Verify the original captured position and capture time survive retries and are not recomputed at send time in mobile/src/services/cacheService.ts

**Checkpoint**: All six stages capture position, degrade safely, and survive offline queueing.

---

## Phase 4: User Story 2 - View Stage Locations on a Map from the Web (Priority: P1)

**Goal**: Office users can see which lifecycle events have a position and open Google Maps for any of them.

**Independent Test**: Expand a packing list history and confirm each event with a position exposes a working map link while events without one show an explicit unavailable state.

### Implementation for User Story 2

- [X] T026 [US2] Render a clickable map-pin indicator per workday history event and per progress transition, opening `https://www.google.com/maps?q=<lat>,<lng>` in a new tab with `rel="noopener noreferrer"`, in frontend/src/pages/Files/PackingListsPanel.jsx
- [X] T027 [US2] Render the explicit unavailable-location state with its translated reason for events without a position in frontend/src/pages/Files/PackingListsPanel.jsx
- [X] T028 [US2] Show the list creation location alongside the creation entry in the history in frontend/src/pages/Files/PackingListsPanel.jsx
- [X] T029 [P] [US2] Add accessible labels and titles for the location indicator so the link purpose and its event are announced, in frontend/src/pages/Files/PackingListsPanel.jsx

**Checkpoint**: Captured positions are reviewable from the web history.

---

## Phase 5: User Story 3 - Define Job Service Coordinates in the Web (Priority: P1)

**Goal**: Office users can set a job's exact coordinates by map selection or by pasting a shared coordinate value, and jobs with coordinates are clearly identifiable.

**Independent Test**: Set coordinates by both methods, save, reopen, and confirm they persist and the job shows the exact-coordinates indicator; confirm invalid input is rejected without altering saved values.

### Implementation for User Story 3

- [X] T030 [US3] Add `serviceLatitude` and `serviceLongitude` to the destructured field lists of the POST and PUT handlers in backend/routes/jobs.js
- [X] T031 [US3] Validate coordinate pairing and ranges, rejecting partial or out-of-range values with a 400 and leaving stored values unchanged, in backend/routes/jobs.js
- [X] T032 [US3] Create the reusable coordinate picker component with map selection, shared-link paste, clear action and graceful degradation when no maps key is configured, in frontend/src/components/LocationPicker.jsx
- [X] T033 [US3] Integrate the coordinate picker into the job form and include the coordinate fields in the full save payload in frontend/src/pages/Jobs/JobForm.jsx
- [X] T034 [US3] Carry the coordinate fields through the inline job editor payload so saving there does not clear coordinates set elsewhere, in frontend/src/pages/Jobs/JobDocument.jsx
- [X] T035 [P] [US3] Display the exact-coordinates indicator distinguishing coordinate-backed jobs from address-only jobs in frontend/src/pages/Jobs/JobDetail.jsx
- [X] T036 [P] [US3] Surface validation messaging for uninterpretable input, out-of-range values and partial coordinate entry in frontend/src/components/LocationPicker.jsx

**Checkpoint**: Jobs can carry verified coordinates without regressing full-object job saves.

---

## Phase 6: User Story 4 - Navigate Using Job Coordinates on Mobile (Priority: P2)

**Goal**: Mobile navigation targets the job's exact coordinates when they exist and falls back to the text address when they do not.

**Independent Test**: Start navigation for a job with coordinates and confirm the exact point is targeted; repeat for a job without coordinates and confirm the address behavior is unchanged.

### Implementation for User Story 4

- [X] T037 [US4] Include `serviceLatitude` and `serviceLongitude` in the object returned by `getServiceContext` in backend/routes/packingLists.js
- [X] T038 [US4] Carry the coordinate keys through the cached service context reference in mobile/src/services/cacheService.ts
- [X] T039 [US4] Build the navigation destination from coordinates when present and fall back to the encoded address otherwise, in mobile/src/screens/PackingListScreen.tsx
- [X] T040 [US4] Show the Spanish operator indication of whether an exact location or a text address is in use in mobile/src/screens/PackingListScreen.tsx

**Checkpoint**: Crews route to verified coordinates when available.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, compliance and end-to-end validation across all stories.

- [X] T041 [P] Confirm the API contract matches the implemented request and response shapes in specs/007-packing-list-gps-location/contracts/packing-list-location-api.yaml
- [X] T042 Validate surface language policy: web and client-facing mobile EN/ES, operator-facing mobile Spanish, language-neutral backend values across frontend/src/i18n.jsx and mobile/src/screens
- [X] T043 Confirm coordinate and location changes appear in the existing audit snapshots without new audit call sites in backend/routes/jobs.js and backend/routes/packingLists.js
- [X] T044 Confirm location data adds no new access path and follows existing record gating in backend/routes/packingLists.js
- [X] T045 Run type and build validation for all changed surfaces: `npx tsc --noEmit` and `npx expo export --platform android` in mobile/, `node --check` on backend/routes/packingLists.js and backend/routes/jobs.js, and `npm run build` in frontend/
- [X] T046 Run the quickstart scenarios A–H and record outcomes in the results log in specs/007-packing-list-gps-location/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Stories (Phases 3–6)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all implemented user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. Independent of other stories.
- **US2 (P1)**: Depends on US1 producing serialized location data before it can be meaningfully verified, though the rendering work itself is separable.
- **US3 (P1)**: Starts after Foundational. Fully independent of US1 and US2.
- **US4 (P2)**: Depends on US3, because coordinates must exist before navigation can target them.

### Within Each Story

- Backend persistence and serialization before mobile send paths.
- Local schema and row types before screen capture wiring.
- Core mutation paths before validation messaging and accessibility polish.

## Parallel Opportunities

- Phase 1: T003 runs alongside T001–T002.
- Phase 2: T006, T007, T010, T011 and T012 touch different files and can run in parallel; T008 waits on T007.
- US1: T018 and T019 run in parallel after the backend tasks land.
- US2: T029 runs alongside T026–T028 once the indicator exists.
- US3: T035 and T036 run in parallel with T033–T034.
- Polish: T041 runs alongside T042–T044.
- With multiple developers, US1/US2 and US3/US4 form two independent tracks after Phase 2.

## Parallel Example: Phase 2

```bash
# After the schema is pushed (T004, T005):
T006  backend location parser and validator
T007  mobile SQLite additive columns
T010  mobile API payload types
T011  web coordinate parsing helper
T012  web EN/ES strings
```

## Parallel Example: User Story 3

```bash
# After the picker component exists (T032):
T035  exact-coordinates indicator on job detail
T036  coordinate validation messaging
```

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1).
4. Validate with quickstart Scenarios A, B and C.
5. Stage locations are being captured and stored; deploy or demo.

### Incremental Delivery

1. US1 — capture at every stage.
2. US2 — review those positions from the web.
3. US3 — job service coordinates.
4. US4 — coordinate-based mobile navigation.
5. Phase 7 — cross-cutting validation.

### Team Parallel Strategy

1. Everyone aligns on Phases 1–2.
2. Developer A: US1 then US2 (capture and review pipeline).
3. Developer B: US3 then US4 (job coordinates and navigation).
4. Developer C: web i18n, accessibility and polish tasks.

## Notes

- All schema changes are additive and nullable; no backfill and no destructive migration.
- Location capture must never block, delay or fail a lifecycle stage — this is the single most important invariant in the feature.
- Job updates must always send the full object; both job-saving surfaces must carry the coordinate fields or one will null out the other's data.
- Positions are immutable once confirmed; retries and idempotent replays must never overwrite them.
