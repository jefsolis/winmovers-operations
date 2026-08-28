# Quickstart Validation: Packing List 2.0 Operations

## Prerequisites

- Backend running on port 3001.
- Mobile app running with API base URL configured to backend.
- User account with existing packing-list permissions.
- At least one moving file available for packing-list operations.

## Setup

1. Start backend:

```powershell
Set-Location backend
npm run start:dev
```

2. Start mobile app:

```powershell
Set-Location mobile
npx expo start --port 8081 --clear
```

3. Confirm API and app connectivity by opening the packing-list home and loading at least one list.

## Validation Scenarios

### Scenario A: Multi-day dual-signature cycle

1. Create or open an active packing list.
2. Start day 1 (Traveling -> Working boundary path) and complete required client + crew-leader signatures.
3. Close day 1 as non-final and complete required client + crew-leader signatures.
4. Start day 2 and complete required dual signatures again.
5. Verify history shows day 1 start, day 1 close, day 2 start in order.

Expected outcome:

- Each day boundary requires both signatures.
- Duplicate taps/retries do not create duplicate confirmed history events.

### Scenario B: Final-day completion flow

1. Continue on the same list and mark final-day completion.
2. Confirm workflow does not require a separate day-close signature event first.
3. Confirm satisfaction survey appears in this final completion flow.
4. Confirm list reaches completed state.

Expected outcome:

- Survey appears only at final completion.
- Completed state is terminal for operational edits.

### Scenario C: Box-content editing

1. Open a box with at least one item.
2. Edit item type, quantity, and observations.
3. Save and return to list/detail views.

Expected outcome:

- Updated values are visible consistently.
- Invalid quantity is rejected with clear correction guidance.

### Scenario D: Deferred barcode assignment and completion blocking

1. Create one or more boxes without barcode scan.
2. Verify boxes show a visible missing-barcode indicator.
3. Attempt final completion with at least one missing barcode.
4. Assign barcodes later to all missing boxes.
5. Retry final completion.

Expected outcome:

- Completion is blocked until all boxes are barcode-complete.
- Block message clearly explains unresolved condition.
- Completion proceeds once all barcodes are assigned.

### Scenario E: Placeholder future logistics actions

1. Open the actions area in packing-list detail.
2. Verify placeholders exist for:
  Ingress to Truck
  Traveling to Warehouse
  Ingress to Warehouse
  Extract from Warehouse
3. Select each placeholder.

Expected outcome:

- Placeholders are discoverable and marked not available.
- No operational state, signatures, survey, or box/item data is modified.

## Contract Cross-Check

- Validate behavior against API contract at:
  - `/specs/006-packing-list-2-upgrade/contracts/packing-list-2-workday-api.yaml`
- Ensure response payloads for workday history, package barcode readiness, and completion block reasons match contract schema.

## Data Model Cross-Check

- Validate state and relationships against:
  - `/specs/006-packing-list-2-upgrade/data-model.md`
- Confirm event sequence constraints and barcode-completion gate rules are enforced.

## Regression Focus

- Existing single-day completion still works.
- Offline retry for signatures and item edits does not produce duplicate events.
- Completed lists remain read-only for content edits.
- Web visibility of history and status stays aligned with backend source of truth.
