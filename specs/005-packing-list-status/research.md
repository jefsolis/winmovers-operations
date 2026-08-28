# Research: Packing List Status Progress

## Decision 1: Separate operational progress from lifecycle and synchronization state

**Decision**: Add `progressStatus` to the packing list with `NOT_STARTED`, `TRAVELING`, `WORKING`, and `COMPLETED`. Preserve the existing backend `status` values (`ACTIVE`, `COMPLETE_PENDING_SYNC`, `CLOSED`, `ERROR`) and mobile `sync_state` values as separate lifecycle/transport concerns.

**Rationale**: A list can be Traveling while its latest transition is pending synchronization, or Working while package edits are saving. Reusing `status` would make those valid combinations impossible and would regress existing close/edit-lock logic.

**Alternatives considered**:
- Replace the existing `status`: rejected because it controls editability, completion retry, and legacy closed-state normalization.
- Derive progress from package counts and completion timestamps: rejected because departure and arrival cannot be inferred reliably.

## Decision 2: Use a single sequential transition contract with atomic final completion

**Decision**: Add an idempotent `POST /packing-lists/{id}/progress-transitions` contract for `TRAVELING` and `WORKING`. Extend the existing `PATCH /packing-lists/{id}/complete` contract to atomically create the `COMPLETED` progress transition, persist completion observations and satisfaction data, and set lifecycle status to `CLOSED`.

**Rationale**: A single transition endpoint centralizes sequential validation and audit behavior. Keeping completion in the established close endpoint preserves the proven package/photo/signature synchronization order and prevents `progressStatus=COMPLETED` from diverging from lifecycle `CLOSED`.

**Alternatives considered**:
- Separate endpoint per stage: rejected because validation, locking, and idempotency would be duplicated.
- Route completion through the generic transition endpoint: rejected because completion has existing full-state save, Azure signature upload, email, and retry semantics.

## Decision 3: Persist append-only transitions with client-generated idempotency keys

**Decision**: Introduce an append-only `PackingProgressTransition` record with a globally unique client-generated `idempotencyKey`, from/to status, actor identity/name, device ID, timestamps, observations, and optional arrival signature blob path. Execute current-status validation, transition creation, and packing-list status update in one transaction. If the same key is retried, return the original successful transition.

**Rationale**: Mobile requests can time out after the server commits. A durable unique key provides exact retry behavior and avoids fragile time-window deduplication. Append-only records satisfy audit-history requirements.

**Alternatives considered**:
- Deduplicate within a 30-second time window: rejected because legitimate requests and delayed retries cannot be distinguished reliably.
- Audit log only: rejected because transition-specific fields and idempotent response lookup need a first-class relation.

## Decision 4: Queue offline transitions locally

**Decision**: Add a local `packing_progress_transitions` queue in SQLite. Each row stores the idempotency key, target status, observations, local/blob signature paths, survey payload where applicable, request/sync state, error, and timestamps. The queue is flushed before normal edits after reconnect/app foreground; confirmed server state replaces local optimistic progress, while pending progress remains visibly marked.

**Rationale**: A row-based queue can represent multiple transition types and future acknowledgement fields without continually expanding the packing-list table. It also survives process termination and makes retries observable.

**Alternatives considered**:
- Add pending-arrival columns directly to `packing_lists`: rejected because it mixes confirmed state with request payload and does not scale to future transitions.
- Require connectivity for status advancement: rejected by the offline reliability requirements and current local-first architecture.

## Decision 5: Reuse Azure signature storage for arrival acknowledgement

**Decision**: Capture arrival signatures with the existing signature canvas and upload helper. Store only the Azure blob path on the server and generate signed read URLs in packing-list detail responses. Preserve the local signature data until transition confirmation.

**Rationale**: This follows the constitution and the existing completion signature flow, avoids local production storage, and supports web/mobile display with expiring URLs.

**Alternatives considered**:
- Store base64 signatures in PostgreSQL: rejected due to database bloat and conflict with the established Azure storage model.
- Reuse the final completion signature fields: rejected because arrival and completion are separate acknowledgements and both must remain visible.

## Decision 6: Return a normalized service-context DTO

**Decision**: Expand packing-list summary/detail responses with `serviceContext`: client name, resolved phone, formatted service address, job type/category, and source record identifiers. Resolve values server-side using these priorities:
1. Client: individual client, then corporate client.
2. Phone: selected client phone, then linked job client/company phone; do not treat destination contact phone as the client phone.
3. Address: moving-file origin address/city/country, then linked job origin address/city/country, then client address.
4. Job type: linked job type when present, otherwise moving-file category.

