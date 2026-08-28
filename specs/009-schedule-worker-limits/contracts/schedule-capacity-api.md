# API Contract: Schedule Capacity & Settings

Base path: `/api/schedule` (existing router, `backend/routes/schedule.js`). All endpoints require existing `requireScheduleAccess` unless noted; capacity-write and resolution endpoints additionally require `requireScheduleManager` (new, `canManageSchedule` or `ADMIN`).

## GET /api/schedule/settings

Returns the current capacity configuration.

**Auth**: `requireScheduleAccess` (read allowed for anyone with schedule access).

**Response 200**:
```json
{
  "dailyWorkerCapacity": 30,
  "updatedAt": "2026-08-27T12:00:00.000Z",
  "updatedByStaffId": "staff_abc123"
}
```

## PUT /api/schedule/settings

Updates the daily worker capacity.

**Auth**: `requireScheduleManager`.

**Request body**:
```json
{ "dailyWorkerCapacity": 25 }
```

**Response 200**: same shape as GET.

**Response 400** (validation failure — non-numeric, zero, or negative):
```json
{ "error": "La capacidad diaria debe ser un número entero mayor que cero." }
```

**Response 403** (caller lacks `canManageSchedule`/`ADMIN`):
```json
{ "error": "No tienes permiso para configurar la capacidad de la Bitácora." }
```

---

## GET /api/schedule/capacity?date=YYYY-MM-DD&days=N

Returns remaining capacity for a date span (used by the job/schedule form to pre-validate before submit).

**Auth**: `requireScheduleAccess`.

**Response 200**:
```json
{
  "capacity": 30,
  "days": [
    { "date": "2026-09-01", "committed": 18, "remaining": 12 },
    { "date": "2026-09-02", "committed": 30, "remaining": 0 }
  ],
  "fits": false,
  "workersRequired": null
}
```

If `workersRequired` query param is also supplied, `fits` reflects whether every day in the span has `remaining >= workersRequired`.

---

## GET /api/schedule/capacity/suggestions?date=YYYY-MM-DD&days=N&workersRequired=W

Returns the closest available date span(s) when the requested span doesn't fit.

**Auth**: `requireScheduleAccess`.

**Response 200**:
```json
{
  "requested": { "date": "2026-09-01", "days": 2, "workersRequired": 8 },
  "suggestions": [
    { "startDate": "2026-09-03", "endDate": "2026-09-04" },
    { "startDate": "2026-08-30", "endDate": "2026-08-31" }
  ]
}
```

An empty `suggestions` array means no fitting span was found within the search window; the caller must display a "no available date found nearby" message (per FR-009 / Assumptions).

---

# API Contract: Job Fields & Auto-Scheduling

Base path: `/api/jobs` (existing router). No new endpoints — existing create/update payload contract extended.

## POST /api/jobs, PUT /api/jobs/:id — extended fields

**Request body additions** (sent alongside all other existing full-object fields per the full-object PUT convention):
```json
{
  "workersRequired": 8,
  "daysToComplete": 2
}
```

**Response additions** — when auto-scheduling is attempted as a side effect of create/update, the response includes a `scheduleWarning` object if the job could not be auto-scheduled:
```json
{
  "id": "job_123",
  "...": "...existing job fields...",
  "scheduleWarning": {
    "code": "MISSING_WORKERS_REQUIRED",
    "message": "Este trabajo necesita el número de trabajadores requeridos antes de poder agendarse automáticamente."
  }
}
```
or
```json
{
  "scheduleWarning": {
    "code": "NO_CAPACITY",
    "message": "No hay espacio en la Bitácora para este trabajo el 2026-09-01 (o los días 2026-09-01–2026-09-02).",
    "suggestions": [
      { "startDate": "2026-09-03", "endDate": "2026-09-04" }
    ]
  }
}
```
`scheduleWarning` is `null`/absent when the job was scheduled successfully (or scheduling wasn't applicable, e.g. no service date set).

---

# API Contract: Schedule Entry Override & Resolution

Base path: `/api/schedule` (existing router).

## POST /api/schedule (existing) / PUT /api/schedule/:id (existing) — extended fields

**Request body additions**:
```json
{
  "forceOverride": true,
  "overrideReason": "El cliente exige entrega ese día por cierre de puerto."
}
```

- When the requested span doesn't fit capacity and `forceOverride` is not `true`, the endpoint responds **409**:
```json
{
  "error": "No hay espacio en la Bitácora para este trabajo ese día (o días).",
  "suggestions": [ { "startDate": "2026-09-03", "endDate": "2026-09-04" } ]
}
```
- When `forceOverride: true` is sent without a non-empty `overrideReason`, responds **400**:
```json
{ "error": "Debes indicar un motivo para agendar este trabajo fuera de la capacidad disponible." }
```
- When `forceOverride: true` with a valid reason, the entry is created/updated with `needsAttention: true`, `overrideReason` stored, and response is **201/200** as normal, including the new fields.

## GET /api/schedule/attention

Returns all schedule entries currently flagged `needsAttention: true`, for the dashboard card and the Schedule screen's manager indicator.

**Auth**: `requireScheduleAccess` (read allowed for the dashboard card per FR-021, which any user can view); manager-only actions remain separately gated.

**Response 200**:
```json
[
  {
    "id": "entry_1",
    "jobId": "job_123",
    "job": { "jobNumber": "000123", "client": { "name": "Acme Corp" } },
    "startDate": "2026-09-01",
    "endDate": "2026-09-02",
    "overrideReason": "El cliente exige entrega ese día por cierre de puerto.",
    "needsAttention": true
  }
]
```

## PUT /api/schedule/:id/resolve

Clears the `needsAttention` flag once the day is no longer overbooked (called after a manager frees capacity by editing other entries).

**Auth**: `requireScheduleManager`.

**Response 200**: updated entry with `needsAttention: false` (reason retained for history).

**Response 409** (day is still overbooked): 
```json
{ "error": "El día todavía excede la capacidad disponible; libera más trabajadores antes de resolver." }
```
