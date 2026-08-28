# Feature Specification: Packing List Ingress & Egress Box Scanning

**Feature Branch**: `008-packing-ingress-egress`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "packing list ingress and egress - implement ingress and egress functionalities in the mobile app. We need a way to start the process of scanning all boxes that are getting ingressed into the truck, ingress into the warehouse and egress out of the warehouse. We already have options for this in the app in the options menu of each packing list. When any of these options are selected we need a way to scan each box and show a list of boxes checked and unchecked if they have been scanned. The list can be Box 1, Box 2, Box 3, etc. with a checked or unchecked status, it needs to be clear for the operator which boxes are or aren't scanned. There should be a way to complete the ingress or egress and a warning if any of the boxes in the packing list is missing. We should not let the truck leave if there are boxes that haven't been scanned propperly. At the end of the scanning the crew leader should sign (and the location stored as usual). When ingressing or egressing into or from the warehouse the Warehouse manager should also sign (two signatures) and the gps location stored. There should also be a way to ingress or egress a box if the barcode scanner is not working (manually entering the code). All this history should also be shown both in app and in web. For now these options should be available only when the packing list is complete (this could change later when the process is confirm with the warehouse manager)."

## Clarifications

### Session 2026-08-25

- Q: For User Story 3 (signatures and location capture), should each signature (crew leader, warehouse manager) capture its own independent GPS location, or should a single GPS location be captured once for the whole operation? → A: A single GPS location is captured once, at completion of the ingress/egress operation; both the crew leader and warehouse manager signatures are still required (two signatures), but they share that one recorded location.
- Q: Should ingress/egress operations support an optional observations/notes field, consistent with other packing list lifecycle events? → A: Yes — add an optional free-text observations field to each ingress/egress operation, the same way other lifecycle events (e.g., workday start/close) already support observations.
- Q: Should warehouse ingress/egress operations let the operator record where in the warehouse the boxes are being stored or retrieved from? → A: Yes — add an optional warehouse location field (free-text, e.g., a rack/aisle/area description) to "Ingress to Warehouse" and "Egress from Warehouse" operations, entered by the crew leader or warehouse manager, so the warehouse manager knows where to go get or put the boxes. This is separate from the GPS location captured at completion.
- Q: If the app is closed mid-scan, what should happen to the in-progress ingress/egress operation? → A: It must remain open so the operator can resume it later exactly where they left off (previously checked boxes stay checked); the operator must also be able to reset the operation to start the checklist over from zero if needed.
- Q: How should the feature behave when the device is offline during scanning, signing, or entering the warehouse location/observations? → A: The entire in-progress operation (checklist state, signatures already captured, warehouse location, observations) must be stored locally on the device and synchronized automatically once connectivity returns, with no data loss.
- Q: What should happen when a scanned or manually entered box code belongs to a different packing list rather than being simply unrecognized? → A: The app must clearly warn the operator that the box belongs to a different packing list (not just "not found"), and must not process/check that box against the current operation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan All Boxes for an Ingress or Egress Operation (Priority: P1)

A crew leader selects "Ingress to Truck", "Ingress to Warehouse", or "Egress from Warehouse" from a completed packing list's options menu. The app opens a scanning session that lists every box in the packing list (Box 1, Box 2, Box 3, ...) with a clear checked/unchecked state. As the crew leader scans each box's barcode, its entry flips to checked. The crew leader can see at a glance which boxes still need to be scanned.

**Why this priority**: This is the core capability of the feature — without a reliable per-box checklist, none of the safety guarantees (no missing boxes, no early truck departure) can exist.

**Independent Test**: Start an ingress or egress operation on a packing list with several boxes, scan a subset, and confirm the checklist accurately reflects scanned vs. unscanned boxes at every point, surviving app backgrounding/reopening.

**Acceptance Scenarios**:

