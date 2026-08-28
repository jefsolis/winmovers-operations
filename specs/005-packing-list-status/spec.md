# Feature Specification: Packing List Status Progress

**Feature Branch**: `005-packing-list-status`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "packing list status - Packing lists should show job progress through Not Started, Traveling, Working, and Completed; status must be visually clear in mobile and web; operators need an easy way to advance stages; packing-list detail must show critical client information and actions to call or navigate; arrival and completion transitions require signatures and observations, with a five-star satisfaction rating at completion; and the job needs placeholder options for Incidents, Documents, and Materials."

## Clarifications

### Session 2026-08-23

- Q: Which parts of the mobile progress experience require English and Spanish? → A: Operator-facing mobile UI is Spanish-only, using "No iniciado", "En camino", "Trabajando", and "Completado". Client-facing arrival acknowledgement, signature, observations, review, and satisfaction interactions must allow English and Spanish. Web retains its existing bilingual behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track and Advance Job Progress (Priority: P1)

A field operator can immediately understand the current packing-job stage and move the job through Not Started, Traveling, Working, and Completed in sequence. A web operations user sees the same current stage without needing separate updates.

**Why this priority**: Shared, accurate progress is the core operational need. It allows field staff and office staff to coordinate work and understand whether a crew has departed, arrived, started work, or finished.

**Independent Test**: Create a packing list, verify it starts as Not Started, advance it through each allowed stage on mobile, and verify each stage, icon, and latest change appears consistently in both mobile and web.

**Acceptance Scenarios**:

1. **Given** a new packing list, **When** creation completes, **Then** mobile displays "No iniciado" with a clock-style icon and web displays the equivalent Not Started stage using its existing language behavior.
2. **Given** a Not Started packing list, **When** the operator selects "Iniciar viaje" and confirms, **Then** mobile displays "En camino" with a truck-style icon and web displays the equivalent Traveling stage.
3. **Given** a Traveling packing list, **When** the operator completes the arrival acknowledgement, **Then** mobile displays "Trabajando" with a work/packing-style icon and web displays the equivalent Working stage.
4. **Given** a Working packing list, **When** the operator completes final sign-off and satisfaction capture, **Then** mobile displays "Completado" with a check-style icon and web displays the equivalent Completed stage.
5. **Given** a packing list at any stage, **When** the operator views its detail, **Then** a four-stage progress indicator highlights the current stage and a single primary action clearly names the next stage.
6. **Given** a status change is submitted more than once because of delayed feedback or retry, **When** the duplicate request is processed, **Then** no duplicate transition or duplicate sign-off record is created.

---

### User Story 2 - Contact and Navigate to the Client (Priority: P1)

An operator opening a packing list can see the client name, phone number, service address, and job type, then call the client or launch navigation without retyping information.

**Why this priority**: Operators need contact and destination details before and during travel. Missing or buried information causes delays and increases the risk of arriving at the wrong location.

**Independent Test**: Open a packing list linked to a client with complete details, verify all required information is visible, then use Call and Navigate and confirm the device opens an appropriate phone or navigation application with the correct destination.

**Acceptance Scenarios**:

1. **Given** a packing list with client information, **When** the operator opens it, **Then** the detail view shows client name, phone number, service address, and localized job type.
2. **Given** a valid client phone number, **When** the operator selects Call, **Then** the device phone application opens with that number ready to call.
3. **Given** a valid service address, **When** the operator selects Navigate, **Then** an available navigation application opens with the address as the destination.
4. **Given** multiple supported navigation applications are available, **When** the operator selects Navigate, **Then** the device lets the operator choose an available option or uses the device's established default.
5. **Given** the phone number or address is missing, **When** the operator views the client section, **Then** the missing value is clearly indicated and its related action is unavailable without blocking other work.

---

### User Story 3 - Capture Arrival Acknowledgement (Priority: P1)

When the crew arrives, the operator records observations and obtains the client's signature before changing the job from Traveling to Working.

**Why this priority**: Arrival acknowledgement provides a clear handoff into on-site work and creates evidence of when and under what conditions service began.

**Independent Test**: Advance a Traveling packing list, enter arrival observations, collect a client signature, and verify the list changes to Working with the acknowledgement visible from mobile and web.

**Acceptance Scenarios**:

1. **Given** a Traveling packing list, **When** the operator selects I’ve Arrived, **Then** an arrival acknowledgement screen requests observations and client signature before status advancement.
2. **Given** a valid signature and optional observations, **When** the operator confirms arrival, **Then** the acknowledgement is retained and the status changes to Working.
3. **Given** signature capture is incomplete, **When** the operator attempts to confirm arrival, **Then** the list remains Traveling and clearly explains what is required.
4. **Given** connectivity is temporarily unavailable after acknowledgement, **When** the data is safely retained on the device, **Then** the operator sees that synchronization is pending and the acknowledgement is submitted automatically after connectivity returns.

