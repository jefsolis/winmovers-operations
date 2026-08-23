# Tasks: WinMovers Packing Mobile App

**Feature Branch**: `003-packing-mobile-app`
**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [data-model.md](data-model.md) · [contracts/api.md](contracts/api.md) · [contracts/mobile-sqlite.md](contracts/mobile-sqlite.md) · [research.md](research.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase (different files, no shared dependency)
- **[Story]**: User story label (US1–US6)
- Tasks without [P] depend on the previous task in their story completing first

---

## Phase 1: Setup — Monorepo & Mobile Scaffold

**Purpose**: Initialize the `mobile/` workspace and install all required native dependencies. No user story work can begin until the Expo development build can be installed on a device and the backend has the new route file registered.

- [X] T001 Initialize Expo managed workflow project in `mobile/` with TypeScript template (`npx create-expo-app mobile --template expo-template-blank-typescript`)
- [X] T002 Install mobile dependencies: `expo-sqlite`, `expo-camera`, `expo-barcode-scanner`, `expo-image-picker`, `expo-secure-store`, `expo-file-system`, `expo-network`, `react-native-app-auth`, `react-native-signature-canvas`, `axios`, `@react-navigation/native`, `@react-navigation/native-stack` in `mobile/package.json`
- [X] T003 [P] Configure `mobile/tsconfig.json` with strict mode and path aliases (`@/` → `mobile/src/`)
- [X] T004 [P] Configure `mobile/app.json` with bundle identifiers, permissions for camera and microphone, and Expo plugin entries for `expo-camera`, `expo-barcode-scanner`, `expo-image-picker`, `expo-secure-store`
- [X] T005 Create Expo development build configuration; document `eas build --profile development` command in `mobile/README.md`
- [X] T006 [P] Add `backend/routes/packingLists.js` with router scaffold (empty route stubs for all 7 endpoints from `contracts/api.md`) and `module.exports`
- [X] T007 Register `/api/packing-lists` route in `backend/index.js` (mount after `/api/files/:fileId/attachments`, before `/api/files`)
- [X] T008 Allow BODEGA role access to `/packing-lists` in `backend/middleware/accessControl.js`

**Checkpoint**: `npx expo start` runs without errors; `backend/index.js` registers the new route; BODEGA access allowed.

---

## Phase 2: Foundational — Backend Schema & Mobile DB Layer

**Purpose**: Database models and local SQLite schema that every user story builds on. Must be complete before any story-specific backend or mobile work.

- [X] T009 Add `PackingList`, `Package`, `PackageItem`, `PackagePhoto` Prisma models to `backend/prisma/schema.prisma` per `data-model.md`; add back-relations to `MovingFile` and `PackingItemType`
- [X] T010 Run `npx prisma db push` and `npx prisma generate` from `backend/`
- [X] T011 [P] Implement `mobile/src/db/schema.ts`: open `packing.db`, enable WAL mode, create all 6 SQLite tables (`packing_lists`, `packages`, `package_items`, `package_photos`, `item_type_cache`, `moving_file_cache`) with `CREATE TABLE IF NOT EXISTS` per `contracts/mobile-sqlite.md`
- [X] T012 [P] Implement `mobile/src/db/queries.ts`: typed helper functions for all key read and write patterns from `contracts/mobile-sqlite.md` (insert/update packing list, insert package, upsert items, mark photo uploaded, update sync state, cache refresh)
- [X] T013 [P] Implement `mobile/src/services/api.ts`: axios instance with `baseURL` pointing to backend; attach Azure AD Bearer token from `expo-secure-store` in request interceptor; export typed wrappers for all 7 API endpoints from `contracts/api.md`
- [X] T014 Initialize DB at app startup in `mobile/App.tsx`: call `initDb()` from `schema.ts` before rendering navigation

**Checkpoint**: App launches, SQLite DB initialises without error, all 6 tables exist; backend schema migration complete.

---

## Phase 3: User Story 1 — Authenticate Once, Work Indefinitely (P1) 🎯 MVP

**Goal**: Operator logs in once; app works indefinitely offline without re-authentication.

**Independent Test**: Quickstart Scenario 1 — log in, toggle airplane mode, close and reopen app, confirm no login prompt.

- [X] T015 [US1] Implement `mobile/src/auth/msalConfig.ts`: `react-native-app-auth` config with Azure AD tenant ID, client ID, redirect URI, scopes (`openid`, `profile`, `offline_access`, `api://<clientId>/.default`)
- [X] T016 [US1] Implement `mobile/src/auth/useAuth.ts`: hook that manages login, silent token refresh, and offline fallback. On app start: attempt silent refresh from stored refresh token in `expo-secure-store`. On `invalid_grant` error while offline: continue with offline mode flag set. On `invalid_grant` while online: show login screen.
- [X] T017 [US1] Implement `mobile/src/auth/AuthGuard.tsx`: wrapper component shown before navigation root. Renders children if authenticated or offline-with-prior-auth; renders `LoginScreen` otherwise.
- [X] T018 [US1] Implement `mobile/src/screens/LoginScreen.tsx`: Spanish-language first-login screen with "Iniciar Sesión" button and offline explanation message when no network is available.
- [X] T019 [US1] Generate stable device UUID on first launch, store in `expo-secure-store` under key `deviceId`; export `getDeviceId()` from `mobile/src/auth/deviceId.ts`
- [X] T020 [US1] Add `AppState` listener in `mobile/App.tsx`: on transition to `active`, trigger silent token refresh via `useAuth` and connectivity probe via `expo-network`

**Checkpoint**: Quickstart Scenario 1 passes. App opens after airplane mode without login prompt.

---

## Phase 4: User Story 2 — Create a Packing List Linked to a Moving File (P1)

**Goal**: Operator can create a packing list from a cached Moving File list, fully offline. List persists across app restarts.

**Independent Test**: Quickstart Scenario 2 — create packing list in airplane mode, close app, reopen, confirm list visible.

- [X] T021 [US2] Implement `mobile/src/services/cacheService.ts`: `refreshMovingFileCache()` calls `GET /api/files?category=LOCAL,EXPORT,WAREHOUSE&status=OPEN`, upserts results into `moving_file_cache` SQLite table; called on app foreground when online
- [X] T022 [US2] Implement `mobile/src/screens/HomeScreen.tsx`: lists all packing lists from `packing_lists` SQLite table ordered by `updated_at DESC`; shows `list_number` (or "Sin número" if not yet synced), `moving_file_ref`, operator name, `sync_state` badge; "Nueva Lista" button
- [X] T023 [US2] Implement `mobile/src/screens/NewPackingListScreen.tsx`: loads Moving Files from `moving_file_cache`; shows empty-cache warning if table is empty; operator name input; on confirm: inserts new row into `packing_lists` with client-UUID, `sync_state = 'LOCAL'`, navigates to `PackingListScreen`
- [X] T024 [US2] On app foreground (online): fetch all non-COMPLETE packing lists from `GET /api/packing-lists?movingFileId=*` (all accessible files) and upsert into local `packing_lists`; fetch packages/items/photos and upsert into local tables; implement in `mobile/src/services/cacheService.ts`

**Checkpoint**: Quickstart Scenario 2 passes. Cross-device packing list appears on new device after online foreground (Quickstart Scenario 8 step 2).

---

## Phase 5: User Story 3 — Scan and Build Packages (P1)

**Goal**: Operator can scan barcodes, assign predefined and custom items, fully offline.

**Independent Test**: Quickstart Scenario 3 — offline scan, add items, add custom item, duplicate barcode warning.

- [X] T025 [US3] Implement `mobile/src/services/cacheService.ts` addition: `refreshItemTypeCache()` calls `GET /api/packing-item-types`, full-replaces `item_type_cache` SQLite table; called on app foreground when online
- [X] T026 [US3] Implement `mobile/src/screens/PackingListScreen.tsx`: displays all packages for the current packing list from SQLite; shows barcode, item count, photo count per package; "Agregar Caja" (scan) and "Agregar Caja Manualmente" (manual) actions; navigates to `PackageDetailScreen`
- [X] T027 [US3] Implement `mobile/src/components/BarcodeScanner.tsx`: uses `expo-barcode-scanner`; on scan result passes barcode string back to parent; dismiss button
- [X] T028 [US3] Implement barcode add flow in `PackingListScreen.tsx`: on barcode received (scanned or typed), check `packages` table for duplicate in same `packing_list_id`; if duplicate show Spanish warning toast; if new insert into `packages`, update `packing_lists.updated_at` and set `sync_state = 'LOCAL'`
- [X] T029 [US3] Implement `mobile/src/screens/PackageDetailScreen.tsx`: displays items and photos for current package; "Agregar Artículo" action
- [X] T030 [US3] Implement `mobile/src/components/ItemPicker.tsx`: scrollable list from `item_type_cache` (Spanish names by default); quantity stepper (min 1); free-text "Nombre personalizado" field shown when no type selected; on confirm inserts `PackageItem` into SQLite; sets `sync_state = 'LOCAL'` on parent packing list

**Checkpoint**: Quickstart Scenario 3 passes. All steps fully functional offline.

---

## Phase 6: User Story 4 — Photograph Packages (P1)

**Goal**: Operator captures photos per package; photos upload to Azure Blob immediately when online.

**Independent Test**: Quickstart Scenario 4 — offline photo saved as PENDING; online photo uploads immediately.

- [X] T031 [US4] Implement `mobile/src/services/photoUpload.ts`: `uploadPhoto(localPath, packingListId)` — calls `POST /api/packing-lists/upload-token`, then HTTP PUT to SAS URL with `x-ms-blob-type: BlockBlob`; on success updates `package_photos.blob_path` and `upload_state = 'UPLOADED'` in SQLite; on failure sets `upload_state = 'ERROR'`
- [X] T032 [US4] Implement "Agregar Foto" action in `PackageDetailScreen.tsx`: uses `expo-image-picker` with `launchCameraAsync`; saves photo to `expo-file-system` cache directory; inserts `package_photos` row with `upload_state = 'PENDING'`; if device online triggers `uploadPhoto()` immediately; updates `packing_list.sync_state = 'LOCAL'`
- [X] T033 [US4] Implement photo queue flush in `mobile/src/services/syncService.ts`: on app foreground when online, query all `package_photos WHERE upload_state IN ('PENDING','ERROR')` and call `uploadPhoto()` for each sequentially
- [X] T034 [US4] Render photo thumbnails in `PackageDetailScreen.tsx`: show grid of thumbnails from `local_path` (before upload) or `blob_path` (after upload); tapping a thumbnail opens full-screen view

**Checkpoint**: Quickstart Scenario 4 passes. Offline photos upload automatically on reconnect.

---

## Phase 7: User Story 5 — Capture Client Signature (P2)

**Goal**: Client reviews packing list and signs; operator can also record signature decline.

**Independent Test**: Quickstart Scenario 6 (sign-off) and Scenario 7 (decline).

- [X] T035 [US5] Implement `mobile/src/screens/SignOffScreen.tsx`: loads all packages and items for the packing list from SQLite; shows summary list; language toggle button (ES ↔ EN) that switches item name display between `name_es` and `name_en` from `item_type_cache` (custom items show as-entered)
- [X] T036 [US5] Implement `mobile/src/components/SignaturePad.tsx`: wraps `react-native-signature-canvas`; on confirm captures PNG, saves to `expo-file-system`; passes local path back to `SignOffScreen`
- [X] T037 [US5] Implement signature upload in `SignOffScreen.tsx`: after signature confirmed, call `POST /api/packing-lists/upload-token` with `contentType = 'image/png'`; upload signature PNG to SAS URL; update `packing_lists.signature_local_path` and `signature_blob_path` in SQLite
- [X] T038 [US5] Implement "Cliente Rechaza Firmar" flow in `SignOffScreen.tsx`: show note input (required); on confirm update SQLite `signature_declined = 1`, `signature_decline_note`; skip signature upload
- [X] T039 [US5] Implement "Completar Lista" button in `SignOffScreen.tsx`: validates at least one package exists and (signature captured or decline noted); updates SQLite `status = 'COMPLETE'`, `sync_state = 'COMPLETING'`; navigates back to `HomeScreen`

**Checkpoint**: Quickstart Scenarios 6 and 7 pass. Signature visible as thumbnail on completed packing list.

---

## Phase 8: User Story 6 — Auto-Save Live Sessions & Sync on Completion (P2)

**Goal**: Changes are transparently live-saved to the server when online; completion triggers confirmation email; lock take-over works.

**Independent Test**: Quickstart Scenarios 5 (live-save), 8 (cross-device lock), 9 (error + retry).

### Backend — Packing Lists Route

- [X] T040 [US6] Implement `POST /api/packing-lists` in `backend/routes/packingLists.js`: auto-assign `PL-NNNN` list number (follow existing numbering pattern from other routes); create `PackingList` record; set `lockedByDeviceId`, `lockedAt`, `lockExpiresAt = now + 4h`; call `logAudit()` with action `CREATE`
- [X] T041 [US6] Implement `GET /api/packing-lists` (query `?movingFileId=`) in `backend/routes/packingLists.js`: return all packing lists for the file with `packageCount`; include in-progress lists (status ACTIVE)
- [X] T042 [US6] Implement `GET /api/packing-lists/:id` in `backend/routes/packingLists.js`: return full packing list with nested packages, items, and photos per `contracts/api.md`
- [X] T043 [US6] Implement `PUT /api/packing-lists/:id` in `backend/routes/packingLists.js`: verify `deviceId` matches `lockedByDeviceId` (return 409 if not); full-replace packages/items/photos (upsert by `id`, delete absent records); renew `lockExpiresAt = now + 4h`; return `{ id, updatedAt, lockExpiresAt }`
- [X] T044 [US6] Implement `PATCH /api/packing-lists/:id/claim-lock` in `backend/routes/packingLists.js`: `$transaction` — check existing lock; if no lock or expired: claim; if held and unexpired: return 409 with lock owner info; call `logAudit()` with action `UPDATE`
- [X] T045 [US6] Implement `PATCH /api/packing-lists/:id/complete` in `backend/routes/packingLists.js`: verify `deviceId` matches lock holder (409 if not); validate at least one package exists (400 if not); set `status = COMPLETE`; clear lock fields; call `logAudit()` with action `UPDATE`; fire-and-forget email via existing `notifications.js` pattern (send packing list summary to client email on linked MovingFile)
- [X] T046 [US6] Implement `POST /api/packing-lists/upload-token` in `backend/routes/packingLists.js`: generate write-scoped SAS URL (1-hour TTL) using `backend/storage/azure.js` pattern; return `{ sasUrl, blobPath }`

### Mobile — Sync Service

- [X] T047 [US6] Implement `mobile/src/services/syncService.ts` — `useSyncService()` hook: ref-based debounce timer (2.5s); on packing list state change: reset timer; on timer fire: call `PUT /api/packing-lists/:id` with full current state from SQLite; on 409 (lock lost): update SQLite `sync_state = 'ERROR'`, show Spanish alert "Otro dispositivo tomó el control"; on success: update `server_id`, `list_number`, `sync_state = 'SAVED'`, renew lock expiry in SQLite
- [X] T048 [US6] Add `AppState` `background`/`inactive` flush in `syncService.ts`: cancel debounce timer and fire PUT immediately when app is about to be backgrounded (prevent data loss)
- [X] T049 [US6] Implement completion sync in `syncService.ts`: when `sync_state = 'COMPLETING'`, call `PATCH /api/packing-lists/:id/complete`; on success set `sync_state = 'COMPLETE'`; on failure set `sync_state = 'ERROR'`; retry automatically on next foreground-with-connectivity
- [X] T050 [US6] Implement lock take-over UI: in `PackingListScreen.tsx`, when `GET /api/packing-lists/:id` returns a lock held by another device, show `mobile/src/screens/LockTakeoverScreen.tsx` — displays lock holder device ID and expiry; "Tomar Control" button calls `PATCH /claim-lock`; on 409 show remaining lock time; on 200 load full packing list state from server into SQLite and proceed to edit
- [X] T051 [US6] Add error banner and retry button in `HomeScreen.tsx` and `PackingListScreen.tsx`: packing lists with `sync_state = 'ERROR'` show a red badge and "Reintentar" button; tap triggers immediate sync attempt via `syncService`

### Web Panel

- [X] T052 [P] [US6] Create `frontend/src/pages/Files/PackingListsPanel.jsx`: calls `GET /api/packing-lists?movingFileId=:id`; renders read-only table of packing lists (list number, operator, status badge, package count, item count, date); shown on the MovingFile detail page for all non-null results; add i18n keys to `frontend/src/i18n.jsx` for both `en` and `es`
- [X] T053 [US6] Integrate `PackingListsPanel` into the existing MovingFile detail page component in `frontend/src/pages/Files/`

**Checkpoint**: Quickstart Scenarios 5, 8, and 9 pass. Web panel shows in-progress lists.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T054 [P] Add `sync_state` visual badges to `HomeScreen.tsx`: LOCAL (grey), SAVING (spinner), SAVED (green), COMPLETING (spinner), COMPLETE (green check), ERROR (red) — all labels in Spanish
- [X] T055 [P] Add storage exhaustion guard in `PackageDetailScreen.tsx`: check `expo-file-system` free space before launching camera; show Spanish error alert if < 100 MB free
- [X] T056 [P] Add duplicate barcode warning in `PackingListScreen.tsx`: Spanish toast "Código de barras ya existe en esta lista" with dismiss action
- [X] T057 [P] Validate `PackageItem` constraint in `ItemPicker.tsx` and in `PUT /api/packing-lists/:id` handler: either `packingItemTypeId` or `customName` must be non-null, not both; return 400 if violated
- [X] T058 [P] Add `signatureDeclineNote` required validation in `SignOffScreen.tsx`: "Completar Lista" disabled until note is non-empty when `signatureDeclined = true`
- [X] T059 [P] Add concurrent sync deduplication flag in `syncService.ts`: boolean `isSyncing` ref; if `true`, skip debounce fire (queue implicitly via next state change)
- [X] T060 Update `mobile/README.md` with: local dev setup, EAS build commands, environment variables needed (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, backend URL config), and link to `quickstart.md`

---

## Dependencies (Story Completion Order)

```
Phase 1 (Setup)
  └── Phase 2 (Foundation: schema + DB layer)
        ├── Phase 3 (US1: Auth) ──────────────────── required by all other mobile phases
        │     └── Phase 4 (US2: Create list)
        │           └── Phase 5 (US3: Scan packages)
        │                 └── Phase 6 (US4: Photos)
        │                       └── Phase 7 (US5: Signature) ── requires packages + photos
        │                             └── Phase 8 (US6: Live-save + completion)
        └── Phase 9 (Polish) ─── can start in parallel with Phase 8 once Phase 7 complete
```

Backend tasks T040–T046 can be implemented in parallel with mobile tasks T015–T039, since they have no mobile dependency. T052 (web panel) can be implemented in parallel with all mobile work.

---

## Parallel Execution Examples

**Sprint structure (approximate)**:

| Work stream | Tasks |
|---|---|
| Backend API (independent) | T006–T008 → T009–T010 → T040–T046 |
| Mobile Foundation | T001–T005 → T011–T014 → T015–T020 |
| Mobile Core (after auth) | T021–T024 → T025–T030 → T031–T034 |
| Mobile Completion (after core) | T035–T039 → T047–T051 |
| Web Panel (independent) | T052–T053 (any time after T041 is done) |
| Polish (parallel with US6) | T054–T060 |

---

## Implementation Strategy

**MVP scope (P1 stories only — Phases 1–6)**:
Delivers a fully functional offline packing list app where operators can authenticate, create lists, scan packages, assign items, and photograph packages. The packing list is persisted locally. This is independently testable and deployable without the live-save, signature, or completion email features.

**Full scope (all stories — Phases 1–9)**:
Adds client sign-off, live server sync, lock-based cross-device continuity, completion email, web read-only panel, and all polish tasks.
