# Quickstart: Validate Packing Improvements

## Purpose
Validate the packing improvements end-to-end across web and mobile for deletion behavior, localization, synchronization integrity, and completion reliability.

## Prerequisites
- Backend running and connected to PostgreSQL.
- Frontend web app running.
- Mobile app running in Expo with authenticated user.
- At least one OPEN moving file in EXPORT/LOCAL/WAREHOUSE and one OPEN moving file in IMPORT.
- Azure Blob configuration available for photo/signature upload tests.

## Setup
1. Start backend and frontend from repository root.
2. Start mobile app from mobile workspace.
3. Ensure item type cache can be refreshed from backend.
4. Ensure test user has BODEGA access to packing endpoints.

## Validation Scenarios

### Scenario 1: Spanish tab label fix
1. Open web app and switch language to Spanish.
2. Navigate to file section containing packing panel.
3. Verify tab/label text appears as Lista de empaque.
Expected:
- No legacy label inconsistencies.

### Scenario 2: Mobile home shows packing lists as primary view
1. Open mobile home screen.
2. Verify current packing lists appear as primary list content.
3. Verify there is an explicit action to create a new packing list.
Expected:
- Home is packing-list-first, not open-files-first.

### Scenario 3: New list file selection filter
1. Tap new packing list action.
2. Inspect selectable file list.
3. Verify only OPEN EXPORT/LOCAL/WAREHOUSE files are selectable.
4. Verify OPEN IMPORT files are excluded.
Expected:
- Filter is deterministic and consistent online/offline from cache.

### Scenario 4: Live-save avoids 0-boxes web issue
1. Create or open an ACTIVE packing list in mobile.
2. Add 2 packages with multiple items and at least 1 photo each.
3. Open related moving file in web packing panel.
4. Observe package and item counts.
Expected:
- Counts reflect server state within 10 seconds under stable connectivity.
- During propagation lag, web shows last known counts and a visible Sync in progress indicator.
- Web does not show misleading 0 boxes after server save.

### Scenario 5: Complete flow with language prompt and signature
1. In mobile, tap Complete on an ACTIVE list.
2. Verify language selection prompt appears before client review/signature.
3. Choose EN and complete with signature.
Expected:
- Review content renders in selected language.
- List enters COMPLETE_PENDING_SYNC when confirmation is delayed.
- List transitions to CLOSED after server confirmation.

### Scenario 6: Completion retry after temporary failure
1. Begin completion and force network interruption after signature capture.
2. Confirm app does not lose completion intent or signature metadata.
3. Restore connectivity.
Expected:
- Automatic retry occurs.
- Status eventually transitions from COMPLETE_PENDING_SYNC to CLOSED.
- No manual data repair required.

### Scenario 7: Web soft delete
1. In web packing panel, delete a packing list.
2. Confirm prompt and execute deletion.
3. Refresh packing list view.
Expected:
- List is removed from active view.
- Audit/history remains available through audit log.
- Child package/item/photo data remains retained for traceability.

## Contract References
- API contracts: [contracts/packing-lists-api.yaml](contracts/packing-lists-api.yaml)
- Data model: [data-model.md](data-model.md)

## Completion Criteria
- All scenarios pass.
- No unresolved Network request failed in completion path.
- Synchronization acceptance metrics in spec are met.