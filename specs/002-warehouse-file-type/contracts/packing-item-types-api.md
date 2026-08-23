# Packing Item Types API — Contract

**Feature**: 002-warehouse-file-type
**Date**: 2026-08-03
**Mount point**: `/api/packing-item-types`
**Route file**: `backend/routes/packingItemTypes.js`
**Registration**: In `backend/index.js`, mount BEFORE `/api/files` (attachment route ordering rule).

All endpoints require a valid Azure AD JWT (`Authorization: Bearer <token>`).

---

## GET /api/packing-item-types

Returns all **active** packing item types, sorted by name ascending.
Intended for the mobile app to fetch and cache.

**Authentication**: Valid JWT required (any role including Bodega).

**Request**: No query parameters required.

**Response 200**:

```jsonc
[
  { "id": "clx...", "nameEs": "Caja", "nameEn": "Box", "active": true, "createdAt": "...", "updatedAt": "..." },
  { "id": "clx...", "nameEs": "Electrónico", "nameEn": "Electronic", "active": true, "createdAt": "...", "updatedAt": "..." },
  { "id": "clx...", "nameEs": "Mueble", "nameEn": "Furniture", "active": true, "createdAt": "...", "updatedAt": "..." }
]
```

**Response 401**: No or invalid JWT.

---

## GET /api/packing-item-types/all

Returns **all** packing item types (active and inactive), for the admin
management UI.

**Authentication**: Valid JWT required; intended for ADMIN role (enforced in UI,
not at API level since existing admin endpoints follow this pattern).

**Response 200**: Same shape as above but includes entries where `active: false`.

---

## POST /api/packing-item-types

Creates a new packing item type.

**Authentication**: Valid JWT + `forbidBodegaWrite` (Bodega role cannot write).

**Request body**:

```jsonc
{
  "nameEs": "Caja de Archivos",   // required, non-empty string
  "nameEn": "Archive Box"         // required, non-empty string
}
```

**Response 201**:

```jsonc
{ "id": "clx...", "nameEs": "Caja de Archivos", "nameEn": "Archive Box", "active": true, "createdAt": "...", "updatedAt": "..." }
```

**Response 400**: `nameEs` or `nameEn` missing or empty.

---

## PUT /api/packing-item-types/:id

Updates the names of an existing packing item type.

**Authentication**: Valid JWT + `forbidBodegaWrite`.

**Request body**:

```jsonc
{
  "nameEs": "Caja de Cartón",   // required, non-empty string
  "nameEn": "Cardboard Box"     // required, non-empty string
}
```

**Response 200**: Updated item type object.

**Response 404**: Item type not found (Prisma P2025 → global error handler returns 404).

---

## PATCH /api/packing-item-types/:id/deactivate

Soft-deactivates an item type. Sets `active = false`.

**Authentication**: Valid JWT + `forbidBodegaWrite`.

**Request body**: Empty.

**Response 200**: Updated item type object with `"active": false`.

**Response 404**: Item type not found.

---

## Error handling

- Global error handler in `backend/index.js` handles Prisma `P2025` → 404.
- `forbidBodegaWrite` returns 403 for Bodega-role users on write endpoints.
- No new error conditions beyond these existing patterns.
