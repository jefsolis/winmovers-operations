# WinMovers Operations — Feature Backlog

> Last updated: June 27, 2026  
> Items are grouped by theme. Priority and sprint assignment to be determined separately.

---

## 16. FIDI — Operational Inter-Continental Moving Activities Declaration (June 2026)

### ~~FIDI-01~~ ✅ — Year selection and summary totals for FIDI declaration report

**User story:** As an operations manager, I want to select one or more years and generate the FIDI declaration summary so I can fill in the annual activity report required for FAIM certification.

**Context:**
- FIDI requires members to declare inter-continental moving activity annually.
- The report has three sheets: Summary, List of Export Moves, and List of Import Moves.
- Only EXPORT and IMPORT jobs are included; DOMESTIC/LOCAL jobs are excluded.
- The "year" of a job is determined by its File creation date (`createdAt` on `MovingFile`).
- "Third Country Moves" is always 0% for WinMovers.
- "Custom clearance needed?" is always YES for all jobs.

**Acceptance criteria:**
- A new FIDI Report page is accessible from the main navigation (admin or management role).
- The user can select one or more calendar years to include in the report.
- The UI renders a summary table per selected year with:
  - Total Number of Inter-Continental Shipments acting as the Booker (jobs where `bookerRole = BOOKER`)
  - Total Number of Inter-Continental Shipments acting as the OA non-booker (jobs where `bookerRole = OA`)
  - Total Number of Inter-Continental Shipments acting as the DA non-booker (jobs where `bookerRole = DA`)
- The UI renders a percentages table per selected year with:
  - % Acting as the booker of the move (`BOOKER count / total * 100`)
  - % Performing OA services (`OA count / total * 100`)
  - % Performing DA services (`DA count / total * 100`)
  - % Booking Third Country Moves (always `0%`)
  - Total (always sums to `100%`)
- Percentages are rounded to two decimal places.
- If total jobs for a year is 0, percentages display as `0.00%` without dividing by zero.
- A backend API endpoint `GET /api/reports/fidi?years=2024,2025` returns the structured data for the selected years.

**Test checklist (post-implementation):**
- [ ] Select a single year and verify summary counts match manual count of EXPORT+IMPORT jobs by bookerRole for that year.
- [ ] Select multiple years and verify each year has its own independent table.
- [ ] Verify percentages sum to 100% for each year (accounting for rounding).
- [ ] Verify a year with 0 jobs shows 0 counts and 0.00% without errors.
- [ ] Verify DOMESTIC/LOCAL jobs are excluded from all counts.
- [ ] Verify Third Country Moves percentage is always 0%.

---

### ~~FIDI-02~~ ✅ — Export and Import job detail lists for FIDI declaration report

**User story:** As an operations manager, I want the FIDI report to show the full sequential list of Export jobs and the full sequential list of Import jobs per selected years, with no gaps, so I can copy the data into the FIDI Excel template and auditors can verify continuity.

**Context:**
- Sheet 2 of the FIDI template is "List of Export Moves"; sheet 3 is "List of Import Moves". They are separate lists.
- Transport method must be normalized: `ROAD`/`TERRESTRE` → `Land`, `SEA`/`MARITIMO` → `Sea`, `AIR`/`AEREO` → `Air`.
- "Custom clearance needed?" is always `YES`.
- All file numbers in the sequence must appear — no gaps. If a file has been soft-deleted or cancelled, its row must still appear so the numbering is complete and auditable.
- A soft-deleted or cancelled file row shows only Year and File Number; all other columns display `CANCELADO`.
- Data is read-only display — the user copies rows manually into the Excel template.

**Columns for Export list and Import list (separate tables):**
| Column | Source |
|---|---|
| Year | File `createdAt` year |
| File Number | `MovingFile.fileNumber` |
| Import or Export | `EXPORT` or `IMPORT` (from `MovingFile.category`) |
| Booker/OA/DA | `MovingFile.bookerRole` |
| Origin Agent | `Job.originAgent.name` |
| Destination Agent | `Job.destAgent.name` |
| Origin Country | `Job.originCountry` |
| Destination Country | `Job.destCountry` |
| DTD / PTD / DTP | `Job.serviceType` |
| Transport Method | Normalized from `Job.shipmentMode`: `Land` / `Sea` / `Air` |
| Volume | `Job.volumeCbm` (in CBM) |
| Custom clearance needed? | Always `YES` |

**Acceptance criteria:**
- The FIDI Report page displays the Export list and Import list as two separate tables below the summary tables.
- Each list is filtered to the selected years.
- The API query includes soft-deleted files (uses `includeDeleted: true` or equivalent) so no file number is omitted.
- Soft-deleted or cancelled file rows show Year and File Number only; all remaining columns display `CANCELADO`.
- Active rows have all columns populated normally.
- Transport method values are normalized to `Land`, `Sea`, or `Air` regardless of the stored language/case.
- Rows are sorted by year ascending, then by file number ascending with no gaps in the sequence.
- The API endpoint from FIDI-01 returns separate `exportList` and `importList` arrays.
- Each table has a "Copy to clipboard" or similar affordance to facilitate pasting into the Excel template.

**Test checklist (post-implementation):**
- [ ] Verify Export list and Import list are rendered as two separate tables.
- [ ] Verify Export list contains only EXPORT files; Import list contains only IMPORT files.
- [ ] Soft-delete an Export file and verify it still appears in the Export list as `CANCELADO`.
- [ ] Verify no file numbers are missing from either sequence (e.g. E-0001 through E-0010 all present if they exist).
- [ ] Verify `Road`/`Terrestre`/`ROAD` all normalize to `Land`.
- [ ] Verify `Sea`/`Maritimo`/`SEA` normalizes to `Sea`.
- [ ] Verify `Air`/`Aereo`/`AIR` normalizes to `Air`.
- [ ] Verify "Custom clearance needed?" always shows `YES` on active rows.
- [ ] Verify rows with null origin/destination agent display blank (no crash).
- [ ] Verify active job count in lists matches counts in the FIDI-01 summary tables for each year.
- [ ] Verify rows are sorted by year ascending then file number ascending.

---

## 15. File Deletion & Weight Unit Migration (June 2026)

### ~~SD-FILE-01~~ ✅ — Soft delete File records instead of physical delete

**User story:** As an operations user, I want deleting a File to archive it (soft delete) so records can be recovered and historical references remain valid.

**Context:**
- Current File deletion removes rows physically.
- The system needs reversible deletion behavior for Files while keeping operational integrity.

**Acceptance criteria:**
- Deleting a File marks it as deleted (for example with `deletedAt` and `deletedBy`) instead of removing the row.
- File list APIs exclude deleted records by default.
- Deleted Files cannot be edited, closed, or receive new attachments unless restored.
- Delete action is recorded in audit logs.

**Test checklist (post-implementation):**
- [x] Delete a File and verify the DB row remains with deleted marker fields set.
- [x] Confirm deleted File does not appear in default File lists.
- [x] Confirm direct update/close/upload calls on deleted File are rejected.
- [x] Confirm audit log contains the soft-delete action with actor and timestamp.

---

### ~~SD-FILE-02~~ ✅ — Add Deleted Files view and restore action

**User story:** As an admin/supervisor, I want to view and restore deleted Files from the UI so I can recover records deleted by mistake.

**Acceptance criteria:**
- File list UI supports filter/toggle: Active / Deleted / All.
- Deleted rows are visually distinct.
- Deleted File detail view is read-only except Restore.
- Restore action reactivates the File and makes it visible in normal views.
- Restore action is audited.

**Test checklist (post-implementation):**
- [x] Toggle Deleted filter and verify soft-deleted Files are listed.
- [x] Open deleted File and verify edit/close/upload actions are unavailable.
- [x] Restore deleted File and verify it reappears in active list.
- [x] Confirm restore action is logged in audit history.

---

### ~~SD-FILE-03~~ ✅ — Exclude deleted Files from all dashboard metrics and widgets

**User story:** As management, I want dashboards to ignore deleted Files so KPIs and operational reports reflect active data only.

**Acceptance criteria:**
- All dashboard queries and file-derived widgets exclude soft-deleted Files.
- Pound report, completion charts, no-invoice cards, and delivery alerts ignore deleted Files.
- Deleted Files only appear where explicitly requested (Deleted view / admin filters).

**Test checklist (post-implementation):**
- [x] Soft-delete a File that contributes to a dashboard card and verify the metric decreases accordingly.
- [x] Restore the same File and verify the metric returns.
- [x] Confirm deleted Files are absent from non-admin default dashboard flows.

---

### WT-LB-01 — Standardize weight unit to pounds (LB) for new and edited records

**User story:** As an operations user, I want weight captured and displayed in pounds so the system aligns with operational reporting.