**Rationale**: Packing work occurs at the origin/client location. Central resolution gives mobile and web identical values and avoids duplicating legacy field precedence.

**Alternatives considered**:
- Let mobile combine moving-file and job caches: rejected because those caches currently omit critical fields and can disagree across devices.
- Use `destPhone` as fallback: rejected because it may identify a destination contact rather than the client being serviced.

## Decision 7: Use a versioned structured satisfaction response

**Decision**: Add a one-to-one `PackingSatisfactionResponse` for each packing list with `surveyVersion`, structured `answers`, respondent context, and timestamps. Version 1 requires `answers.overallRating` as an integer from 1 through 5. Validate each known version on the server.

**Rationale**: Structured versioned answers satisfy the immediate star rating while allowing future questions and answer types without schema changes for every question. A first-class record supports reporting and authorization better than embedding survey data in an audit string.

**Alternatives considered**:
- Add only `satisfactionRating` to `PackingList`: rejected because future questions would force repeated schema expansion and lose survey-version context.
- Build configurable survey-definition tables now: rejected as unnecessary complexity before additional questions are known.

## Decision 8: Use established icon libraries with text labels

**Decision**: Add `lucide-react` to web and `@expo/vector-icons` to mobile. Use clock, truck, package/work, check, phone, navigation, menu, alert, file, and materials icons with text labels and accessible names. Mobile labels are Spanish; web labels continue through the existing localization system. Use a custom five-button star selector built from the same icon library rather than a separate rating dependency.

**Rationale**: These libraries provide familiar, accessible symbols, consistent sizing, and no hand-drawn SVG maintenance. Text remains mandatory so status is not conveyed by icon or color alone.

**Alternatives considered**:
- Emoji: rejected because rendering and visual weight vary by platform and printed/web contexts.
- A dedicated star-rating package: rejected because five controlled icon buttons are simple and avoid another dependency.

## Decision 9: Apply language policy by mobile audience

**Decision**: Add operator-facing mobile progress labels and actions directly in Spanish, matching the current operator experience. Use "No iniciado", "En camino", "Trabajando", and "Completado" for statuses and "Iniciar viaje", "Ya llegamos", and "Completar trabajo" for next-stage actions. Extend the existing review-language choice so client-facing arrival acknowledgement, signature, observations, review, and satisfaction content renders completely in English or Spanish. Keep new web text in both existing `frontend/src/i18n.jsx` language dictionaries.

**Rationale**: Operators use the mobile app in Spanish, while clients may require English during acknowledgement and sign-off. Audience-based language behavior satisfies both workflows without adding an unused language mode to operator screens.

**Alternatives considered**:
- Make every mobile screen bilingual: rejected because it introduces an unused language capability for operator workflows.
- Keep every mobile screen Spanish-only: rejected because client-facing acknowledgement and sign-off must support English-speaking clients.
- Translate the entire mobile application: rejected as out of scope, unnecessary, and higher risk.

## Decision 10: Backfill and compatibility behavior

**Decision**: Add `progressStatus` with default `NOT_STARTED`, then run an explicit idempotent backfill after schema synchronization: existing `CLOSED`/legacy `COMPLETE` lists become `COMPLETED`; other undeleted lists become `NOT_STARTED`. API response normalization also treats a closed lifecycle as completed defensively during rollout.

**Rationale**: A database default alone would incorrectly show historical completed work as Not Started. The defensive read rule protects mixed-version deployment windows.

**Alternatives considered**:
- Infer status only at read time forever: rejected because filtering, reporting, and transition validation require persisted state.
- Infer historical Traveling or Working: rejected because no reliable evidence exists.

## Decision 11: Refresh web status within the existing acceptance window

**Decision**: Reuse the schedule module's quiet polling pattern in the web packing panel: background refresh every 10 seconds while visible and immediate refresh on focus/visibility return, preserving current data on transient refresh failure.

**Rationale**: The web must reflect mobile-confirmed progress without manual refresh. Ten-second polling meets the existing operational acceptance window without adding a new realtime service.

**Alternatives considered**:
- WebSockets or server-sent events: rejected as disproportionate infrastructure for the current scale and existing Express architecture.
- Refresh only when expanding a row: rejected because the summary status would remain stale.
