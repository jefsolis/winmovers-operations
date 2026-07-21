<!--
SYNC IMPACT REPORT
==================
Version change: TEMPLATE (unversioned) → 1.0.0
Rationale: Initial ratification of the WinMovers Operations constitution from
the project template. All placeholder tokens replaced with concrete governance.

Principles defined:
  1. Bilingual by Default (EN/ES) — NEW
  2. Auditability of Material Changes — NEW
  3. Role-Based Access Control — NEW
  4. Azure-Native Auth & Storage — NEW
  5. Prisma Singleton Data Access — NEW
  6. Preserve Domain & Contract Invariants — NEW
  7. Incremental, Low-Risk Change — NEW

Added sections:
  - Technology & Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance

Removed sections: none (template placeholders replaced in place)

Templates reviewed for alignment:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic
     and reads from this file; no changes required.
  ✅ .specify/templates/spec-template.md — no principle-specific references;
     no changes required.
  ✅ .specify/templates/tasks-template.md — task categories compatible with the
     principles below (i18n, audit, access-control tasks fit existing phases);
     no changes required.
  ✅ .specify/templates/checklist-template.md — generic; no changes required.

Follow-up TODOs: none. RATIFICATION_DATE set to the date of first adoption
recorded below; update if an earlier formal adoption date is identified.
-->

# WinMovers Operations Constitution

WinMovers Operations is a production enterprise system that manages the full
lifecycle of international moving operations: clients, visits, quotes,
jobs/work orders, moving files (expedientes), attachments, agents, staff, audit
logs, schedule entries, and reports. This constitution governs how the system
evolves. It is not aspirational: it encodes invariants that already hold in the
codebase and MUST continue to hold.

## Core Principles

### I. Bilingual by Default (EN/ES)

Every user-facing string MUST flow through the central i18n system and MUST be
defined in both English and Spanish. Components MUST NOT hardcode display
labels; status and type labels MUST come from i18n keys or `constants.js`
metadata helpers.

- Adding UI text without both `en` and `es` entries is a defect.
- Generated documents and reports MUST honor the record's language where the
  business rule specifies one, and MUST be internally consistent otherwise.

Rationale: The business operates bilingually with clients, agents, and staff;
partial translations produce broken screens and non-compliant documents.

### II. Auditability of Material Changes

Material create, update, and delete actions on core records MUST remain
traceable. Existing audit and history behavior MUST be preserved when code is
changed, and extended deliberately when new material entities are introduced.

- Soft-deleted records MUST remain auditable; deletion MUST NOT erase history.
- Changes that would drop, weaken, or bypass audit capture require explicit
  justification in the governing spec.

Rationale: The system is a system of record for compliance-sensitive moving
operations; "who changed what, and when" must always be answerable.

### III. Role-Based Access Control

Sensitive operations MUST be protected by backend middleware AND matching
frontend guards. Existing access patterns — including ADMIN and BODEGA/Schedule
access — MUST be respected.

- A new role-gated screen or API MUST update both the frontend guard and the
  backend middleware; a guard on only one side is a defect.
- Access decisions MUST NOT be silently loosened.

Rationale: Warehouse (BODEGA), administrative, and operational staff have
distinct, non-overlapping privileges that protect business data integrity.

### IV. Azure-Native Auth & Storage

Authentication MUST use Azure AD / MSAL with JWT, and staff linkage MUST resolve
via Azure OID. File and document persistence MUST use Azure Blob Storage.

- Production code paths MUST NOT introduce local disk storage for attachments,
  signatures, or generated files.
- Auth flows MUST NOT be bypassed for `/api` routes outside explicitly public
  endpoints.

Rationale: The deployment target and security model depend on Azure identity
and object storage; local storage or alternate auth breaks portability and
compliance.

### V. Prisma Singleton Data Access

Backend database access MUST use the shared `getPrisma()` helper. Code MUST NOT
instantiate `new PrismaClient()` directly. Raw SQL MUST be avoided unless there
is no practical Prisma alternative, and its use MUST be justified.

- Schema changes MUST be followed by `prisma db push` and `prisma generate`.
- Route modules MUST avoid circular dependencies; shared logic belongs in
  explicit helpers, not cross-imported route files.

Rationale: A single cached client prevents connection exhaustion and keeps data
access consistent and testable.

