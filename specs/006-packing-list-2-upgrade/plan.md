# Implementation Plan: Packing List 2.0 Operations

**Branch**: `006-packing-list-2-upgrade` | **Date**: 2026-08-24 | **Spec**: `/specs/006-packing-list-2-upgrade/spec.md`

**Input**: Feature specification from `/specs/006-packing-list-2-upgrade/spec.md`

## Summary

Extend packing-list operations to support multi-day execution with dual signatures (client + crew leader) per day boundary, preserve per-day history, enforce barcode completeness before final completion, and allow box-content edits and deferred barcode assignment. The approach reuses existing offline/idempotent synchronization patterns, adds explicit day-event semantics, and introduces non-operational placeholders for future warehouse/truck actions without changing current core workflow behavior.

## Technical Context

**Language/Version**: TypeScript 6.x (mobile), JavaScript Node.js 20 (backend), SQL (SQLite + PostgreSQL via Prisma)

**Primary Dependencies**: React Native/Expo SDK 52, React Navigation, expo-sqlite, expo-network, expo-file-system, Express, Prisma 5, @azure/storage-blob

**Storage**: Mobile offline cache in SQLite (`packing.db`), backend PostgreSQL via Prisma, signatures/photos in Azure Blob Storage

**Testing**: `npx tsc --noEmit`, `npx expo export --platform android`, backend route syntax checks, scenario validation from quickstart

**Target Platform**: Android/iOS operator mobile app + existing Node.js API consumed by mobile and web

**Project Type**: Mobile + API + web monitoring workflow

**Performance Goals**: Daily workflow actions and box edits should synchronize under normal connectivity within current live-sync expectations (target under 10 seconds for visible consistency)

**Constraints**: Offline-capable workflow, idempotent retry safety, full-object PUT update semantics, immutable completed-list operations, Spanish operator-facing mobile text, client-facing EN/ES consistency

**Scale/Scope**: Active operational usage across many concurrent packing lists; feature scope touches mobile packing detail, signature flows, sync services, backend packing-list route contracts, and related web display text

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Principle I (Surface-Specific Language Policy): PASS
  - Operator-facing mobile remains Spanish.
  - Client-facing signature/review/satisfaction interactions remain EN/ES-capable.
  - New domain states and event types stay language-neutral.
- Principle II (Auditability): PASS
  - Design includes explicit per-day history events and actor/timestamp retention.
- Principle III (RBAC): PASS
  - No access relaxation planned; existing guards must remain unchanged.
- Principle IV (Azure-Native Auth & Storage): PASS
  - Signatures and photos continue via Azure Blob storage and signed URLs.
- Principle V (Prisma Singleton): PASS
  - Backend changes remain in route/service pattern using `getPrisma()`.
- Principle VI (Domain & Contract Invariants): PASS
  - Full-object PUT semantics preserved.
  - Existing route ordering and enum language neutrality preserved.
- Principle VII (Incremental Change): PASS
  - Feature split into additive event and validation extensions without workflow rewrite.

Post-Design Re-check: PASS

## Project Structure

### Documentation (this feature)

```text
specs/006-packing-list-2-upgrade/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── packing-list-2-workday-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── index.js
├── prisma/
│   └── schema.prisma
├── routes/
│   └── packingLists.js
└── services/

frontend/
└── src/
    ├── i18n.jsx
    ├── constants.js
    └── pages/

mobile/
└── src/
    ├── db/
    │   ├── schema.ts
    │   └── queries.ts
    ├── hooks/
    │   └── useLiveSync.ts
    ├── services/
    │   ├── api.ts
    │   └── cacheService.ts
    └── screens/
        ├── PackingListScreen.tsx
        ├── PackageDetailScreen.tsx
        ├── SignatureScreen.tsx
        ├── ArrivalAcknowledgementScreen.tsx
        ├── ScanScreen.tsx
        └── PhotoScreen.tsx
```

**Structure Decision**: Use the existing mobile + backend architecture, extending current packing-list routes, sync services, and mobile screens in place. No new top-level apps or services are introduced.

## Complexity Tracking

No constitution violations requiring exception handling.

## Implementation Tracking Stub

- Feature branch: `006-packing-list-2-upgrade`
- Execution mode: phase-by-phase (Setup → Foundational → US1..US5 → Polish)
- Source of truth: `specs/006-packing-list-2-upgrade/tasks.md`
