# Data Model: Packing List Status Progress

## State Separation

Packing lists have two independent state dimensions:

| Dimension | Values | Purpose |
|---|---|---|
| Lifecycle `status` | `ACTIVE`, `COMPLETE_PENDING_SYNC`, `CLOSED`, `ERROR` | Editability, completion retry, and server synchronization lifecycle |
| Operational `progressStatus` | `NOT_STARTED`, `TRAVELING`, `WORKING`, `COMPLETED` | Field-work progress visible to operators and web users |

Valid combinations include `ACTIVE + TRAVELING`, `ACTIVE + WORKING`, and `COMPLETE_PENDING_SYNC + COMPLETED`. A confirmed `CLOSED` lifecycle MUST resolve to `COMPLETED` progress.

## Server Entities

### PackingList (extended)

Existing packing record extended with operational progress.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `progressStatus` | String | Yes | One of `NOT_STARTED`, `TRAVELING`, `WORKING`, `COMPLETED`; defaults to `NOT_STARTED` |
| `progressTransitions` | Relation | Yes | Ordered append-only history |
| `satisfactionResponse` | Relation | No | Present only after completion survey is accepted |

Existing lifecycle, completion, signature, package, lock, soft-delete, and audit fields remain unchanged.

Indexes:
- Existing lifecycle status index remains.
- Add index on `progressStatus` for operational filtering/reporting.

Compatibility invariant:
- `status IN (CLOSED, COMPLETE)` implies `progressStatus=COMPLETED` after backfill and defensive response normalization.

### PackingProgressTransition (new)

Immutable record of a requested and confirmed forward stage change.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | String | Yes | Server-generated identifier |
| `packingListId` | String | Yes | Parent packing list |
| `idempotencyKey` | String | Yes | Client-generated UUID; globally unique |
| `fromStatus` | String | Yes | Confirmed status before transition |
| `toStatus` | String | Yes | Exactly the next allowed status |
| `deviceId` | String | Yes | Originating device identifier |
| `actorOid` | String | Yes | Authenticated Azure OID |
| `actorName` | String | Yes | Operator/staff display-name snapshot |
| `observations` | Text | No | Arrival or completion observations |
| `signatureUrl` | String | No | Azure blob path; required for transition to `WORKING` |
| `occurredAt` | DateTime | Yes | Device-captured event time retained for offline chronology |
| `confirmedAt` | DateTime | Yes | Server confirmation time |
| `createdAt` | DateTime | Yes | Persistence timestamp |

Constraints:
- Unique `idempotencyKey`.
- Index `(packingListId, confirmedAt)`.
- Transition records are never updated or deleted through normal feature APIs.
- Server validates `occurredAt` as a parseable timestamp and records `confirmedAt` independently.
- `toStatus=WORKING` requires `signatureUrl`.
- `toStatus=COMPLETED` is created only by the completion transaction.

Relationships:
- Many transitions belong to one PackingList.
- Deleting a packing list remains soft-delete; transition history is retained.

### PackingSatisfactionResponse (new)

Versioned completion survey response designed for future questions.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | String | Yes | Server-generated identifier |
| `packingListId` | String | Yes | Unique one-to-one parent |
| `surveyVersion` | Integer | Yes | Version `1` for initial release |
| `answers` | JSON | Yes | Version-specific structured answers |
| `capturedByOid` | String | Yes | Authenticated operator Azure OID |
| `capturedByName` | String | Yes | Operator display-name snapshot |
| `submittedAt` | DateTime | Yes | Client response capture time |
| `createdAt` | DateTime | Yes | Persistence timestamp |
| `updatedAt` | DateTime | Yes | Last persistence timestamp |

Version 1 answer schema:

```json
{
  "overallRating": 5
}
```

Validation:
- `surveyVersion` MUST equal `1` for this release.
- `overallRating` MUST be a whole integer from 1 through 5.
- Unknown answer keys MAY be retained but do not satisfy future-version requirements.

## Derived API Value Object

