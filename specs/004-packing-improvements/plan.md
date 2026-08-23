# Implementation Plan: Packing Improvements

**Branch**: `004-packing-improvements` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-packing-improvements/spec.md`

## Summary

Deliver a cross-surface packing reliability upgrade spanning backend API, web file packing panel, and mobile packing workflow. The plan introduces soft-delete for web removal, localization correction for Spanish tab text, packing-list-first mobile home flow, strict eligible-file filtering (OPEN EXPORT/LOCAL/WAREHOUSE only), and a robust completion model that avoids user dead-ends by using a locked COMPLETE_PENDING_SYNC state before server-confirmed CLOSED. Synchronization integrity is enforced by full-state debounced saves of packages/items/photos and explicit web sync visibility during propagation lag.

## Technical Context

**Language/Version**:
- Backend: Node.js 20, JavaScript (CommonJS), Express
- Frontend: React 18 + Vite, JavaScript/JSX
- Mobile: React Native (Expo SDK 57), TypeScript

**Primary Dependencies**:
- Backend: Prisma 5, @azure/storage-blob, uuid
- Frontend: react-router-dom, axios, existing i18n provider
- Mobile: axios, expo-network, expo-sqlite, react-native-signature-canvas

**Storage**:
- PostgreSQL via Prisma (server source of truth)
- Local SQLite in mobile for offline-first state
- Azure Blob Storage for package photos and client signatures

**Testing**:
- Existing project scripts and manual E2E scenario validation
- API contract validation against packing routes
- Mobile online/offline transition validation via quickstart scenarios

**Target Platform**:
- Backend: Linux container on Azure App Service
- Frontend: modern desktop browser
- Mobile: Android/iOS devices used by warehouse operators

**Project Type**:
- Monorepo web + API + mobile operational application

**Performance Goals**:
- Web packing summary reflects online mobile updates within <= 10 seconds
- Completion retries auto-finalize pending lists within 5 minutes after stable connectivity

**Constraints**:
- Offline-first mobile behavior must be preserved
- Full-object update semantics must be preserved in existing backend patterns
- Bilingual text changes must be in i18n dictionaries (EN/ES)
- Auditability cannot be weakened for delete and completion events

**Scale/Scope**:
- Incremental update to existing packing modules across 3 surfaces
- Typical working set: dozens of active lists, up to tens of packages/photos per list

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Review

- Principle I (Bilingual by Default): PASS
  - Plan includes i18n-key-based Spanish label correction with EN/ES parity.
- Principle II (Auditability): PASS
  - Deletion is soft-delete with retained history; completion transitions are auditable.
- Principle III (RBAC): PASS
  - Packing endpoints remain role-gated; no privilege broadening introduced.
- Principle IV (Azure auth/storage): PASS
  - Signature/photo flow remains Azure Blob based; no local-only production artifact store.
- Principle V (Prisma singleton): PASS
  - API changes remain in route modules using getPrisma().
- Principle VI (Domain invariants): PASS
  - Moving-file category constraints and update semantics are explicitly preserved.
- Principle VII (Incremental change): PASS
  - Scope targets existing modules with minimal surface-area expansion.

Gate Result: PASS

## Project Structure

### Documentation (this feature)

```text
specs/004-packing-improvements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── packing-lists-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma
├── routes/
│   └── packingLists.js
└── middleware/
    └── accessControl.js

frontend/
└── src/
    ├── i18n.jsx
    ├── components/
    │   └── Layout.jsx
    └── pages/
        └── Files/
            ├── FileDetail.jsx
            └── PackingListsPanel.jsx

mobile/
└── src/
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── NewPackingListScreen.tsx
    │   ├── PackingListScreen.tsx
    │   └── SignatureScreen.tsx
    ├── services/
    │   ├── api.ts
    │   └── cacheService.ts
    ├── hooks/
    │   └── useLiveSync.ts
    └── db/
        ├── schema.ts
        └── queries.ts
```

**Structure Decision**: Use the existing monorepo web+api+mobile structure and implement only focused changes inside established packing modules. No new top-level services are required.

## Phase 0 Output Reference

- Research completed: [research.md](./research.md)
- All prior clarifications resolved; no open NEEDS CLARIFICATION markers remain.

## Phase 1 Output Reference

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/packing-lists-api.yaml](./contracts/packing-lists-api.yaml)
- Validation scenarios: [quickstart.md](./quickstart.md)

## Post-Design Constitution Re-Check

- Principle I (Bilingual by Default): PASS
  - Contract and quickstart require EN/ES review language behavior and Spanish label correction through i18n.
- Principle II (Auditability): PASS
  - Data model defines soft-delete retention and completion audit events.
- Principle III (RBAC): PASS
  - No contract path bypasses role controls; packing endpoints stay under current middleware.
- Principle IV (Azure auth/storage): PASS
  - Contract keeps upload-token and blob-path model for photos/signature.
- Principle V (Prisma singleton): PASS
  - Design assumes route-level getPrisma() pattern and transactional save behavior.
- Principle VI (Domain invariants): PASS
  - Full-state save and moving-file category rules remain explicit.
- Principle VII (Incremental, low-risk): PASS
  - Design extends existing endpoints and states rather than introducing parallel workflows.

Gate Result: PASS

## Complexity Tracking

No constitution violations identified. No special complexity exemptions required.

## Implementation Notes (2026-08-04)

- Backend schema updated and synchronized (`prisma db push`, `prisma generate`) for packing-list soft-delete and completion metadata.
- Packing routes updated for soft-delete, enriched summary counters, sync visibility, completion review language, and lock/edit protections.
- Web packing panel updated with delete action, sync-in-progress indicator, and i18n status labels.
- Mobile home flow changed to packing-list-first, with explicit new-list action and eligible-file filtering (OPEN EXPORT/LOCAL/WAREHOUSE only).
- Mobile signature flow updated to require review language selection and to persist completion intent as pending sync before remote confirmation.
- Mobile live sync updated to retry pending completion on app foreground/connectivity recovery.

Verification performed:
- File-level diagnostics for changed backend/frontend/mobile files: no static errors.
- Prisma schema sync completed successfully on local database.

Acceptance update (2026-08-23):
- The implementation was accepted as complete after iterative web and on-device validation of the packing workflows, including online completion, signature display, synchronization recovery, localization, and packing-list visibility.
- The feature task list is closed at the user's direction; any newly observed behavior will be tracked as follow-up work.
