# Feature Specification: WinMovers Packing Mobile App

**Feature Branch**: `003-packing-mobile-app`

**Created**: 2026-08-03

**Status**: Draft

---

## Clarifications

### Session 2026-08-03

- Q: Must a Packing List be formally completed before any data is saved to the server, or can it sync to the server incrementally during an active session while connectivity is available? → A: When connectivity is available, the packing list is a live session that automatically saves changes to the server in real-time. Completion is a distinct, formal step that locks the record and triggers the client email; sync does not require completion first.
- Q: When are package photos uploaded to cloud storage — immediately when taken (if online), or as a batch at the completion step? → A: Photos upload to cloud storage immediately when taken if the device is online. Offline photos are queued locally and uploaded as soon as connectivity is restored.
- Q: Can the web application or another device edit an in-progress packing list while the mobile session is active, requiring the app to pull remote changes during the session? → A: The web app has read-only visibility. The mobile app does not need to pull remote changes from the web during an active session. (Device-to-device continuity addressed in Q6 below.)
- Q: How should the live-save mechanism push changes to the server — full-state snapshot after each change (debounced) or per-action incremental endpoints? → A: Full-state PUT debounced after each local change. The process is fully transparent to the operator — no manual trigger is ever required during an active session.
- Q: Should in-progress packing lists be visible in the web app before the operator marks them Complete? → A: Yes. As soon as any data has been saved to the server, the packing list is visible read-only on the Moving File page in the web app.
- Q: What triggers the confirmation email to the client — the backend on receiving Complete status, an explicit operator action, or creation of the packing list? → A: The backend sends the email automatically when it processes the Complete status. The mobile app has no involvement in email delivery.
- Q: Can a packing list created on one mobile device be opened and continued on a different device, so that if a device becomes unavailable another device can take over? → A: Yes. All non-finalized packing lists must be visible in the app on any device and available to continue. The session ownership model for concurrent device access will be confirmed during planning.
- Q: When two mobile devices attempt to edit the same non-finalized packing list, how is the conflict resolved? → A: One device holds an active edit lock at a time. When a second device opens the list it must explicitly take ownership; once it does, the previous device becomes read-only until it reloads the latest server state.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticate Once, Work Indefinitely (Priority: P1)

A warehouse or on-site staff member logs into the mobile app using the shared Bodega Azure AD account. After the first successful login, the app silently renews the session whenever network access is available. If the device goes offline, the operator continues to use the app normally — they are never prompted to log in again due to lack of connectivity.

**Why this priority**: All other functionality depends on authentication being transparent and non-blocking. Operators work in warehouses and client locations where connectivity is unreliable; a login wall would halt operations entirely.

**Independent Test**: Can be fully tested by logging in once on a new device install, toggling airplane mode on, and verifying that all app screens remain accessible after restarting the app. Delivers the ability to use the app on-site without internet.

**Acceptance Scenarios**:

1. **Given** the app is freshly installed and connectivity is available, **When** the operator logs in with the shared Bodega account, **Then** the app authenticates and proceeds to the home screen without further credential prompts.
2. **Given** the operator is authenticated and the device loses connectivity, **When** the operator opens any app screen or creates a new packing list, **Then** the app works normally with no authentication error.
3. **Given** the operator is authenticated and connectivity is restored after an extended offline period, **When** the app detects the network, **Then** the session token is silently refreshed without any user interaction.
4. **Given** the operator has never logged in on a newly installed app and there is no network, **When** the operator opens the app, **Then** the app shows a clear message indicating that a first-time login requires connectivity and cannot proceed offline.

---

### User Story 2 - Create a Packing List Linked to a Moving File (Priority: P1)

An operator at a client's location opens the app and creates a new Packing List. They select the relevant Moving File (LOCAL, EXPORT, or WAREHOUSE category) from a cached list, enter their name, and begin the packing process. The packing list is immediately saved locally so that work is never lost — even if the device is powered off mid-process.

**Why this priority**: This is the entry point for the entire workflow. Without the ability to create a packing list and link it to the correct file, no subsequent work can proceed.

**Independent Test**: Can be tested by creating a packing list in airplane mode using a cached list of Moving Files, closing the app, reopening it, and confirming the draft packing list is visible and intact.

**Acceptance Scenarios**:

