# Feature Specification: Packing List GPS Location Tracking

**Feature Branch**: `007-packing-list-gps-location`

**Created**: 2026-08-25

**Status**: Complete

**Completed**: 2026-08-25

**Input**: User description: "packing list location - add gps location to each stage of the list lifecycle, for example when the list is created, when the truck starts traveling to client's location, when the job starts, each day start and closure and the final job completion. Each of those stages should log the device's current location, any error should be handled smoothly and not affect the application flow, if location is not available log it but don't stop the process. In the web show this information as a clickable icon that opens a google maps window with that location. Also, web application should allow to select a location in a google maps map or enter the gps coordinates that Whatsapp or other applications share (for example: https://maps.google.com/maps?q=9.9776154%2C-84.1246276&z=17&hl=es) in the job form, this should be used by the mobile application when possible, if this does not exist for this job then use the text address instead (clearly show when the job has the real coordinates)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture Location at Every Packing List Stage (Priority: P1)

An operator works a packing list on a mobile device. Without any extra taps, the system records where the device was each time the list advances through a lifecycle stage: list creation, start of travel to the client, arrival/work start, each workday start, each workday close, and final completion. If the device cannot provide a location, the stage still completes normally and the system records that the location was unavailable and why.

**Why this priority**: This is the core value of the feature. It provides operational evidence of where and when each stage happened, and it must never interfere with the operator's ability to complete work.

**Independent Test**: Run a full packing list lifecycle on a device with location enabled and verify every stage has an associated position; repeat with location disabled and verify every stage still completes and is marked as location unavailable.

**Acceptance Scenarios**:

1. **Given** an operator with location permission granted, **When** they create a packing list, **Then** the creation event stores the device position and the moment it was measured.
2. **Given** an operator starting travel to the client, **When** they confirm the status change, **Then** the travel-start event stores the device position.
3. **Given** an operator confirming arrival to begin work, **When** the arrival is recorded, **Then** the work-start event stores the device position.
4. **Given** a multi-day job, **When** the operator starts and later closes each workday, **Then** each of those day events stores its own device position independently.
5. **Given** an operator completing the job, **When** the final completion is confirmed, **Then** the completion event stores the device position.
6. **Given** a device with location services turned off or permission denied, **When** any lifecycle stage is recorded, **Then** the stage succeeds, no error interrupts the operator, and the event is stored with an explicit "location unavailable" reason.
7. **Given** a device that is offline, **When** a stage is recorded, **Then** the captured position is stored locally with the event and is transmitted with that event when connectivity returns.

---

### User Story 2 - View Stage Locations on a Map from the Web (Priority: P1)

An office user reviewing a packing list in the web application sees a location indicator next to each lifecycle event that has a recorded position. Selecting the indicator opens Google Maps in a new window centered on that position. Events without a position clearly show that no location was captured.

**Why this priority**: Captured data has no operational value until office staff can inspect it. It is the direct consumer of User Story 1.

**Independent Test**: Open a packing list that has stage positions and confirm each event with a position exposes a working map link, while events without one show an explicit unavailable indicator.

**Acceptance Scenarios**:

1. **Given** a lifecycle event with a recorded position, **When** the user views the packing list history, **Then** a clickable location indicator appears on that event.
2. **Given** the user selects the location indicator, **When** the action is triggered, **Then** Google Maps opens in a separate window centered on the recorded coordinates.
3. **Given** a lifecycle event whose location was unavailable, **When** the user views the history, **Then** the event shows an explicit unavailable state instead of a map link.
4. **Given** the user hovers or focuses the indicator, **When** assistive technology reads it, **Then** the purpose of the link and the event it belongs to are announced.

---

### User Story 3 - Define Job Service Coordinates in the Web (Priority: P1)

An office user editing a job can set the exact service location either by selecting a point on a Google Maps map or by pasting coordinates shared from WhatsApp or a similar application (for example a `maps.google.com/maps?q=<lat>,<lng>` link, or a plain `lat, lng` pair). The job then clearly indicates that it has verified coordinates rather than only a text address.

**Why this priority**: Exact coordinates remove the ambiguity of free-text addresses, which is the most common cause of crews arriving at the wrong location. It is required before mobile navigation can rely on coordinates.

**Independent Test**: Edit a job, set coordinates by both map selection and by pasting a shared link, save, reopen, and confirm the coordinates persist and the job is marked as having exact coordinates.

**Acceptance Scenarios**:

