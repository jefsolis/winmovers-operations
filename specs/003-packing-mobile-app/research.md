# Research: WinMovers Packing Mobile App

**Feature**: `003-packing-mobile-app` | **Date**: 2026-08-03

---

## R-001 — MSAL / Azure AD authentication for React Native + Expo

**Decision**: Use `react-native-app-auth` (community OAuth2/OIDC bridge) together with `expo-secure-store` for persistent token storage. Microsoft does not publish a unified `@azure/msal-react-native` package; the native MSAL SDKs for Android and iOS are accessible via this bridge and work in Expo's managed workflow.

**Rationale**: `react-native-app-auth` uses native AppAuth SDKs under the hood, supports PKCE (required for mobile), and is the current production-ready path for Expo + Azure AD. It handles token caching internally; `expo-secure-store` is used as the persistent backing store to survive app restarts.

**Offline behaviour**: When the device is offline and the refresh token cannot be renewed, `react-native-app-auth` throws an `invalid_grant` (or equivalent) error on silent refresh attempt. The app catches this error and continues operating in offline mode using the last-known local SQLite state. The user is never forcibly logged out during offline use; re-authentication is only prompted when the user is explicitly online and the refresh token has also expired.

**Shared account / per-device cache**: Each device maintains its own independent token cache. Multiple warehouse devices using the same Azure AD account each authenticate independently; tokens are device-scoped, which is correct security behaviour.

**Alternatives considered**: `expo-auth-session` (lower level, requires more manual PKCE + token management); custom native module bridging MSAL Android/iOS directly (requires bare Expo workflow, rejected to stay in managed workflow).

---

## R-002 — Offline-first debounced sync pattern

**Decision**: Use a **ref-based debounce timer** (`useRef` + `clearTimeout/setTimeout`) scoped to the active packing session. All writes go to `expo-sqlite` immediately and synchronously. The debounced timer schedules the network PUT; it is reset on every change. The timer is flushed eagerly when `AppState` transitions to `background` or `inactive` to ensure no changes are lost when the app is backgrounded.

**Rationale**: React Native background tasks are unreliable (throttled/killed by OS, especially iOS). Writing to SQLite first ensures zero data loss regardless of background behaviour. AppState flushing is the recommended pattern for pre-suspension writes. Target debounce window: 2–3 seconds after the last user action.

**Offline queue**: When a flush attempt fails (no connectivity or server error), the pending state stays in SQLite. On the next AppState `active` transition or successful connectivity probe, the flush is retried automatically.

**Alternatives considered**: Redux middleware (overkill); background tasks via `expo-task-manager` (unreliable, iOS restrictions); immediate PUT on every keystroke (excessive network traffic, breaks offline model).

---

## R-003 — Connectivity detection

**Decision**: Use `expo-network` (`Network.getNetworkStateAsync()`) checked reactively on `AppState` `active` transitions (foreground resume) and after failed network calls. Do not poll continuously.

**Rationale**: Continuous polling drains battery. The app regains foreground via `AppState`, at which point a connectivity probe is cheap and sufficient to trigger any queued flushes. Failed API calls provide immediate signal that connectivity was lost mid-session.

**Alternatives considered**: `@react-native-community/netinfo` (requires native linking, outside Expo managed workflow); polling intervals (battery drain, rejected).

---

## R-004 — Photo / signature upload to Azure Blob Storage

**Decision**: **Backend issues a SAS URL (write-only, 1-hour TTL); the mobile device uploads the file directly to Azure Blob Storage** using an HTTP PUT with header `x-ms-blob-type: BlockBlob`. The backend endpoint returns the SAS URL and the final blob path; after upload the mobile app stores the blob path locally and includes it in the packing list PUT payload.

**Rationale**: Avoids routing large binary files through the backend (bandwidth, latency, Heroku/Azure App Service timeouts). The SAS URL pattern is already implemented in `backend/storage/azure.js` for download; extending it for write-scoped SAS for uploads is a small addition. The mobile app never holds storage credentials.

**Upload flow**:
1. Mobile calls `POST /api/packing-lists/upload-token` → receives `{ sasUrl, blobPath }`.
2. Mobile PUTs the file directly to `sasUrl`.
3. Mobile stores `blobPath` in local SQLite alongside the local file path.
4. Next debounced PUT to `/api/packing-lists/:id` includes `blobPath` as the photo's remote URL.

**Alternatives considered**: Backend proxy upload (backend receives the binary and re-uploads to Azure — adds latency and doubles bandwidth, rejected); direct storage credentials in app (security anti-pattern, rejected).

---

## R-005 — Edit lock model (cross-device take-over)

**Decision**: Add three nullable fields to the `PackingList` Prisma model: `lockedByDeviceId` (String), `lockedAt` (DateTime), `lockExpiresAt` (DateTime). Lock TTL is **4 hours**. A dedicated `PATCH /api/packing-lists/:id/claim-lock` endpoint handles lock acquisition using a `$transaction` (check + set atomically). If the existing lock is expired, any device can claim immediately (force-claim for dead device recovery). If the existing lock is held and unexpired, the endpoint returns 409; the app shows the `LockTakeoverScreen` with owner info and a "Take Over" button that waits for expiry or force-claims.

**Rationale**: Pessimistic locking is the right model for single-operator physical sessions (one person, one device, one job site). Prisma `$transaction` gives atomic check-and-set without raw SQL. 4-hour TTL accommodates the longest realistic packing sessions while allowing recovery from lost devices within a reasonable window.

**Lock renewal**: The mobile app renews the lock expiry on each successful debounced PUT (backend updates `lockExpiresAt` to `now + 4h` whenever a valid owner saves). This keeps active sessions alive indefinitely.

**Alternatives considered**: Optimistic locking (version field) — adds conflict-resolution UI complexity on mobile, rejected; advisory locks — not idiomatic with Prisma, rejected; no lock (last-write-wins) — silent data overwrite risk, rejected.

---

## R-006 — WAREHOUSE file category dependency on spec 002

**Decision**: The `MovingFile.category` field in `schema.prisma` is a plain `String` (no enum constraint). Adding `WAREHOUSE` requires only: (a) the backend auto-numbering logic for `B-XXXX` numbers (spec 002 task), and (b) ensuring the mobile file-fetch endpoint includes `WAREHOUSE` in its filter. No schema migration gate blocks this feature.

**Rationale**: Confirmed by reading `schema.prisma` — `category` is `String`, not a Prisma enum. The WAREHOUSE value can be written as soon as spec 002 route work is merged. The mobile app's Moving File cache endpoint should filter `category IN ('LOCAL', 'EXPORT', 'WAREHOUSE')`.

**Implementation note**: If spec 002 is not yet merged when this feature is implemented, the mobile app should filter `category IN ('LOCAL', 'EXPORT')` and add WAREHOUSE once available. This is a config-level change, not an architectural one.