1. **Given** a completed packing list with N boxes, **When** the crew leader selects an ingress/egress option, **Then** a checklist with N entries (Box 1..Box N) is shown, all initially unchecked.
2. **Given** an open scanning session, **When** the crew leader scans a box's barcode, **Then** that box's entry becomes checked and visually distinct from unchecked entries.
3. **Given** a box has already been scanned, **When** the crew leader scans the same barcode again, **Then** the app confirms it is already checked and does not create a duplicate record.
4. **Given** a scanned barcode does not belong to any box in this packing list, **When** the scan occurs, **Then** the app rejects it with a clear message and the checklist is unchanged.
5. **Given** a scanning session with some boxes checked, **When** the operator leaves and reopens the screen (or the app restarts), **Then** the previously checked boxes remain checked.
6. **Given** an in-progress ingress/egress operation, **When** the crew leader chooses to reset it, **Then** all boxes in that operation return to unchecked and any previously captured warehouse location/observations for that attempt are cleared, allowing the checklist to be redone from zero.
7. **Given** a scanned or manually entered code that belongs to a box from a different packing list, **When** the code is processed, **Then** the app clearly warns that the box belongs to a different packing list and does not check it against the current operation.

---

### User Story 2 - Block Completion When Boxes Are Missing (Priority: P1)

When the crew leader attempts to finish an ingress or egress operation, the app checks whether every box has been scanned. If any box is unscanned, the app blocks completion and shows a clear warning identifying the missing boxes, so the truck cannot depart (or the warehouse movement cannot be confirmed) with unaccounted boxes.

**Why this priority**: This directly enforces the operational safety rule that motivated the feature — an incomplete scan must never be silently accepted.

**Independent Test**: Attempt to complete an ingress/egress operation while boxes remain unscanned and confirm completion is blocked with a specific warning; then scan the remaining boxes and confirm completion becomes possible.

**Acceptance Scenarios**:

1. **Given** a scanning session with one or more unscanned boxes, **When** the crew leader attempts to complete the operation, **Then** the app blocks completion and displays which boxes are still missing.
2. **Given** every box in the list is checked, **When** the crew leader attempts to complete the operation, **Then** the app allows the crew leader to proceed to the signature step.
3. **Given** an ingress-to-truck operation with missing boxes, **When** completion is blocked, **Then** the message explicitly warns that the truck should not depart until all boxes are scanned.

---

### User Story 3 - Capture Required Signatures and Location on Completion (Priority: P1)

Once all boxes are scanned, the crew leader signs to confirm the operation. For warehouse operations (ingress to warehouse and egress from warehouse), the warehouse manager must also sign before the operation is considered complete. A single device GPS location is captured once, at the moment the operation completes, and is shared by both required signatures — it is not captured separately per signature.

**Why this priority**: Signatures are the accountability record required to trust that the operation was authorized by the right people; the shared location ties that record to where the operation was completed, without the checklist alone being sufficient evidence.

**Independent Test**: Complete a truck ingress operation and confirm it finalizes with a single crew-leader signature and one recorded location; complete a warehouse ingress/egress operation and confirm it requires both signatures before finalizing, with exactly one recorded location shared by both.

**Acceptance Scenarios**:

1. **Given** all boxes are scanned for a truck ingress operation, **When** the crew leader signs, **Then** the operation is marked complete with the crew leader's signature and one device-captured location.
2. **Given** all boxes are scanned for a warehouse ingress or egress operation, **When** the crew leader signs, **Then** the app then requires the warehouse manager's signature before the operation finalizes.
3. **Given** the crew leader has signed a warehouse operation, **When** the warehouse manager signs, **Then** the operation is marked complete with both signatures and a single location captured at that completion moment.
4. **Given** a warehouse operation, **When** only one of the two required signatures has been captured, **Then** the operation remains incomplete and clearly indicates which signature is still pending.
5. **Given** the device cannot obtain a location at the moment the operation completes, **When** the final required signature is captured, **Then** the operation still completes and the app records that location was unavailable, without blocking the operator.
6. **Given** the crew leader wants to note something about the operation (e.g., a discrepancy, a delay, a condition observed), **When** they enter free-text observations before completing the operation, **Then** the observations are saved with the operation even though the operation completes successfully without them.
7. **Given** an operation with no observations entered, **When** it completes, **Then** it completes normally and the observations field is simply left empty.

---

### User Story 4 - Manually Enter a Box Code When the Scanner Is Unavailable (Priority: P2)

