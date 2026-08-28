# Feature Specification: Packing List 2.0 Operations

**Feature Branch**: `006-packing-list-2-upgrade`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "packing list 2.0 - add crew leader signatures at arrival and completion-related checkpoints, support multi-day daily start/end signatures, keep completion survey only for final completion, preserve per-day history, allow box-content editing, allow creating boxes before barcode scan with later scan and completion blocking for missing barcodes, and reserve space for future logistics actions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Multi-Day Workflows with Dual Signatures (Priority: P1)

As an operator, I can start and close each work day on the same packing list while collecting both required signatures (client and crew leader) so that every day is auditable and work can continue on later days.

**Why this priority**: Daily execution and proof-of-service are core operational controls. Missing or inconsistent daily records creates compliance and customer-dispute risk.

**Independent Test**: Start day 1, capture arrival signatures for both parties, close day 1 with both signatures, start day 2, and verify each day retains distinct start/end records in order.

**Acceptance Scenarios**:

1. **Given** an active packing list for a multi-day job, **When** the operator marks the start of a work day, **Then** the workflow requires both client and crew leader signatures before confirming the day start.
2. **Given** a started work day that is not the last day, **When** the operator closes the day, **Then** the workflow requires both client and crew leader signatures before confirming day closure.
3. **Given** day 1 is closed, **When** day 2 begins, **Then** the operator can set Traveling again and repeat the day-start signature workflow.
4. **Given** multiple day cycles on one packing list, **When** history is viewed, **Then** entries are grouped and ordered by day and event type (start/end) with clear timestamps and actors.

---

### User Story 2 - Complete Final Day Without End-of-Day Closure Signature (Priority: P1)

As an operator, I can complete the packing list on the final day using the completion flow, without requiring an additional end-of-day closure signature, while still collecting final client-facing completion inputs.

**Why this priority**: Completion must be unambiguous and operationally efficient. Requiring both end-of-day closure and completion sign-off on the last day creates redundant steps and confusion.

**Independent Test**: On the last day, run day-start signatures, perform work, execute completion, verify completion succeeds without a separate day-end signature step, and verify the survey appears only at final completion.

**Acceptance Scenarios**:

1. **Given** the operator indicates the current work day is the final day, **When** they complete the job, **Then** the system finalizes without requiring a separate end-of-day closure signature event.
2. **Given** a non-final day closure, **When** the operator finishes the day, **Then** the completion survey is not shown.
3. **Given** final completion, **When** client-facing completion is presented, **Then** the satisfaction survey is shown and captured only in that final completion flow.
4. **Given** final completion is confirmed, **When** history is reviewed, **Then** the last day shows final completion as the terminal event for the packing list.

---

### User Story 3 - Edit Box Contents During Work (Priority: P1)

As an operator, I can open any box and edit its contents so corrections can be made in the field (item type, quantity, and observations) without recreating the box.

**Why this priority**: Box content errors are common during active operations; correcting them quickly is essential for inventory fidelity.

**Independent Test**: Open a box with existing items, change item type, quantity, and observation text, save, and verify updated values appear in box detail, box summaries, and persisted records.

**Acceptance Scenarios**:

1. **Given** a box item exists, **When** the operator edits item type, quantity, or observation and saves, **Then** the updated values replace the prior values.
2. **Given** multiple item edits on one box, **When** changes are saved, **Then** all accepted edits remain consistent across list and detail views.
3. **Given** an invalid item quantity, **When** the operator attempts to save, **Then** the system rejects the change with a clear correction message.

---

### User Story 4 - Create Boxes Before Barcode Is Available (Priority: P1)

As an operator, I can create boxes even when barcode labels are not yet ready, then scan/assign barcodes later, while clearly seeing which boxes are still pending barcode assignment.

**Why this priority**: Field operations cannot pause because labels are delayed. The workflow must support staged capture while preserving traceability.

**Independent Test**: Create boxes without barcodes, verify they are visibly marked as pending barcode, later assign barcodes to selected boxes, and verify pending indicators clear per box.

**Acceptance Scenarios**:

1. **Given** barcode labels are unavailable, **When** the operator creates a new box, **Then** the box is created with a visible missing-barcode indicator.
2. **Given** a box missing barcode, **When** the operator later scans or assigns its barcode, **Then** the box updates to a barcode-complete state.
3. **Given** a mix of barcode-complete and barcode-missing boxes, **When** the operator reviews the list, **Then** missing-barcode boxes are clearly identifiable without opening each box.
4. **Given** at least one box is missing barcode, **When** the operator attempts final completion, **Then** completion is blocked with a clear explanation of what must be resolved.

---

### User Story 5 - Reserve Navigation Space for Future Logistics Actions (Priority: P3)

As an operations user, I can see that the packing workflow can expand with additional logistics actions later, without those future actions affecting current behavior.

**Why this priority**: The team needs an extensible interaction pattern now so future actions can be added predictably without redesigning the core screen.

**Independent Test**: Verify the action area can present future action entries (Ingress to Truck, Traveling to Warehouse, Ingress to Warehouse, Extract from Warehouse) as non-operational placeholders, and current operational behavior is unchanged.

**Acceptance Scenarios**:

1. **Given** a packing list in active use, **When** the operator opens the action area, **Then** current actions remain primary and future logistics actions are shown as not yet available.
2. **Given** a future placeholder action is selected, **When** no implementation exists, **Then** no operational state or inventory data is modified.

### Edge Cases