**Acceptance criteria:**
- All relevant forms, details, documents, and reports use `LB` as displayed weight unit.
- API contract for weight fields is explicitly documented as pounds.
- Validation/help text references pounds instead of kilograms.

**Test checklist (post-implementation):**
- [ ] Create new File with weight and verify value is treated as LB in UI and API.
- [ ] Edit existing File weight and verify updated value is interpreted as LB.
- [ ] Verify all weight labels in File detail, summaries, and report widgets show LB.

---

### WT-LB-02 — Convert historical KG values to LB with safe migration controls

**Runbook:** [docs/WT_LB_02_PRODUCTION_RUNBOOK.md](docs/WT_LB_02_PRODUCTION_RUNBOOK.md)

**User story:** As a data owner, I want all historical weight values converted from KG to LB safely so existing records remain accurate after unit standardization.

**Context:**
- Historical records currently store weight values that were entered as kilograms.
- Migration must avoid double conversion.

**Acceptance criteria:**
- Migration converts historical values using: `LB = KG * 2.2046226218`.
- Conversion is idempotent (records are not converted twice).
- A conversion marker/strategy is implemented (for example: `weightUnit`, `weightConvertedAt`, or equivalent migration guard).
- Migration output includes counts: converted, skipped-null, skipped-already-converted, failed.
- Backup/snapshot and rollback procedure is documented before production run.

**Test checklist (post-implementation):**
- [ ] Run migration in staging and verify sample records against manual conversion.
- [ ] Re-run migration and verify no additional conversion occurs.
- [ ] Compare pre/post dashboard totals to validate expected proportional change.
- [ ] Execute production runbook with backup confirmation and post-run validation report.

---

## 1. Bug Fixes

### ~~BUG-01~~ ✅ — Coordinator email not sent for Export files

**Summary:** When a coordinator is assigned (or reassigned) to an Export `MovingFile`, the notification email is silently skipped. The same logic works correctly for Import files.

**Steps to reproduce:**
1. Create or edit an Export file.
2. Assign a coordinator with a valid email.
3. No email is received by the coordinator.

**Acceptance criteria:**
- Coordinator assignment email is sent for `EXPORT`, `IMPORT`, and `LOCAL` files on create and on reassignment.
- The email subject and body correctly identify the file category.
- Existing Import behavior is unchanged.

---

### ~~BUG-02~~ ✅ — Pre-Advice Email and Waybill Email attachment types appear in Import files

**Summary:** `PRE_ADVICE_EMAIL` (Correo de envío de Pre aviso) and `WAYBILL_EMAIL` (Correo de envío de Waybill) are incorrectly listed as required documents in Import files. They are Export-only concepts.

**Acceptance criteria:**
- Both attachment types are removed from `REQUIRED_ATTACHMENTS.IMPORT` in `constants.js`.
- Both remain in `REQUIRED_ATTACHMENTS.EXPORT`.
- Already-uploaded attachments of those types on existing Import files are not deleted; they simply move to the "Other" section.
- The file completion percentage for Import files is recalculated accordingly.

---

## 2. Quote — Personal Email Signatures

### ~~QT-01~~ ✅ — Staff member can configure a personal text signature block

**User story:** As a staff member, I want to define a personal text signature (my name, title, phone, and any custom text) so that it is automatically included when I create a quote, avoiding repetitive manual entry.

**Acceptance criteria:**
- An `emailSignature` text field is added to the `StaffMember` model (plain text or simple HTML).
- The Staff form (create and edit) includes a multi-line "Email Signature" textarea.
- The field is optional; leaving it blank produces no signature block in quotes.
- Changes to the signature only affect future quotes, not already-generated documents.

---

### ~~QT-01b~~ ✅ — Staff member can upload a handwritten signature image

**User story:** As a staff member, I want to upload a scanned or photographed image of my handwritten signature so that quotes look like I personally signed them.

**Acceptance criteria:**
- An "Upload Signature Image" control is added to the Staff form (create and edit), accepting PNG or JPEG up to 2 MB.
- The image is stored in Azure Blob Storage under a dedicated container path (e.g. `signatures/{staffId}.png`).
- A URL to the stored image is saved as `signatureImageUrl` on the `StaffMember` record.
- A preview of the uploaded image is shown in the Staff form below the upload button.
- The staff member can delete the current image (sets the field to null).
- If an image is present, it is rendered below the text signature block in the quote document.
- The image is displayed at a fixed height (e.g. 60 px) so it does not overwhelm the page layout.

---

### ~~QT-01c~~ ✅ — Staff member can draw a handwritten signature on a canvas

**User story:** As a staff member, I want to draw my signature directly on screen (using mouse or finger on touch devices) so that I do not need to scan a physical document.

**Acceptance criteria:**
- A "Draw Signature" tab/panel is added to the Staff form alongside the upload option, using the `signature_pad` library.
- The canvas is sized appropriately for both desktop (mouse) and mobile/tablet (touch/stylus).
- "Clear" button resets the canvas.
- "Save" converts the canvas content to a PNG and uploads it to Azure Blob Storage (same path as QT-01b: `signatures/{staffId}.png`), replacing any previous image.
- The saved result is displayed and used identically to an uploaded image (QT-01b); there is no distinction in storage or rendering.
- If the user has both drawn and uploaded an image at different times, the most recently saved one wins.

---

### ~~QT-02~~ ✅ — Quote document includes the creator's personal signature

**User story:** As a client, I want the quote I receive to include the creator's contact details and signature at the bottom, so I know exactly who to contact.

**Acceptance criteria:**
- When generating a quote PDF or preview, the signature of the staff member listed as quote creator is injected at the bottom of the document.
- If the creator has no signature configured, a sensible fallback (company name + phone only) is used.
- The signature renders correctly in both the in-browser preview and the exported PDF.
- Language of the signature block matches the quote language (EN / ES).

---

### ~~QT-03~~ ✅ — Quote form pre-fills creator from the currently logged-in user

**User story:** As a staff member, I want the "Created By" field in the quote form to default to me, so I do not have to select myself every time.

**Acceptance criteria:**
- When opening the new quote form, the creator is pre-selected with the current user's staff record (resolved via `/api/staff/me`).
- The user can still change the creator if needed (e.g., creating on behalf of a colleague).
- If the logged-in user has no linked staff record, the field is left blank.

---

## 3. Dashboard — Files Without Invoice (Export & Import)

### ~~DB-01~~ ✅ — Dashboard shows Export files without invoice

**User story:** As an operations manager, I want to see Export files that have no invoice attached, so I can follow up before the file is closed.

**Acceptance criteria:**
- A new dashboard card "Export Files Without Invoice" mirrors the existing local-file card pattern.
- Files are split into two sub-lists: ≤ 30 days old (recent) and 30+ days old (overdue).
- Each row links directly to the export file detail.
- The card is visible by default.
- An overdue row is highlighted in red.

---

### ~~DB-02~~ ✅ — Dashboard shows Import files without invoice

**User story:** As an operations manager, I want to see Import files that have no invoice attached.

**Acceptance criteria:**
- A new dashboard card "Import Files Without Invoice" with the same split / highlight logic as DB-01.
- The card is visible by default.

---

### ~~DB-03~~ ✅ — Consolidate "Files Without Invoice" into a single card (optional enhancement)

**User story:** As a power user, I want to view all file categories without invoice in a single card with tabs or filters, to avoid scrolling past three separate cards.

**Acceptance criteria:**
- Single card with a tab bar or segmented control: Export | Import | Local.
- Each tab shows the same recent / overdue breakdown.
- Replaces (or can optionally replace) the three individual cards.
- Tab selection is remembered per-user via the dashboard layout API.

---

## 4. Automatic Page Reload on New Deployment

### ~~UX-01~~ ✅ — App detects a new version and prompts the user to reload

**User story:** As a user, I want to be notified when a new version of the app has been deployed, so I am always using the latest features and bug fixes without manually refreshing.

**Proposed approach:**
- The build pipeline injects a `VITE_BUILD_ID` environment variable (e.g. git short SHA) into the frontend bundle.
- A lightweight polling hook (`useVersionCheck`) calls `GET /api/version` every 5 minutes.
- The backend `/api/version` endpoint returns `{ buildId: process.env.BUILD_ID }`.
- When the returned `buildId` differs from the one baked into the current bundle, a non-blocking toast/banner appears: *"A new version is available — click to reload."*
- Clicking the banner calls `window.location.reload()`.
- The banner is dismissible; once dismissed it does not reappear for that version.

**Acceptance criteria:**
- Polling is paused when the browser tab is hidden (`document.visibilityState`) to avoid unnecessary requests.
- The version endpoint is public (no auth required).
- No automatic forced reload — the user is always in control.
- `BUILD_ID` is set in the Dockerfile and CI workflow from the git SHA.

---

## 5. Audit Logs

### ~~AL-01~~ ✅ — System records an audit event for every create / update / delete

