# Data Model: Packing Improvements

## Overview
This feature extends existing packing data behavior with deletion visibility controls, completion state reliability, and web-visible synchronization semantics.

## Entities

### PackingList
- Purpose: Top-level operational packing record linked to one moving file.
- Existing key fields:
  - id
  - listNumber
  - movingFileId
  - operatorName
  - status (currently ACTIVE, COMPLETE, ERROR)
  - signatureUrl
  - signatureDeclined
  - signatureDeclineNote
  - lockedByDeviceId, lockedAt, lockExpiresAt
  - createdAt, updatedAt
- New/extended feature fields (logical model):
  - deletedAt (nullable timestamp) for soft delete in web
  - deletedBy (nullable staff id or oid reference) for audit context
  - completionState (derived/explicit): ACTIVE, COMPLETE_PENDING_SYNC, CLOSED, ERROR
  - reviewLanguage (EN/ES) captured at completion prompt for sign-off rendering
  - syncVisibilityState (derived): IN_SYNC or SYNC_IN_PROGRESS for web presentation
- Relationships:
  - belongs to MovingFile
  - has many Package

Validation rules:
- Cannot transition to completion states when package count is 0.
- Soft-deleted packing lists are excluded from active web list queries.
- Completion with signature declined requires decline note.
- Packing list in COMPLETE_PENDING_SYNC or CLOSED is read-only.

State transitions:
- ACTIVE -> COMPLETE_PENDING_SYNC when user completes and local signature/finalization intent is recorded.
- COMPLETE_PENDING_SYNC -> CLOSED when server confirms completion.
- ACTIVE/COMPLETE_PENDING_SYNC -> ERROR when sync or finalization fails.
- ERROR -> ACTIVE or COMPLETE_PENDING_SYNC when retry succeeds, based on last intended action.
- Any active state -> SOFT_DELETED (visibility state) via web delete action.

### Package
- Purpose: One physical box in a packing list.
- Key fields:
  - id
  - packingListId
  - barcode
  - createdAt
- Relationships:
  - belongs to PackingList
  - has many PackageItem
  - has many PackagePhoto

Validation rules:
- barcode must be unique within packingListId.
- package records are included in full-state live-save payload.

### PackageItem
- Purpose: Declared contents of a package.
- Key fields:
  - id
  - packageId
  - packingItemTypeId (nullable)
  - customName (nullable)
  - quantity
  - note
- Validation rules:
- quantity >= 1.
- Either packingItemTypeId or customName must be present.

### PackagePhoto
- Purpose: Photo evidence associated to a package.
- Key fields:
  - id
  - packageId
  - blobPath
  - uploadedAt
- Mobile local fields (SQLite): localPath, uploadState.

Validation rules:
- blobPath is required for server-persisted photo rows.
- uploadState drives whether photo metadata is included in PUT payload.

### CompletionRecord (logical)
- Purpose: Captures finalization intent and result.
- Key fields:
  - packingListId
  - reviewLanguage
  - signatureUrl or signatureDeclined + signatureDeclineNote
  - completionRequestedAt
  - completionConfirmedAt (nullable)
  - retryCount
  - lastError

Validation rules:
- reviewLanguage is required at completion start.
- completionConfirmedAt required for CLOSED.

## Derived Read Models

### PackingListWebSummary
- id
- listNumber
- movingFileId
- operatorName
- state badge
- packageCount
- itemCount
- photoCount
- lastSyncedAt
- syncVisibilityState

Rules:
- Counts come from server-persisted Package/PackageItem/PackagePhoto data.
- If latest mobile changes are not yet propagated, show last known counts plus sync indicator.

## Concurrency and Locking
- Single active writer lock by device (existing lock fields).
- Lock can be claimed by another device through claim-lock workflow.
- While soft-deleted or CLOSED, lock acquisition for edits is denied.

## Audit Events
- PACKING_LIST_SOFT_DELETE
- PACKING_LIST_RESTORE (optional for future)
- PACKING_LIST_COMPLETE_REQUESTED
- PACKING_LIST_COMPLETION_CONFIRMED
- PACKING_LIST_COMPLETION_RETRY
