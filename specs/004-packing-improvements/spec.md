# Feature Specification: Packing Improvements

**Feature Branch**: `004-packing-improvements`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "packing improvements - we need a way to delete packing lists from the web application, we also need to fix the tab Packing in spanish to Lista de empaque. Also, in the app we need to change the main (home) screen, to show current Packing lists instead of open Files. In the app when users want to create a new packing list (there should be a button to do so) users can select one of the open Files (Export, Local or Warehouse only, do not include Import files). Also we need to review the synchronization of packages and items and pictures. Also there is an error when users click Complete on the packing list and the user signs, after that there is an error in the application and the packing list can't be closed (error is Network request failed). Also, when the user clicks on Complete the app should request what language to show the Packing list contents so the client can review it and then sign it off."

## Clarifications

### Session 2026-08-04

- Q: Should package/item/photo metadata be persisted during active session so web shows real box counts before completion? -> A: Persist full package/item/photo metadata to server during active session (debounced live-save), and web always reads server state.
- Q: How quickly must the web reflect mobile package/item/photo changes while online? -> A: Web reflects updates within a short eventual-consistency window (target under 10 seconds when online).
- Q: What deletion model should web packing list removal use? -> A: Soft delete from active views while preserving full history and related data for audit and recovery.
- Q: How should completion behave when signature is captured but server finalization cannot be confirmed immediately? -> A: Mark locally locked "Complete Pending Sync" immediately after signature, then transition to "Closed" after server confirmation.
- Q: What should web show while recent mobile changes are still propagating to server-visible totals? -> A: Show last known server counts with a visible "Sync in progress" indicator until fresh totals arrive.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Packing Lists in Web (Priority: P1)

An operations user can remove a packing list from the web application from the packing list area, and Spanish-speaking users see the packing tab labeled correctly as "Lista de empaque".

**Why this priority**: The web team needs direct operational control of packing lists and correct bilingual navigation text to avoid user confusion and operational delays.

**Independent Test**: From the web application, a user deletes an existing packing list and verifies it no longer appears in active lists, then switches to Spanish and confirms the packing tab label shows "Lista de empaque".

**Acceptance Scenarios**:

1. **Given** a user is viewing packing lists in the web application, **When** they choose delete and confirm the action, **Then** the selected packing list is removed from active web views.
2. **Given** the application language is Spanish, **When** the user opens the main navigation, **Then** the packing tab label is displayed as "Lista de empaque".
3. **Given** a delete request cannot be completed, **When** the failure is returned, **Then** the user sees a clear error and the packing list remains unchanged.

---

### User Story 2 - Start Packing from Mobile Home (Priority: P1)

A mobile operator sees current packing lists on the home screen and can create a new packing list using a dedicated action. During creation, the operator can select only eligible open files (Export, Local, or Warehouse), while Import files are excluded.

**Why this priority**: This is the main daily workflow for warehouse and field users. The home screen and creation flow must focus on packing work, not unrelated records.

**Independent Test**: On mobile home, the user sees current packing lists, taps a "New Packing List" action, and can only choose eligible open files. Import files are not selectable.

**Acceptance Scenarios**:

1. **Given** a user opens the mobile app home screen, **When** current packing data is available, **Then** the home screen displays current packing lists instead of open files.
2. **Given** a user taps the new packing list action, **When** the selectable file list is shown, **Then** only open Export, Local, and Warehouse files are available.
3. **Given** only open Import files exist, **When** the user attempts to create a new packing list, **Then** the app informs the user that no eligible files are available.

---

### User Story 3 - Complete and Sign Off Reliably (Priority: P1)

When completing a packing list in mobile, the app asks which language to use for client review content, then captures signature and completes the list without leaving it stuck in an uncloseable state. Package, item, and picture synchronization remains consistent before and after completion.

**Why this priority**: Completion and sign-off are business-critical and client-facing. Failures at this step block operations and create legal and customer-service risk.

**Independent Test**: A user completes a packing list after selecting language and capturing signature, even under intermittent connectivity, and the packing list reaches a closed state with no data loss in packages, items, or pictures.

**Acceptance Scenarios**:

1. **Given** a packing list is ready to complete, **When** the user taps complete, **Then** the app prompts for the review language before showing final client review.
2. **Given** a review language is selected, **When** the client reviews and signs, **Then** the packing list content is shown in the selected language and signature is captured.
3. **Given** signature capture succeeds, **When** the user confirms completion and server confirmation is not yet available, **Then** the packing list moves to a locked "Complete Pending Sync" state and no "Network request failed" dead-end blocks progress.
4. **Given** a packing list is in "Complete Pending Sync", **When** connectivity and server finalization succeed, **Then** the status transitions automatically to "Closed" without losing packages, items, pictures, or signature.

---

### Edge Cases