1. **Given** the operator opens the app with cached Moving Files, **When** they tap "New Packing List" and select a Moving File, **Then** a new packing list record is created locally with the selected file, the operator's name, and the current date/time, and its status is set to "Draft".
2. **Given** the operator is creating a packing list, **When** no Moving Files are cached (e.g., first launch with no prior sync), **Then** the app displays a message indicating that a network connection is needed to fetch available files before proceeding.
3. **Given** a draft packing list exists, **When** the operator closes and reopens the app, **Then** the draft packing list is displayed in the home screen and can be resumed.
4. **Given** connectivity is available, **When** the app launches or regains network access, **Then** the list of available Moving Files is refreshed from the server and the cache is updated.
5. **Given** a packing list was started on a different device and has been partially saved to the server, **When** an operator opens the app on a new device while online, **Then** the packing list appears in the home screen list and the operator can open it and continue adding packages from the point where it was left off.

---

### User Story 3 - Scan and Build Packages (Priority: P1)

The operator scans the barcode on a physical box using the device camera. A new Package is created with that barcode as its identifier. The operator then selects item types from a predefined list (e.g., "Books", "Clothing", "Electronics") and assigns quantities to document what is inside. If a barcode cannot be scanned, the operator types it manually. If an item type is not in the list, the operator types a custom item name.

**Why this priority**: Package documentation is the core value of the packing list. Without this capability the app has no purpose.

**Independent Test**: Can be tested entirely offline by scanning a barcode, adding items from the cached list, adding a custom item, and confirming the package appears in the packing list with correct contents.

**Acceptance Scenarios**:

1. **Given** a packing list is open, **When** the operator activates the camera scanner and scans a barcode, **Then** a new Package is created with that barcode as its ID and added to the packing list.
2. **Given** the camera scan fails or is unavailable, **When** the operator selects "Enter Manually", **Then** the app provides a text field to type the barcode value, and the package is created the same way as a scanned one.
3. **Given** a package is open, **When** the operator selects an item type from the predefined list and sets a quantity, **Then** the item is added to the package's contents list.
4. **Given** a package is open and the needed item type is not in the list, **When** the operator types a custom item name, **Then** the custom item is accepted, saved locally, and will be included in the sync payload.
5. **Given** the app is offline, **When** the operator adds items to packages, **Then** the predefined item type list is served from the local cache and the experience is fully functional.
6. **Given** connectivity is available, **When** the app refreshes the item type list from the server, **Then** any newly added or updated item types become available in the picker on the next packing session.

---

### User Story 4 - Photograph Packages (Priority: P1)

The operator takes one or more photos of a Package's contents using the device camera. The photos are saved to the device and associated with the package. Photos are displayed as thumbnails within the package detail view. When the device is online during the session, each photo is uploaded to cloud storage immediately after it is captured. When the device is offline, photos are saved locally and queued; they are uploaded automatically as soon as connectivity is restored.

**Why this priority**: Photographic evidence of contents is a key legal and operational requirement for international moving. Missing photos can cause disputes.

**Independent Test**: Can be tested by adding photos to packages in airplane mode and verifying they appear as thumbnails in the package detail. Delivers photo documentation capability independently of sync.

**Acceptance Scenarios**:

1. **Given** a package is open, **When** the operator taps "Add Photo" and takes a photo with the device camera, **Then** the photo is saved to local device storage and a thumbnail is displayed in the package view.
2. **Given** a package has photos, **When** the operator views the package detail, **Then** all photos are displayed as thumbnails and can be tapped to view full-size.
3. **Given** a package has photos, **When** the packing list is in draft or complete status (not yet synced), **Then** the photos remain available for viewing on the device.
4. **Given** a package is open, **When** the operator taps "Add Photo" multiple times, **Then** each photo is added independently and all are associated with that package.

---

### User Story 5 - Capture Client Signature (Priority: P2)

At the end of the packing session, the operator presents the device to the client. The app displays a summary of the packing list — all packages and their item contents — and allows the client to select their preferred language (Spanish or English) for the displayed item names. The client signs on the device screen with their finger. The signature is saved locally and will be uploaded during sync.

**Why this priority**: The client signature represents acceptance and is legally significant, but can only occur after all packages are documented (P1 stories complete).

**Independent Test**: Can be tested by completing a packing list, navigating to the signature screen, changing the display language, drawing a signature, and confirming it is saved and shown as a thumbnail on the review screen.

**Acceptance Scenarios**:

1. **Given** a packing list has at least one package, **When** the operator navigates to the "Client Sign-off" step, **Then** the app displays all packages, their item contents, and item quantities.
2. **Given** the sign-off screen is displayed, **When** the operator selects "English" or "Spanish" for item names, **Then** all item type labels on the sign-off screen update to the selected language without losing any data.
3. **Given** the client is viewing the sign-off screen, **When** the client draws their signature in the signature area and confirms, **Then** the signature image is saved locally and associated with the packing list.
4. **Given** a signature has been captured, **When** the operator marks the packing list as "Complete", **Then** the packing list status changes to "Complete" and it is added to the sync queue.
5. **Given** the packing list is in complete status, **When** the operator opens it, **Then** the captured signature is displayed as a preview and the packing list is locked from further editing.

