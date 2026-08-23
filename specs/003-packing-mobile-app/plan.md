# Implementation Plan: WinMovers Packing Mobile App

**Branch**: `003-packing-mobile-app` | **Date**: 2026-08-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-packing-mobile-app/spec.md`

## Summary

A React Native (Expo) mobile application for warehouse and on-site staff to create and manage Packing Lists. The app is offline-first: all data is persisted locally in SQLite, and when connectivity is available the session is live-saved to the backend via a debounced full-state PUT. Photos are uploaded to Azure Blob Storage immediately when taken (online) or queued for upload on reconnect (offline). The client signs off on the device screen; completion triggers a backend-generated confirmation email. Any device can open and continue a packing list started on another device, governed by a server-side edit lock with explicit take-over. The app lives in a new `mobile/` directory within the existing monorepo.

## Technical Context

**Language/Version**: TypeScript / React Native 0.74+ via Expo SDK 51+

**Primary Dependencies**:
- `expo` (managed workflow), `expo-sqlite` (local SQLite), `expo-camera` / `expo-barcode-scanner` (camera + barcode), `expo-image-picker` (photo capture), `expo-secure-store` (keychain token storage), `expo-file-system` (local photo files), `expo-network` (connectivity detection)
- `@azure/msal-react-native` (Azure AD auth, MSAL for React Native)
- `react-native-signature-canvas` (signature pad)
- Backend: Node.js + Express (existing) — new routes added to the existing backend
- PostgreSQL + Prisma 5 (existing) — new models added to existing schema
- Azure Blob Storage (existing `backend/storage/azure.js`)

**Storage**:
- Mobile: `expo-sqlite` local SQLite for all packing list data, photo metadata, and caches
- Server: PostgreSQL (Prisma) for persisted packing list records
- Media: Azure Blob Storage for photos and signatures (existing container)

**Testing**: `jest` + `@testing-library/react-native` (mobile unit/component); existing backend test patterns (manual/curl) for new API routes

**Target Platform**: iOS 15+ and Android 12+ (physical warehouse devices managed by the company)

**Project Type**: mobile-app (new `mobile/` workspace) + backend API extensions (new routes in existing `backend/`)

**Performance Goals**:
- Single package documented (scan → items → photo) in under 2 minutes (operator time)
- Debounced server push within 2–3 seconds of last action
- Sign-off screen renders full packing list in under 3 seconds

**Constraints**:
- Fully offline-capable; app must work indefinitely without network given prior authentication
- Single shared Bodega Azure AD account; MSAL refresh token in device keychain
- No local disk storage as permanent record — all media staged locally, permanent store is Azure Blob
- Backend must honour existing BODEGA role access-control conventions
- No new frontend (React web) pages required beyond the read-only panel on the MovingFile detail page

**Scale/Scope**:
- Typical packing list: 5–50 packages, 1–10 photos each, one signature
- Small team (≤10 warehouse operators); no high-concurrency requirements on mobile
- ~5 new Prisma models, ~6 new backend route files, 1 new web panel component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Bilingual by Default (EN/ES) | ✅ PASS | App primary language is Spanish (FR-030). Sign-off screen supports ES/EN toggle (FR-031). Backend confirmation email must honour the language on file for the linked MovingFile. |
| II. Auditability of Material Changes | ✅ PASS | PackingList creation, completion, and lock transfer are material actions; `logAudit()` calls must be added to the new packing-list route the same way they exist in other routes. |
| III. Role-Based Access Control | ✅ PASS | The Bodega role on the backend currently has heavily restricted access. The new `/api/packing-lists` routes must be explicitly allowed for BODEGA in `accessControl.js`. The web-facing read-only panel in the MovingFile page must not require any new role — it is visible to all staff who can already view files. |
| IV. Azure-Native Auth & Storage | ✅ PASS | Mobile app uses MSAL for React Native (Azure AD). Photos and signatures are uploaded to Azure Blob Storage (existing `storage/azure.js`). Local device storage is explicitly a temporary staging area only. |
| V. Prisma Singleton Data Access | ✅ PASS | All new backend routes will use `getPrisma()` from `../db`. No direct Prisma client instantiation. |
| VI. Preserve Domain & Contract Invariants | ✅ PASS | MovingFile categories: spec assumes WAREHOUSE exists (from spec 002); implementation gate — confirm `WAREHOUSE` category is present before wiring file-fetch endpoint. No existing contract broken. |
| VII. Incremental, Low-Risk Change | ✅ PASS | New `mobile/` directory is additive. New backend routes are additive. One new read-only panel added to the MovingFile web page. No existing routes modified. |

**Post-Design Re-check**: Will be performed after Phase 1 artifacts are generated.

## Post-Design Constitution Re-check

*Phase 1 artifacts (data-model.md, contracts/api.md, contracts/mobile-sqlite.md, quickstart.md) are complete.*

| Principle | Post-Design Status | Evidence |
|---|---|---|
| I. Bilingual by Default | ✅ PASS | Sign-off screen language toggle in `SignOffScreen.tsx`. Item types carry `nameEs` / `nameEn` in `PackingItemType` model. Confirmation email language resolved from linked MovingFile's client record. |
| II. Auditability | ✅ PASS | `logAudit()` required on: POST /packing-lists (CREATE), PATCH /claim-lock (UPDATE), PATCH /complete (UPDATE). Defined in contracts/api.md and will be tracked in tasks. |
| III. RBAC | ✅ PASS | `accessControl.js` must allow BODEGA on `/packing-lists/*` (documented in contracts/api.md). Web panel requires no new role. |
| IV. Azure-Native Auth & Storage | ✅ PASS | SAS URL upload pattern confirmed (R-004). Local paths are staging only; `blob_path` is the permanent reference. `signatureUrl` stored as Azure Blob path in server model. |
| V. Prisma Singleton | ✅ PASS | All server routes use `getPrisma()`. Confirmed in data-model.md and route pattern. |
| VI. Domain Invariants | ✅ PASS | `@@unique([packingListId, barcode])` enforced at DB level. Either `packingItemTypeId` or `customName` enforced in handler. No existing models altered (only additive relations). |
| VII. Incremental Change | ✅ PASS | 0 existing routes modified. 1 new route file. 1 new React web component. Entirely new `mobile/` directory. |

## Project Structure

### Documentation (this feature)

```text
specs/003-packing-mobile-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api.md           # Backend REST contracts (new endpoints)
│   └── mobile-sqlite.md # Mobile local DB schema
└── tasks.md             # Phase 2 output (not created by /speckit.plan)
```

### Source Code (repository root)

```text
mobile/                          # NEW — React Native / Expo app
├── app.json                     # Expo config
├── package.json
├── tsconfig.json
├── App.tsx                      # Entry point; MSAL provider + navigation root
├── src/
│   ├── auth/
│   │   └── msalConfig.ts        # MSAL for React Native config (clientId, tenantId, scopes)
│   ├── db/
│   │   └── schema.ts            # expo-sqlite table definitions & migration helpers
│   ├── services/
│   │   ├── syncService.ts       # debounced live-save, offline queue, lock management
│   │   ├── photoUpload.ts       # immediate-upload-or-queue logic for photos/signature
│   │   └── api.ts               # axios instance → backend /api/*
│   ├── screens/
│   │   ├── HomeScreen.tsx       # List of all packing lists + status
│   │   ├── NewPackingListScreen.tsx
│   │   ├── PackingListScreen.tsx  # Package list for a single packing list
│   │   ├── PackageDetailScreen.tsx  # Items + photos for a single package
│   │   ├── SignOffScreen.tsx    # Summary + language toggle + signature pad
│   │   └── LockTakeoverScreen.tsx  # Shown when another device holds the lock
│   └── components/
│       ├── BarcodeScanner.tsx
│       ├── ItemPicker.tsx
│       └── SignaturePad.tsx

backend/
└── routes/
    └── packingLists.js          # NEW — /api/packing-lists (CRUD + lock + complete)

frontend/
└── src/
    └── pages/
        └── Files/
            └── PackingListsPanel.jsx  # NEW — read-only panel on MovingFile detail page
```

**Structure Decision**: Option 3 (Mobile + API). The mobile app lives in a new top-level `mobile/` directory. The API extensions are new route files in the existing `backend/routes/` directory following established patterns. One new React component is added to the existing web frontend.

## Complexity Tracking

*No constitution violations requiring justification.*
