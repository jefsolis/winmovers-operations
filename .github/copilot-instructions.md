# WinMovers Operations — Copilot Instructions

## General Rules

- **Never run `git commit` or `git push` automatically.** Only perform git commits or pushes when the user explicitly asks for it.

---

## Project Overview
Operations management system for an international moving company. Features: Jobs, Clients, Agents, Visits (pre-sale), Quotes, Moving Files (export/import/local), and file Attachments stored in Azure Blob Storage.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, port 3001 (local) / 8080 (container) |
| ORM | Prisma 5 + PostgreSQL |
| Frontend | React 18 + Vite, port 5173 (local) |
| File storage | Azure Blob Storage (`@azure/storage-blob`) |
| Container | Docker multi-stage build (Alpine Node 20) |
| Deployment | GitHub Actions → Azure Container Registry → Azure App Service (`winmovers-ops-2026`, resource group `winmovers-rg`) |

---

## Repository Layout

```
winmovers-operations/
├── backend/
│   ├── index.js              # Express app entry, registers all routes, serves static frontend
│   ├── db.js                 # getPrisma() singleton — always use this, never new PrismaClient()
│   ├── .env                  # DATABASE_URL, AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER
│   ├── prisma/
│   │   └── schema.prisma
│   └── routes/
│       ├── dashboard.js
│       ├── clients.js
│       ├── agents.js
│       ├── staff.js
│       ├── visits.js
│       ├── quotes.js
│       ├── jobs.js
│       ├── movingFiles.js
│       └── attachments.js    # mounted at /api/files/:fileId/attachments (BEFORE /api/files)
├── frontend/
│   ├── src/
│   │   ├── api.js            # central axios instance, baseURL = /api
│   │   ├── i18n.jsx          # ALL user-facing text lives here (EN + ES)
│   │   ├── constants.js      # status/type/mode metadata + helper functions
│   │   ├── App.jsx           # React Router routes
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── QuickCreateClientModal.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Clients/
│   │       ├── Agents/
│   │       ├── Staff/
│   │       ├── Visits/
│   │       ├── Quotes/
│   │       ├── Jobs/
│   │       └── Files/        # Export / Import / Local files + attachments
│   └── vite.config.js        # proxy /api → http://localhost:3001
├── Dockerfile                 # multi-stage: builds frontend, installs backend, runs on :8080
└── .github/workflows/
    └── ci-deploy.yml          # push to main → build image → push ACR → restart Azure Web App
```

---

## Backend Conventions

### Database access
Always use `getPrisma()` from `./db` — never instantiate `PrismaClient` directly:
```js
const { getPrisma } = require('../db')
const result = await getPrisma().modelName.findMany(...)
```

### Route pattern
```js
const router = require('express').Router()
const { getPrisma } = require('../db')

router.get('/', async (req, res, next) => {
  try {
    // ...
  } catch (err) { next(err) }
})

module.exports = router
```
The global error handler in `index.js` handles `P2025` (Prisma not-found) as 404.

### Registering new routes
Add to `backend/index.js` in this order — note that `/api/files/:fileId/attachments` **must be registered before** `/api/files`:
```js
app.use('/api/files/:fileId/attachments', require('./routes/attachments'))
app.use('/api/files',                    require('./routes/movingFiles'))
```

### Auto-numbering
- Jobs: sequential numeric (e.g. `000123`)
- MovingFiles: `E-0001` (EXPORT), `D-0001` (IMPORT), `M-0001` (LOCAL)
- Visits: `V-0001`
- Quotes: `Q-0001`

### Environment variables (backend/.env)
```
DATABASE_URL=
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=
```

---

## Prisma Schema — Key Models & Relations

```
Client       — clientType: CORPORATE | INDIVIDUAL | BROKER
               has two Visit relations: "VisitClient" (individual) and "VisitCorporateClient" (corporate)

Agent        — three Job relations: OriginAgent | DestAgent | CustomsAgent
               (no agentType field — it was removed)

Job          — type: EXPORT | IMPORT | INTERNATIONAL | DOMESTIC
               status: SURVEY → QUOTATION → BOOKING → PRE_MOVE → IN_TRANSIT → DELIVERED → CLOSED
               linked to: Client, 3× Agent, Quote (unique), MovingFile (unique)

MovingFile   — category: EXPORT | IMPORT | LOCAL
               status: OPEN | CLOSED
               EXPORT/IMPORT files are auto-created when a Job is created
               has many Attachments

Attachment   — belongs to MovingFile; storagePath is the Azure Blob path

Visit        — status: SCHEDULED | COMPLETED | QUOTED | CLOSED
               serviceType: DOOR_TO_PORT | DOOR_TO_DOOR | PACKING | LOCAL_MOVE
               has clientId (individual) AND corporateClientId (company) — both optional
               has many Quotes

Quote        — status: DRAFT | SENT | ACCEPTED | REJECTED
               belongs to Visit; optionally linked to a Job once converted
               language: EN | ES
```

When adding fields to existing models, always run `npx prisma db push` then `npx prisma generate` from `backend/`.

---

## Frontend Conventions

### i18n
All user-facing strings go through `i18n.jsx`. Use the `useLanguage()` hook:
```jsx
const { t } = useLanguage()
// t('nav.visits'), t('common.save'), t('visitStatuses.SCHEDULED'), etc.
```
Add keys to **both** `en` and `es` objects in `i18n.jsx` whenever adding new UI text.

### API calls
Use the central `api.js` instance (not raw fetch/axios):
```js
import api from '../../api'
const data = await api.get('/visits')
await api.put(`/visits/${id}`, payload)
```

### Constants & metadata
Status/type badge colours live in `constants.js`. Helper functions accept `t` for labels:
```js
import { statusMeta, getJobStatuses } from '../../constants'
const meta = statusMeta(job.status, t)  // { value, bg, color, label }
```

### PUT requests (critical)
When updating a record, **always send the full object** — never send only changed fields. The backend destructures the full body and will null-out any field not included:
```js
await api.put(`/visits/${id}`, {
  status, clientId, corporateClientId, assignedToId,
  prospectName, prospectPhone, prospectEmail,
  originAddress, originCity, originCountry,
  destAddress, destCity, destCountry,
  serviceType, scheduledDate, observations, language,
})
```

### QuickCreateClientModal
Always creates `INDIVIDUAL` clients — no `clientType` dropdown. Hardcodes `clientType: 'INDIVIDUAL'` in the POST payload.

---

## Deployment

Pushing to `main` triggers `ci-deploy.yml` automatically:
1. Build multi-stage Docker image
2. Push to `${{ secrets.ACR_NAME }}.azurecr.io/winmovers-ops:latest`
3. `az webapp config container set` + `az webapp restart` on `winmovers-ops-2026`

The Docker image runs the Express backend on port 8080. The backend serves the built React frontend as static files from `./frontend` (copied in during the Docker build).

**Required GitHub secrets:** `ACR_NAME`, `AZURE_APP_ID`, `AZURE_PASSWORD`, `AZURE_TENANT`

---

## Local Development

```powershell
# Backend
Set-Location backend
node index.js        # listens on :3001

# Frontend (separate terminal)
Set-Location frontend
npm run dev          # listens on :5173, proxies /api → :3001
```

After schema changes:
```powershell
Set-Location backend
npx prisma db push
npx prisma generate
```
