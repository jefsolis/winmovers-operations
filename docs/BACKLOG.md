# WinMovers Operations — Feature Backlog

> Last updated: May 10, 2026  
> Items are grouped by theme. Priority and sprint assignment to be determined separately.

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
