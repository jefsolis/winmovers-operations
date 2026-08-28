# Phase 0 Research: Packing List 2.0 Operations

## Decision 1: Represent multi-day activity as explicit day events under one packing list

- Decision: Keep one packing list as the container and model each day boundary as explicit events (DAY_START, DAY_CLOSE, FINAL_COMPLETE) in ordered history.
- Rationale: Preserves existing packing-list identity, avoids fragmenting data across multiple lists, and matches the requirement to maintain day-by-day history on the same record.
- Alternatives considered:
  - Create one packing list per day: rejected because it breaks continuity of packages/items/photos and complicates completion.
  - Infer day boundaries from timestamps only: rejected because inference is brittle and ambiguous for retries/offline events.

## Decision 2: Require dual signatures by event type, with final-day exception

- Decision: Require client + crew-leader signatures for DAY_START and non-final DAY_CLOSE; on final day, use FINAL_COMPLETE flow and skip DAY_CLOSE signature requirement.
- Rationale: Satisfies business rule for dual acknowledgement at work boundaries while avoiding redundant signature collection on the terminal day.
- Alternatives considered:
  - Always require DAY_CLOSE and FINAL_COMPLETE signatures on final day: rejected as redundant and contrary to requested behavior.
  - Only one signature at day boundaries: rejected because it does not meet requirement.

## Decision 3: Keep satisfaction survey scoped to final completion only

- Decision: Show and persist satisfaction survey exclusively in FINAL_COMPLETE.
- Rationale: Aligns with requirement that survey must not appear on non-final day closure.
- Alternatives considered:
  - Optional survey at each day close: rejected due to requirement conflict and survey fatigue.
  - Survey at day start: rejected as semantically incorrect.

## Decision 4: Preserve offline-first behavior using existing idempotent retry patterns

- Decision: Reuse existing transition idempotency keys, pending sync states, and retry loops for new day events and signatures.
- Rationale: Minimizes risk and keeps consistency with proven behavior for transitions, photos, and completion.
- Alternatives considered:
  - Introduce separate sync engine for day events: rejected due to complexity and higher regression risk.
  - Require online-only daily signatures: rejected due to operational unreliability in field conditions.

## Decision 5: Enforce barcode completeness as a hard completion gate

- Decision: Track barcode-missing status per box and block FINAL_COMPLETE while any box remains unresolved.
- Rationale: Directly satisfies business integrity requirement that completion is invalid with unscanned boxes.
- Alternatives considered:
  - Soft warning only: rejected because operators could still complete invalid jobs.
  - Block day close as well: rejected because requirement targets final completion gate specifically.

## Decision 6: Allow deferred barcode assignment with explicit pending indicators

- Decision: Permit box creation without barcode and provide a dedicated later assignment/scan action; expose visible missing-barcode indicators in list and detail views.
- Rationale: Supports real field flow where labels may be delayed while preserving discoverability of unresolved boxes.
- Alternatives considered:
  - Keep barcode mandatory at creation: rejected because it blocks operations when labels are unavailable.
  - Hidden placeholder barcode values: rejected due to ambiguity and audit risk.

## Decision 7: Support in-place editing of box items through existing item records

- Decision: Extend current box item UI from add/delete into editable forms for item type, quantity, and observations.
- Rationale: Uses existing item entities and sync payload shape with minimal domain expansion.
- Alternatives considered:
  - Delete and recreate item for edits: rejected due to poor UX and noisy history.
  - Lock item edits after creation: rejected due to requirement conflict.

## Decision 8: Reserve future logistics actions as non-operational placeholders in actions area

- Decision: Add placeholder entries for Ingress to Truck, Traveling to Warehouse, Ingress to Warehouse, and Extract from Warehouse with explicit not-available behavior.
- Rationale: Establishes stable UI extension points now without changing current business state machine.
- Alternatives considered:
  - Omit placeholders until implementation: rejected because requirement explicitly asks to consider and place future actions.
  - Implement partial backend states now: rejected because out of current scope.

## Decision 9: Extend API contracts incrementally rather than introducing a new service

- Decision: Extend existing `/api/packing-lists` contract and event payload semantics for day-cycle and dual-signature data.
- Rationale: Keeps route ordering, auth, and synchronization patterns intact; lower deployment and testing risk.
- Alternatives considered:
  - Add separate day-lifecycle microservice: rejected due to architecture sprawl and governance mismatch.
  - Put day metadata only in mobile local cache: rejected because web visibility and audit consistency require server truth.