---

### User Story 6 - Auto-Save Live Sessions and Sync on Completion (Priority: P2)

When the device has network connectivity during an active packing session, the app automatically and continuously saves changes — packages, item assignments, and photos — to the server as the operator works. No manual sync action is required. When the device is offline, all changes are saved locally and pushed to the server as soon as connectivity is restored. When the operator formally marks the packing list "Complete" after the client signs off (or declines), the server finalizes the record and sends a confirmation email to the client.

**Why this priority**: Live-save ensures work is never lost to device failure and keeps the final completion step lightweight. It depends on the core package documentation workflows (P1 stories) and the client sign-off step (User Story 5).

**Independent Test**: Can be tested by (a) creating a packing list while online and verifying the server record is created after the first package is scanned — without completing the list — and (b) going offline mid-session, adding more packages, reconnecting, and verifying those additions are automatically pushed to the server.

**Acceptance Scenarios**:

1. **Given** an active packing session and the device has network connectivity, **When** the operator adds a package, an item, or a photo, **Then** the change is automatically saved to the server without any operator action and the packing list status shows "Active".
2. **Given** an active session that is online, **When** the device loses connectivity, **Then** subsequent changes are saved locally only and the packing list status indicates it is working offline.
3. **Given** an active session with locally-saved changes and the device regains connectivity, **When** connectivity is restored, **Then** the app automatically resumes live-saving and pushes all outstanding local changes to the server.
4. **Given** the operator has documented all packages and captured the client signature, **When** the operator marks the packing list "Complete", **Then** the packing list is locked from further editing, the server finalizes the record, and a confirmation email is sent to the client.
5. **Given** a packing list in "Error" status, **When** the operator taps "Retry", **Then** the sync retries the failed step and the operator sees the updated result.
6. **Given** an active online session and a specific save action fails (network drop, server error), **When** the failure occurs, **Then** the failed change is queued locally and retried automatically on the next available opportunity; the operator is notified if the error persists beyond a short retry window.

---

### Edge Cases

- What happens if the device runs out of storage while taking photos? The app must alert the operator and allow them to free up space before continuing.
- What happens if a Moving File is deleted on the server after it has been cached on the device? The packing list already linked to it must still be submittable; the server handles the association error gracefully.
- What happens if the operator switches to a different Moving File after adding packages? A warning must confirm that relinking the file does not discard the already-added packages.
- What happens if the client refuses to sign? The operator must be able to mark the packing list as complete without a signature, with a note indicating the client declined.
- What happens if two syncs are triggered simultaneously (manual + automatic)? Only one sync process runs at a time; the second is queued or ignored.
- What happens if connectivity drops mid-session after some changes have already been live-saved to the server? The local SQLite database always holds the full authoritative current state. On reconnect, the app resumes live-saving and reconciles outstanding local changes with the partial server record; no data is lost.
- What happens if a device that had unsynchronised offline changes is replaced by a new device that opens the same packing list from the server? The server's latest confirmed state is used as the baseline on the new device; any unsynced local changes on the old device are superseded once the new device saves.
- What happens if a device holds the edit lock and goes permanently offline (device lost or broken)? The app on a new device MUST be able to forcibly take ownership regardless of the previous device's lock state, since there is no way to release the lock from a dead device.
- What happens if a scanned barcode already exists in the current packing list? The app warns the operator of the duplicate and does not create a second package with the same barcode.

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Access**

- **FR-001**: The app MUST authenticate the operator using the shared Bodega Azure AD account via MSAL and store the refresh token securely on the device keychain so that subsequent launches do not require re-entering credentials.
- **FR-002**: The app MUST silently refresh the access token in the background whenever connectivity is available, with no user interaction required.
- **FR-003**: The app MUST allow full offline operation — including creating, editing, and completing packing lists — when a valid session exists but connectivity is unavailable; the operator MUST NOT be locked out of local data due to an expired access token during offline use.
- **FR-004**: On first install with no prior authentication, the app MUST require network connectivity for the initial login and MUST display a clear explanation if launched offline without credentials.

**Moving File Cache**

- **FR-005**: The app MUST fetch the list of available Moving Files (LOCAL, EXPORT, and WAREHOUSE categories) from the backend when online and cache the result locally.
- **FR-006**: The app MUST serve the cached Moving File list when offline, allowing operators to link packing lists to files without connectivity.