If the camera-based barcode scanner is not working or a barcode is unreadable, the crew leader can manually type the box's code to mark it checked in the same ingress/egress checklist.

**Why this priority**: It is an important fallback for field reliability, but the checklist and completion-blocking behavior (User Stories 1-2) deliver value even before this fallback exists.

**Independent Test**: Open an ingress/egress scanning session, manually enter a valid box code, and confirm the corresponding entry becomes checked exactly as if it had been scanned; then attempt an invalid code and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** an open scanning session, **When** the crew leader chooses to enter a code manually and types a code matching a box in the list, **Then** that box becomes checked.
2. **Given** a manually entered code does not match any box in the list, **When** it is submitted, **Then** the app rejects it with a clear message and the checklist is unchanged.
3. **Given** a box already checked via camera scan, **When** the same code is entered manually, **Then** the app confirms it is already checked without creating a duplicate record.

---

### User Story 5 - Review Ingress/Egress History in the Mobile App and Web (Priority: P3)

Anyone reviewing a packing list — in the mobile app or the web application — can see the history of ingress/egress operations performed on it: which type of operation, when, who scanned it, which boxes were confirmed, the signature(s), and the recorded location(s).

**Why this priority**: History review is the natural downstream consumer of the data captured in User Stories 1-4; it depends on that data existing first.

**Independent Test**: Complete a truck ingress and a warehouse egress on the same packing list, then open the app history view and the web packing list view and confirm both operations, their signatures, and their locations are visible.

**Acceptance Scenarios**:

1. **Given** a packing list with one or more completed ingress/egress operations, **When** a user opens that packing list's history in the mobile app, **Then** each operation is listed with its type, timestamp, actor(s), and completion status.
2. **Given** the same packing list, **When** an office user opens it in the web application, **Then** the same operations, signatures, locations, and any observations are visible.
3. **Given** an operation whose location was unavailable at capture time, **When** the history is viewed, **Then** it explicitly shows the location as unavailable rather than omitting the field silently.
4. **Given** an operation with observations entered, **When** the history is viewed, **Then** the observations text is visible alongside that operation.

---

### User Story 6 - Record Where Boxes Are Stored or Retrieved in the Warehouse (Priority: P2)

For "Ingress to Warehouse" and "Egress from Warehouse" operations, the crew leader or warehouse manager can enter a free-text warehouse location (e.g., an aisle, rack, or area description) describing where the boxes are being stored or from where they are being retrieved. This helps the warehouse manager know exactly where to go to place or collect the boxes, independent of the GPS coordinates captured at completion.

**Why this priority**: It materially improves the usefulness of a warehouse operation for the people who physically move the boxes, but the checklist, blocking, and signature guarantees (User Stories 1-3) already deliver the core safety value without it.

**Independent Test**: Complete a warehouse ingress operation while entering a warehouse location description, then confirm it is saved and visible with the operation in both app and web history; confirm a truck-ingress operation does not offer this field.

**Acceptance Scenarios**:

1. **Given** a warehouse ingress or egress operation in progress, **When** the crew leader or warehouse manager enters a warehouse location description, **Then** it is saved with the operation.
2. **Given** a warehouse operation with no warehouse location entered, **When** it completes, **Then** it completes normally and the field is simply left empty.
3. **Given** a truck-ingress operation, **When** the crew leader looks for a warehouse location field, **Then** it is not offered, since boxes are not being stored in or retrieved from the warehouse in that operation.

---

### Edge Cases

- What happens if a packing list has zero boxes — can an ingress/egress operation still be started and completed trivially?
- What happens if two devices try to scan the same packing list's ingress/egress operation at the same time?
- What happens if the crew leader attempts to start a new ingress/egress operation while a previous one for the same list and type is still incomplete?

