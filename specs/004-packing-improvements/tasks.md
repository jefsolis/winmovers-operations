# Tasks: Packing Improvements

**Input**: Design documents from `/specs/004-packing-improvements/`
**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required), [research.md](research.md), [data-model.md](data-model.md), [contracts/packing-lists-api.yaml](contracts/packing-lists-api.yaml), [quickstart.md](quickstart.md)

**Tests**: Automated test tasks are not included because the specification does not explicitly request TDD or new automated suites; validation is driven by quickstart scenarios.

**Organization**: Tasks are grouped by user story for independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align existing modules and contracts for the packing improvements implementation.

- [X] T001 Update feature contract details in `specs/004-packing-improvements/contracts/packing-lists-api.yaml` to match final implementation signatures used by backend and mobile.
- [X] T002 Update feature validation flow references in `specs/004-packing-improvements/quickstart.md` with exact status labels used by implementation (`COMPLETE_PENDING_SYNC`, `CLOSED`, sync indicator wording).
- [X] T003 [P] Add implementation notes for packing-improvements rollout in `docs/BACKLOG.md` (scope, migration/order, rollback notes).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data and API primitives required before user-story work.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T004 Extend `PackingList` model with soft-delete and completion-language fields in `backend/prisma/schema.prisma` (`deletedAt`, `deletedBy`, `reviewLanguage`, completion timestamps/metadata as needed).
- [X] T005 Run schema sync and client regeneration for updated packing fields from `backend/prisma/schema.prisma` (`backend/` prisma db push + prisma generate).
- [X] T006 [P] Update backend packing DTO shaping and enum/state handling in `backend/routes/packingLists.js` for `ACTIVE`, `COMPLETE_PENDING_SYNC`, `CLOSED`, `ERROR`.
- [X] T007 [P] Extend mobile local state model for pending completion and review language in `mobile/src/db/queries.ts` and `mobile/src/db/schema.ts`.
- [X] T008 [P] Update mobile API types for completion and summary state fields in `mobile/src/services/api.ts`.
- [X] T009 Add reusable packing sync-state badge helper for web panel rendering in `frontend/src/pages/Files/PackingListsPanel.jsx`.

**Checkpoint**: Data model, mobile local model, and API state model are aligned.

---

## Phase 3: User Story 1 - Manage Packing Lists in Web (Priority: P1) 🎯 MVP

**Goal**: Allow safe packing-list deletion in web and correct Spanish label text.

**Independent Test**: Delete a packing list from web and confirm it disappears from active views; switch to Spanish and confirm "Lista de empaque" label.

- [X] T010 [US1] Implement soft-delete endpoint behavior for packing lists in `backend/routes/packingLists.js` (`PATCH /packing-lists/:id/soft-delete`) with `logAudit` tracking.
- [X] T011 [US1] Exclude soft-deleted packing lists from summary/detail list queries in `backend/routes/packingLists.js`.
- [X] T012 [P] [US1] Add deletion action UI with confirmation and API call in `frontend/src/pages/Files/PackingListsPanel.jsx`.
- [X] T013 [P] [US1] Add delete/soft-delete translation keys in both language maps in `frontend/src/i18n.jsx`.
- [X] T014 [US1] Fix Spanish packing tab label text to "Lista de empaque" in `frontend/src/i18n.jsx` and consume key in `frontend/src/components/Layout.jsx` if needed.
- [X] T015 [US1] Show delete result/error feedback and refresh active list state in `frontend/src/pages/Files/PackingListsPanel.jsx`.

**Checkpoint**: Web users can soft-delete packing lists and Spanish label is corrected.

---

## Phase 4: User Story 2 - Start Packing from Mobile Home (Priority: P1)

**Goal**: Mobile home becomes packing-list-first and new list creation uses only eligible open files.

**Independent Test**: Home shows current packing lists; tapping new list allows only OPEN EXPORT/LOCAL/WAREHOUSE files and excludes IMPORT.

- [X] T016 [US2] Add query to load current packing lists for home feed in `mobile/src/db/queries.ts`.
- [X] T017 [US2] Replace open-files-first home list with current packing lists plus explicit new-list action in `mobile/src/screens/HomeScreen.tsx`.
- [X] T018 [P] [US2] Update moving-file cache refresh to enforce OPEN + category whitelist filtering in `mobile/src/services/cacheService.ts`.
- [X] T019 [US2] Enforce eligible file filtering and empty-eligible-state messaging in `mobile/src/screens/NewPackingListScreen.tsx`.
- [X] T020 [US2] Ensure create-flow navigation from home to new-list and resume behavior for existing active lists in `mobile/src/screens/HomeScreen.tsx`.
- [X] T021 [US2] Add/adjust mobile copy for new home and eligibility errors in `mobile/src/screens/HomeScreen.tsx` and `mobile/src/screens/NewPackingListScreen.tsx`.

**Checkpoint**: Mobile operators can start work from packing lists and create new lists only from eligible files.

---

## Phase 5: User Story 3 - Complete and Sign Off Reliably (Priority: P1)

