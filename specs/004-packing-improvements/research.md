# Research: Packing Improvements

## Decision 1: Web deletion uses soft delete with explicit deleted marker
- Decision: Add a soft-delete mechanism for packing lists and exclude soft-deleted rows from active web queries.
- Rationale: The constitution requires auditability of material changes and preservation of history. Soft delete avoids destructive data loss and supports operational recovery.
- Alternatives considered:
  - Hard delete of packing list and child records: rejected because it breaks traceability and recovery.
  - Archive-only without delete intent: rejected because requirement explicitly asks for delete action in web workflow.

## Decision 2: Active-session persistence remains full-state debounced PUT
- Decision: Keep full-state debounced live-save for packages, items, and photo metadata during active sessions.
- Rationale: Current mobile implementation already builds a full payload and backend transactionally upserts package graph. This aligns with clarified requirement that web must not show 0 boxes after server save.
- Alternatives considered:
  - Completion-only persistence: rejected because web in-progress visibility fails.
  - Per-item incremental endpoints: rejected for this phase due to higher API and conflict complexity.

## Decision 3: Web count behavior during propagation lag
- Decision: Web shows last known server counts plus visible "Sync in progress" indicator while newer mobile changes are propagating.
- Rationale: Avoids misleading zero placeholders and communicates consistency delay explicitly.
- Alternatives considered:
  - Hide counts completely during sync: rejected because users lose operational visibility.
  - Show zero until sync completes: rejected because it recreates the observed issue.

## Decision 4: Completion state model is two-step (pending then closed)
- Decision: Introduce a local/device-facing locked state "Complete Pending Sync" and finalize to "Closed" on server confirmation.
- Rationale: Prevents workflow dead-ends when completion confirmation is delayed, while preserving an explicit server-confirmed final state.
- Alternatives considered:
  - Keep editable until server confirms: rejected due to risk of post-signature edits.
  - Mark closed instantly without confirmation distinction: rejected due to weak reliability semantics.

## Decision 5: Signature completion flow must be resilient to data-URL upload failures
- Decision: Treat signature capture/upload/complete as resumable finalization; retain completion intent and retry completion when network or upload step fails.
- Rationale: Current reported error "Network request failed" after signature indicates the current completion path can fail mid-flow and strand records.
- Alternatives considered:
  - Require immediate online success only: rejected because it blocks operations in unstable connectivity.
  - Skip signature upload on failure and close anyway: rejected because it violates sign-off expectations.

## Decision 6: Mobile home and create flows shift from open-files-first to packing-lists-first
- Decision: Home shows current packing lists as primary list with a clear action to start new list; file selection is a bounded step in creation flow.
- Rationale: Matches operator mental model and user request.
- Alternatives considered:
  - Keep open-files list as home and add a secondary packing section: rejected as less direct for daily packing tasks.

## Decision 7: Eligible file filtering is OPEN + category whitelist
- Decision: New list creation file selector includes only OPEN files in EXPORT, LOCAL, WAREHOUSE categories; IMPORT is excluded.
- Rationale: Explicit user requirement and existing moving-file cache already carries status and category for filtering.
- Alternatives considered:
  - Category-only filter: rejected because closed files would still appear.
  - Backend-only filtering with no local cache rules: rejected because offline behavior needs deterministic local filtering.

## Decision 8: Translation fix is centralized in i18n dictionaries
- Decision: Update tab label through translation keys in both EN and ES dictionaries; do not hardcode labels in components.
- Rationale: Constitution mandates bilingual-by-default and centralized localization.
- Alternatives considered:
  - Component-local string replacement: rejected because it bypasses i18n governance.
