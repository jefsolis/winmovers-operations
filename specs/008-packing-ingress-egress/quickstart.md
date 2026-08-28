# Quickstart: Validating Packing List Ingress & Egress

## Prerequisites

- Backend running locally (`backend`, port 3001) with `prisma db push` + `prisma generate` applied after the schema changes in [data-model.md](./data-model.md).
- Frontend running locally (`frontend`, port 5173).
- Mobile app running via Expo (`mobile`, `npx expo start`) on a device/simulator with camera + location permissions available.
- A packing list that is in the completed state used to gate these actions (FR-002), with at least 2-3 boxes (`Package` rows with barcodes assigned).

## Scenario 1 — Truck ingress happy path (single signature)

1. On the completed packing list's options menu, select **Ingress to Truck**.
2. Confirm the checklist shows one entry per box (Box 1..Box N), all unchecked.
3. Scan each box's barcode with the camera; confirm each flips to checked and the count of remaining boxes decreases.
4. Attempt to complete before all boxes are checked → confirm the app blocks completion and lists the missing box numbers, with an explicit "truck should not depart" warning (FR-009/FR-010).
5. Scan the remaining box(es); attempt to complete again → confirm the app proceeds to the crew leader signature step.
6. Sign as crew leader → confirm the operation reaches `COMPLETE` with one recorded location (or an explicit "unavailable" indicator if location services are off) and no warehouse-manager step is requested.
7. Re-open the packing list and confirm the operation appears in the app's ingress/egress history with its type, timestamp, boxes, crew leader signature, and location.
8. Open the same packing list in the web app (`PackingListsPanel`) and confirm the same operation, signature, and location are visible there.

## Scenario 2 — Warehouse ingress with two signatures + warehouse location

1. Select **Ingress to Warehouse** from the same (or another completed) packing list's options menu.
2. Enter a warehouse location description (e.g., "Aisle 3, Rack B") at any point before completing.
3. Scan/manually enter all boxes; attempt completion.
4. Sign as crew leader → confirm the operation shows "awaiting warehouse manager signature" and does not yet report `COMPLETE`.
5. Sign as warehouse manager → confirm the operation reaches `COMPLETE` with both signatures, exactly one recorded location (shared by both), and the entered warehouse location visible.
6. Confirm the same is visible in web history, including the warehouse location and both signatures.

## Scenario 3 — Manual entry fallback

1. Start any ingress/egress operation.
2. Use "enter code manually" for one box with a valid code → confirm it becomes checked.
3. Attempt an invalid/unrelated code → confirm it is rejected with a clear message and the checklist is unchanged.
4. Attempt a code from a different packing list's box → confirm the app shows the specific "different packing list" warning (not a generic not-found message) and the box is not checked (FR-006a).

## Scenario 4 — Resume, reset, and offline behavior

1. Start an operation, check some (not all) boxes, then close/kill the app.
2. Reopen the app and the same packing list/option → confirm the previously checked boxes are still checked (FR-008).
3. Choose to reset the operation → confirm all boxes return to unchecked and any warehouse location/observations entered are cleared (FR-008a).
4. Put the device in airplane mode; scan boxes and sign as crew leader → confirm the app lets the operation proceed and complete locally without error.
5. Re-enable connectivity → confirm the operation and its scans/signature/location sync to the server without data loss, and then appear in web history.

## Reference

- Functional requirements: [spec.md](./spec.md#requirements-mandatory)
- Data shapes: [data-model.md](./data-model.md)
- API behavior: [contracts/ingress-egress-api.md](./contracts/ingress-egress-api.md)

## Regression Focus

- Existing packing list creation, packing, barcode assignment, workday start/close, and completion/signature flows must remain unaffected — this feature only adds new options-menu actions and history, and does not change existing packing list state machines.
- Existing web `PackingListsPanel` history (workday events, transitions, satisfaction) must continue to render unchanged alongside the new ingress/egress section.
- The `PACKING_FUTURE_ACTIONS` placeholder entries for these three actions are replaced by real navigation; confirm no other placeholder actions in that menu are affected.