**Goal**: Completion asks review language, survives intermittent network, and preserves package/item/photo/signature consistency while fixing the close failure path.

**Independent Test**: Complete list with selected language and signature under unstable connectivity; list enters `COMPLETE_PENDING_SYNC` then transitions to `CLOSED` automatically, with intact counts/media in web.

- [X] T022 [US3] Accept and persist completion review language and pending/closed transitions in `backend/routes/packingLists.js`.
- [X] T023 [US3] Return web summary fields for reliable counts and sync-visibility state from `backend/routes/packingLists.js` (`packageCount`, `itemCount`, `photoCount`, `syncVisibilityState`).
- [X] T024 [P] [US3] Add language-selection prompt before signature finalization in `mobile/src/screens/SignatureScreen.tsx`.
- [X] T025 [US3] Update completion API payload and call path for review language and pending completion semantics in `mobile/src/services/api.ts` and `mobile/src/screens/SignatureScreen.tsx`.
- [X] T026 [US3] Remove hard failure path that blocks completion on transient network and persist local completion intent in `mobile/src/screens/SignatureScreen.tsx` and `mobile/src/db/queries.ts`.
- [X] T027 [US3] Implement automatic retry to promote `COMPLETE_PENDING_SYNC` to `CLOSED` on reconnect in `mobile/src/hooks/useLiveSync.ts`.
- [X] T028 [P] [US3] Ensure package/item/photo save payload always includes current authoritative graph in `mobile/src/hooks/useLiveSync.ts`.
- [X] T029 [US3] Fix server-side reconciliation of package/item/photo rows to prevent web "0 boxes" regressions in `backend/routes/packingLists.js`.
- [X] T030 [US3] Show last known counts with visible sync-in-progress state in web packing panel in `frontend/src/pages/Files/PackingListsPanel.jsx`.
- [X] T031 [US3] Harden lock and edit-protection rules for `COMPLETE_PENDING_SYNC` and `CLOSED` in `backend/routes/packingLists.js` and `mobile/src/screens/PackingListScreen.tsx`.

**Checkpoint**: Completion is resilient, language-aware, and synchronization remains consistent across mobile/web.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, docs, and end-to-end validation across all stories.

- [X] T032 [P] Add explicit audit coverage for soft-delete and completion lifecycle transitions in `backend/routes/packingLists.js` and `backend/audit.js`.
- [X] T033 [P] Add user-facing error normalization for sync failures (`Network request failed` and lock conflicts) in `mobile/src/screens/SignatureScreen.tsx` and `mobile/src/hooks/useLiveSync.ts`.
- [X] T034 [P] Align bilingual web and mobile wording for packing improvements in `frontend/src/i18n.jsx` and mobile screen text in `mobile/src/screens/HomeScreen.tsx` and `mobile/src/screens/SignatureScreen.tsx`.
- [X] T035 Run full scenario validation from `specs/004-packing-improvements/quickstart.md` and record implementation notes in `specs/004-packing-improvements/plan.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2.
- **Phase 5 (US3)**: Depends on Phase 2 and integrates with US2 mobile flow; can begin once US2 creates/opens lists correctly.
- **Phase 6 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational.
- **US2 (P1)**: Independent after Foundational.
- **US3 (P1)**: Depends on foundational sync primitives and list creation flow from US2.

### User Story Completion Order

1. US1 and US2 can proceed in parallel after Phase 2.
2. US3 follows once US2 flow is stable (or in partial parallel after T019/T020 are complete).
3. Polish after all implemented stories.

---

## Parallel Execution Examples

### Parallel Example: User Story 1

- T012 [P] [US1] in `frontend/src/pages/Files/PackingListsPanel.jsx`
- T013 [P] [US1] in `frontend/src/i18n.jsx`

### Parallel Example: User Story 2

- T018 [P] [US2] in `mobile/src/services/cacheService.ts`
- T017 [US2] in `mobile/src/screens/HomeScreen.tsx` can proceed after T016 starts

### Parallel Example: User Story 3

- T024 [P] [US3] in `mobile/src/screens/SignatureScreen.tsx`
- T028 [P] [US3] in `mobile/src/hooks/useLiveSync.ts`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) only.
3. Validate independent test for web delete + Spanish label.
4. Demo/release MVP increment.

### Incremental Delivery

1. Setup + Foundational.
2. Deliver US1 (web control + localization).
3. Deliver US2 (mobile home/create flow).
4. Deliver US3 (reliable completion + sync integrity).
5. Finish with Polish and full quickstart validation.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. Split after foundation:
   - Developer A: US1 web/API delete flow.
   - Developer B: US2 mobile home/create flow.
   - Developer C: US3 completion/sync reliability.
3. Rejoin for Phase 6 hardening and scenario validation.

---

## Notes

- [P] tasks operate on separate files/components and can run in parallel.
- All user-story tasks include `[USx]` labels for traceability.
- Keep update payloads full-object where backend update handlers destructure request bodies.
- Preserve route ordering and existing auth/access middleware behavior.