**User story:** As an administrator, I want every change to every record to be logged automatically, so I can answer "who changed this, and when?" at any time.

**Proposed data model:**
```
AuditLog {
  id          String   @id @default(cuid())
  entityType  String   // "Job" | "Visit" | "Quote" | "MovingFile" | "Client" | ...
  entityId    String
  action      String   // "CREATE" | "UPDATE" | "DELETE"
  userId      String?  // staffMember.id (null if action performed without a linked staff record)
  userName    String?  // snapshot of name at time of action
  before      Json?    // snapshot of record before the change (null for CREATE)
  after       Json?    // snapshot of record after the change (null for DELETE)
  changedKeys String[] // list of top-level keys that differ between before and after
  createdAt   DateTime @default(now())
}
```

**Acceptance criteria:**
- Audit logging is implemented as a shared helper `logAudit(req, entityType, entityId, action, before?, after?)` called from each route handler.
- CREATE, UPDATE, and DELETE routes for: Jobs, Visits, Quotes, MovingFiles, Clients, Agents, Staff all emit audit events.
- The audit log is append-only; no route allows deleting or editing audit records.
- `userId` and `userName` are resolved from `req.user.oid` → staff record at request time.
- Storage in a dedicated `AuditLog` Postgres table (separate from application data).

---

### ✅ AL-02 — Each record has a "History" tab showing its own audit trail

**User story:** As a coordinator, I want to open a Job (or Visit, or File) and see a timeline of every change made to it — who made it and what changed — so I can understand the current state of the record.

**Acceptance criteria:**
- A "History" (Historial) tab is added to the detail pages of: Job, Visit, Quote, MovingFile.
- The tab shows a reverse-chronological list of audit events for that entity.
- Each entry displays: timestamp, user name, action type (badge), and a diff of changed fields (old value → new value).
- Sensitive fields (none currently, but e.g. internal notes) can be excluded from the diff display via a configuration list.
- The tab only shows the history of the current record (not related records).
- Loading the History tab is lazy (fetched on tab click, not on page load).
- Backend: `GET /api/audit?entityType=Job&entityId=:id` — admin or the staff member who owns the record can access it.

---

### ✅ AL-03 — Centralized audit log page for administrators

**User story:** As an administrator, I want a single page where I can browse, filter, and search all audit activity across the entire system, so I can investigate incidents or review activity patterns.

**Acceptance criteria:**
- A new page `/admin/audit` is accessible only to users with `role = 'ADMIN'`.
- The page shows a paginated table: Timestamp | User | Action | Entity Type | Entity ID/Number | Changed Fields.
- Filters: date range, entity type, action (CREATE / UPDATE / DELETE), user.
- Search: free-text search against entity ID or user name.
- Each row in the table links to the relevant record detail page.
- Rows for deleted records link to a "Record has been deleted" placeholder.
- The page is added to the admin navigation section in the sidebar (admin-only).
- Backend: `GET /api/audit` with optional query params `entityType`, `action`, `userId`, `from`, `to`, `page`, `limit`. Admin-only middleware guard.

---

### AL-04 — Audit log actor email stored for unlinked Azure AD users

**Summary:** Unlinked users (Azure AD accounts with no matching `StaffMember` record) have their `userId` recorded as `null` in `AuditLog`. Their Azure AD display name (`userName`) is captured from the JWT, but it is not a unique identifier. If two unlinked users share the same display name, their actions would be indistinguishable in the audit log.

**Proposed fix:** Add a `userEmail String?` field to the `AuditLog` model. In `logAudit` (`audit.js`), always populate it from `req.user.email` (the `preferred_username` claim from the JWT). This uniquely identifies every actor regardless of Staff linkage.

**Notes:**
- Not currently a practical problem (all users have distinct display names).
- Requires a schema migration (`prisma db push`) and a minor change to `audit.js`.

---

---

## 6. Quote Templates — Aerial & Import

### ~~QT-04~~ ✅ — Aerial freight quote template (Export, EN + ES)

**User story:** As a coordinator, I want to generate a quote using an Aerial (air freight) template when the service is by air, so the wording correctly reflects air freight instead of sea/road freight.

**Context:**
- Currently there are two international Export templates: `TEMPLATES.EN` and `TEMPLATES.ES` (sea/road).
- A new parallel set `AERIAL_TEMPLATES` (EN + ES) is needed with air-freight-specific wording for sections such as International Freight and Service Schedule.
- The template structure (section keys) stays the same as `TEMPLATES`; only the default text per section differs.

**Acceptance criteria:**
- A new `AERIAL_TEMPLATES` export is added to `quoteTemplates.js` with `EN` and `ES` variants.
- The Quote form includes a **Service Mode** selector (e.g. Sea/Road vs. Aerial) that appears only for international (Export) quotes.
- Selecting Aerial loads the `AERIAL_TEMPLATES` defaults instead of `TEMPLATES`.
- The selected mode is saved on the Quote record (new `serviceMode` field: `SEA_ROAD | AERIAL`).
- The `QuoteDocument` renders identically for both modes; only the pre-filled text differs.
- Existing quotes without a `serviceMode` value default to `SEA_ROAD` so nothing breaks.
- Template texts for EN and ES to be provided separately.

---

### ~~QT-05~~ ✅ — Quote for Import files

**User story:** As a coordinator, I want to create a quote directly from an Import Moving File, so I can send a formal import service proposal to clients who already have an inbound shipment.

**Context:**
- Today, quotes are always tied to a Visit (`visitId` is required). Import files have no pre-sale visit.
- Import quotes need a different entry point and a different template (import-specific sections).
- The Import quote template exists only in Spanish; an English translation is needed.

**Acceptance criteria:**
- The Quote schema (Prisma + backend) gains an optional `movingFileId` field so a quote can be linked to a MovingFile instead of (or in addition to) a Visit.
- A **"Create Quote"** button is added to the Import file detail page (similar to how it appears on Visit detail pages).
- Clicking it opens the existing Quote form pre-populated with client, origin, destination from the file; `visitId` is left blank; `movingFileId` is set.
- A new `IMPORT_TEMPLATES` export is added to `quoteTemplates.js` with `EN` and `ES` variants.
- The Quote form detects it is an Import quote (via `fileId` query param or `movingFileId`) and loads `IMPORT_TEMPLATES` instead of `TEMPLATES`.
- `visitId` is not required when `movingFileId` is present; backend validation is updated accordingly.
- The `QuoteDocument` renders Import quotes correctly (section headings, placeholders match import wording).
- Import quotes appear in the Quotes list and are linked back from the Import file detail page.
- Template texts for EN and ES to be provided separately.

---

### ✅ AL-04 — Audit log entries are retained for a configurable period

**User story:** As an administrator, I want to be confident that audit data is kept for at least 2 years, and that very old records can be archived or purged without disrupting the app.

**Acceptance criteria:**
- Default retention: 2 years (configurable via an `AUDIT_RETENTION_DAYS` env variable).
- A background job (or manual admin action) can purge records older than the retention period.
- Purge action is itself logged (meta-audit entry) so there is a record of when purges occurred.
- Purging is never automatic in production without explicit configuration opt-in.

---

## 7. Email & Notifications

### ~~BUG-03~~ ✅ — Email delivery is invisible: no audit trail when emails are sent or fail

**User story:** As an administrator, I want to see a log of every email the system has attempted to send — including whether it succeeded or failed and why — so I can diagnose delivery problems without having to grep server logs.

**Implemented:**
- `EmailLog` Prisma model added (`entityType`, `entityId`, `recipient`, `subject`, `status`, `error`, `sentAt`). Table created via `prisma db push`.
- `logEmail()` helper in `notifications.js` — fire-and-forget, never throws; writes `SENT` or `FAILED` after every `sendMail` call.
- `GET /api/admin/email-logs` endpoint in `admin.js` — last 100 entries newest-first.
- Read-only Email Delivery Log card added to `AdminPage.jsx` with SENT/FAILED badges and error tooltip.
- **Additional fix:** When coordinator is assigned/changed on a Work Order (Job), the linked MovingFile's `coordinatorId` is now also updated and the notification email is sent. Conversely, updating the coordinator on a File also syncs back to the linked Job. This two-way sync ensures both records are always consistent regardless of which screen is used.

---

### ~~NTF-01~~ ✅ — Visit notification email includes all visit fields in Spanish

**User story:** As a staff member assigned to a visit, I want the notification email I receive to include every piece of information about the visit — not just the date and client name — so I have everything I need without opening the app.

**Context:**
- The current HTML table in `notifyVisitAssigned` (`notifications.js`) includes only: client, date/time, phone, email, address, service type (raw enum), and observations.
- Missing fields: destination address/city/country, `bookerRole`, `language`, origin and destination agent names, prospect name (when no client is linked), and the visit number link.
- `serviceType` enum values are displayed as-is (e.g. `DOOR_TO_PORT`) instead of translated Spanish labels.

