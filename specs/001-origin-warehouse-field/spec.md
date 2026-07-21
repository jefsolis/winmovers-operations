# Feature Specification: Origin Warehouse Field for Import Jobs

**Feature Branch**: `001-origin-warehouse-field`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "almacen de origen - I need a new field in the Import Jobs, after Origin Address I need another field named Almacen de Origen (translate the field name from Spanish), this will help users know what is the name of the place the load must be recollected from, this field can be empty"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record the origin warehouse for an import job (Priority: P1)

An operations user creating or editing an import job needs to capture the name of
the warehouse or facility where the shipment must be collected from at origin.
They enter this name in a dedicated "Origin Warehouse" field positioned directly
after the Origin Address, so the collection location is clearly identified apart
from the street address.

**Why this priority**: This is the core purpose of the feature — without the
ability to enter and save the origin warehouse name, the feature delivers no
value. It is the minimum viable slice.

**Independent Test**: Can be fully tested by opening an import job, entering a
value in the Origin Warehouse field, saving, and confirming the value persists
and is displayed when the job is reopened.

**Acceptance Scenarios**:

1. **Given** a user is creating an import job, **When** they view the origin
   section, **Then** an "Origin Warehouse" field appears immediately after the
   Origin Address field.
2. **Given** a user enters a warehouse name in the Origin Warehouse field,
   **When** they save the job, **Then** the entered value is stored and shown
   when the job is reopened.
3. **Given** an import job with a saved Origin Warehouse value, **When** the user
   edits and changes the value, **Then** the updated value replaces the previous
   one after saving.

---

### User Story 2 - Leave the origin warehouse empty (Priority: P2)

An operations user may not yet know the collection warehouse when creating an
import job, so they must be able to save the job with the Origin Warehouse field
left blank and fill it in later.

**Why this priority**: Optionality is an explicit requirement; the field must
never block saving. Important but secondary to being able to capture the value.

**Independent Test**: Can be tested by creating or editing an import job while
leaving the Origin Warehouse field empty and confirming the job saves without
error and shows an empty value.

**Acceptance Scenarios**:

1. **Given** a user is creating or editing an import job, **When** they leave the
   Origin Warehouse field empty and save, **Then** the job is saved successfully
   with no value for the field.
2. **Given** an import job that has an Origin Warehouse value, **When** the user
   clears the field and saves, **Then** the field is stored as empty.

---

### Edge Cases

- What happens when the field is left empty? The job saves normally and the field
  displays as blank wherever import job details are shown.
- How does the system handle a very long warehouse name? The value is accepted up
  to the standard text-field length used for other address/name fields.
- How does the field behave for non-import jobs? The field is scoped to import
  jobs and does not alter the origin section of other job types.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an "Origin Warehouse" field on the import
  job form, positioned immediately after the Origin Address field.
- **FR-002**: The system MUST allow the Origin Warehouse field to be left empty
  and MUST save the import job successfully when it is empty.
- **FR-003**: The system MUST persist the Origin Warehouse value when an import
  job is created or updated, and MUST display the saved value when the job is
  viewed or edited.
- **FR-004**: The system MUST allow the Origin Warehouse value to be edited and
  cleared, storing the latest value (including empty) on save.
- **FR-005**: The Origin Warehouse field label MUST be presented in both English
  ("Origin Warehouse") and Spanish ("Almacén de Origen"), consistent with the
  application's bilingual behavior.

### Key Entities *(include if feature involves data)*

- **Import Job**: An operational record for an inbound (import) move. Gains a new
  optional attribute representing the name of the origin warehouse / collection
  facility, logically associated with the job's origin information.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can enter and save an Origin Warehouse value on an import job
  and see it persist across page reloads 100% of the time.
- **SC-002**: Import jobs can be saved with the Origin Warehouse field empty
  without any validation error 100% of the time.
- **SC-003**: The Origin Warehouse field is visible on every import job form,
  positioned directly after Origin Address, in both supported languages.

## Assumptions

- The field applies to import jobs; "Origin Warehouse" is the chosen English
  translation of "Almacén de Origen".
- The field is a free-text name field, following the same length and validation
  conventions as existing origin/address text fields.
- The field is optional and requires no default value.
- Existing import job records without this value will display it as empty until
  populated.
- No reporting, filtering, or search behavior over this new field is required in
  this iteration.
