# Feature Specification: Warehouse File Type and Packing Item Type Management

**Feature Branch**: `002-warehouse-file-type`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "warehouse moving file type - Warehouse File Type and Packing Item Type Management — prerequisite additions to the existing web application for the forthcoming mobile packing app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and manage a Warehouse Moving File (Priority: P1)

An operations or warehouse staff member needs to create a Warehouse File to
represent a client's long-term storage at the warehouse. They create the file
from the Files section of the web app, selecting "Warehouse" as the file
category, and filling in the client, dates, and relevant details. The system
auto-assigns a sequential number with the prefix `B-` (e.g. `B-0001`). The file
appears in the Files list alongside Export, Import, and Local files, and can be
opened, edited, and closed.

**Why this priority**: This is the root entity the rest of the feature depends
on. Without it, Warehouse jobs cannot be created, and the mobile app cannot link
packing lists.

**Independent Test**: Can be fully tested by creating a Warehouse File through
the web app and confirming the auto-assigned `B-` number, that it appears in the
Files list, and that it can be set to CLOSED.

**Acceptance Scenarios**:

1. **Given** a staff member opens the "New File" form, **When** they select the
   WAREHOUSE category, **Then** the form saves the file, the system assigns the
   next `B-XXXX` number, and the file appears in the Files list.
2. **Given** a Warehouse File exists, **When** the staff member opens it,
   **Then** they see all relevant file details and a status of OPEN.
3. **Given** a Warehouse File with status OPEN, **When** the staff member
   changes the status to CLOSED and saves, **Then** the file is saved as CLOSED.
4. **Given** three Warehouse Files already exist (B-0001, B-0002, B-0003),
   **When** a new one is created, **Then** it is assigned B-0004.
5. **Given** the Files list is viewed, **When** Warehouse Files exist,
   **Then** they appear in the list alongside other file categories; the list can
   be filtered by category to show only WAREHOUSE files.

---

### User Story 2 - Warehouse Job auto-created and linked when a Warehouse File is created (Priority: P2)

When a Warehouse File is created, the system automatically creates a linked
Warehouse Job (a new Job type `WAREHOUSE`), following the same pattern used for
Export/Import files and their jobs. The job is linked to the file and a schedule
entry is auto-created on the date specified in the job.

**Why this priority**: Warehouse files need an associated job record so that
the scheduling and operational workflow functions the same way as other file
types.

**Independent Test**: Create a Warehouse File; confirm a WAREHOUSE job is
automatically created and linked, and that a schedule entry is created for the
selected service date.

**Acceptance Scenarios**:

1. **Given** a staff member saves a new Warehouse File with a service date,
   **Then** a new Job of type WAREHOUSE is auto-created, linked to that file,
   and a schedule entry is created for the service date.
2. **Given** a Warehouse File is created without a service date, **Then** a
   WAREHOUSE job is still created and linked, but no schedule entry is created
   (matching existing behavior for jobs without a date).
3. **Given** the new job exists, **When** it is opened in the web app,
   **Then** it shows job type WAREHOUSE and the link back to the Warehouse File.

---

### User Story 3 - Admin manages the Packing Item Type catalog (Priority: P3)

An admin user needs to maintain the predefined list of item types that warehouse
operators assign to packages in the mobile app (e.g. "Caja", "Mueble",
"Electrónico"). They must be able to add new item types, edit names, and
deactivate items that are no longer in use. Deactivated items disappear from the
mobile app but their historical data is preserved.

**Why this priority**: Required for the mobile app to function, but the catalog
can be populated after Warehouse Files are working. Deactivation (soft-delete)
ensures historical records remain intact.

**Independent Test**: Log in as an admin, open the Item Types management page,
create a new item type, edit it, deactivate it, and confirm the API response for
`GET /api/packing-item-types` excludes deactivated entries.

**Acceptance Scenarios**:

1. **Given** an admin user opens the Item Types management page, **Then** they
   see all existing item types with their names and active/inactive status.
2. **Given** the admin enters a new item type name and saves, **Then** the new
   entry is added with `active = true` and appears in the list.
3. **Given** the admin edits an existing item type name and saves, **Then** the
   updated name is reflected in the list and in the API response.
4. **Given** the admin deactivates an item type, **Then** it is marked inactive
   and no longer returned by `GET /api/packing-item-types`.
5. **Given** a non-admin user navigates to the Item Types management page,
   **Then** they are denied access (redirected or shown an error).

---

### User Story 4 - Mobile app fetches active item types via API (Priority: P4)

The mobile app (and any other consumer) can fetch the current list of active
packing item types from `GET /api/packing-item-types` to cache and use offline.
The endpoint returns all active entries ordered by name.

**Why this priority**: Downstream dependency of the mobile app, but the endpoint
is simple once the entity exists.

**Independent Test**: Call `GET /api/packing-item-types` and confirm it returns
only active entries, sorted by name, including any custom fields the mobile app
needs.

**Acceptance Scenarios**:

1. **Given** active and inactive item types exist, **When** `GET /api/packing-item-types`
   is called, **Then** only active entries are returned, sorted alphabetically
   by name.