**Acceptance criteria:**
- The email HTML table is extended to include all of the following (when present): visit number, client or prospect name, contact phone, contact email, scheduled date/time (formatted in Spanish, Costa Rica timezone), origin address + city + country, destination address + city + country, service type (translated to Spanish label), booker role (translated), assigned staff name, language, origin agent name, destination agent name, observations.
- Service type values are translated using a local map: `DOOR_TO_PORT → Puerta a Puerto`, `DOOR_TO_DOOR → Puerta a Puerta`, `PACKING → Empaque`, `LOCAL_MOVE → Mudanza Local`.
- Booker role values are translated: `BOOKER → Agente`, `OA → Agente de Origen`, blank → not shown.
- The ICS calendar invite `DESCRIPTION` field is also updated to include the full detail set.
- All labels and values are in Spanish regardless of the visit's `language` field (this is an internal staff notification).
- Existing behavior for visits that have no `scheduledDate` (no email sent) is unchanged.

---

## 8. Visit Enhancements

### ~~VIS-01~~ ✅ — Print / PDF export for visit detail page

**User story:** As a staff member, I want to print or save a visit as a PDF directly from the visit detail page, so I can bring a paper copy to the appointment or share it via email.

**Context:**
- `VisitDetail.jsx` already has a "Download ICS" button but no print action.
- The visit detail is a single-page view (no multi-page pagination needed), so a simple `window.print()` with print-specific CSS is appropriate — no need for the html2canvas / jsPDF approach used in quotes.

**Acceptance criteria:**
- A **"Imprimir"** (print) button is added to the `VisitDetail` page header, next to the existing action buttons.
- Clicking the button calls `window.print()`.
- A `@media print` CSS block (in `index.css` or a `<style>` element in `VisitDetail`) hides: the sidebar nav, the top header bar, all action buttons, the tab bar, and any toast/modal overlays.
- The printable area shows: visit number, status badge, all visit fields (same set as NTF-01), linked client/prospect block, linked quotes table (if any).
- The WinMovers logo appears at the top of the printed page.
- Page margins and font sizes are print-appropriate (no scroll-container clipping).
- The button is labeled in Spanish ("Imprimir") to match the app's primary language.

---

## 9. User Preferences

### ~~UX-02~~ ✅ — Per-user attachment color mode preference

**User story:** As a staff member, I want to choose whether attachment category tiles in the file detail page are shown in full color or in a monochrome (grayscale) style, so the view matches my personal workflow preference.

**Context:**
- `FileAttachments.jsx` renders each attachment category as a colored tile: the tile background and badge use category-specific colors (green, blue, orange, etc.) regardless of whether a file has been uploaded.
- Some users find the colorful view helpful at a glance; others find it distracting and prefer all tiles to appear in grey until a document is actually attached, at which point the tile turns green.
- The preference is purely cosmetic and per-user; it does not affect data or logic.

**Proposed implementation:**
- Store the preference in `localStorage` under the key `wm_attachColorMode_{userOid}` with values `'colorful'` (default) or `'monochrome'`.
- The user OID is available from the MSAL account object already used throughout the app.
- No database schema change is needed.

**Acceptance criteria:**
- A toggle (labeled "Vista en color / Vista monocroma" or similar) is added inside the `FileAttachments` component header, visible to all users.
- The preference is read from `localStorage` on mount and applied immediately (no page reload needed).
- **Colorful mode (default):** tiles and badges use their current category-specific colors regardless of upload status.
- **Monochrome mode:** tiles and badges for categories with **no file uploaded** are rendered in neutral grey (`bg: '#f1f5f9', color: '#64748b'`). Categories with a file uploaded turn green (`bg: '#dcfce7', color: '#166534'`). The "Other documents" section is unaffected by this setting.
- The toggle icon/label clearly communicates the current mode and what clicking it will do.
- The preference persists across page navigations and browser sessions (via `localStorage`).
- If no preference is stored, the default is `'colorful'` (preserving current behavior for existing users).

---

### ~~ATT-01~~ ✅ — Support multiple attachments for the same document type

**User story:** As a coordinator, I want to upload multiple attachments under the same document type (for example several invoices, photos, or supporting documents), so I can keep all related files together without replacing previous uploads.

**Context:**
- The current UI behaves as if each attachment category supports only one file: when a user uploads a new file for an existing category, the previous file in that category is deleted and replaced.
- The current database model already supports multiple attachments per file and category because `Attachment` is stored as many rows linked to `MovingFile`, with no uniqueness constraint on `(fileId, category)`.
- This means the main change should be behavioural/UI-based rather than a major schema redesign.

**Recommended implementation:**
- Keep the current `Attachment.category` model and allow many `Attachment` rows with the same `category` for the same `MovingFile`.
- Remove the frontend "replace existing attachment in same category" behaviour from `FileAttachments.jsx`.
- In the UI, render each required/optional category as a section or tile that can contain a **list** of uploaded files instead of only one current file.
- Required-document completion logic remains category-based: a required category counts as complete when **at least one** attachment exists in that category.
- Deleting one file in a category removes only that file, not the entire category.

**Acceptance criteria:**
- Uploading a second file for the same category keeps the first file; both are visible under that category.
- The backend `POST /api/files/:fileId/attachments` route accepts multiple uploads over time for the same category without deleting existing rows.
- `FileAttachments.jsx` shows all files within a category, with per-file actions for preview/download/delete.
- Required category completion and percentage calculations treat a category as satisfied when at least one attachment exists in that category.
- Existing files remain valid; no data migration is required.
- The "Other" category continues to support any number of uploads as it does today.

---

## 10. Bug Fixes (May 2026)

### ~~BUG-04~~ ✅ — Accented characters in attachment filenames display as garbled text

**User story:** As a user, I want file names with accented characters (tildes, ñ, ü, etc.) to display correctly in the system after upload, so I can identify documents by their proper Spanish names.

**Context:**
- Multer reads `req.file.originalname` as Latin-1 (`ISO-8859-1`) — this is the Node.js / HTTP spec default.
- Modern browsers send the filename in the `Content-Disposition` header encoded as UTF-8.
- The mismatch causes accented characters to be stored as garbled sequences (e.g. `á` becomes `Ã¡`).
- Affected: the `filename` field stored in the `Attachment` table and displayed in `FileAttachments.jsx`.

**Acceptance criteria:**
- In the POST handler in `attachments.js`, `req.file.originalname` is re-decoded from Latin-1 to UTF-8 before any use:
  ```js
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  ```
- The re-decoded `filename` is used for both `storage.uploadFile(...)` and `attachment.create({ data: { filename, ... } })`.
- `req.file.originalname` is not used directly anywhere else in the handler.
- Already-stored attachments with garbled names are not affected (no migration); only new uploads are fixed.
- Manual test: upload a file named `Solicitud de mudanza — Señor García.pdf` and verify the name is stored and displayed correctly.

---

### ~~BUG-05~~ ✅ — Microsoft login error "No podemos iniciar su sesión" for a specific user

**User story:** As an administrator, I want to be able to diagnose and resolve login failures for individual users so they are not blocked from accessing the system.

**Context:**
- One user is seeing the Azure AD error "No podemos iniciar su sesión. Vuelva a intentarlo." on the Microsoft login page.
- This error is thrown by Azure AD / Entra ID before our application receives any token; it is not an application-level bug.
- Common causes: the user's account is disabled or locked, the user is not in the permitted tenant, the App Registration's supported account type does not match the user's account type, or "User assignment required" is enabled on the Enterprise Application and the user has not been assigned.

**Acceptance criteria (admin checklist — no code changes required):**
1. Verify the user's Azure AD account status: navigate to **Entra ID → Users → [user] → Account enabled** — must be `Yes`.
2. Confirm the user belongs to the correct tenant (`AZURE_TENANT_ID` in backend `.env`).
3. Check **App Registrations → WinMovers Operations → Authentication → Supported account types** — should match the user's account type (typically "Accounts in this organizational directory only").
4. Check **Enterprise Applications → WinMovers Operations → Properties → User assignment required**: if `Yes`, navigate to **Users and groups** and ensure the affected user (or their group) is listed.
5. If the account is a guest (B2B invite), verify the invitation has been accepted and the guest account is not in an "Invitation pending" state.
6. After resolving, ask the user to open a private/incognito browser window and retry login to rule out cached token issues.
7. Document the root cause and resolution in the user's notes or the relevant support ticket.

---

## 11. Bitácora (Operations Schedule)

> **Context:** The operations team currently maintains a physical Excel scheduler ("Bitácora 2026") with 12 monthly sheets. Each sheet is a calendar grid: columns = days, rows = tasks per day. Tasks include packing jobs, moves, container loads, unpacking deliveries, industrial jobs, and manual entries. This feature replaces that spreadsheet with an integrated in-app scheduler that auto-populates from Jobs and Visits.

