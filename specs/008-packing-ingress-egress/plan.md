# Implementation Plan: Packing List Ingress & Egress Box Scanning

**Branch**: `008-packing-ingress-egress` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-packing-ingress-egress/spec.md`

## Summary

Turn the existing "Ingress to Truck" / "Ingress to Warehouse" / "Egress from Warehouse" placeholder options (mobile packing list options menu) into working operations: a per-box scan checklist (camera barcode + manual fallback), hard blocking of completion while boxes are missing, a crew-leader signature (plus a warehouse-manager signature for the two warehouse operations) with a single GPS location captured at completion, optional observations, an optional free-text warehouse storage location for the two warehouse operations, resumable/resettable in-progress state, full offline capture with sync, and history visible in both the mobile app and the web application. The approach mirrors the existing `PackingWorkdayEvent` / `PackingProgressTransition` lifecycle pattern already used for daily start/close and completion events (idempotency-keyed offline sync, best-effort location capture, Azure Blob signature storage via SAS upload).

## Technical Context

**Language/Version**: TypeScript (Expo/React Native mobile app), JavaScript (Node.js 20 backend, React 18 web frontend)

**Primary Dependencies**: Expo (`expo-camera` for barcode scanning, `expo-sqlite` for local persistence, `expo-location` for GPS), `react-native-signature-canvas`, Express + Prisma 5, `@azure/storage-blob`, React 18 + Vite

**Storage**: PostgreSQL via Prisma (`getPrisma()`) for server records; on-device SQLite (`packing.db`) for offline mobile state; Azure Blob Storage for signature images

**Testing**: No automated test suite exists for backend/frontend/mobile in this repo today (manual QA via quickstart scenarios); follow existing project convention of no new test framework introduction

**Target Platform**: Android/iOS (Expo managed app) for the operator flow; web (desktop browser) for office history review

**Project Type**: Mobile app + web application + shared Node.js/Express API (existing 3-surface structure)

**Performance Goals**: Checklist state updates and scan feedback must feel instantaneous (<300ms) on-device; no specific backend throughput target beyond existing packing list API load

**Constraints**: Must work fully offline on the operator device (scan, sign, complete, reset all queued and synced later); GPS capture must never block or fail the operation (existing "best-effort, log unavailable" contract); packing lists can have 0–50+ boxes

**Scale/Scope**: 3 operation types × N packing lists; adds 2 Prisma models, ~5 backend endpoints, 2 new mobile screens (or 1 parameterized screen) + options menu wiring, 1 new web history section reusing the existing `PackingListsPanel`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Surface-Specific Language Policy**: PASS. New mobile screens are operator-facing → Spanish only (matches existing Scan/Signature screens). New web history text goes through central i18n (EN/ES). Operation types, scan methods, statuses, and signature roles are stored as language-neutral enums (`INGRESS_TRUCK`, `CAMERA`/`MANUAL`, `CREW_LEADER`/`WAREHOUSE_MANAGER`, etc.).
- **II. Auditability of Material Changes**: PASS. Every operation and box scan is persisted with actor, device, timestamps, and — once complete — signatures and location; nothing is hard-deleted (reset clears working state via explicit update, not row deletion, so the prior attempt's audit trail is not silently destroyed — see research.md for the reset design decision).
- **III. Role-Based Access Control**: PASS. Reuses the existing packing list mobile auth/device-lock model; no new roles are introduced (warehouse manager signs in person on the operator's already-authenticated device, exactly like today's client signatures). Web history read access follows the existing packing list panel's existing access guard.
- **IV. Azure-Native Auth & Storage**: PASS. Signatures are uploaded to Azure Blob Storage via the existing SAS-token upload pattern (`/api/packing-lists/upload-token`); no local disk persistence server-side.
- **V. Prisma Singleton Data Access**: PASS. All new backend queries go through `getPrisma()`; no raw SQL planned.
- **VI. Preserve Domain & Contract Invariants**: PASS. Does not change existing Packing List, Package, or Workday Event contracts; purely additive models/endpoints. Existing "PUT sends full object" rule does not apply (new resources use POST with idempotency keys, matching the existing transition/workday-event pattern).
- **VII. Incremental, Low-Risk Change**: PASS. Reuses established patterns (idempotency-keyed offline sync, best-effort location capture, SAS signature upload, checklist UI conventions) rather than introducing new mechanisms.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-packing-ingress-egress/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma            # + PackingIngressEgressOperation, PackingIngressEgressBoxScan models
└── routes/
    └── packingLists.js          # + ingress/egress endpoints (start/resume, scan, reset, sign, history)

frontend/
└── src/
    ├── i18n.jsx                 # + EN/ES strings for ingress/egress history
    ├── constants.js             # + operation type / status metadata (replaces PACKING_FUTURE_ACTIONS placeholders)
    └── pages/Files/
        └── PackingListsPanel.jsx  # + ingress/egress operation history section

mobile/
└── src/
    ├── db/
    │   ├── schema.ts             # + local tables: ingress_egress_operations, ingress_egress_box_scans
    │   └── queries.ts            # + CRUD/query helpers for the new local tables
    ├── services/
    │   ├── api.ts                # + client methods for the new endpoints
    │   ├── cacheService.ts       # + retry/sync of pending operations & scans
    │   └── location.ts           # (reused, no change)
    ├── navigation/
    │   └── types.ts              # + IngressEgress route param types
    └── screens/
        ├── PackingListScreen.tsx     # wire real navigation for the 3 options-menu actions (replace placeholders)
        ├── IngressEgressScreen.tsx   # NEW: per-box checklist + camera/manual scan + reset + warehouse location/observations entry
        └── IngressEgressSignatureScreen.tsx  # NEW: crew leader (+ warehouse manager) signature capture, single location capture, completion
```

**Structure Decision**: Extends the existing 3-surface layout (`backend/`, `frontend/`, `mobile/`) already used by the packing list feature set. No new top-level projects; the feature is additive within each surface's existing packing-list module (routes/packingLists.js, PackingListsPanel.jsx, mobile packing-list screens/db).
