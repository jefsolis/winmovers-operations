# Quickstart Validation Guide: WinMovers Packing Mobile App

**Feature**: `003-packing-mobile-app` | **Date**: 2026-08-03

This guide describes how to validate each user story end-to-end once the feature is implemented. It is not a full test suite — it is a checklist of runnable scenarios that prove the system works as specified.

---

## Prerequisites

1. Backend running locally on port 3001 (`cd backend && node index.js`).
2. Mobile app built as a development build and installed on a physical device or emulator (`cd mobile && npx expo run:android` or `run:ios`).
3. Database has at least one `MovingFile` with `status = OPEN` and `category IN ('LOCAL', 'EXPORT', 'WAREHOUSE')`.
4. Database has at least 5 `PackingItemType` records (active).
5. Azure Blob Storage connection is configured in `backend/.env`.
6. Device has access to the local network where the backend is running (for local testing), or the backend is deployed.
7. A client email address is present on the MovingFile's linked client record (for email validation).

---

## Scenario 1 — First-time authentication and offline continuation

**Validates**: User Story 1 (Authenticate Once, Work Indefinitely)

1. Fresh install the app on a device. Open it.
2. Confirm the app shows a login prompt and a message indicating network is required for first login.
3. Log in with the shared Bodega Azure AD account.
4. Confirm the home screen loads without errors.
5. Toggle airplane mode ON.
6. Close and reopen the app.
7. **Expected**: App opens directly to the home screen — no login prompt shown.
8. Toggle airplane mode OFF.
9. **Expected**: No re-authentication prompt; session continues silently.

---

## Scenario 2 — Create a packing list offline

**Validates**: User Story 2 (Create a Packing List)

1. Toggle airplane mode ON (device offline).
2. Tap "Nueva Lista de Empaque" on the home screen.
3. **Expected**: List of Moving Files shown from local cache.
4. Select a Moving File.
5. Enter operator name. Confirm.
6. **Expected**: Packing list created; home screen shows it with status "Local" (not yet synced).
7. Close the app completely. Reopen.
8. **Expected**: Draft packing list visible on home screen with all data intact.

---

## Scenario 3 — Scan packages and assign items (offline)

**Validates**: User Story 3 (Scan and Build Packages)

1. Open the offline draft packing list from Scenario 2.
2. Tap "Agregar Caja". Activate the barcode scanner. Scan a barcode.
3. **Expected**: New package appears with the scanned barcode as its ID.
4. Open the package. Tap "Agregar Artículo". Select an item type from the list. Set quantity to 3.
5. **Expected**: Item appears in the package contents with quantity 3.
6. Add a second item by typing a custom name ("Cuadros de arte"). Set quantity 1.
7. **Expected**: Custom item appears in the package contents.
8. Attempt to scan the same barcode again.
9. **Expected**: Warning shown; duplicate package not created.
10. Tap "Agregar Caja Manualmente". Enter a barcode value by typing.
11. **Expected**: New package created from manual entry.

---

## Scenario 4 — Add photos to a package (offline + online)

**Validates**: User Story 4 (Photograph Packages)

**Offline photo capture**:
1. With airplane mode ON, open a package. Tap "Agregar Foto". Take a photo.
2. **Expected**: Photo appears as thumbnail. `upload_state = PENDING` in local DB.
3. Toggle airplane mode OFF.
4. **Expected**: Within ~10 seconds, the photo is uploaded; thumbnail still visible. `upload_state = UPLOADED`.

**Online photo capture**:
5. With airplane mode OFF, open a package. Tap "Agregar Foto". Take a photo.
6. **Expected**: Photo immediately uploads and thumbnail appears. `upload_state = UPLOADED`.

---

## Scenario 5 — Live-save while online

**Validates**: User Story 6 (Auto-Save Live Sessions)

1. Ensure device is online. Open the packing list.
2. Add a new package by scanning a barcode.
3. Wait 3 seconds without further action.
4. **Expected**: `GET /api/packing-lists/:id` on the backend returns the new package — server record updated without any manual action.
5. Go to the backend and confirm `PackingList` and `Package` records exist in the database.
6. Toggle airplane mode ON. Add another package.
7. Toggle airplane mode OFF. Wait 3 seconds.
8. **Expected**: The offline-added package now appears in `GET /api/packing-lists/:id` on the server.

---

## Scenario 6 — Client sign-off and completion

**Validates**: User Story 5 (Client Sign-off) + User Story 6 (Completion)

1. Open a packing list with at least 2 packages and photos. Tap "Firma del Cliente".
2. **Expected**: Sign-off screen shows all packages and item names in Spanish.
3. Tap the language toggle to "English".
4. **Expected**: Item names update to English labels. Package count and structure unchanged.
5. Toggle back to "Spanish".
6. Draw a signature on the signature pad. Tap "Confirmar Firma".
7. Tap "Completar Lista".
8. **Expected**: Packing list status transitions to COMPLETE on the home screen.
9. **Expected**: Client receives a confirmation email within 5 minutes (check the email address on the linked client record).
10. **Expected**: The completed packing list is locked — cannot add new packages.

---

## Scenario 7 — Client declines to sign

**Validates**: FR-022 (Signature declined)

1. Open a packing list with at least one package. Tap "Firma del Cliente".
2. Tap "Cliente Rechaza Firmar". Enter a decline note.
3. Tap "Completar Lista".
4. **Expected**: Packing list marked COMPLETE without a signature. Decline note stored.
5. Check backend: `signatureDeclined = true`, `signatureDeclineNote` populated.

---

## Scenario 8 — Cross-device packing list continuation

**Validates**: User Story 2 Scenario 5 + FR-025a (edit lock)

*Requires two devices (Device A and Device B) connected to the same backend.*

1. On Device A: create a packing list and add 3 packages. Confirm live-save to server.
2. On Device B: open the app (online). The packing list from Device A appears in the home screen.
3. On Device B: tap to open the packing list.
4. **Expected**: App shows "Esta lista está siendo editada por otro dispositivo" (locked by another device). "Tomar Control" button shown.
5. Tap "Tomar Control". Confirm.
6. **Expected**: Device B now holds the lock. Packages are visible and editable.
7. Add a new package on Device B.
8. On Device A: try to save (tap anywhere to trigger debounce).
9. **Expected**: Device A receives a 409; local UI shows a message that it lost the lock. Data on Device A is preserved locally.

---

## Scenario 9 — Error state and retry

**Validates**: FR-027 (Error on sync failure)

1. Create a packing list and add packages while online.
2. Stop the backend server.
3. Add one more package on the mobile app.
4. Wait 5 seconds.
5. **Expected**: Packing list shows an error indicator within 30 seconds.
6. Restart the backend server.
7. **Expected**: App automatically retries; packing list status clears to normal within a sync cycle.

---

## Web App Read-Only Panel Validation

**Validates**: FR-025b (in-progress packing lists visible on web)

1. Open the web app. Navigate to a MovingFile that has an active packing list.
2. **Expected**: A "Listas de Empaque" panel on the MovingFile detail page shows the packing list with its current status, operator name, and package count.
3. The panel should appear for packing lists in ACTIVE status (not just COMPLETE).

---

## References

- API endpoints: [contracts/api.md](../contracts/api.md)
- Data model: [data-model.md](../data-model.md)
- Mobile SQLite schema: [contracts/mobile-sqlite.md](../contracts/mobile-sqlite.md)
- Feature spec: [spec.md](../spec.md)