### Design Decisions
- **One Job → two entries**: when a Job has `packDate`, create a `EMPAQUE` entry; when it has `moveDate`, create a `MUDANZA` entry. Both are independent schedule entries linked to the same job.
- **Visits**: when a Visit has `scheduledDate`, create a `VISITA` entry linked to that visit.
- **Manual entries**: users can create entries not linked to any record (type `OTRO` or any task type).
- **Permission-gated**: a new `canAccessSchedule` boolean flag on `StaffMember`; only staff with this flag (or admin role) can view and edit the Bitácora.
- **No recurring tasks** for now.
- **No import** of historical Excel data.
- **Both list and calendar views** available, with calendar as default.

---

### SCH-01 — Data model: `ScheduleEntry`

**Schema changes:**
```prisma
model ScheduleEntry {
  id          String   @id @default(cuid())
  date        DateTime // the day (store at midnight UTC)
  time        String?  // "08:00", "10:30" — free text
  taskType    String   // see ScheduleTaskType values below
  description String   // free-text label shown on calendar
  notes       String?  // internal notes

  // Optional links — system-created entries have exactly one; manual entries have none
  jobId        String?
  visitId      String?
  movingFileId String?
  assignedToId String?  // default coordinator/assigned staff

  job        Job?        @relation(fields: [jobId], references: [id], onDelete: SetNull)
  visit      Visit?      @relation(fields: [visitId], references: [id], onDelete: SetNull)
  movingFile MovingFile? @relation(fields: [movingFileId], references: [id], onDelete: SetNull)
  assignedTo StaffMember? @relation(fields: [assignedToId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Task type values (stored as String):**
`EMPAQUE | MUDANZA | DESEMPAQUE | CARGA_CONTENEDOR | TRABAJO_INDUSTRIAL | ENTREGA | VISITA | OTRO`

**StaffMember change:**
```prisma
canAccessSchedule Boolean @default(false)  // new — added alongside existing flags
```

**Back-relations to add:**
- `Job` → `scheduleEntries ScheduleEntry[]`
- `Visit` → `scheduleEntries ScheduleEntry[]`
- `MovingFile` → `scheduleEntries ScheduleEntry[]`
- `StaffMember` → `scheduleEntries ScheduleEntry[]`

**Acceptance criteria:**
- `npx prisma db push` succeeds with no destructive changes to existing tables.
- `ScheduleEntry` table is created; `StaffMember` gains `canAccessSchedule` column (default `false` — all existing staff start without schedule access).
- Back-relations compile without errors.

---

### SCH-02 — Backend: CRUD routes for schedule entries

**New file:** `backend/routes/schedule.js` — mounted at `GET|POST /api/schedule` and `GET|PUT|DELETE /api/schedule/:id`.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schedule?from=&to=` | Entries in date range, with linked job/visit/file names |
| `GET` | `/api/schedule/:id` | Single entry detail |
| `POST` | `/api/schedule` | Create manual entry |
| `PUT` | `/api/schedule/:id` | Update time, description, notes, assignedToId only (taskType and date also editable for manual entries; system-linked entries are protected) |
| `DELETE` | `/api/schedule/:id` | Delete manual entry only; system-created entries (with jobId/visitId) cannot be deleted directly |

**Auto-sync hooks** — add calls in existing route handlers:
- `backend/routes/jobs.js` `POST /` → call `syncJobScheduleEntries(job)` after job is created
- `backend/routes/jobs.js` `PUT /:id` → call `syncJobScheduleEntries(job)` after update (upsert pack + move entries, delete the one whose date was cleared)
- `backend/routes/visits.js` `POST /` → call `syncVisitScheduleEntry(visit)` after creation
- `backend/routes/visits.js` `PUT /:id` → call `syncVisitScheduleEntry(visit)` after update

**`syncJobScheduleEntries(job)` helper:**
```js
// Upsert EMPAQUE entry if packDate set, delete if cleared
// Upsert MUDANZA entry if moveDate set, delete if cleared
// Description auto-generated: "Empaque de {clientName}" / "Mudanza de {clientName}"
```

**`syncVisitScheduleEntry(visit)` helper:**
```js
// Upsert VISITA entry if scheduledDate set, delete if cleared
// Description: "{prospectName || clientName} — {serviceType label}"
```

**Permission middleware:**
```js
// requireScheduleAccess — checks req.staff.canAccessSchedule || req.staff.role === 'ADMIN'
// Applied to all /api/schedule routes
```

**Acceptance criteria:**
- All five endpoints work correctly with valid data.
- Creating/updating a Job with packDate=2026-06-10 creates an `EMPAQUE` schedule entry on that date.
- Clearing the packDate updates the same job → the EMPAQUE entry is deleted.
- Staff without `canAccessSchedule` receive 403 on all schedule endpoints.
- GET range query returns entries with `job.jobNumber`, `visit.visitNumber`, `assignedTo.name` joined.

---

### SCH-03 — Staff permission: `canAccessSchedule`

**Backend:**
- `canAccessSchedule` field is included in all `GET /api/staff`, `GET /api/staff/me`, `POST /api/staff`, and `PUT /api/staff/:id` read/write operations (already covered by generic select/update patterns, but verify explicitly).

**Frontend — Staff form:**
- Add a `canAccessSchedule` checkbox in the Permissions section of `StaffForm.jsx`, alongside the existing four permission flags.
- Label EN: `"Can access the Operations Schedule (Bitácora)"` / ES: `"Puede acceder a la Bitácora de Operaciones"`.
- Include in the PUT payload (full-object pattern).

**Acceptance criteria:**
- Toggling `canAccessSchedule` in the staff form and saving persists the value to the DB.
- The Schedule nav item (SCH-04) is only visible to users whose staff record has `canAccessSchedule = true` (or `role = 'ADMIN'`).

---

### SCH-04 — Frontend: calendar view (default)

**New page:** `frontend/src/pages/Schedule/SchedulePage.jsx`  
**Route:** `/schedule` added to `App.jsx`  
**Nav item:** "Bitácora" added to `Layout.jsx` sidebar (visible only when `currentStaff.canAccessSchedule || currentStaff.role === 'ADMIN'`).

**Calendar layout:**
- **Month view** — 7-column weekly grid showing all 4–5 weeks of the current month.
- Each day cell shows up to 3 task chips; if more, shows `+N more` chip.
- Each chip: colored by `taskType`, shows `time` prefix + `description` truncated.
- Clicking a day opens a **day panel** (right-side drawer or modal) with the full list for that day.
- Navigation: `← prev month` / `→ next month` buttons + current month/year label.
- "Today" button snaps back to current month.

**Task type colors:**
| Type | Color |
|---|---|
| EMPAQUE | blue |
| MUDANZA | indigo |
| DESEMPAQUE | teal |
| CARGA_CONTENEDOR | orange |
| TRABAJO_INDUSTRIAL | amber |
| ENTREGA | green |
| VISITA | purple |
| OTRO | grey |

**Day panel:**
- Lists all entries for the clicked day in time order (null time at end).
- Each entry: colored badge (taskType), time, description, link chip to linked job/visit/file (if any), assigned staff name.
- "Add entry" button at bottom opens the entry form (SCH-05).
- Clicking existing entry opens edit form.

**Acceptance criteria:**
- Calendar renders correctly for all months (28/29/30/31-day months, correct first day of week).
- Entries auto-populated from jobs/visits appear on the correct date.
- Calendar is read-only for staff who only have `canAccessSchedule`; editing controls are shown only when the user has edit permission (same flag for now — all schedule users can edit).
- Responsive: on narrow screens calendar stacks to a scrollable week list.

---

### SCH-05 — Frontend: list view + create/edit form

**List view toggle:**
- A `List` / `Calendar` toggle button in the page header switches views.
- List view shows entries grouped by date (ascending), filter by month matching the current calendar month.
- Each row: date pill, time, taskType badge, description, linked record chip, assigned staff.

**Create / edit modal (shared):**

| Field | Type | Notes |
|---|---|---|
| Date | date picker | required |
| Time | text `HH:MM` | optional |
| Task type | select | all 8 types |
| Description | text | required |
| Notes | textarea | optional |
| Assigned to | staff lookup | filters to `canAccessSchedule = true` staff |
| Link to Job | optional lookup | searching by job number; auto-fills description |
| Link to Visit | optional lookup | searching by visit number |
| Link to File | optional lookup | searching by file number |

- System-generated entries (those with a `jobId` or `visitId`) show a read-only pill "Auto from Job #E-0001" or similar; the date, taskType and client description are locked and can only be changed via the source record.
- Manual entries (no linked record) are fully editable and deletable.