---

### User Story 4 - Complete Work and Record Satisfaction (Priority: P1)

When packing work is finished, the operator records completion observations, presents the existing completion review and signature flow to the client, and captures a one-to-five-star satisfaction rating before completing the job.

**Why this priority**: Completion is the final client-facing proof of service and the first structured customer satisfaction signal for the packing operation.

**Independent Test**: Advance a Working list through completion with observations, signature, and a star rating, then verify the list is Completed and all sign-off information is available in mobile and web.

**Acceptance Scenarios**:

1. **Given** a Working packing list, **When** the operator selects Complete Job, **Then** completion requests observations, the existing client review/signature information, and a one-to-five-star satisfaction rating.
2. **Given** all required completion information is valid, **When** the operator confirms, **Then** the list becomes Completed and cannot be edited through normal packing actions.
3. **Given** the client selects a star rating, **When** completion is retained, **Then** the rating is associated with that completion and visible to authorized users in mobile and web.
4. **Given** final server confirmation is delayed, **When** completion data is safely retained, **Then** the interface communicates pending synchronization and automatically finalizes without losing observations, signature, rating, packages, items, or photos.
5. **Given** satisfaction questions are expanded in a future release, **When** new questions are introduced, **Then** existing star-only responses remain valid and distinguishable from newer response formats.

---

### User Story 5 - Access Future Job Tools (Priority: P3)

An operator can open an Options menu from the packing-list detail and see Incident, Documents, and Materials as clearly identified future capabilities.

**Why this priority**: The menu establishes a stable and discoverable home for upcoming operational tools without implying that unfinished workflows are currently available.

**Independent Test**: Open Options from a packing list, verify all three entries are present, and confirm selecting an entry communicates that the capability is not yet available and does not alter job data.

**Acceptance Scenarios**:

1. **Given** an operator is viewing a packing list, **When** they open Options, **Then** Incident, Documents, and Materials are listed with distinct icons and localized labels.
2. **Given** one of the placeholder options is selected, **When** no feature exists yet, **Then** the app communicates Coming Soon and performs no data change or navigation into an incomplete workflow.

### Edge Cases

- A status update made on one device is received while another device still displays an older stage.
- An operator double-taps Continue or the device retries a transition after a timeout.
- A user attempts to skip a stage, move backward, or modify a Completed packing list.
- Client details change after the packing list was opened but before Call or Navigate is selected.
- A phone number contains formatting, an extension, or an international country code.
- No supported navigation application is installed, or the address cannot be resolved.
- The client signature is captured but the status update cannot immediately reach the server.
- The app closes during arrival or completion sign-off before confirmation.
- Satisfaction rating is omitted or outside the allowed one-to-five range.
- A web user views the list while a mobile status transition is pending synchronization.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every newly created packing list MUST begin with the progress status Not Started.
- **FR-002**: Packing-list progress MUST use exactly four user-facing stages in this order: Not Started, Traveling, Working, and Completed.
- **FR-003**: The mobile app MUST allow operators to advance progress only to the next sequential stage through a prominent contextual primary action.
- **FR-004**: The mobile contextual action MUST identify the result before confirmation in Spanish: "Iniciar viaje", "Ya llegamos", or "Completar trabajo", according to the current stage.
- **FR-005**: Mobile and web MUST display the same current progress stage and latest confirmed transition information for a packing list.
- **FR-006**: Each progress stage MUST have a visually distinct, accessible icon and text label. Mobile MUST use "No iniciado" with a clock-style icon, "En camino" with a truck-style icon, "Trabajando" with a work/packing-style icon, and "Completado" with a check-style icon.
- **FR-007**: Status meaning MUST NOT depend on color or icon alone; a localized text label MUST always accompany the visual treatment.
- **FR-008**: Mobile packing-list detail MUST display a four-stage progress indicator that clearly distinguishes completed, current, and upcoming stages.
- **FR-009**: Status transitions MUST retain the previous stage, new stage, date and time, acting operator, and any transition-specific acknowledgement information for audit history.
- **FR-010**: Duplicate transition submissions MUST be handled without creating duplicate status-history, signature, observation, or satisfaction records.
- **FR-011**: Normal operator workflows MUST prevent skipping stages, moving backward, and changing operational content after Completed.
- **FR-012**: Mobile packing-list detail MUST show client name, phone number, service address, and localized job type.
- **FR-013**: Mobile MUST provide a Call action that opens the device phone application with the client's available phone number.
- **FR-014**: Mobile MUST provide a Navigate action that sends the available service address to an installed navigation application or the device's navigation chooser/default.
- **FR-015**: Call and Navigate actions MUST be unavailable with a clear explanation when their required client data is missing or invalid.
- **FR-016**: Moving from Traveling to Working MUST require an arrival acknowledgement containing a client signature and allowing operator observations.
- **FR-017**: An incomplete arrival acknowledgement MUST leave the packing list in Traveling and MUST NOT create a confirmed transition.
- **FR-018**: Moving from Working to Completed MUST retain completion observations, the existing completion review/signature outcome, and a client satisfaction response.
- **FR-019**: The initial satisfaction survey MUST require one whole-number rating from one to five stars.
- **FR-020**: Satisfaction data MUST preserve the survey version and support adding future questions and answer types without invalidating existing star-only responses.
- **FR-021**: Arrival and completion information safely retained during temporary connectivity loss MUST synchronize automatically when connectivity returns, with a visible pending state until confirmed.
- **FR-022**: Web and mobile MUST display arrival acknowledgement, completion observations, signature outcome, and satisfaction rating to authorized users once confirmed.
- **FR-023**: The mobile packing-list detail MUST provide an Options menu containing Incident, Documents, and Materials.
- **FR-024**: Placeholder options MUST be visibly identified as not yet available and MUST NOT create, modify, or delete operational data.
- **FR-025**: All new operator-facing mobile labels, guidance, statuses, and messages MUST be presented in Spanish; operator-facing screens MUST NOT add an EN/ES selector. Web MUST retain its existing bilingual behavior.
- **FR-025a**: Client-facing mobile arrival acknowledgement, signature, observations, review, and satisfaction interactions MUST allow English and Spanish selection and MUST render all client-facing content consistently in the selected language.
- **FR-025b**: Shared backend progress statuses and transition types MUST remain language-neutral enums; Spanish and English labels MUST be applied only in mobile or web presentation code.
- **FR-026**: Access to packing-list details, status changes, client contact information, signatures, observations, and satisfaction responses MUST preserve existing role restrictions.