1. **Given** a user editing a job, **When** they select a point on the map, **Then** the corresponding coordinates are captured into the job form.
2. **Given** a user pastes a shared Google Maps link containing coordinates, **When** the value is accepted, **Then** the coordinates are extracted and shown on the map.
3. **Given** a user pastes a plain latitude and longitude pair, **When** the value is accepted, **Then** the coordinates are extracted and shown on the map.
4. **Given** a user pastes a value that contains no recognizable coordinates, **When** they attempt to accept it, **Then** the system explains the value could not be interpreted and the previously saved coordinates remain unchanged.
5. **Given** a user enters coordinates outside valid latitude or longitude ranges, **When** they attempt to save, **Then** the system rejects the value with a clear explanation.
6. **Given** a job with saved coordinates, **When** any user views the job, **Then** the job visibly indicates it has exact coordinates as opposed to only a text address.
7. **Given** a user clears the coordinates, **When** the job is saved, **Then** the job reverts to being identified by its text address only.

---

### User Story 4 - Navigate Using Job Coordinates on Mobile (Priority: P2)

An operator opening navigation for a packing list is routed to the job's exact coordinates when they exist. When the job has no coordinates, navigation falls back to the existing text address behavior, and the operator can tell which of the two is being used.

**Why this priority**: It converts the coordinate data into a concrete field benefit, but it depends on User Story 3 being available first.

**Independent Test**: Open navigation for a job with coordinates and confirm the exact point is targeted; repeat for a job without coordinates and confirm the address-based behavior is unchanged.

**Acceptance Scenarios**:

1. **Given** a job with exact coordinates, **When** the operator starts navigation, **Then** navigation targets those coordinates.
2. **Given** a job without coordinates, **When** the operator starts navigation, **Then** navigation targets the text address exactly as it does today.
3. **Given** a job with exact coordinates, **When** the operator views the service details, **Then** the interface indicates that an exact location is available.

---

### Edge Cases

- The device returns a position with very low accuracy: the position is stored together with its reported accuracy so reviewers can judge its reliability.
- The device takes too long to return a position: the stage proceeds without waiting indefinitely, and the event is recorded as location unavailable due to timeout.
- The operator revokes location permission mid-job: earlier events keep their positions and later events are recorded as unavailable.
- The same stage is retried after a sync failure: the position captured at the original moment is preserved rather than replaced by the retry-time position.
- A completed list is reviewed later: recorded positions remain visible and unchanged.
- A shared link contains a place name but no coordinate pair: the value is rejected as uninterpretable rather than guessed.
- A pasted coordinate uses a comma as the decimal separator or includes surrounding whitespace: the value is normalized when unambiguous, otherwise rejected.
- A job's coordinates are edited after packing list stages were already recorded: stage positions are historical facts and are not rewritten.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture the device's current position when a packing list is created.
- **FR-002**: System MUST capture the device's current position when travel to the client location begins.
- **FR-003**: System MUST capture the device's current position when work begins at the client location.
- **FR-004**: System MUST capture the device's current position at each workday start and each workday close.
- **FR-005**: System MUST capture the device's current position at final job completion.
- **FR-006**: System MUST store, for each captured position, the latitude, longitude, reported accuracy, and the time the position was measured.
- **FR-007**: System MUST complete every lifecycle stage successfully even when a position cannot be obtained, and MUST NOT block, delay indefinitely, or fail the operator's action because of location capture.
- **FR-008**: System MUST record an explicit unavailability reason when a position cannot be obtained, distinguishing at minimum permission denied, location services disabled, timeout, and other errors.
- **FR-009**: System MUST NOT surface location failures as blocking errors to the operator during normal stage progression.
- **FR-010**: System MUST retain locally captured positions while offline and transmit them together with their stage event once connectivity is restored.
- **FR-011**: System MUST preserve the originally captured position and its measurement time when a stage event is retried or re-synchronized.
- **FR-012**: Web users MUST be able to see, for each lifecycle event in the packing list history, whether a position was captured.
- **FR-013**: Web users MUST be able to open Google Maps in a separate window centered on a captured position by selecting a location indicator on that event.
- **FR-014**: System MUST clearly present lifecycle events whose location was unavailable, without implying a false position.
- **FR-015**: Web users MUST be able to set a job's exact service coordinates by selecting a point on a map.
- **FR-016**: Web users MUST be able to set a job's exact service coordinates by entering a coordinate value shared from external applications, including Google Maps share links of the form `maps.google.com/maps?q=<lat>,<lng>` and plain latitude/longitude pairs.
- **FR-017**: System MUST validate that entered coordinates fall within valid latitude and longitude ranges and MUST reject uninterpretable values with an explanatory message, leaving previously saved values unchanged.
- **FR-018**: System MUST visibly distinguish jobs that have exact coordinates from jobs identified only by a text address.
- **FR-019**: Users MUST be able to remove a job's coordinates, returning the job to text-address identification.
- **FR-020**: The mobile application MUST use the job's exact coordinates for navigation when they exist, and MUST fall back to the existing text address behavior when they do not.
- **FR-021**: The mobile application MUST indicate to the operator whether an exact location or a text address is being used for the service.
- **FR-022**: System MUST keep recorded stage positions immutable once confirmed; later edits to a job's coordinates MUST NOT alter historical stage positions.
- **FR-023**: Captured positions MUST be included in the existing audit trail for the affected records, consistent with current auditability behavior.
- **FR-024**: Access to captured positions MUST follow the same access rules that already govern the packing list and job records they belong to.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: All new web text — location indicator labels, map link titles, unavailable-location states, coordinate entry labels, validation messages, and the exact-coordinates indicator — MUST be defined in both English and Spanish through the central i18n system. No display label may be hardcoded in a component.
- **Operator-facing mobile**: New operator-visible text, such as the indication of whether navigation uses exact coordinates or a text address, MUST be Spanish.
- **Client-facing mobile**: This feature adds no new client-facing interaction. Existing client-facing review, signature, acknowledgement, observations, and satisfaction screens MUST continue to honor the client's selected language, and location capture MUST NOT alter that behavior.
- **Backend/domain values**: Location unavailability reasons and stage identifiers MUST be language-neutral values; human-readable descriptions MUST be produced only at the presentation boundary.