**Acceptance criteria:**
- Creating a manual entry from the calendar day panel adds it immediately to the view (optimistic or re-fetch).
- Editing a system-generated entry allows changing `time`, `notes`, `assignedToId` only (date and description are locked with a tooltip explaining why).
- Deleting a system-generated entry is blocked with a message: "This entry is managed by Job #XXX. Update or delete the job to remove it."
- All form fields validated: date required, description required, time must be `HH:MM` format if provided.
- i18n keys added to `i18n.jsx` for all new UI strings (EN + ES).

---

### SCH-06 — Auto-sync backfill (optional, run once)

**One-time script** `backend/scripts/backfill-schedule-entries.js`:
- Reads all `Job` records with non-null `packDate` or `moveDate` and upserts the corresponding `ScheduleEntry` records.
- Reads all `Visit` records with non-null `scheduledDate` and upserts their `VISITA` entries.
- Supports `--dry-run` flag (prints what would be created, no DB writes).
- Safe to re-run (upsert by `jobId+taskType` / `visitId`).

**Acceptance criteria:**
- `--dry-run` output shows counts of entries that would be created.
- Live run creates entries without errors or duplicate records.
- Post-run: calendar view shows all historical jobs and visits on their scheduled dates.

---

## 12. Bug Fixes & Improvements (May 2026)

### ~~BUG-06~~ ✅ — Blank page when navigating back to Import / Export file list after opening a record

**User story:** As a coordinator, when I open an Import or Export file for editing and then navigate back to the list, I expect to see the list — not a blank page — so I can continue working without having to manually refresh the browser.

**Context:**
- User reports a blank page on the Import/Export file list after opening a record for edit.
- A page refresh fixes it, but the blank state returns on the next back-navigation.
- A browser console error will be provided — investigation must begin once the error log is shared.
- Suspected causes: React Router state loss, a missing error boundary, a failed API call whose error is swallowed, or a component that requires data that is not present on re-mount (e.g. a missing `key` or stale cached value).

**Investigation steps:**
1. Capture the full browser console error and network tab output from the user.
2. Check `FilesList.jsx` and `FileDetail.jsx` (or equivalent `ImportFiles` / `ExportFiles` pages) for unhandled promise rejections, missing null-guards, or conditional renders that produce `null` without a fallback.
3. Verify that React Router `useNavigate` / `useLocation` state is not relied upon without a null-check.
4. Check whether the list fetches data on mount (in a `useEffect`) and whether the effect cleans up correctly.
5. If a state variable is initialised from route params/state that is absent on re-mount, add a safe default or redirect.

**Acceptance criteria:**
- Navigating back to the Import or Export file list after viewing/editing a record always renders the list correctly.
- No blank page occurs on any navigation path (first visit, back-navigation, browser back button).
- If an API call fails, an error message is shown instead of a blank page.
- Fix is confirmed by the reporting user.

---

### ~~BUG-07~~ ✅ — Email not being sent when a file or work order is assigned or updated

**User story:** As a coordinator, I want to receive an email whenever a Moving File or Job (Work Order) that I am assigned to is saved — whether I was just assigned, re-assigned, or any other field was changed — so I always have the latest information.

**Root causes found:**
1. `movingFiles.js` PUT: email was only sent when `coordinatorId !== prevFile.coordinatorId` — so self-assignment (saving with the same coordinator) and any other field change (ETD, ETA, port, status…) produced no email.
2. `jobs.js` PUT: same guard; additionally, if no linked `MovingFile` existed the notification was skipped entirely.
3. `notifications.js`: `notifyFileCoordinator` only had subjects/messages for `created` and `reassigned`; no `updated` case.

**Fixes applied:**
- `notifications.js` — `notifyFileCoordinator` now handles `action = 'assigned' | 'updated'` in addition to `created` / `reassigned`. Subject and opening sentence change accordingly.
- `movingFiles.js` PUT — notification now fires on **every save** as long as `file.coordinator.email` is set. Action is `'assigned'` when coordinator ID changed, `'updated'` otherwise. Coordinator sync to linked Job is unchanged (still only runs on actual coordinator change).
- `jobs.js` PUT — sync to linked `MovingFile` still only runs on coordinator change. Notification now always fires when `activeCoordinatorId` is set and a linked file exists; fetches the file (with client + coordinator) fresh so the email contains up-to-date context.

**Acceptance criteria:**
- Saving a file with a coordinator set always produces a `SENT` (or `FAILED`) entry in the Email Log, regardless of which fields changed.
- Email subject says "asignado" on first assignment, "reasignado" on coordinator change, "actualizado" on all other saves.
- Self-assignment (coordinator saves the file themselves) triggers the email.
- Saving a Job triggers the notification through the linked file.
- A `FAILED` entry appears with error detail if the mail service rejects the request.

---

### ~~QT-06~~ ✅ — New footer image for quote documents

**User story:** As a manager, I want to provide a new footer image (logo / branding banner) that appears at the bottom of every quote document, replacing the current footer, so quotes reflect our updated branding.

**Context:**
- Quote documents are rendered in `QuoteDocument.jsx` (and the equivalent print / PDF view).
- The current footer is either hard-coded text or an existing image asset.
- The new image file will be provided by the user.

**Acceptance criteria:**
- The footer image asset is replaced / added in the frontend `public/` or `src/assets/` folder.
- `QuoteDocument.jsx` references the new image in the footer section.
- The image scales correctly across the quote page width without overflowing or stretching.
- Both the in-browser preview and the downloaded/printed PDF show the new footer.
- The old footer image (if any) is removed so it is not bundled unnecessarily.
- No quote data fields, layout, or signature block are affected.

---

### JOB-01 ✅ — Create a new Job (Work Order) directly, without a prior Visit or Quote

**User story:** As an operations manager, I want a "New Job" button on the Jobs list page that lets me create a work order from scratch — without first creating a Visit or Quote — so that walk-in, referral, or repeat customers can be handled quickly.

**Context:**
- Currently, jobs are created by converting a Quote (which itself originates from a Visit).
- Some jobs arrive without a prior sales cycle (e.g. direct bookings, returning corporate clients).
- On creation, an Export Moving File should be automatically created and linked to the new Job, following the existing auto-creation logic used when a Job is created from a Quote.

**Acceptance criteria:**
- A **"+ New Job"** (or "Nuevo Trabajo") button is added to the `JobsList.jsx` page header.
- Clicking it opens the existing `JobForm.jsx` (or a simplified variant) with all mandatory fields: client, type, origin/destination, dates.
- The `visitId` and `quoteId` fields are optional (left blank for direct jobs).
- On save, the backend `POST /api/jobs` handler creates the Job and auto-creates the linked Export `MovingFile` (same logic as quote-conversion path).
- The user is redirected to the new Job detail page after creation.
- The Jobs list and the new Job detail page reflect the record correctly.
- i18n keys added for all new button labels and form headings.

---

### JOB-02 ✅ — Reorder tabs in Job detail page: Work Order first

**User story:** As a coordinator, I want the "Work Order" tab to be the first (default) tab when I open a Job, because that is the information I look at most often, so I don't have to click away from the default tab every time.

**Context:**
- `JobDetail.jsx` currently renders three tabs in this order: **Overview → Work Order → History**.
- The desired new order is: **Work Order → Overview → History**.
- The active tab on first load defaults to index 0 (Overview); after the change it should default to Work Order.

**Acceptance criteria:**
- Tab order in `JobDetail.jsx` is changed to: **Work Order (index 0) → Overview (index 1) → History (index 2)**.
- The page loads with the Work Order tab active by default.
- All three tabs still render their existing content correctly.
- No other pages or components are affected.
- i18n keys and tab labels are unchanged (only the order changes).

---

## 13. Improvements (May–June 2026)

---

### ~~NTF-02~~ ✅ — File change email includes a summary of what was modified

**User story:** As a coordinator, when I receive an email notifying me that a Moving File was updated, I want to see exactly which fields changed and their new values in the email body, so I can understand what happened without having to open the app.

**Context:**
- `BUG-07` (now resolved) ensures an email is sent on every file save. However, the email body currently contains only the file's current state (a static snapshot) and does not tell the coordinator what specifically changed from the previous save.
- The backend `movingFiles.js` PUT handler already reads the `prevFile` snapshot before applying the update — this data is available to pass to the notification.
- The change summary should list only meaningful fields (not internal IDs or timestamps), translated to Spanish labels.

**Fields to include in the diff (when changed):**
- Status (`estado`)
- Coordinator (`coordinador`)
- ETD / ETA (`fecha ETD / ETA`)
- Origin port / Destination port (`puerto origen / destino`)
- Volume / Weight / Bultos (`volumen / peso / bultos`)
- Shipment mode (`modo de envío`)
- Service details / observations (`detalles del servicio / observaciones`)
- Invoice number / Invoice date (`número de factura / fecha de factura`)
- Custom/client reference numbers (if any)