**Resolved by clarification** (see Clarifications section):
- Closing the app mid-scan: the in-progress operation remains open and resumable, with a manual reset option to restart its checklist from zero.
- Offline scanning/signing: the entire in-progress operation is stored locally and synced automatically without data loss once connectivity returns.
- Scanning a box belonging to a different packing list: the app shows a specific "different packing list" warning and does not process the box against the current operation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a crew leader to start an ingress/egress scanning session from the existing packing list options menu for the "Ingress to Truck", "Ingress to Warehouse", and "Egress from Warehouse" actions.
- **FR-002**: These ingress/egress actions MUST only be available when the packing list is in a completed state; unavailability MUST be clearly communicated when it applies.
- **FR-003**: When a scanning session starts, the system MUST display a checklist with one entry per box in the packing list, labeled sequentially (Box 1, Box 2, Box 3, ...), each showing a clear checked or unchecked state.
- **FR-004**: The system MUST let the crew leader scan a box's barcode with the device camera to mark the corresponding entry as checked.
- **FR-005**: The system MUST let the crew leader manually type a box's code to mark the corresponding entry as checked when the camera scanner is unavailable or a barcode cannot be read.
- **FR-006**: The system MUST reject a scanned or manually entered code that does not correspond to any box in the packing list being processed, and MUST leave the checklist unchanged when this happens.
- **FR-006a**: When the scanned or manually entered code corresponds to a box belonging to a different packing list, the system MUST show a warning that specifically identifies it as belonging to a different packing list (distinct from a not-found code), and MUST NOT check that box against the current operation.
- **FR-007**: The system MUST treat re-scanning or re-entering an already-checked box's code as a no-op confirmation, not a duplicate record.
- **FR-008**: The system MUST persist checklist progress so that closing and reopening the scanning session (or restarting the app) preserves which boxes are already checked, allowing the crew leader to resume an in-progress operation exactly where they left off.
- **FR-008a**: The system MUST let the crew leader reset an in-progress ingress/egress operation, clearing all checked boxes (and any warehouse location/observations entered for that attempt) so the checklist can be redone from zero.
- **FR-009**: The system MUST prevent completing an ingress/egress operation while any box remains unchecked, and MUST show the crew leader exactly which boxes are still missing.
- **FR-010**: For the "Ingress to Truck" operation specifically, the completion-blocking warning MUST make clear that the truck must not depart while boxes remain unscanned.
- **FR-011**: Once all boxes are checked, the system MUST require the crew leader to sign before the operation can be marked complete.
- **FR-012**: For "Ingress to Warehouse" and "Egress from Warehouse" operations, the system MUST additionally require a warehouse manager signature after the crew leader signature, before the operation is marked complete.
- **FR-012a**: The system MUST capture the device's GPS location exactly once per ingress/egress operation, at the moment the operation reaches completion (i.e., after the last required signature — crew leader alone for truck ingress, or both crew leader and warehouse manager for warehouse operations), using the same location-capture behavior established for other packing list lifecycle events (succeed silently with an explicit "unavailable" reason when location cannot be obtained). Individual signatures MUST NOT each capture their own separate location.
- **FR-013**: The system MUST clearly indicate, at any point, which of the required signatures (crew leader, and warehouse manager when applicable) are still pending.
- **FR-013a**: The system MUST let the crew leader (and, for warehouse operations, the warehouse manager) enter optional free-text observations for the ingress/egress operation, consistent with the observations already supported on other packing list lifecycle events; observations MUST NOT be required to complete the operation.
- **FR-013b**: For "Ingress to Warehouse" and "Egress from Warehouse" operations, the system MUST let the crew leader or warehouse manager enter an optional free-text warehouse location describing where the boxes are stored or retrieved from; this field MUST NOT be offered for "Ingress to Truck" operations and MUST NOT be required to complete the operation.
- **FR-014**: The system MUST record, for each completed ingress/egress operation, its type, the packing list it belongs to, the checked boxes, the actor(s) who signed, the signature(s), the location captured, any observations entered, and (for warehouse operations) any warehouse location entered.
- **FR-015**: The system MUST make the ingress/egress operation history (type, timestamp, actor(s), boxes confirmed, signature(s), location(s), observations, warehouse location) visible both in the mobile app and in the web application.
- **FR-016**: The system MUST behave consistently offline: the entire in-progress ingress/egress operation (box scans, signatures, warehouse location, observations) MUST be retained on the device when captured without connectivity, and MUST be synchronized automatically once connectivity returns, without losing checklist state.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: All new web text (history views, operation labels, warnings) MUST be added to the central i18n system with English and Spanish entries.
- **Operator-facing mobile**: The scanning checklist, warnings, and signature screens are operator-facing and MUST use Spanish copy, consistent with the rest of the operator mobile experience.
- **Client-facing mobile**: Not applicable — this feature has no client-facing screens; boxes are scanned and signed by crew and warehouse staff only.
- **Backend/domain values**: Operation types, box checklist states, and signature roles MUST be stored as language-neutral values (e.g., `INGRESS_TRUCK`, `INGRESS_WAREHOUSE`, `EGRESS_WAREHOUSE`, `CHECKED`/`UNCHECKED`, `CREW_LEADER`/`WAREHOUSE_MANAGER`), with translation applied only at the presentation layer.

