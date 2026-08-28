# Tasks: Packing List 2.0 Operations

**Input**: Design documents from `/specs/006-packing-list-2-upgrade/`

**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: No mandatory automated TDD requirement was specified in the feature spec. Validation tasks below use the required quickstart scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding, shared enums/types, and migration placeholders.

- [X] T001 Create feature branch documentation stubs in specs/006-packing-list-2-upgrade/plan.md
- [X] T002 Define new domain enums and status constants for workday events in frontend/src/constants.js
- [X] T003 [P] Add bilingual web labels for new workday/barcode states in frontend/src/i18n.jsx
- [X] T004 [P] Add mobile API type scaffolding for workday and barcode flows in mobile/src/services/api.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared data model, API contract integration points, and sync foundations required by all stories.

**CRITICAL**: No user story implementation starts before this phase completes.

- [X] T005 Add Prisma schema fields/models for workday events and dual signatures in backend/prisma/schema.prisma
- [X] T006 Add SQLite schema extensions for workday events and barcode state in mobile/src/db/schema.ts
- [X] T007 Implement SQLite queries for workday events/signature pairs/barcode readiness in mobile/src/db/queries.ts
- [X] T008 [P] Extend backend packing list serializers for workday history and barcode completeness in backend/routes/packingLists.js
- [X] T009 [P] Add mobile cache reconciliation support for workday event pulls in mobile/src/services/cacheService.ts
- [X] T010 Implement shared completion gate utility for missing barcodes in backend/routes/packingLists.js
- [X] T011 Add API client methods for workday events and barcode assignment in mobile/src/services/api.ts
- [X] T012 Wire live sync primitives for new workday event payloads in mobile/src/hooks/useLiveSync.ts

**Checkpoint**: Foundation complete. User stories can now proceed.

---

## Phase 3: User Story 1 - Multi-Day Dual-Signature Workflows (Priority: P1) 🎯 MVP

**Goal**: Operators can execute repeated workdays with required client and crew-leader signatures at day boundaries.

**Independent Test**: Start day 1, close day 1, start day 2 with dual signatures each time, and verify per-day ordered history.

### Implementation for User Story 1

- [X] T013 [US1] Add backend endpoint handler for `POST /packing-lists/:id/workday-events` in backend/routes/packingLists.js
- [X] T014 [US1] Enforce dual-signature validation and idempotency for day events in backend/routes/packingLists.js
- [X] T015 [US1] Persist day-start/day-close events and actor metadata in backend/routes/packingLists.js
- [X] T016 [P] [US1] Add mobile workday-event submit and retry orchestration in mobile/src/hooks/useLiveSync.ts
- [X] T017 [P] [US1] Add local pending/confirmed workday event storage transitions in mobile/src/db/queries.ts
- [X] T018 [US1] Implement crew-leader signature capture UI for day boundaries in mobile/src/screens/ArrivalAcknowledgementScreen.tsx
- [X] T019 [US1] Add day timeline grouping and rendering in mobile/src/screens/PackingListScreen.tsx
- [X] T020 [US1] Surface synchronized day history details in web packing list views in frontend/src/pages

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Final-Day Completion Rules (Priority: P1)

**Goal**: Final completion skips separate day-close signature while keeping final completion survey/signoff requirements.

**Independent Test**: Complete a last-day flow without day-close signature and verify survey appears only at completion.

### Implementation for User Story 2

- [X] T021 [US2] Update completion workflow rules and final-day branching in backend/routes/packingLists.js
- [X] T022 [US2] Restrict satisfaction capture to final completion events in backend/routes/packingLists.js
- [X] T023 [US2] Update completion payload validation and event sequencing in mobile/src/services/api.ts
- [X] T024 [US2] Adjust completion orchestration to bypass non-final day-close signature on final day in mobile/src/screens/SignatureScreen.tsx
- [X] T025 [US2] Ensure survey visibility only in final completion client-facing flow in mobile/src/screens/SignatureScreen.tsx
- [X] T026 [US2] Render final-day terminal event semantics in timeline history in mobile/src/screens/PackingListScreen.tsx

**Checkpoint**: US2 independently functional and testable.

---

## Phase 5: User Story 3 - Edit Box Contents (Priority: P1)

**Goal**: Operators can edit existing box item type, quantity, and observations.

**Independent Test**: Edit an existing box item and verify persisted updates in detail and summary views.

### Implementation for User Story 3

- [X] T027 [US3] Add backend full-object update handling for edited package items in backend/routes/packingLists.js
- [X] T028 [US3] Add item edit mutation queries with validation safeguards in mobile/src/db/queries.ts
- [X] T029 [US3] Add editable item form state and save flow in mobile/src/screens/PackageDetailScreen.tsx
- [X] T030 [P] [US3] Add quantity/type/observation validation messaging in mobile/src/screens/PackageDetailScreen.tsx
- [X] T031 [US3] Refresh box previews after item edit synchronization in mobile/src/screens/PackingListScreen.tsx
- [X] T032 [US3] Add stale-update reconciliation for edited items during server refresh in mobile/src/services/cacheService.ts

**Checkpoint**: US3 independently functional and testable.

---

## Phase 6: User Story 4 - Deferred Barcode Assignment and Completion Gate (Priority: P1)