### VI. Preserve Domain & Contract Invariants

The existing domain rules and API contracts are binding and MUST be preserved
unless a change explicitly and intentionally revises them:

- Core models: Jobs, Visits, Quotes, Clients, Agents, Staff, Moving Files,
  Schedule Entries, Attachments.
- Export and Import moving files are auto-created for Jobs when appropriate.
- Numbering schemes are fixed: moving files use category prefixes
  (`E-0001` export, `D-0001` import, `M-0001` local); Visits and Quotes use
  their own sequential numbering.
- Schedule entries are part of the warehouse/operations flow and are
  permission-gated.
- Reports (e.g., the FIDI declaration report) depend on normalized business
  values and MUST keep their exact formatting, normalization, and numbering
  rules.
- Weight fields are semantically pounds (LB) in the UI even where legacy naming
  says `weightKg`.
- Frontend update requests MUST send the full object. Backend update handlers
  destructure the full body, so partial PUT payloads will null out omitted
  fields and are a defect.
- Route registration order and path precedence MUST be preserved; attachment
  routes MUST be registered before `/api/files`.

Rationale: These invariants are load-bearing; silently altering them corrupts
records, breaks documents, or regresses access control.

### VII. Incremental, Low-Risk Change

Prefer the smallest change that satisfies the requirement. Favor incremental,
low-risk edits over large rewrites. Do not optimize away legacy behavior unless
the change is explicitly intended.

- Changes MUST stay consistent with the current codebase style.
- Normalization, formatting, and permission logic MUST be centralized in
  explicit helpers rather than duplicated.

Rationale: This is a live production system; broad rewrites introduce
disproportionate operational risk relative to their benefit.

## Technology & Architecture Constraints

The stack is fixed for the current architecture and MUST NOT be swapped without
a governance amendment:

- Frontend: React 18 + Vite + React Router (client-side rendering).
- Backend: Node.js + Express, serving the built frontend as static files.
- Database: PostgreSQL with Prisma 5 (access via `getPrisma()`).
- Auth: Azure AD / MSAL, JWT validated via JWKS, staff linked by Azure OID.
- Storage: Azure Blob Storage for attachments, signatures, and generated files.
- Deployment: Docker multi-stage build → GitHub Actions → Azure Container
  Registry → Azure App Service.

Additional constraints:

- New backend routes MUST follow the established handler pattern (async handler,
  `try/catch` delegating to the global error handler) and MUST be registered in
  the correct order in `backend/index.js`.
- The global error handler's contract (e.g., Prisma `P2025` → 404) MUST be
  preserved.

## Development Workflow & Quality Gates

Every change MUST satisfy the following gates before it is considered complete:

- [ ] Schema changes ran `prisma db push` and `prisma generate`.
- [ ] New UI text added to both `en` and `es` translation maps.
- [ ] New routes registered in the correct order in `backend/index.js`.
- [ ] Role-gated features updated on both frontend guards and backend
      middleware, and verified against the BODEGA role for correct restriction.
- [ ] New reports/documents preserve exact business wording, normalization, and
      numbering behavior.
- [ ] Update flows send full objects (no partial PUT payloads).
- [ ] Attachments and generated files persist only to Azure Blob Storage.
- [ ] Audit/history behavior preserved (or deliberately extended) for material
      changes.

Reviews MUST verify compliance with these gates and with the Core Principles.
Any deviation MUST be justified in the governing spec or PR description.

## Governance

This constitution supersedes ad-hoc practices for the WinMovers Operations
codebase. When guidance conflicts, the constitution wins.

- Amendments MUST be proposed with rationale, the affected principles or
  sections, and any migration impact, and MUST update the version below.
- Versioning follows semantic versioning:
  - MAJOR: backward-incompatible governance changes (principle removed or
    materially redefined, or a fixed technology/contract invariant changed).
  - MINOR: a new principle or section is added, or guidance is materially
    expanded.
  - PATCH: clarifications, wording, or non-semantic refinements.
- All PRs and reviews MUST confirm the change respects the Core Principles and
  passes the Development Workflow & Quality Gates.
- Complexity or deviation from an invariant MUST be explicitly justified; if it
  cannot be justified, the simpler compliant approach MUST be used.

**Version**: 1.0.0 | **Ratified**: 2026-07-20 | **Last Amended**: 2026-07-20