### Key Entities *(include if feature involves data)*

- **Packing List**: The operational packing record, including its current progress stage, linked moving file/job, client context, and completion state.
- **Progress Transition**: An auditable change from one packing stage to the next, including previous and new stage, operator, timestamp, and related acknowledgement.
- **Client Service Context**: The client name, callable phone number, service address, and job type presented to the operator for the packing assignment.
- **Arrival Acknowledgement**: Evidence collected when the crew arrives, including client signature, operator observations, timestamp, and synchronization state.
- **Completion Sign-Off**: Existing final review/signature outcome extended with completion observations and satisfaction response.
- **Satisfaction Survey Definition**: A versioned description of the questions presented at completion, initially containing one five-star rating question and able to add future questions.
- **Satisfaction Response**: The client's answers for a specific survey version and packing-list completion, initially a one-to-five-star value.
- **Job Option**: A discoverable packing-list tool entry; Incident, Documents, and Materials are placeholders in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of newly created packing lists display Not Started before any operator action.
- **SC-002**: At least 95% of operators can identify the current stage and advance to the next permitted stage without assistance on their first attempt.
- **SC-003**: At least 95% of confirmed status changes become visible in both mobile and web within 10 seconds under stable connectivity.
- **SC-004**: 100% of tested stage transitions follow Not Started → Traveling → Working → Completed, with no skipped or duplicate confirmed transitions.
- **SC-005**: At least 95% of operators can initiate a client call or navigation in no more than two actions from packing-list detail when required data is available.
- **SC-006**: 100% of Traveling-to-Working transitions retain the required arrival signature and transition timestamp.
- **SC-007**: 100% of Working-to-Completed transitions retain completion sign-off, observations, and a valid one-to-five-star rating.
- **SC-008**: In connectivity interruption tests, 100% of safely confirmed arrival and completion inputs remain available and synchronize without duplicate records after connectivity returns.
- **SC-009**: 100% of mobile status displays use the required Spanish label with an icon and remain understandable when viewed without color.
- **SC-010**: In acceptance testing, selecting any placeholder job option results in zero operational data changes.

## Assumptions

- Operators advance packing-list progress from the mobile app; web users monitor the stage and related details in this phase.
- Sequential forward progression is the standard workflow. Backward correction requires an authorized administrative process and is outside this feature's operator flow.
- “Completed” is the user-facing operational progress stage; temporary synchronization/finalization indicators may coexist without changing that business meaning.
- The service address associated with the assignment is the destination used for navigation.
- The device decides which installed navigation application handles the destination; supported options may include Waze, Google Maps, Apple Maps, or the established device default.
- Existing packing completion review, language selection, signature capture, and offline synchronization behavior remain in place and are extended rather than replaced.
- Operator-facing mobile screens remain Spanish-only. Client-facing mobile screens reuse or extend the existing review-language selection to provide complete English and Spanish interactions.
- Arrival observations are optional; completion observations are captured and may be left blank unless current business rules require content.
- The one-to-five-star rating is required for this phase and is not anonymous.
- Incident, Documents, and Materials are presentation-only placeholders; their underlying workflows and data are outside this feature's scope.