**Goal**: Operators can create boxes without barcode, assign later, and are blocked from completion until all barcodes are assigned.

**Independent Test**: Create barcode-missing boxes, assign later, and confirm completion is blocked until all boxes are resolved.

### Implementation for User Story 4

- [X] T033 [US4] Allow package creation with nullable barcode in backend/routes/packingLists.js
- [X] T034 [US4] Add barcode assignment endpoint handler `PATCH /packing-lists/:id/packages/:packageId/barcode` in backend/routes/packingLists.js
- [X] T035 [US4] Enforce per-list barcode uniqueness and missing-barcode completion gate in backend/routes/packingLists.js
- [X] T036 [US4] Add SQLite barcode-state persistence and selectors in mobile/src/db/queries.ts
- [X] T037 [US4] Add create-box-without-scan flow in mobile/src/screens/ScanScreen.tsx
- [X] T038 [US4] Add late barcode scan/assignment action from box detail in mobile/src/screens/PackageDetailScreen.tsx
- [X] T039 [US4] Display missing-barcode indicators in package cards and detail headers in mobile/src/screens/PackingListScreen.tsx
- [X] T040 [US4] Block final completion with actionable Spanish guidance for unresolved boxes in mobile/src/screens/SignatureScreen.tsx

**Checkpoint**: US4 independently functional and testable.

---

## Phase 7: User Story 5 - Future Logistics Action Placeholders (Priority: P3)

**Goal**: Show reserved, non-operational actions for future truck/warehouse workflows.

**Independent Test**: Open action area, see all placeholders, select each and verify no operational data changes.

### Implementation for User Story 5

- [X] T041 [US5] Add placeholder action definitions for truck/warehouse flow in frontend/src/constants.js
- [X] T042 [P] [US5] Add mobile Spanish labels and unavailable-state copy for placeholders in mobile/src/screens/PackingListScreen.tsx
- [X] T043 [P] [US5] Add web EN/ES placeholder labels in frontend/src/i18n.jsx
- [X] T044 [US5] Implement non-mutating placeholder interaction handlers in mobile/src/screens/PackingListScreen.tsx

**Checkpoint**: US5 independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, consistency, and end-to-end validation across all stories.

- [X] T045 [P] Update API contract documentation for implemented endpoints in specs/006-packing-list-2-upgrade/contracts/packing-list-2-workday-api.yaml
- [X] T046 Validate language policy surface compliance in mobile/src/screens and frontend/src/i18n.jsx
- [X] T047 Validate role-gated access behavior for new backend mutations in backend/routes/packingLists.js
- [ ] T048 Run full quickstart scenarios and record results in specs/006-packing-list-2-upgrade/quickstart.md
- [ ] T049 Run schema and client regeneration steps for Prisma changes in backend/prisma/schema.prisma
- [X] T050 Run type/build validation for mobile and backend changed surfaces in mobile/src and backend/routes/packingLists.js

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup completion; blocks all user stories.
- User Stories (Phases 3-7): Depend on Foundational completion.
- Polish (Phase 8): Depends on all selected user stories being complete.

### User Story Dependencies

- US1 (P1): Starts after Foundational; no dependency on other stories.
- US2 (P1): Depends on US1 day-event model and shared signature data paths.
- US3 (P1): Starts after Foundational; independent from US1/US2 behavior.
- US4 (P1): Depends on Foundational and package-edit baselines; can run alongside late US3 tasks.
- US5 (P3): Starts after Foundational; functionally independent and non-operational.

### Within Story Order

- Backend contract + persistence changes before mobile submit flows.
- Data/query updates before screen integration.
- State validation and user guidance after core mutation paths are functional.

## Parallel Opportunities

- Phase 1: T003 and T004 in parallel.
- Phase 2: T008 and T009 in parallel.
- US1: T016 and T017 in parallel after T013-T015.
- US3: T030 can run in parallel with T029 once query support exists.
- US5: T042 and T043 in parallel.
- Polish: T045 can run in parallel with T046/T047.

## Parallel Example: User Story 1

```bash
# After backend day-event persistence is in place:
T016 [US1] mobile workday-event sync orchestration
T017 [US1] local pending/confirmed event storage transitions
```

## Parallel Example: User Story 4

```bash
# After barcode state persistence primitives are available:
T038 [US4] late barcode assignment action in box detail
T039 [US4] missing-barcode indicators in package cards
```

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1).
4. Validate multi-day dual-signature history end-to-end.

### Incremental Delivery

1. Deliver US1 multi-day dual signatures.
2. Add US2 final-day completion behavior.
3. Add US3 box content editing.
4. Add US4 deferred barcode + completion gate.
5. Add US5 placeholders.
6. Finish with Phase 8 cross-cutting validation.

### Team Parallel Strategy

1. Team aligns on Phase 1-2 foundations.
2. Developer A: US1 + US2 flow.
3. Developer B: US3 + US4 box workflows.
4. Developer C: Web/i18n + placeholder action surfacing + polish tasks.

## Notes

- All task descriptions include concrete file paths.
- [P] tasks are selected only where file/dependency separation supports safe parallelization.
- Full-object update semantics must be preserved on all PUT/PATCH integrations.
- No destructive migration path is assumed; schema updates should be additive/forward-safe.