**Packing List Management**

- **FR-007**: The app MUST allow the operator to create a new Packing List by selecting a Moving File from the cached list and recording the operator name and creation timestamp.
- **FR-008**: Each Packing List MUST have a sync status reflecting its current state: **Local** (created or modified while offline, not yet saved to server), **Active** (online session in progress — changes are being automatically saved to the server as they occur), **Complete** (operator has formally closed the list; pending final server confirmation if the device was offline at the time of completion), **Synced** (server has confirmed the completed packing list), or **Error** (a sync step failed and manual retry is needed). When connectivity is available during an active session, the status MUST transition from Local to Active automatically.
- **FR-009**: All Packing List data — including packages, items, and local file paths for photos and the signature — MUST be persisted locally so that no data is lost if the app is closed or the device restarts. When online, the app MUST also fetch all non-finalized and recently completed packing lists from the server so that packing lists created on other devices are available to open and continue on this device.
- **FR-010**: The app MUST display all packing lists on the home/list screen with their current status, including packing lists created on other devices that have been fetched from the server.

**Package Creation**

- **FR-011**: The app MUST allow the operator to add a Package to a Packing List by scanning a barcode with the device camera.
- **FR-012**: The app MUST provide a manual barcode entry fallback when the camera scan fails or is unavailable.
- **FR-013**: The app MUST prevent duplicate barcodes within the same Packing List and display a warning if a duplicate is scanned or entered.

**Package Contents**

- **FR-014**: The app MUST fetch the list of PackingItemType entries from the backend when online and cache the result locally.
- **FR-015**: The operator MUST be able to assign items from the cached PackingItemType list to a Package, specifying a quantity (integer, minimum 1) and an optional note per item.
- **FR-016**: If the required item type is not in the cached list, the operator MUST be able to type a custom item name; custom items MUST be stored locally and included in the sync payload.

**Package Photos**

- **FR-017**: The operator MUST be able to capture one or more photos of a Package using the device camera; each photo MUST be saved to local device storage and associated with its Package. If the device is online at the time of capture, the photo MUST be uploaded to cloud storage immediately and the remote URL stored alongside the local path. If the device is offline, the photo is queued locally and uploaded automatically when connectivity is next available.
- **FR-018**: The app MUST display captured photos as thumbnails within the Package detail view.

**Client Sign-off**

- **FR-019**: Before completing a Packing List, the app MUST display a summary of all Packages and their item contents, with an option to view associated photos.
- **FR-020**: The sign-off screen MUST allow the operator to toggle the language of displayed item type names between Spanish and English to match the client's preference.
- **FR-021**: The app MUST provide a signature capture area where the client can sign with their finger; the captured signature MUST be saved locally as an image.
- **FR-022**: The operator MUST be able to complete a Packing List without a client signature if the client declines, with a mandatory note indicating refusal.
- **FR-023**: Once a Packing List is marked Complete, it MUST be locked from further editing. If connectivity is available at the time of completion, the final completion state is immediately confirmed with the server. If the device is offline at the time of completion, the final confirmation is saved locally and sent to the server when connectivity is next available.

**Sync & Submission**

- **FR-024**: The app MUST automatically detect network connectivity changes. When the device is online during an active packing session, the app MUST continuously save in-progress changes (packages, items, photos) to the server without requiring operator action. When connectivity is gained or restored, any locally-queued changes for active sessions MUST be pushed to the server automatically, and any Packing Lists in Complete or Error status MUST also be finalized with the server.
- **FR-025**: Live-save during an active session MUST be fully automatic and transparent to the operator. No manual save, sync button, or confirmation MUST be required during a packing session. The app MUST silently debounce local changes and push the full current packing list state to the server after a short idle window (targeting 2–3 seconds after the last action).
- **FR-025a**: The app MUST support cross-device continuity: any device can fetch a non-finalized packing list from the server and continue it. A server-side edit lock tracks which device currently holds write access. When a second device opens an actively-locked packing list, the app MUST display a warning that another device is editing it and require the operator to explicitly confirm taking ownership before edits are allowed. Once ownership is transferred, the previous device MUST be demoted to read-only and notified when it next attempts to save.
- **FR-025b**: In-progress packing lists that have been partially saved to the server MUST be visible read-only on the Moving File detail page in the existing web application. The web app MUST show the current status, operator name, package count, and item count without requiring the packing list to be marked Complete first.
- **FR-026**: During an active online session, the app MUST push the full current packing list state (packages, item assignments, and photo remote URLs for already-uploaded photos) to a single backend endpoint via a debounced PUT call after each change. Offline-queued changes MUST be flushed automatically in the same manner once connectivity returns, with no operator action required.
- **FR-027**: If any step of the sync fails, the Packing List status MUST be set to Error and the operator MUST be shown a clear, actionable error message; the packing list MUST remain retryable.
- **FR-028**: Only one sync process MUST run at a time; concurrent sync triggers MUST be deduplicated.
- **FR-029**: When the backend receives and confirms a Packing List status of Complete, it MUST automatically send a confirmation email with the packing list summary to the client email address on record for the linked Moving File. The mobile app MUST NOT be responsible for triggering or tracking email delivery.