**Proposed implementation:**
- In `notifications.js`, add a helper `diffFileFields(prev, next)` that returns an array of `{ label, oldValue, newValue }` for fields that changed.
- `notifyFileCoordinator` accepts an optional `changes` parameter (array from `diffFileFields`).
- When `changes` is non-empty, append a "Lo que cambió" section to the HTML email as a two-column table: field label | old → new value.
- When `action = 'updated'` and no meaningful fields differ (e.g. only `updatedAt` changed), the "Lo que cambió" section is omitted.
- In `movingFiles.js` PUT, compute `diffFileFields(prevFile, updatedFile)` and pass it to `notifyFileCoordinator`.

**Acceptance criteria:**
- When a file is saved with changed fields, the coordinator email contains a "Lo que cambió" section listing each changed field with its previous and new value.
- Unchanged fields are not listed.
- Internal fields (`id`, `createdAt`, `updatedAt`, `coordinatorId`, `clientId`) are excluded from the diff.
- Enum values are shown as human-readable Spanish labels (e.g. `OPEN → CLOSED` becomes `Abierto → Cerrado`).
- If only non-meaningful fields changed (timestamps), the "Lo que cambió" section is omitted and the email still sends.
- The diff section renders correctly in both plain-text email clients and rich HTML clients.
- Existing `created` / `assigned` / `reassigned` email flows are unaffected.

---

### ~~JOB-03~~ ✅ — "Facturar a nombre de" pre-fills with Destination Agent when one is assigned

**User story:** As a coordinator, when I fill in a Job (Work Order) that has a Destination Agent assigned, I want the "Facturar a nombre de" field to be automatically pre-populated with the Destination Agent's name, so I don't have to type it manually.

**Context:**
- The `JobForm.jsx` currently pre-populates "Facturar a nombre de" (`invoiceTo`) with the client name.
- For many international jobs (especially Export), the invoice is issued to the Destination Agent rather than the end client.
- The Destination Agent is selected via the `AgentLookup` component bound to `destAgentId` on the form.

**Proposed behaviour:**
- When the user selects or changes the Destination Agent in the form, the `invoiceTo` field is automatically set to the agent's name **only if** `invoiceTo` is currently blank or still matches the old auto-filled value (i.e. do not overwrite a value the user typed manually).
- If the Destination Agent is cleared, `invoiceTo` reverts to the client name (if a client is selected) or is left blank.
- The `invoiceTo` field remains fully editable at all times; the auto-fill is a convenience, not a lock.
- On initial load of an existing job, no auto-fill override occurs (the saved value is respected).

**Acceptance criteria:**
- Selecting a Destination Agent in the job form sets `invoiceTo` to the agent's name if the field was blank or matched a previous auto-fill.
- Clearing the Destination Agent resets `invoiceTo` to the client name (or blank if no client).
- Manually typing in `invoiceTo` prevents further auto-overwrite for the duration of that form session.
- Behaviour applies in both the new-job form and the edit-job form.
- No backend changes required — this is purely a frontend form enhancement.
- i18n: no new keys needed (field label already exists).

---

### ~~SCH-07~~ ✅ — "Encargado" (person in charge) field on Schedule entries

**User story:** As an operations manager, I want each schedule entry to have a dedicated "Encargado" field identifying the staff member responsible for executing that task, so the daily schedule clearly shows who is doing what without having to open the linked job.

**Context:**
- `ScheduleEntry` already has an `assignedToId` field (previously named "Assigned to"). This field is being repurposed / clarified as the "Encargado" — the person responsible for physically carrying out the task.
- When a schedule entry is **auto-created from a Job** (via `syncJobScheduleEntries`), the Encargado should be pre-populated with the Job's coordinator (`coordinatorId` on the linked `MovingFile`, or `activeCoordinatorId` on the `Job` itself).
- When a schedule entry is **created manually**, the user selects the Encargado from a Staff dropdown.
- The field is optional (some entries may not have a named responsible party).

**Schema:** No new field needed — `assignedToId` / `assignedTo` on `ScheduleEntry` already exists. Only label and auto-fill logic need to change.

**Frontend changes (`SchedulePage.jsx`):**
- Rename the form label from "Assigned to" / whatever it currently says to **"Encargado"** in both the create/edit modal and in entry display (calendar chip, list card, hover popup, day panel).
- In the entry display, show `encargado.name` below or alongside the client name where space permits (list view: always shown; calendar chip: shown on hover popup only).

**Backend changes (`scheduleSync.js`):**
- In `syncJobScheduleEntries`, when upserting a `ScheduleEntry`, resolve the coordinator as follows:
  1. If the Job has a linked `MovingFile` with a `coordinatorId`, use that.
  2. Else if the Job has an `activeCoordinatorId`, use that.
  3. Else leave `assignedToId` null.
- Only set `assignedToId` on **create** (upsert insert path); do not overwrite a value the user may have manually changed on the **update** path.

**Acceptance criteria:**
- When a Job is created or updated and `syncJobScheduleEntries` runs, the resulting `ScheduleEntry` has `assignedToId` set to the Job's coordinator (if one exists).
- The schedule form shows a "Encargado" dropdown populated with all Staff members (no `canAccessSchedule` filter — any staff member can be responsible for a task).
- The selected Encargado's name is visible in: the calendar hover popup, the list view card, and the day panel.
- Manually selecting a different Encargado on an auto-generated entry is allowed and persists.
- If no coordinator is found, the field is left blank and the entry is created without error.
- i18n: add `schedule.encargado` key (ES: "Encargado", EN: "Person in Charge") to `i18n.jsx`.

---

### ~~SCH-08~~ ✅ — Multi-day schedule entries with start date and end date

**User story:** As an operations user, I want a schedule item to have a start date and an end date, so the same task can appear across multiple consecutive days when the work lasts more than one day.

**Context:**
- Today each `ScheduleEntry` is effectively single-day via the `date` field.
- In practice, many tasks span multiple days even though they are still one logical assignment.
- Users want to edit the schedule item itself and have that same item appear on every date between the start and end date, inclusive.
- Auto-generated items from Jobs and Visits should still default to a single day when first created.
- Extending or shortening a schedule item in the Bitácora must **not** modify the original Job or Visit record.

**Proposed data model:**
- Replace or evolve the single-day `date` concept into `startDate` and `endDate` on `ScheduleEntry`.
- For existing records, migrate `date` so that `startDate = endDate = date`.
- A schedule entry is rendered on every calendar day where `startDate <= day <= endDate`.

**Behaviour rules:**
- Manual entries can be created directly with a date range.
- Existing manual entries can be edited to expand or shrink the range.
- Auto-generated entries from Jobs/Visits are created with `startDate = endDate = source date` by default.
- If a user later edits an auto-generated schedule item and changes its end date (or start date), that change is stored only on the `ScheduleEntry` and does not sync back to the source Job/Visit.
- Future Job/Visit updates should not overwrite a manually adjusted multi-day range on the schedule item.
- Editing the item always affects the whole schedule item; no per-day split/edit behaviour is needed.

**Frontend changes (`SchedulePage.jsx`):**
- The create/edit modal gains **Start date** and **End date** fields.
- Validation requires `startDate <= endDate`.
- Calendar rendering shows the same item in each day cell and day panel across the full inclusive range.
- List view should include the full range clearly (for example `2026-06-03 -> 2026-06-05` when multi-day).

**Backend changes:**
- `GET /api/schedule?from=&to=` must return entries whose date range overlaps the requested window, not only entries whose single date falls inside it.
- Create/update routes validate the date range and persist both `startDate` and `endDate`.
- Sync helpers for Jobs and Visits create single-day entries by default but preserve manual range edits on existing schedule entries.

**Acceptance criteria:**
- A user can create a schedule item with start date `2026-06-03` and end date `2026-06-05`, and the same item appears on June 3, 4, and 5.
- Editing an existing item to change only the end date updates all rendered days for that item.
- Existing single-day records continue to work after migration, with `startDate` and `endDate` both set to the original date.
- Auto-generated schedule items from Jobs and Visits are still created as single-day entries by default.
- Changing the date range in the Schedule does not update the source Job or Visit.
- Later syncs from Job/Visit updates do not overwrite a schedule item's manually adjusted multi-day range.
- i18n keys are added for any new labels/messages needed (`startDate`, `endDate`, range validation text).

---

### ~~JOB-04~~ ✅ — Filter Files lists by status (applied to Export / Import / Local)

**User story:** As a coordinator, I want to filter the Jobs list by one or more statuses, so I can quickly see only the jobs in a specific stage (e.g. all jobs currently "In Transit") without scrolling through the full list.

**Context:**
- `JobsList.jsx` currently shows all jobs in a flat list, sorted by job number or date.
- The job pipeline has 7 statuses: `SURVEY | QUOTATION | BOOKING | PRE_MOVE | IN_TRANSIT | DELIVERED | CLOSED`.
- A quick-filter bar (similar to a segmented control or tag cloud) above the list would let users click one or more statuses to narrow the view without a full page reload.
- The active filter(s) should persist while the user is on the page (component state), but do not need to survive navigation (no URL param or localStorage required for MVP).