2. **Given** the endpoint is called without authentication, **Then** it returns
   a 401 (the endpoint requires a valid JWT, consistent with all other API
   endpoints).

---

### Edge Cases

- What happens if a Warehouse File is created and the auto-job creation fails?
  The file creation should succeed and the error is logged; a staff member can
  create the job manually.
- What happens if `B-` numbering reaches `B-9999`? The auto-number increments
  beyond four digits (e.g. `B-10000`), following the same pattern as other file
  types.
- What happens if an admin deactivates an item type that is already referenced
  in historical packing list records on the mobile? Deactivation is a soft flag;
  existing records retain their item type reference and display the name — no
  cascade delete.
- What if a Warehouse File is created for a client that already has open
  Warehouse Files? Multiple open Warehouse Files per client are allowed (no
  uniqueness constraint beyond the file number).

## Requirements *(mandatory)*

### Functional Requirements

**Warehouse File type:**

- **FR-001**: The system MUST support a `WAREHOUSE` category on Moving Files,
  alongside the existing `EXPORT`, `IMPORT`, and `LOCAL` categories.
- **FR-002**: The system MUST auto-assign a unique sequential number to each
  Warehouse File using the prefix `B-` (e.g. `B-0001`, `B-0002`), following
  the same zero-padded convention as other file types.
- **FR-003**: Staff MUST be able to create Warehouse Files manually through the
  web app Files section. Warehouse Files are NOT auto-created from Jobs.
- **FR-004**: Warehouse Files MUST have OPEN and CLOSED status, behaving
  identically to other file types in the lifecycle.
- **FR-005**: Warehouse Files MUST appear in the Files list view and have a
  detail/edit view in the web app. The Files list MUST support filtering by the
  WAREHOUSE category.

**Warehouse Job auto-creation:**

- **FR-006**: When a Warehouse File is created, the system MUST automatically
  create a linked Job of type `WAREHOUSE` and associate it with the file.
- **FR-007**: If the Warehouse File has a service date, the system MUST
  auto-create a schedule entry for the linked Job on that date, following the
  same logic used for other job types.
- **FR-008**: The new `WAREHOUSE` job type MUST be selectable and visible in the
  web app Jobs section alongside existing job types.

**Packing Item Type catalog:**

- **FR-009**: The system MUST provide a new `PackingItemType` entity with
  fields: unique identifier, name (text), active flag (boolean, default true),
  created timestamp, and updated timestamp.
- **FR-010**: Admin users MUST be able to view, create, edit, and
  soft-deactivate Packing Item Types through a dedicated web UI accessible only
  to users with the ADMIN role.
- **FR-011**: The system MUST expose a `GET /api/packing-item-types` endpoint
  that returns all active Packing Item Types ordered by name ascending.
  Authentication (valid JWT) is required.
- **FR-012**: All user-facing labels in the Packing Item Type management UI
  MUST be available in both English and Spanish via the existing i18n system.

### Key Entities *(include if feature involves data)*

- **MovingFile** (modified): gains the new `WAREHOUSE` category value and the
  `B-` auto-numbering logic. No other structural change.
- **Job** (modified): gains the new `WAREHOUSE` type value. A WAREHOUSE job is
  linked one-to-one with the Warehouse File that created it, following the
  existing `movingFileId` relation.
- **PackingItemType** (new): represents one entry in the predefined item
  catalog. Attributes: `id` (cuid), `name` (string, required), `active`
  (boolean, default `true`), `createdAt`, `updatedAt`. No relations to other
  models in this iteration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can create a Warehouse File and receive a correctly
  sequenced `B-XXXX` number within the same response, 100% of the time.
- **SC-002**: Every new Warehouse File automatically has a linked WAREHOUSE Job
  present in the database immediately after creation.
- **SC-003**: Admin users can add, edit, and deactivate Packing Item Types
  through the web UI without errors.
- **SC-004**: `GET /api/packing-item-types` returns only active entries sorted
  by name, and excludes deactivated entries within the same request cycle.
- **SC-005**: Non-admin users cannot access the Packing Item Type management UI
  or mutate item types via the API.

## Assumptions

- The `B-` prefix was confirmed by the user; the four-digit zero-padding
  convention (e.g. `B-0001`) follows the same pattern as `E-0001`, `D-0001`,
  `M-0001`, `V-0001`, `Q-0001`.
- Warehouse Files are standalone — not linked to an existing Job or Quote at
  creation time (unlike Export/Import files which can be auto-created from jobs).
- The auto-created WAREHOUSE Job inherits basic details from the Warehouse File
  (client, dates) using the same pattern as existing auto-job creation; the
  precise field mapping will be defined during planning.
- Item type names are entered in Spanish (the primary warehouse language) with
  no translation requirement on the name content itself; only the UI labels
  around the management interface are bilingual.
- The `GET /api/packing-item-types` endpoint requires authentication (JWT),
  consistent with all other `/api` endpoints; no public/anonymous access.
- Deactivating an item type does not affect historical records that reference it.
- The monthly billing feature for Warehouse Files (invoicing clients) is out of
  scope for this iteration; this spec covers only the file/job/catalog setup.
