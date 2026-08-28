# Implementation Plan: Packing List GPS Location Tracking

**Branch**: `007-packing-list-gps-location` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-packing-list-gps-location/spec.md`

## Summary

Record the device's position at each packing list lifecycle stage (creation, travel start, work start, each workday start and close, final completion), surface those positions in the web history as links that open Google Maps, and let office users set a job's exact service coordinates by map selection or by pasting a shared coordinate link so mobile navigation can target the precise point instead of a text address.

Technical approach: add nullable location columns to the three existing lifecycle-event tables plus `PackingList`, and two coordinate columns to `Job` — no new tables. On mobile, a single `captureStageLocation()` helper built on `expo-location` returns a settled result and never throws, so the six call sites always proceed; captured values are written into the existing SQLite queue rows at enqueue time and travel with their event on sync, which makes offline capture and retry correct by construction. Backend handlers accept an optional `location` object and persist it only on first create, preserving idempotency and immutability. Web adds a per-event map-pin link and a coordinate field with map picker on the job form, with all new strings routed through the central i18n system.

## Technical Context

**Language/Version**: Node.js + Express (backend), React 18 + Vite (web), React Native 0.76 / TypeScript on Expo SDK 52 (mobile)

**Primary Dependencies**: Prisma 5 + PostgreSQL, `expo-location` (new mobile dependency), Google Maps JavaScript API (new, optional `VITE_`-prefixed key), existing `expo-sqlite` offline store

**Storage**: PostgreSQL via the shared `getPrisma()` singleton; mobile SQLite for offline queueing. No new storage system; Azure Blob Storage usage is unchanged.

**Testing**: Manual quickstart scenarios plus existing gates — `npx tsc --noEmit` and `npx expo export --platform android` (mobile), `node --check` on changed routes (backend), `npm run build` (frontend)

**Target Platform**: Azure App Service container for web/API; Android device via Expo for mobile

**Performance Goals**: Location capture adds ≤2s to any stage (SC-003); capture is bounded by a ~5s timeout race that can never block stage completion

**Constraints**: Non-blocking capture (FR-007/FR-009); offline-capable with original-capture-time preservation (FR-010/FR-011); full-object PUT semantics preserved for jobs; language-neutral domain enums; additive, nullable-only schema changes

**Scale/Scope**: 6 lifecycle stages, 4 backend endpoints touched, 2 job payload surfaces, 1 web history panel, 4 mobile screens plus the sync layer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| I. Surface-Specific Language Policy | New web strings (coordinate field, validation messages, exact-coordinates indicator, location link, unavailable state) go in both EN and ES maps in `frontend/src/i18n.jsx`; new operator-facing mobile text is Spanish; no new client-facing mobile interaction; `locationUnavailableReason` is a language-neutral enum translated only at the presentation boundary. | PASS |
| II. Auditability of Material Changes | No audit call site is removed or weakened. `logAudit` snapshots whole records, so new columns on `Job` and `PackingList` are captured automatically. Stage locations are immutable evidence and are never rewritten. | PASS |
| III. Role-Based Access Control | No new roles, screens, or endpoints. All reads and writes occur through endpoints already gated by existing middleware and frontend guards; access to a location is exactly the access to its parent record. | PASS |
| IV. Azure-Native Auth & Storage | No auth change. No new file persistence — coordinates are scalar database columns, not blobs. No local disk storage introduced. | PASS |
| V. Prisma Singleton Data Access | All new queries use existing handlers built on `getPrisma()`. No `new PrismaClient()`, no raw SQL. Schema change followed by `prisma db push` and `prisma generate` per the quality gate. | PASS |
| VI. Preserve Domain & Contract Invariants | Schema changes are additive and nullable. Job `POST`/`PUT` keep full-object semantics, with the new fields added to the destructured list *and* to every frontend payload that submits a job (both `JobForm.jsx` and the `JobDocument.jsx` inline editor) so neither screen nulls out the other's data. Route registration order, numbering schemes, idempotency keys, and the completion barcode gate are untouched. | PASS |
| VII. Incremental, Low-Risk Change | Inline nullable columns instead of a new location table; one shared capture helper instead of six try/catch blocks; extend `getServiceContext()` rather than adding a mobile fetch; graceful degradation when no maps key is configured. | PASS |

**Result**: PASS. No violations; Complexity Tracking is not required.

**Post-Design Re-check**: PASS. Phase 1 introduced no new entity beyond nullable columns, no new endpoint, no new role, and no new storage target. The only new runtime dependencies are `expo-location` (first-party for the existing SDK) and an optional Google Maps key that the design explicitly degrades without.

## Project Structure

### Documentation (this feature)

```text
specs/007-packing-list-gps-location/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── packing-list-location-api.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma                        # + location columns on PackingList,
│                                            #   PackingProgressTransition, PackingWorkdayEvent
│                                            # + serviceLatitude/serviceLongitude on Job
└── routes/
    ├── packingLists.js                      # accept + persist `location` on create,
    │                                        #   progress-transitions, workday-events, complete;
    │                                        #   serialize location in serializeTransition /
    │                                        #   serializeWorkdayEvent; expose coordinates
    │                                        #   through getServiceContext()
    └── jobs.js                              # + coordinate fields in POST/PUT destructuring
                                             #   and range/pairing validation

frontend/
└── src/
    ├── i18n.jsx                             # EN/ES strings for all new web text
    ├── constants.js                         # location unavailability reason metadata
    ├── components/
    │   └── LocationPicker.jsx               # (new) map selection + shared-link parsing
    └── pages/
        ├── Files/
        │   └── PackingListsPanel.jsx        # map-pin link per history event,
        │                                    #   unavailable-location state
        └── Jobs/
            ├── JobForm.jsx                  # coordinate field + picker, full payload
            └── JobDocument.jsx              # inline editor carries coordinates through

mobile/
├── app.json                                 # Android/iOS location permission declarations
├── package.json                             # + expo-location
└── src/
    ├── services/
    │   ├── location.ts                      # (new) captureStageLocation(), never throws
    │   ├── api.ts                           # location in request/response types
    │   └── cacheService.ts                  # send stored location on retry paths
    ├── hooks/
    │   └── useLiveSync.ts                   # send stored location on completion sync
    ├── db/
    │   ├── schema.ts                        # additive columns on the three local tables
    │   └── queries.ts                       # row types + persistence of location values
    └── screens/
        ├── PackingListScreen.tsx            # capture on list creation and travel start;
        │                                    #   navigate to coordinates when available
        ├── ArrivalAcknowledgementScreen.tsx # capture on work start, day start, day close
        └── SignatureScreen.tsx              # capture on final completion
```

**Structure Decision**: The existing three-surface layout is retained — `backend/` (Express + Prisma), `frontend/` (React + Vite web app), `mobile/` (Expo React Native client). This feature adds no new project or module boundary; it extends existing route handlers, existing screens, and the existing offline sync layer. The only new files are one mobile service (`location.ts`) and one web component (the coordinate picker), both introduced because their logic is reused across multiple call sites.

## Complexity Tracking

> Not required — Constitution Check passed with no violations.