### Key Entities *(include if feature involves data)*

- **Stage Location Record**: The position associated with a single packing list lifecycle event. Attributes: latitude, longitude, reported accuracy, measurement time, and either a captured state or an unavailability reason. Belongs to exactly one lifecycle event and is immutable after confirmation.
- **Packing List Lifecycle Event**: An existing recorded moment in the packing list's progression (creation, travel start, work start, workday start, workday close, final completion) that now optionally carries a Stage Location Record.
- **Job Service Coordinates**: The exact latitude and longitude of a job's service location, optional and separate from the job's text address. Used by mobile navigation when present.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For jobs performed on devices with location enabled, at least 95% of lifecycle stage events carry a captured position.
- **SC-002**: Zero lifecycle stages fail, hang, or display a blocking error as a result of location capture, including when location is denied, disabled, or unavailable.
- **SC-003**: Location capture adds no more than 2 seconds to the time an operator waits to complete any lifecycle stage.
- **SC-004**: 100% of lifecycle events without a captured position display an explicit unavailable state with a recorded reason.
- **SC-005**: Office users can open the map for a recorded stage position in a single action from the packing list history.
- **SC-006**: Office users can set a job's exact coordinates, by map selection or by pasting a shared coordinate value, in under 60 seconds.
- **SC-007**: 100% of jobs with saved coordinates are visually identifiable as having exact coordinates rather than only a text address.
- **SC-008**: For jobs with exact coordinates, navigation started from mobile targets those coordinates in 100% of attempts.

## Assumptions

- Location capture applies to the packing list lifecycle stages listed by the user; other operational flows are out of scope for this feature.
- Operators grant device location permission through the standard platform prompt; the application requests it but never forces it, and a denial permanently degrades to the unavailable state without repeated interruption.
- Positions are captured at the moment the operator confirms a stage; continuous or background location tracking is explicitly out of scope.
- A single coordinate pair per job is sufficient for the service location; separate origin and destination coordinates are out of scope for this feature.
- Recorded positions inherit the retention, audit, and access rules already applied to packing lists and jobs; no separate retention policy is introduced.
- The web map experience uses Google Maps, consistent with the map links this feature already opens.
- Coordinate precision is stored with sufficient decimal places to identify a building entrance; no survey-grade precision is required.
- The mobile application continues to use its existing navigation mechanism and only changes the target it passes to it.
- Recorded positions are operational evidence visible to authorized office and operations staff; they are not exposed to clients.

## Dependencies

- Existing packing list lifecycle events (creation, progress transitions, workday events, and final completion) must remain the system of record that the location data attaches to.
- Existing job records must accommodate optional coordinates alongside their current text address fields.
- Web map selection depends on availability of a Google Maps browser experience in the office environment.
- Mobile devices must expose a platform location capability; devices without one degrade to the unavailable state.