- A user attempts to delete a packing list that is already being viewed by another user in web.
- The mobile app receives a stale eligible file list while new files were opened recently.
- A packing list has many package photos and connectivity switches repeatedly between online and offline during sync.
- The user selects one language for review, then changes it before signature confirmation.
- Completion is triggered twice quickly by double-tap or delayed UI feedback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a delete action for packing lists in the web application.
- **FR-002**: The web delete flow MUST require explicit user confirmation before removal.
- **FR-003**: After successful deletion, the packing list MUST no longer appear in active web packing list views.
- **FR-003a**: Deletion MUST be implemented as soft delete, preserving related package, item, picture, and audit history data for traceability and possible recovery.
- **FR-004**: The Spanish navigation label for the packing tab MUST be shown as "Lista de empaque".
- **FR-005**: The mobile home screen MUST display current packing lists as the primary content instead of open files.
- **FR-006**: The mobile app MUST provide a clear action to create a new packing list from the home screen.
- **FR-007**: During mobile packing list creation, users MUST be able to select only open files in categories Export, Local, and Warehouse.
- **FR-008**: During mobile packing list creation, open Import files MUST be excluded from selection.
- **FR-009**: If no eligible open files are available, the mobile app MUST inform the user and prevent creation until an eligible file exists.
- **FR-010**: The system MUST preserve consistency of packages, package items, and package pictures during synchronization across mobile and web-visible records.
- **FR-010a**: During an active mobile session, the app MUST continuously persist the full packing list state (including package rows, item rows, and photo metadata) to the server using debounced live-save; persistence MUST NOT wait for final completion.
- **FR-010b**: The web packing view MUST use server-persisted package data as the source of truth for box counts and item/photo-related totals, so in-progress packing lists do not display as zero boxes when package data has been saved.
- **FR-010c**: When mobile connectivity is online and saves are succeeding, the web packing view MUST reflect updated package and item/photo totals within an eventual-consistency window of 10 seconds or less.
- **FR-010d**: While newer mobile changes are still propagating, the web packing view MUST display last known server counts together with a visible "Sync in progress" indicator rather than showing zero placeholders.
- **FR-011**: The system MUST detect and surface synchronization failures with actionable user feedback.
- **FR-012**: When a user selects complete on mobile, the app MUST ask which language to use for client review before signature capture.
- **FR-013**: The selected review language MUST control how packing list contents are presented to the client during sign-off.
- **FR-014**: After client signature and completion confirmation, the app MUST immediately place the packing list in a locked "Complete Pending Sync" state if server finalization is not yet confirmed.
- **FR-015**: If immediate network finalization fails, the app MUST retain the completion intent and retry automatically without losing signature, package, item, or picture data, and transition to "Closed" once server confirmation succeeds.
- **FR-016**: Packing lists in "Complete Pending Sync" and "Closed" states MUST be protected from unintended further edits.
- **FR-017**: Material delete and completion actions MUST remain traceable in operational history.

### Key Entities *(include if feature involves data)*

- **Packing List**: Operational packing record containing status, linked file, packages, client review language choice, and sign-off state.
- **Open File**: Eligible source record used to start a new packing list; only Export, Local, and Warehouse categories are allowed for this feature.
- **Package**: Unit within a packing list identified for tracking and containing item and picture records.
- **Package Item**: Declared content entry associated with a package.
- **Package Picture**: Image evidence attached to a package and synchronized with its parent package.
- **Completion Record**: Finalization outcome for a packing list including review language selection, signature capture result, "Complete Pending Sync" and "Closed" states, and retry status if finalization is delayed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users tested in Spanish see "Lista de empaque" as the packing tab label.
- **SC-002**: In user acceptance testing, users can delete a packing list from web in under 30 seconds including confirmation.
- **SC-003**: 100% of mobile new-packing-list flows exclude Import files from selectable options.
- **SC-004**: At least 95% of users can start a new packing list from mobile home without assistance on first attempt.
- **SC-005**: At least 99% of completion attempts with signature reach "Complete Pending Sync" or "Closed" immediately without manual technical intervention.
- **SC-009**: At least 99% of "Complete Pending Sync" packing lists transition to "Closed" automatically within 5 minutes once stable connectivity is available.
- **SC-006**: In network interruption test cases, 100% of completion attempts preserve signature, package, item, and picture data after automatic retry.
- **SC-007**: Support incidents related to "Network request failed" during packing completion are reduced by at least 80% within one month after release.
- **SC-008**: In online operation tests, at least 95% of mobile package/item/photo changes are visible in the web packing view within 10 seconds.

## Assumptions

- Existing role permissions already define which users can manage packing lists in web and mobile contexts.
- Deletion removes packing lists from active operational views while preserving required traceability records.
- "Current packing lists" on mobile home includes active and recently pending-completion lists relevant to ongoing operations.
- Open file categories already distinguish Export, Local, Warehouse, and Import clearly enough for user-facing filtering.
- Client review language options for completion are limited to English and Spanish for this phase.
- Existing business rules for signature capture validity remain unchanged except for the new language-selection prompt and completion reliability improvements.