### ServiceContext

Read-only normalized context resolved from existing MovingFile, Job, and Client data.

| Field | Type | Required | Resolution |
|---|---|---:|---|
| `clientId` | String | No | Individual or corporate client identifier |
| `clientName` | String | No | Individual client name, then corporate client name |
| `phone` | String | No | Client phone, then linked job client/company phone |
| `address` | String | No | Moving-file origin, job origin, then client address |
| `jobType` | String | Yes | Linked job type, otherwise moving-file category |
| `fileNumber` | String | Yes | Moving-file number |
| `category` | String | Yes | Moving-file category |

The backend owns precedence and formatting so mobile and web display the same values.

## Mobile Local Entities

### packing_lists (extended)

| Column | Type | Required | Purpose |
|---|---|---:|---|
| `progress_status` | TEXT | Yes | Latest locally effective status; default `NOT_STARTED` |
| `pending_progress_status` | TEXT | No | Target status awaiting confirmation |

The existing `moving_file_ref` JSON is extended with normalized `clientId`, `clientName`, `phone`, `address`, `jobType`, `fileNumber`, and `category` for offline detail display.

### packing_progress_transitions (new)

Durable local queue and local history.

| Column | Type | Required | Purpose |
|---|---|---:|---|
| `id` | TEXT | Yes | Local primary key and API idempotency key |
| `server_id` | TEXT | No | Server transition ID after confirmation |
| `packing_list_id` | TEXT | Yes | Local packing-list ID |
| `from_status` | TEXT | Yes | Locally confirmed source stage |
| `to_status` | TEXT | Yes | Requested target stage |
| `observations` | TEXT | No | Arrival/completion notes |
| `signature_local_path` | TEXT | No | Durable local signature source until upload confirms |
| `signature_blob_path` | TEXT | No | Azure blob path after upload |
| `survey_version` | INTEGER | No | Required for completion transition |
| `survey_answers` | TEXT | No | JSON object for versioned answers |
| `occurred_at` | TEXT | Yes | Device event timestamp |
| `sync_state` | TEXT | Yes | `PENDING`, `UPLOADING`, `SUBMITTING`, `CONFIRMED`, `ERROR` |
| `sync_error` | TEXT | No | Latest actionable retry error |
| `created_at` | TEXT | Yes | Local creation timestamp |
| `confirmed_at` | TEXT | No | Server confirmation timestamp |

Constraints:
- Unique local `id` is sent as `idempotencyKey`.
- Index `(packing_list_id, sync_state)` for retry scans.
- Confirmed rows remain as local history and are reconciled with server transition IDs.
- Only one non-confirmed transition per packing list is permitted by local query logic.

## State Transitions

```text
NOT_STARTED --Start Travel----------------------> TRAVELING
TRAVELING   --Arrival signature + observations--> WORKING
WORKING     --Completion sign-off + survey------> COMPLETED
```

Rules:
1. Only the next sequential transition is accepted.
2. Backward movement and stage skipping return conflict without mutation.
3. Retrying an already-confirmed idempotency key returns its original transition.
4. Transition confirmation checks the active device lock using existing rules.
5. Completion requires at least one package, established signature/decline rules, completion observations payload, and a valid survey response.
6. Completion writes progress transition, satisfaction response, completion fields, lock release, and lifecycle close atomically.
7. Once lifecycle is closed, package/item/photo edits and further transitions are rejected.

## Migration and Backfill

1. Add server fields/entities and generate the Prisma client.
2. Run an idempotent backfill:
   - lifecycle `CLOSED` or legacy `COMPLETE` → progress `COMPLETED`;
   - all other existing lists → progress `NOT_STARTED`.
3. Add SQLite columns/tables through forward-only `ALTER TABLE` and `CREATE TABLE IF NOT EXISTS` migrations.
4. Existing local closed lists normalize to `COMPLETED` during cache reconciliation.
5. Mixed-version server responses defensively report closed lifecycle lists as completed progress.