**Proposed implementation:**
- Add a row of status filter chips above the jobs table in `JobsList.jsx`.
- Each chip shows the status label (translated, color-coded using existing `statusMeta`) and a count badge showing how many jobs are in that status.
- Clicking a chip toggles it on/off; multiple chips can be active simultaneously.
- When no chip is selected, all jobs are shown (default "show all" state).
- Filtering is done client-side on the already-fetched list (no new API call needed).
- An "× Clear" button appears when any filter is active.

**Acceptance criteria:**
- Status filter chips appear above the jobs list, one per status value, each showing the status label and count.
- Clicking a chip filters the list to show only jobs with that status; the chip appears visually selected (filled background).
- Multiple chips can be active at once (OR logic: show jobs matching any selected status).
- Deselecting all chips restores the full list.
- Counts update if the underlying list data refreshes (e.g. after creating or editing a job).
- The filter is reset when the user navigates away and returns to the page.
- i18n: no new keys needed (status labels already exist in `constants.js` / `i18n.jsx`).

---

## 14. File & Schedule Improvements (June 2026)

### ~~IMP-01~~ ✅ — Restore Origin Address in Import File and Import Job

**User story:** As an operations user, I want Origin Address available again in Import File and Import Job flows so import records have complete route information.

**Context:**
- Origin Address used to exist in Import flows and was removed from UI.
- It is currently unclear whether the DB field was removed or only hidden.
- Origin Address must also appear in generated documents and printouts.

**Acceptance criteria:**
- Import File create/edit forms include Origin Address and save it.
- Import Job create/edit forms include Origin Address and save it.
- Import File and Import Job detail/summary views display Origin Address.
- Import-related documents and printouts include Origin Address.
- If the DB field is missing, a safe schema update is added without breaking existing records.

**Test checklist (post-implementation):**
- [ ] Create a new Import File with Origin Address; save and reopen; verify value persists.
- [ ] Edit an existing Import File Origin Address; save and verify updated value appears in detail and summary.
- [ ] Create a new Import Job with Origin Address; save and reopen; verify value persists.
- [ ] Edit an existing Import Job Origin Address; save and verify updated value appears in detail and summary.
- [ ] Generate/print relevant Import File document(s); verify Origin Address is shown.
- [ ] Generate/print relevant Import Job document(s); verify Origin Address is shown.
- [ ] Regression: create/edit Export and Local records to confirm no unintended field breakage.

---

### ~~IMP-02~~ ✅ — Fix auto-created Schedule entry client naming for new Jobs

**User story:** As a scheduler, I want auto-generated schedule entries created from Jobs to always use the client full name (not the agent name) so the schedule is clear and consistent.

**Context:**
- Auto-created schedule entries are using agent name in the client portion in some cases.
- The description currently adds terms like Empaque/Desempaque to the client text; task type already provides this information.
- Existing descriptive structure can remain; only the client-name source must be corrected.

**Acceptance criteria:**
- When a Job auto-creates a schedule entry, the client portion uses client full name.
- Agent name is never used as client name in auto-created schedule entries.
- Empaque/Desempaque are not prepended/appended to client name text.
- Existing descriptive format remains otherwise unchanged.

**Test checklist (post-implementation):**
- [ ] Create a Job with a linked agent and client; verify auto-created schedule item uses client full name.
- [ ] Create a Job where agent and client names differ clearly; verify schedule text never uses agent as client name.
- [ ] Create an EMPAQUE-type auto entry and verify client text does not include the word "Empaque".
- [ ] Create a DESEMPAQUE-type auto entry and verify client text does not include the word "Desempaque".
- [ ] Verify schedule item still keeps the rest of the description format currently used.
- [ ] Regression: manually-created schedule items are unchanged.

---

### ~~IMP-03~~ ✅ — Update Export summary: remove Service Type and add Weight/Volume

**User story:** As a file coordinator, I want Export summary to show Weight and Volume instead of Service Type so the summary reflects the operational metrics we need.

**Acceptance criteria:**
- Export summary no longer displays Service Type.
- Export summary displays Weight and Volume fields.
- Weight is shown with unit `KG`.
- Volume is shown with unit `CMB`.

**Test checklist (post-implementation):**
- [ ] Open Export summary and confirm Service Type field is removed.
- [ ] Confirm Weight and Volume fields are visible on Export summary.
- [ ] Enter/save Weight and confirm summary shows value with `KG`.
- [ ] Enter/save Volume and confirm summary shows value with `CMB`.
- [ ] Verify empty-state display for missing Weight/Volume is clear and non-breaking.
- [ ] Regression: no layout overlap/overflow issues on desktop and mobile widths.

---

### ~~IMP-04~~ ✅ — Add Weight/Volume to Import summary

**User story:** As a file coordinator, I want Import summary to include Weight and Volume so Import and Export summaries are aligned.

**Acceptance criteria:**
- Import summary displays Weight and Volume fields.
- Weight is shown with unit `KG`.
- Volume is shown with unit `CMB`.

**Test checklist (post-implementation):**
- [ ] Open Import summary and confirm Weight and Volume fields are visible.
- [ ] Enter/save Weight and confirm summary shows value with `KG`.
- [ ] Enter/save Volume and confirm summary shows value with `CMB`.
- [ ] Verify empty-state display for missing Weight/Volume is clear and non-breaking.
- [ ] Regression: no layout overlap/overflow issues on desktop and mobile widths.

---

### ~~IMP-05~~ ✅ — Block Import/Export file closure when Weight or Volume is missing

**User story:** As an operations manager, I want Import and Export files to be blocked from closing unless Weight and Volume are filled so data quality is enforced at closure.

**Context:**
- Applies only to `IMPORT` and `EXPORT` files.
- Already closed historical files are out of scope.

**Acceptance criteria:**
- Closing an Import or Export file is blocked if Weight is empty.
- Closing an Import or Export file is blocked if Volume is empty.
- A clear validation message is shown to users indicating Weight (`KG`) and Volume (`CMB`) are required.
- Backend also enforces this rule so API calls cannot bypass the validation.
- Local files are not affected by this validation.

**Test checklist (post-implementation):**
- [ ] Import file: leave Weight empty, attempt close, verify close is blocked and message is shown.
- [ ] Import file: leave Volume empty, attempt close, verify close is blocked and message is shown.
- [ ] Export file: leave Weight empty, attempt close, verify close is blocked and message is shown.
- [ ] Export file: leave Volume empty, attempt close, verify close is blocked and message is shown.
- [ ] Import file: fill both Weight and Volume, attempt close, verify close succeeds.
- [ ] Export file: fill both Weight and Volume, attempt close, verify close succeeds.
- [ ] Local file: missing Weight/Volume should not block close.
- [ ] API-level test: call close endpoint for Import/Export without Weight or Volume and verify backend rejection.
- [ ] API-level test: call close endpoint with both values and verify success.

---

### ~~IMP-06~~ ✅ — Export Delivery Confirmation is optional unless Booker role is Booker

**User story:** As a coordinator, I want Delivery Confirmation to be optional for Export files unless the Booker/OA/DA role is Booker, so required documents match the actual responsibility.

**Context:**
- Rule applies to all requirement logic, not only one screen.

**Acceptance criteria:**
- For Export files with Booker role `BOOKER`, `DELIVERY_CONFIRMATION` is required.
- For Export files with Booker role `OA` or `DA`, `DELIVERY_CONFIRMATION` is optional.
- The rule is enforced in closure validation.
- The rule is enforced in required-document progression calculations.
- The rule is enforced in completion percentage calculations.
- If Booker role changes, requirement/progression/percentage update accordingly.

**Test checklist (post-implementation):**
- [ ] Export file with Booker role `BOOKER` and no Delivery Confirmation: verify requirement appears as pending.
- [ ] Export file with Booker role `BOOKER` and no Delivery Confirmation: verify close is blocked.
- [ ] Export file with Booker role `BOOKER` and Delivery Confirmation uploaded: verify requirement clears and close can proceed (assuming other validations pass).
- [ ] Export file with Booker role `OA` and no Delivery Confirmation: verify item is optional and does not block close.
- [ ] Export file with Booker role `DA` and no Delivery Confirmation: verify item is optional and does not block close.
- [ ] For each role (`BOOKER`, `OA`, `DA`), verify required-doc progression reflects conditional requirement correctly.
- [ ] For each role (`BOOKER`, `OA`, `DA`), verify completion percentage recalculates correctly when Delivery Confirmation is added/removed.
- [ ] Change role dynamically (OA/DA -> BOOKER and BOOKER -> OA/DA) and verify requirement/progression/percentage update immediately.

---

