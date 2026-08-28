# Implementation Plan: Packing List Status Progress

**Branch**: `005-packing-list-status` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-packing-list-status/spec.md`

## Summary

Add a four-stage operational progress model (`NOT_STARTED` → `TRAVELING` → `WORKING` → `COMPLETED`) to packing lists without replacing the existing lifecycle and synchronization states. The backend gains append-only idempotent transition history, normalized client service context, arrival acknowledgement, and a versioned satisfaction response. Mobile gains a Spanish four-step progress UI, one contextual next-stage action, offline transition queue, client call/navigation actions, arrival signature, completion observations/rating, and placeholder job options. Web mirrors progress and sign-off details through quiet 10-second refreshes and retains its existing localization behavior.

## Technical Context

**Language/Version**:
- Backend: Node.js 20, JavaScript (CommonJS), Express
- Frontend: React 18 + Vite, JavaScript/JSX
- Mobile: React Native 0.76 / Expo SDK 52, TypeScript

**Primary Dependencies**:
- Backend: Prisma 5, `@azure/storage-blob`, `uuid`
- Frontend: existing Axios wrapper, React Router, existing i18n provider; add `lucide-react`
- Mobile: Expo SQLite, Expo Network, React Navigation, signature canvas; add `@expo/vector-icons`

**Storage**:
- PostgreSQL via Prisma for packing lists, immutable progress transitions, survey responses, and metadata
- Azure Blob Storage for arrival and completion signatures
- Mobile SQLite for offline packing state and durable pending transition queue

**Testing**:
- Prisma schema validation/generation and idempotent backfill execution
- Frontend production build
- Mobile TypeScript compile (`npx tsc --noEmit`)
- API contract and manual cross-surface scenarios in [quickstart.md](./quickstart.md)

**Target Platform**:
- Backend: Linux Node 20 container on Azure App Service
- Frontend: modern desktop browsers used by operations staff
- Mobile: Android/iOS Expo application used by field operators

**Project Type**: Monorepo web application + Express API + offline-capable mobile application

**Performance Goals**:
- Confirmed progress changes visible on web and mobile within 10 seconds under stable connectivity
- Contextual status and client detail render from local cache without a blocking network round trip after initial synchronization
- Pending transitions begin retry immediately on foreground or restored connectivity

**Constraints**:
- Preserve existing lifecycle `status`, lock semantics, full-state package save, and pending completion recovery
- Sequential forward transitions only; retries must be idempotent across app restart and network timeout
- All signature binaries remain in Azure Blob Storage
- Operator-facing mobile strings are Spanish; client-facing mobile interactions and web strings retain EN/ES parity; backend values remain language-neutral
- Existing role restrictions and auditability must not be weakened

**Scale/Scope**:
- Three existing application surfaces and one packing route/schema slice
- Typical working set of dozens of active lists and a small transition history per list
- Version 1 satisfaction survey contains one rating but the persistence contract supports future questions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Review

- Principle I (Surface-Specific Language Policy): PASS
  - Web uses the existing EN/ES dictionaries, operator-facing mobile progress UI is Spanish, client-facing acknowledgement/sign-off supports EN/ES, and backend progress values remain language-neutral.
- Principle II (Auditability): PASS
  - Progress transitions are append-only, actor/timestamp identified, and material completion remains in the existing audit log.
- Principle III (Role-Based Access Control): PASS
  - Existing packing route authorization and BODEGA access remain in force; no public or client-only route is added.
- Principle IV (Azure-Native Auth & Storage): PASS
  - Azure OID identifies actors and all signature binaries use the existing Azure SAS/blob flow.
- Principle V (Prisma Singleton Data Access): PASS
  - Route changes use `getPrisma()` and schema changes require `db push` plus `generate`.
- Principle VI (Domain & Contract Invariants): PASS
  - Operational progress is separate from lifecycle status, preserving full-object packing saves, route order, lock rules, and completion behavior.
- Principle VII (Incremental, Low-Risk Change): PASS
  - Existing packing modules and retry mechanisms are extended; no new realtime service or parallel packing workflow is introduced.

Gate Result: PASS

## Project Structure

### Documentation (this feature)

```text
specs/005-packing-list-status/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── packing-list-progress-api.yaml
└── tasks.md                         # Generated later by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma
├── routes/
│   └── packingLists.js
└── scripts/
    └── backfill-packing-progress.js

frontend/
├── src/
│   ├── constants.js
│   ├── i18n.jsx
│   └── pages/Files/PackingListsPanel.jsx
└── package.json

mobile/
├── src/
│   ├── components/
│   │   ├── PackingProgressIndicator.tsx
│   │   └── StarRating.tsx
│   ├── db/
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── hooks/
│   │   └── useLiveSync.ts
│   ├── screens/
│   │   ├── PackingListScreen.tsx
│   │   ├── ArrivalAcknowledgementScreen.tsx
│   │   └── SignatureScreen.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── cacheService.ts
│   └── navigation/types.ts
└── package.json
```

**Structure Decision**: Extend the existing backend/web/mobile packing modules. Add only focused mobile components/screens and a server backfill script; no mobile translation layer is introduced. Keep all API behavior in the established packing route to preserve registration and authorization boundaries.

## Phase 0 Output Reference

- Research decisions: [research.md](./research.md)
- All technical unknowns resolved; no `NEEDS CLARIFICATION` markers remain.

## Phase 1 Output Reference

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/packing-list-progress-api.yaml](./contracts/packing-list-progress-api.yaml)
- End-to-end validation: [quickstart.md](./quickstart.md)

## Post-Design Constitution Re-Check

- Principle I (Surface-Specific Language Policy): PASS
  - Web status/action concepts map to existing EN/ES keys. Operator-facing mobile uses approved Spanish labels and actions; client-facing acknowledgement, signature, observations, review, and satisfaction render in the selected EN/ES language; contract enums remain language-neutral.
- Principle II (Auditability): PASS
  - The data model preserves immutable progress transitions and existing packing audit entries; soft-delete retains related history.
- Principle III (Role-Based Access Control): PASS
  - Contract remains under authenticated packing routes and exposes sensitive client/signature/survey data only through existing authorized surfaces.
- Principle IV (Azure-Native Auth & Storage): PASS
  - Transition signatures store blob paths and API responses generate expiring signed URLs.
- Principle V (Prisma Singleton Data Access): PASS
  - Design requires transactional `getPrisma()` operations and explicit schema sync/client generation.
- Principle VI (Domain & Contract Invariants): PASS
  - Completion is atomic with lifecycle close; current full-state save and one-list-per-file behavior remain unchanged.
- Principle VII (Incremental, Low-Risk Change): PASS
  - Quiet polling reuses the established schedule pattern; durable queues extend current SQLite/reconnect behavior.

Gate Result: PASS

## Complexity Tracking

No constitution violations or complexity exemptions are required.