- Operator captures daily start signatures, then loses connectivity before confirmation.
- Operator attempts to close a day without required dual signatures.
- Operator attempts final completion while one or more boxes still have missing barcode status.
- Operator edits item details on one device while another device still shows stale data.
- Operator starts a new day after midnight boundary; history still must reflect the intended work-day sequence.
- Duplicate day-start or day-end submissions occur because of retries.
- A box receives a barcode already assigned to another box in the same packing list.
- Operator attempts to edit box contents after final completion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support repeated daily work cycles on the same active packing list until final completion.
- **FR-002**: Each daily start event MUST require two signatures: client and crew leader (Jefe de cuadrilla).
- **FR-003**: Each non-final daily closure event MUST require two signatures: client and crew leader (Jefe de cuadrilla).
- **FR-004**: The operator MUST be able to set Traveling at the start of each work day for a multi-day job.
- **FR-005**: The final day completion flow MUST finalize the packing list without requiring a separate end-of-day closure signature event.
- **FR-006**: The satisfaction survey MUST appear only during final completion and MUST NOT appear during non-final day closure.
- **FR-007**: Daily history MUST preserve an ordered record of day start, day closure, and final completion events, including timestamps and actor attribution.
- **FR-008**: The system MUST prevent duplicate daily-history events caused by repeated submissions or retries.
- **FR-009**: Operators MUST be able to edit an existing box item's item type.
- **FR-010**: Operators MUST be able to edit an existing box item's quantity.
- **FR-011**: Operators MUST be able to edit an existing box item's observations.
- **FR-012**: Item edits MUST be validated before save and MUST reject invalid quantities with actionable guidance.
- **FR-013**: Operators MUST be able to create a new box without scanning a barcode at creation time.
- **FR-014**: Boxes created without barcode MUST be visibly marked as barcode-missing in list and detail contexts.
- **FR-015**: Operators MUST be able to assign or scan a barcode for a previously barcode-missing box at a later time.
- **FR-016**: Final completion MUST be blocked while any box in the packing list remains barcode-missing.
- **FR-017**: Completion-blocking feedback for missing barcodes MUST identify the unresolved condition clearly enough for operators to resolve it.
- **FR-018**: The action area MUST reserve discoverable placeholders for future logistics actions: Ingress to Truck, Traveling to Warehouse, Ingress to Warehouse, and Extract from Warehouse.
- **FR-019**: Future logistics action placeholders MUST NOT change current status, signatures, surveys, or box/item records until explicitly implemented.
- **FR-020**: Completed packing lists MUST remain non-editable for operational content, including box items and barcode assignment.
- **FR-021**: Offline-safe retention and retry behavior MUST preserve daily signatures, item edits, and barcode assignments without creating conflicting history entries.
- **FR-022**: Existing role and access restrictions for packing-list workflows MUST remain enforced.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: Any new web text for daily-event history, completion blockers, barcode-missing indicators, and future-action placeholders MUST be provided in both English and Spanish through the existing i18n mechanism.
- **Operator-facing mobile**: All new operational controls and messages for daily start/closure, crew-leader signatures, box editing, barcode-missing indicators, and completion blockers MUST be Spanish.
- **Client-facing mobile**: Client-facing signature and survey interactions MUST continue to support English and Spanish selection, and each interaction MUST remain fully consistent in the selected language.
- **Backend/domain values**: Daily event types, completion states, barcode presence states, and future logistics action identifiers MUST remain language-neutral domain values.

### Key Entities *(include if feature involves data)*

- **Packing List Workday**: A logical day segment within one packing list, containing its own start and (if non-final) closure lifecycle.
- **Daily Signature Pair**: The required client and crew leader signatures associated with day-start or day-closure confirmation.
- **Final Completion Event**: The terminal event that closes the packing list and includes completion-specific client-facing feedback.
- **Box**: A packing unit that may be created before barcode assignment and later transitioned to barcode-complete.
- **Box Item**: A content record within a box, including editable item type, quantity, and observations.
- **Future Logistics Action Placeholder**: A non-operational action slot reserved for upcoming warehouse/truck flow actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of day-start confirmations require both client and crew leader signatures.
- **SC-002**: In acceptance testing, 100% of non-final day closures require both client and crew leader signatures.
- **SC-003**: In multi-day test runs, operators can complete at least 3 consecutive day cycles on the same list with correct day-by-day history ordering and no missing events.
- **SC-004**: 100% of final completions bypass non-final day-closure signature requirements while still capturing required completion inputs.
- **SC-005**: 100% of non-final day closures do not display the satisfaction survey.
- **SC-006**: At least 95% of tested box-content corrections (type, quantity, observations) are completed by operators on first attempt without needing to recreate boxes.
- **SC-007**: 100% of completion attempts with at least one barcode-missing box are blocked until all boxes are barcode-complete.
- **SC-008**: At least 95% of operators can identify barcode-missing boxes within 10 seconds from the box list view.
- **SC-009**: In retry/connectivity interruption tests, 100% of retained daily-signature and item-edit actions synchronize without duplicate confirmed events.
- **SC-010**: Placeholder future logistics actions produce zero operational data changes in all acceptance tests.

## Assumptions

- A packing list may span one or more work days, and operators decide when a day is non-final versus final.
- Existing completion sign-off behavior remains in place and is extended with the new daily-cycle rules rather than replaced.
- Crew leader signature capture follows the same trust and evidence model used for existing client signatures.
- Operators must be able to continue work when barcode labels are delayed, but the business requires barcode completeness before final completion.
- Future logistics actions are intentionally non-operational in this phase and are included only for discoverability and layout stability.
