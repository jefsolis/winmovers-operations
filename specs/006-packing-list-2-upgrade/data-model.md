# Data Model: Packing List 2.0 Operations

## 1. PackingList

- Purpose: Aggregate operational container for multi-day packing execution.
- Existing key fields:
  - id
  - listNumber
  - movingFileId
  - status
  - progressStatus
  - operatorName
- New/extended conceptual fields:
  - hasOpenWorkday (derived)
  - workdayIndexCurrent (derived)
  - completionBlockedReason (derived, e.g., MISSING_BOX_BARCODES)
- Validation rules:
  - FINAL_COMPLETE forbidden while any related box has barcodeState=MISSING.
  - Completed lists are immutable for operational edits.

## 2. PackingWorkdayEvent

- Purpose: Durable chronological record for each day boundary and final completion.
- Fields:
  - id
  - packingListId
  - workdayIndex (1..n)
  - eventType: DAY_START | DAY_CLOSE | FINAL_COMPLETE
  - fromProgressStatus
  - toProgressStatus
  - occurredAt
  - confirmedAt
  - actorName
  - observations (nullable)
  - idempotencyKey
  - syncState
- Validation rules:
  - Event sequence per workday must follow DAY_START -> (DAY_CLOSE or FINAL_COMPLETE).
  - Non-final day cannot emit FINAL_COMPLETE.
  - Duplicate idempotencyKey must not create a second event.

## 3. DailySignaturePair

- Purpose: Capture both mandatory signatures for day-boundary events.
- Fields:
  - id
  - eventId
  - clientSignatureBlobPath (nullable when declined rules apply)
  - crewLeaderSignatureBlobPath
  - clientSignerName (optional display)
  - crewLeaderName (optional display)
  - signatureLanguage: ES | EN (client-facing selection)
  - signedAt
- Validation rules:
  - DAY_START requires both signatures.
  - DAY_CLOSE requires both signatures.
  - FINAL_COMPLETE follows completion flow rules and does not require separate DAY_CLOSE signature on last day.

## 4. SatisfactionResponse

- Purpose: Client feedback captured only at final completion.
- Fields:
  - id
  - packingListId
  - eventId (must reference FINAL_COMPLETE)
  - surveyVersion
  - answers.overallRating (1..5)
  - submittedAt
- Validation rules:
  - Must exist for FINAL_COMPLETE.
  - Must not exist for DAY_CLOSE events.

## 5. Package (Box)

- Purpose: Physical box tracked in packing list.
- Existing key fields:
  - id
  - packingListId
  - barcode
- New/extended conceptual fields:
  - barcodeState: MISSING | ASSIGNED
  - barcodeAssignedAt (nullable)
- Validation rules:
  - barcodeState=MISSING allowed while list is active.
  - FINAL_COMPLETE blocked unless all packages in list have barcodeState=ASSIGNED.
  - Barcode uniqueness enforced within packingListId scope.

## 6. PackageItem

- Purpose: Editable box content line.
- Existing fields:
  - id
  - packageId
  - packingItemTypeId (nullable)
  - customName (nullable)
  - quantity
  - note
- Validation rules:
  - quantity must be integer >= 1.
  - At least one of packingItemTypeId or customName required.
  - Not editable when PackingList is completed.

## 7. FutureActionPlaceholder

- Purpose: UI contract entity for non-operational future actions.
- Fields:
  - id: INGRESS_TRUCK | TRAVELING_WAREHOUSE | INGRESS_WAREHOUSE | EXTRACT_WAREHOUSE
  - displayOrder
  - availabilityState: NOT_AVAILABLE
- Validation rules:
  - Selection must not mutate operational records.

## Relationship Summary

- PackingList 1..n PackingWorkdayEvent
- PackingWorkdayEvent 1..1 DailySignaturePair (for DAY_START and DAY_CLOSE)
- PackingList 1..n Package
- Package 1..n PackageItem
- PackingList 0..1 SatisfactionResponse linked to FINAL_COMPLETE event

## State Transitions

### A. Workday lifecycle (within one packing list)

1. NOT_STARTED -> TRAVELING via DAY_START intent
2. TRAVELING -> WORKING only after valid DAY_START dual signatures
3. WORKING -> TRAVELING via DAY_CLOSE (non-final day only, with dual signatures)
4. WORKING -> COMPLETED via FINAL_COMPLETE (final day, no separate DAY_CLOSE required)

### B. Barcode readiness lifecycle

1. Box created with barcodeState=MISSING (barcode optional at creation)
2. Later scan/assignment updates box to barcodeState=ASSIGNED
3. COMPLETED transition allowed only when all related boxes are ASSIGNED