### Key Entities

- **Ingress/Egress Operation**: A single scanning-and-signing event tied to one packing list and one type (ingress to truck, ingress to warehouse, egress from warehouse). Tracks its overall status (in progress, awaiting signature(s), complete), the boxes it must account for, its required signature(s), the single GPS location (or explicit unavailability reason) captured once at completion, an optional free-text observations note, and (for warehouse operations) an optional free-text warehouse storage location. Can be reset back to zero while in progress.
- **Box Checklist Entry**: The checked/unchecked state of one specific box within an ingress/egress operation, including when and how it was marked checked (camera scan vs. manual entry).
- **Operation Signature**: A signature captured for an ingress/egress operation, identified by its role (crew leader or warehouse manager) and the signing person. Signatures do not carry their own location; the operation's single completion location is shared across all of its signatures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of completed ingress/egress operations have every box in the packing list accounted for as checked — no operation can be marked complete with a missing box.
- **SC-002**: An operator can identify which boxes remain unscanned at a glance, in under 5 seconds, on a packing list with up to 50 boxes.
- **SC-003**: 0 trucks depart under an ingress-to-truck operation that the app allowed to complete with unscanned boxes.
- **SC-004**: 100% of warehouse ingress/egress operations that reach "complete" status have both a crew leader signature and a warehouse manager signature recorded, and exactly one completion location (or explicit unavailability reason).
- **SC-005**: Office staff can find the full ingress/egress history (operations, signatures, locations) for any packing list in the web application without contacting the field crew.
- **SC-006**: When the barcode scanner cannot read a box, a crew leader can still check that box in under 15 seconds using manual entry.
- **SC-007**: 100% of ingress/egress operations interrupted by an app close/restart can be resumed with prior progress intact, or reset to start over, with zero data loss of already-confirmed boxes when resumed.

## Assumptions

- "Packing list is complete" refers to the existing completed/closed packing list state already used to unlock other post-completion options; this gate is expected to be revisited once the process is validated with the warehouse manager, per the request.
- Boxes correspond to the existing `Package` records already scanned and barcoded during packing; "Box 1, Box 2, ..." labeling follows their existing display order.
- Each of the three actions (Ingress to Truck, Ingress to Warehouse, Egress from Warehouse) is tracked as an independent operation; a packing list may accumulate multiple operations over time (e.g., ingress to truck now, ingress to warehouse later), and each requires its own complete box checklist and signature(s).
- "Warehouse manager" is a distinct signing role from the crew leader and does not require its own login on the operator's device; the manager signs in person on the device, the same way client signatures are captured today.
- Truck-ingress operations require only the crew leader's signature; the two-signature requirement applies only to the warehouse ingress and egress operations, as stated in the request.
- Location capture reuses the existing "capture best-effort, never block, log unavailability" pattern already implemented for other packing list lifecycle events, but is captured a single time per operation (at completion) rather than once per signature.
- Observations on ingress/egress operations follow the same optional, free-text pattern already used on other packing list lifecycle events (e.g., workday start/close) and do not block completion of the operation.
- The warehouse location field is a free-text description entered by staff (e.g., "Aisle 3, Rack B"), not a structured warehouse map or bin/slot system; it is purely informational for the warehouse manager and is separate from the GPS coordinates captured at completion.
- Existing barcode/box data (assigned during packing) is reused as the source of truth for which boxes must be scanned; this feature does not change how boxes are created or barcoded during packing.