**Language**

- **FR-030**: The app's primary UI language MUST be Spanish (all labels, navigation, and messages displayed to warehouse staff in Spanish by default).
- **FR-031**: The sign-off screen MUST support toggling item type labels between Spanish and English for the client's benefit without changing the rest of the app's language.

---

### Key Entities

- **PackingList**: Top-level document created by the operator on-site. Linked to one MovingFile. Contains operator name, creation date/time, a list of Packages, an optional client signature image reference, and a sync status. Visible read-only on the Moving File page in the web app as soon as any data has been saved to the server.
- **Package**: A physical box within a Packing List. Identified by a unique barcode within its Packing List. Contains a list of item assignments and a list of photo references.
- **PackageItem**: An item assigned to a Package. References a PackingItemType (or stores a custom name if not in the list). Has a quantity and an optional note.
- **PackagePhoto**: A photo captured for a Package. Stores the local file path before sync and the remote URL after successful upload.
- **ClientSignature**: A signature image captured for a Packing List. Stores the local file path before sync and the remote URL after upload. May be absent if the client declined.
- **PackingItemType**: A predefined item category (e.g., "Books", "Electronics"). Fetched from the server and cached locally. Has Spanish and English label variants.
- **MovingFile** *(cached)*: A reference to a Moving File on the server (LOCAL, EXPORT, or WAREHOUSE category). Cached locally for offline linking.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can create a complete packing list — from first package scan to client signature — without any network connection.
- **SC-002**: A completed packing list syncs successfully within 3 minutes of the device regaining network connectivity, assuming a typical packing list with up to 50 packages and 5 photos each.
- **SC-003**: After a successful sync, the client receives a confirmation email within 5 minutes.
- **SC-004**: The app remains usable (reading, creating, and completing packing lists) on a device that has been offline for up to 30 days, given that authentication was established while online.
- **SC-005**: An operator can scan and document a single package — barcode, items, and at least one photo — in under 2 minutes.
- **SC-006**: Failed syncs are surfaced to the operator within 30 seconds of the failure occurring, with a retry option immediately available.
- **SC-007**: The client sign-off screen renders the full packing list contents (all packages and item names in the selected language) within 3 seconds on a standard device.
- **SC-008**: 100% of packing lists created while offline are preserved and available for sync after the device reconnects — no data loss occurs from connectivity interruption.

---

## Assumptions

- The app targets Android and iOS devices used by warehouse staff; specific minimum OS versions will be determined during planning.
- The shared Bodega Azure AD account is already configured in Azure AD with appropriate permissions; account provisioning is out of scope for this feature.
- The backend endpoint `POST /api/packing-lists` and the photo/signature upload mechanism are new and will be built as part of this feature.
- The existing `GET /api/packing-item-types` endpoint is already implemented (from prior spec 002); the mobile app consumes it as-is.
- "WAREHOUSE" category Moving Files may or may not exist yet in the schema; this will be confirmed during planning and aligned with spec 002 outcomes.
- The client email address is stored on the Moving File's linked record (e.g., the Job's client); the backend will resolve this at submission time.
- Photos and the signature are stored on the device as staging artifacts; local device storage is not a permanent record. Photos are uploaded to cloud storage immediately when taken if the device is online; offline-captured photos are queued and uploaded automatically when connectivity is restored. The signature is uploaded at the point the client signs off (if online) or at next connectivity.
- Any mobile device running the app can see all non-finalized packing lists — including those created on other devices — and continue any of them. This enables device hand-off if a device becomes unavailable mid-session. Only one device holds the active edit lock at a time; a second device must take ownership explicitly before it can save changes.
- The monorepo `mobile/` directory is new; scaffolding and toolchain setup are in scope for the planning phase.
- A single operator is active on a device at a time; multi-user or concurrent session management on the same device is out of scope.
- Barcode format is not constrained; any scannable 1D or 2D barcode value is accepted as a package identifier.
