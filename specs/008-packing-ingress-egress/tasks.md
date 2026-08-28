# Tasks: Packing List Ingress & Egress Box Scanning

**Input**: Design documents from `/specs/008-packing-ingress-egress/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ingress-egress-api.md](./contracts/ingress-egress-api.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested in the spec; no automated test framework exists in this repo today. Validation is manual via [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story (US1–US6, matching spec.md priorities P1/P1/P1/P2/P3/P2) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependency)
- **[Story]**: Maps to US1–US6 from spec.md
- Domain note: the new operation `type` enum uses `INGRESS_TRUCK` / `INGRESS_WAREHOUSE` / `EGRESS_WAREHOUSE` (per data-model.md); the existing options-menu action id `EXTRACT_WAREHOUSE` (frontend/src/constants.js, mobile menu) triggers creating/resuming an `EGRESS_WAREHOUSE` operation — the UI action id is left as-is to avoid touching unrelated existing constants.

## Path Conventions

Existing 3-surface layout (see plan.md): `backend/`, `frontend/`, `mobile/` at repository root.

---

## Phase 1: Setup

**Purpose**: Add the new persisted schema this whole feature depends on.

- [X] T001 Add `PackingIngressEgressOperation` and `PackingIngressEgressBoxScan` models (with `PackingList.ingressEgressOperations` and `Package.ingressEgressScans` back-relations) to `backend/prisma/schema.prisma`, per [data-model.md](./data-model.md)
- [X] T002 Run `npx prisma db push` and `npx prisma generate` from `backend/` to apply the schema change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared wiring every user story needs before real behavior can be added

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Add shared helpers to `backend/routes/packingLists.js`: `resolvePackageByCode(packingListId, code)` (returns the matching package, a `DIFFERENT_LIST` indicator, or not-found), `serializeIngressEgressOperation(operation)` (boxes, signatures via `getDownloadUrl`, location via existing `serializeStageLocation`, warehouseLocation, observations)
- [X] T004 [P] Add local SQLite tables `ingress_egress_operations` and `ingress_egress_box_scans` (mirroring data-model.md, with `server_id`/`sync_state`/`sync_error` columns and `ON DELETE CASCADE`) in `mobile/src/db/schema.ts`
- [X] T005 [P] Add `IngressEgress` and `IngressEgressSignature` route param types (packingListLocalId, serverId, operationType) to `mobile/src/navigation/types.ts`
- [X] T006 [P] Add operation type/status/role metadata (`INGRESS_TRUCK`, `INGRESS_WAREHOUSE`, `EGRESS_WAREHOUSE`, `CHECKED`/`UNCHECKED`, `CREW_LEADER`/`WAREHOUSE_MANAGER`) to `frontend/src/constants.js`
- [X] T007 Mount an `/:id/ingress-egress` sub-route group in `backend/routes/packingLists.js` (empty handlers acceptable at this stage; real handlers added per story below)

**Checkpoint**: Schema, local tables, navigation types, and route skeleton exist — user story implementation can now begin.

---

## Phase 3: User Story 1 - Scan All Boxes for an Ingress or Egress Operation (Priority: P1) 🎯 MVP

**Goal**: Crew leader starts/resumes an ingress/egress operation, sees a live Box 1..N checklist, checks boxes by camera scan, gets a clear rejection for unknown codes and a distinct warning for boxes from a different packing list, and progress survives app restarts and can be reset.

**Independent Test**: Start an operation on a multi-box list, scan a subset, background/restart the app, confirm state persists; scan an unrelated and a cross-list code and confirm distinct rejections; reset and confirm the checklist returns to zero.

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `POST /:id/ingress-egress` (start-or-resume, idempotency-keyed, gated on the packing list's completed state per FR-002) in `backend/routes/packingLists.js`
- [X] T009 [P] [US1] Implement `POST /:id/ingress-egress/:operationId/scans` (resolve via `resolvePackageByCode`, return `404 NOT_FOUND` / `409 DIFFERENT_LIST` / no-op-on-already-checked, idempotency-keyed) in `backend/routes/packingLists.js`
- [X] T010 [US1] Implement `POST /:id/ingress-egress/:operationId/reset` (clears box scans, warehouseLocation, observations, signatures, location; only while not `COMPLETE`) in `backend/routes/packingLists.js` (depends on T008)
- [X] T011 [US1] Implement `GET /:id/ingress-egress` (list operations, minimally serialized for resume) in `backend/routes/packingLists.js` (depends on T008, T009)
- [X] T012 [P] [US1] Add local query helpers in `mobile/src/db/queries.ts`: `startOrResumeIngressEgressOperation`, `getIngressEgressOperation`, `upsertIngressEgressBoxScan`, `resetIngressEgressOperation`
- [X] T013 [P] [US1] Add client methods in `mobile/src/services/api.ts`: `startIngressEgressOperation`, `scanIngressEgressBox`, `resetIngressEgressOperation`, `getIngressEgressOperations`
- [X] T014 [US1] Create `mobile/src/screens/IngressEgressScreen.tsx`: Box 1..N checklist with clear checked/unchecked state, camera scanner (reuse the `expo-camera` pattern from `mobile/src/screens/ScanScreen.tsx`), reset action, distinct alerts for not-found vs. different-packing-list codes (depends on T012, T013)
- [X] T015 [US1] Wire the packing list options menu (`INGRESS_TRUCK`, `INGRESS_WAREHOUSE`, `EXTRACT_WAREHOUSE` entries) in `mobile/src/screens/PackingListScreen.tsx` to navigate to `IngressEgressScreen`, only enabled when the list is in its completed state (depends on T014)
- [X] T016 [US1] Add offline retry/sync of pending start/scan/reset actions to `mobile/src/services/cacheService.ts`, following the existing `retryPendingWorkdayEvents` pattern (depends on T012, T013)

**Checkpoint**: User Story 1 is fully functional and independently testable — checklist, resume, reset, and cross-list detection all work online and offline.

---

## Phase 4: User Story 2 - Block Completion When Boxes Are Missing (Priority: P1)

**Goal**: Attempting to complete an operation with unscanned boxes is blocked with a specific, itemized warning (and an explicit truck-departure warning for `INGRESS_TRUCK`).

**Independent Test**: Attempt to complete with boxes missing and confirm the app blocks with the missing box numbers listed; scan the rest and confirm completion becomes reachable.

### Implementation for User Story 2

- [X] T017 [US2] Add the missing-boxes gate (`409 BOXES_MISSING` with `missingBoxNumbers`) shared by the completion path, to be consumed by the sign endpoint in Phase 5, in `backend/routes/packingLists.js` (depends on T009)
- [X] T018 [US2] Add a "complete" action in `mobile/src/screens/IngressEgressScreen.tsx` that checks local checklist completeness before navigating onward, showing the missing box numbers and, for `INGRESS_TRUCK`, an explicit "truck must not depart" warning (depends on T014)

**Checkpoint**: Completion is provably blocked while any box remains unchecked, for both the API and the mobile UI.

---

## Phase 5: User Story 3 - Capture Required Signatures and Location on Completion (Priority: P1)

**Goal**: Crew leader signs to finalize truck-ingress operations; warehouse operations additionally require a warehouse-manager signature; exactly one GPS location is captured on the call that finalizes the operation; optional observations can be recorded.

**Independent Test**: Complete a truck-ingress operation with one signature and one location; complete a warehouse operation and confirm it requires both signatures before finalizing, with exactly one shared location.

### Implementation for User Story 3

- [X] T019 [P] [US3] Implement `POST /:id/ingress-egress/:operationId/sign` in `backend/routes/packingLists.js`: enforces the T017 boxes-missing gate, role validation (`409 ROLE_NOT_APPLICABLE` for `WAREHOUSE_MANAGER` on `INGRESS_TRUCK`), signing order (`409 WRONG_ORDER`), persists observations, and captures location only on the call that transitions the operation to `COMPLETE` (depends on T017)
- [X] T020 [P] [US3] Add `signIngressEgressOperation` client method to `mobile/src/services/api.ts`
- [X] T021 [US3] Create `mobile/src/screens/IngressEgressSignatureScreen.tsx`: crew leader signature (reuse the `SignatureCanvas` pattern from `mobile/src/screens/SignatureScreen.tsx`), conditional warehouse-manager signature step for warehouse types, single `captureStageLocation()` call on the finalizing signature, observations text input, pending-signature indicator (depends on T020)
- [X] T022 [US3] Wire navigation from the Phase 4 "complete" action to `IngressEgressSignatureScreen` (depends on T018, T021)
- [X] T023 [US3] Add offline retry/sync of pending signatures to `mobile/src/services/cacheService.ts` (depends on T021)

**Checkpoint**: Operations can be fully signed and completed end-to-end, online and offline, with the correct signature count per type and a single shared completion location.

---

## Phase 6: User Story 4 - Manually Enter a Box Code When the Scanner Is Unavailable (Priority: P2)

**Goal**: A box can be checked by typing its code when the camera scanner cannot be used.

**Independent Test**: Manually enter a valid box code and confirm it checks the box exactly like a camera scan; enter an invalid code and confirm rejection.

### Implementation for User Story 4

- [X] T024 [US4] Add a manual-entry input (modal or inline field) to `mobile/src/screens/IngressEgressScreen.tsx`, submitting through the same scan flow as camera scans with `scanMethod: 'MANUAL'` (depends on T014)

**Checkpoint**: Crew leader can check any box without the camera, with identical validation behavior to camera scans.

---

## Phase 7: User Story 6 - Record Where Boxes Are Stored or Retrieved in the Warehouse (Priority: P2)

**Goal**: Warehouse ingress/egress operations can carry an optional free-text warehouse storage location; truck ingress does not offer the field.

**Independent Test**: Enter a warehouse location on a warehouse operation and confirm it saves and displays; confirm the field is absent for truck ingress.

### Implementation for User Story 6

- [X] T025 [US6] Add a `warehouseLocation` text field to `mobile/src/screens/IngressEgressScreen.tsx` (or `IngressEgressSignatureScreen.tsx`), shown only when the operation type is `INGRESS_WAREHOUSE`/`EGRESS_WAREHOUSE` (depends on T014)
- [X] T026 [US6] Reject/ignore a non-empty `warehouseLocation` for `INGRESS_TRUCK` operations in the scan and sign endpoints of `backend/routes/packingLists.js` (depends on T009, T019)

**Checkpoint**: Warehouse operations can record a storage location; truck ingress cannot.

---

## Phase 8: User Story 5 - Review Ingress/Egress History in the Mobile App and Web (Priority: P3)

**Goal**: Completed (and in-progress) ingress/egress operations, with their boxes, signatures, location, observations, and warehouse location, are visible in both the mobile app and the web application.

**Independent Test**: Complete a truck ingress and a warehouse egress on the same list, then confirm both are visible with full detail in the app history view and in the web `PackingListsPanel`.

### Implementation for User Story 5

- [X] T027 [P] [US5] Complete full serialization (boxes, both signatures via `getDownloadUrl`, location, warehouseLocation, observations, status) in the `GET /:id/ingress-egress` endpoint of `backend/routes/packingLists.js` (depends on T011, T019, T026)
- [X] T028 [P] [US5] Add a history view/section in the mobile app (e.g., within `mobile/src/screens/PackingListScreen.tsx`) listing completed/in-progress operations with type, timestamp, actor(s), and status (depends on T027)
- [X] T029 [US5] Add an "Ingress/Egress History" section to `frontend/src/pages/Files/PackingListsPanel.jsx`, reusing its existing `LocationIndicator` and signature-image-link patterns (depends on T027)
- [X] T030 [P] [US5] Add EN/ES strings for operation types, statuses, roles, and history labels to `frontend/src/i18n.jsx` (depends on T029)

**Checkpoint**: All ingress/egress operation history is visible and fully detailed in both the mobile app and the web application.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and validation pass across all stories

- [X] T031 [P] Review all new operator-facing mobile copy in `mobile/src/screens/IngressEgressScreen.tsx` and `mobile/src/screens/IngressEgressSignatureScreen.tsx` for Spanish-only consistency with existing operator screens
- [ ] T032 [P] Run [quickstart.md](./quickstart.md) scenarios 1–4 end-to-end (truck ingress, warehouse ingress with dual signature, manual entry, resume/reset/offline) and record results
- [ ] T033 Verify idempotency-key replay safety for start/scan/reset/sign endpoints (call each twice with the same key; confirm no duplicate rows and identical response)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** blocks **Foundational (Phase 2)** blocks all user stories.
- **US1 (Phase 3)** must complete before **US2 (Phase 4)**, which must complete before **US3 (Phase 5)** — each builds on the previous phase's endpoints/screens (checklist → completion gate → signatures).
- **US4 (Phase 6)** and **US6 (Phase 7)** depend only on US1's `IngressEgressScreen.tsx` (T014) and, for US6's backend gate, on US3's sign endpoint (T019) — both can start once Phase 5 is done, and can proceed in parallel with each other.
- **US5 (Phase 8)** depends on data produced by US1/US2/US3/US6 (T011, T019, T026) and is otherwise independent — it can be built incrementally as those land, but full serialization (T027) needs all of them present.
- **Polish (Phase 9)** runs last.

## Parallel Execution Examples

- Phase 2: T003, T004, T005, T006 can all run in parallel (different files).
- Phase 3: T008 and T009 (different endpoints, same file but non-overlapping handlers) can be drafted in parallel; T012 and T013 (mobile db vs. api client) can run in parallel.
- Phase 5: T019 (backend) and T020 (mobile api client) can run in parallel before T021 consumes both.
- Phase 8: T027 (backend serialization) can run in parallel with drafting T028/T029 UI shells, though final wiring depends on T027 being done.

## Implementation Strategy

**MVP first**: Complete Phases 1–5 (Setup → Foundational → US1 → US2 → US3). This delivers the full safety-critical loop — start/resume an operation, scan every box, block completion on missing boxes, and finalize with the correct signature(s) and a single location — for all three operation types, satisfying the feature's core motivation (no truck departs, no warehouse movement confirmed, with unaccounted boxes).

**Incremental delivery after MVP**: Add US4 (manual entry fallback) and US6 (warehouse location) in either order, then US5 (history in app/web) once there is completed-operation data to show. Each phase is independently shippable and testable per its Independent Test above.
