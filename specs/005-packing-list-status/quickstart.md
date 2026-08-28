# Quickstart: Validate Packing List Status Progress

## Purpose

Validate sequential packing progress, client contact/navigation context, arrival acknowledgement, completion satisfaction, offline retry, web visibility, and placeholder options end to end.

## Prerequisites

- Backend connected to the local PostgreSQL database with packing progress schema and backfill applied.
- Frontend running with an authenticated operations user.
- Mobile app running on a physical device or simulator with an authenticated BODEGA-authorized user.
- Azure Blob configuration available for arrival and completion signature uploads.
- One eligible OPEN Export, Local, or Warehouse moving file linked to a client with phone and origin/service address.
- Device has a phone handler where supported and at least one navigation handler.

## Setup and Static Validation

```powershell
Set-Location backend
npx prisma db push
npx prisma generate
node scripts/backfill-packing-progress.js

Set-Location ..\frontend
npm run build

Set-Location ..\mobile
npx tsc --noEmit
```

Start services in separate terminals:

```powershell
Set-Location backend
npm run start:dev
```

```powershell
Set-Location frontend
npm run dev
```

```powershell
Set-Location mobile
npx expo start --clear
```

## Scenario 1: New List and Shared Progress

1. Create a packing list in mobile for the eligible file.
2. Verify the list opens with Not Started text and clock icon.
3. Verify the four-stage indicator marks Not Started as current and Traveling, Working, Completed as upcoming.
4. Open the file's packing panel in web.

Expected:
- Mobile and web show Not Started.
- Status includes icon and text; meaning remains clear without relying on color.
- The mobile primary action says Start Travel.

## Scenario 2: Client Context, Call, and Navigate

1. Open the packing-list detail in mobile.
2. Verify client name, phone, formatted origin/service address, and localized job type.
3. Tap Call and cancel before placing the call.
4. Tap Navigate and inspect the destination passed to the device handler.
5. Repeat with a test file missing phone/address.

Expected:
- Phone and address match server-resolved service context.
- Call opens the phone handler with the client number.
- Navigate opens the device navigation chooser/default with the service address.
- Missing-data actions are disabled and explained without blocking packing work.

## Scenario 3: Start Travel and Idempotency

1. Tap Start Travel and confirm.
2. Immediately double-tap or replay the request using the same idempotency key in an API client.
3. Observe mobile and web for up to 10 seconds.

Expected:
- Progress advances exactly once from Not Started to Traveling.
- Only one history entry exists for the idempotency key.
- Mobile primary action changes to I’ve Arrived.
- Web updates without manual refresh within 10 seconds under stable connectivity.

## Scenario 4: Arrival Acknowledgement

1. From Traveling, tap I’ve Arrived.
2. Attempt confirmation without a signature.
3. Add observations, capture the client signature, and confirm.
4. Expand the packing-list detail in web.

Expected:
- Missing signature prevents confirmation and leaves status Traveling.
- Valid acknowledgement advances to Working.
- Arrival observations, operator/time, and signed arrival acknowledgement are visible to authorized users in mobile and web.
- Mobile primary action changes to Complete Job.

## Scenario 5: Offline Arrival Retry

1. Start with another Traveling test list.
2. Open arrival acknowledgement, capture signature and observations, then disconnect networking before confirmation.
3. Confirm and close/reopen the app.
4. Restore connectivity.

Expected:
- Input and intent survive app restart.
- Mobile visibly marks Working as pending rather than claiming server confirmation.
- Retry uploads the signature and submits the same idempotency key.
- Server confirms one transition; local pending state clears without duplicates.

## Scenario 6: Completion and Satisfaction

1. Add at least one package to a Working list.
2. Tap Complete Job.
3. Enter completion observations and complete the existing language/review/signature flow.
4. Try to submit without a rating, then select each boundary value (1 and 5 in separate runs) and complete.
5. Inspect mobile and web detail.

Expected:
- Missing rating blocks completion.
- Integer ratings 1 through 5 are accepted; values outside the range are rejected by the API.
- Completion atomically sets lifecycle Closed and progress Completed.
- Completion observations, signature outcome, survey version 1, and star rating are visible to authorized users.
- Normal package/item/photo edits and further transitions are unavailable.

## Scenario 7: Offline Completion Retry

1. Complete a Working list while interrupting connectivity after final signature capture.
2. Return to mobile Home and restore connectivity.
3. Observe web and mobile until confirmation.

Expected:
- Existing package, item, photo, signature, observations, and rating data remain intact.
- The list shows a pending completion/synchronization state.
- Automatic retry uses the original idempotency key and ends at Closed + Completed exactly once.

## Scenario 8: Transition Conflicts and Cross-Device Staleness

1. Open the same Not Started list on two devices.
2. Advance it to Traveling on device A.
3. Attempt the stale Not Started-to-Traveling action with a different key on device B, then attempt to skip to Completed.

Expected:
- Device A succeeds.
- Device B receives current server progress and does not create a duplicate transition.
- Skipping and backward transitions are rejected without mutation.

## Scenario 9: Web Polling and Historical Backfill

1. Keep the web packing panel open while advancing a mobile list.
2. Verify each confirmed stage appears without refreshing the browser.
3. Open one packing list that was Closed before this feature was deployed.

Expected:
- Confirmed changes appear within 10 seconds while the tab is visible and immediately after returning focus.
- Historical closed lists display Completed, never Not Started.
- Temporary polling errors retain the last known status rather than clearing the panel.

## Scenario 10: Options Placeholders and Surface Language Policy

1. Open Options in mobile and verify Incident, Documents, and Materials.
2. Select each entry.
3. Review every new operator-facing mobile progress screen, action, validation message, client action, and placeholder label.
4. Run arrival acknowledgement and completion sign-off in Spanish, then repeat in English.
5. Review the corresponding web progress labels in English and Spanish.

Expected:
- Each mobile option has an icon and Spanish label.
- Selection shows a Spanish coming-soon message and causes no data mutation.
- Mobile statuses are exactly "No iniciado", "En camino", "Trabajando", and "Completado"; mobile actions are exactly "Iniciar viaje", "Ya llegamos", and "Completar trabajo".
- Operator-facing mobile screens do not introduce an EN/ES selector.
- Client-facing arrival acknowledgement, signature, observations, review, and satisfaction screens allow EN/ES selection and render the complete interaction in the selected language.
- New web labels remain available through the web application's existing EN/ES dictionaries.
- API payloads use language-neutral progress enums regardless of selected display language.

## Completion Criteria

- All scenarios pass.
- No duplicate transition, signature, or satisfaction records are created during retries.
- Progress and lifecycle state never contradict after server confirmation.
- Arrival and completion artifacts persist only through PostgreSQL metadata and Azure Blob Storage.
- Role restrictions remain enforced in backend and matching clients.

## References

- API contract: [contracts/packing-list-progress-api.yaml](contracts/packing-list-progress-api.yaml)
- Data model: [data-model.md](data-model.md)
- Research decisions: [research.md](research.md)
