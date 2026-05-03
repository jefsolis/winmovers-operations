require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('./middleware/auth')

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Public endpoints — must be registered before the auth middleware
app.get('/api/version', (_req, res) => {
  res.json({ buildId: process.env.GIT_SHA || 'dev' })
})

// Protect all API routes
app.use('/api', authMiddleware)

// API routes
app.use('/api/dashboard',          require('./routes/dashboard'))
app.use('/api/staff',              require('./routes/staff'))
app.use('/api/clients',            require('./routes/clients'))

app.use('/api/agents',             require('./routes/agents'))
app.use('/api/visits',             require('./routes/visits'))
app.use('/api/quotes',             require('./routes/quotes'))
app.use('/api/files/:fileId/attachments', require('./routes/attachments'))  // must be before /api/files
app.use('/api/files',                    require('./routes/movingFiles'))
app.use('/api/jobs',                     require('./routes/jobs'))
app.use('/api/surveys',                  require('./routes/surveys'))
app.use('/api/admin',                    require('./routes/admin'))
app.use('/api/audit',                    require('./routes/audit'))
app.use('/api/email',                    require('./routes/email'))

// Legacy health check
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from WinMovers API' })
})

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err)
  const status = err.code === 'P2025' ? 404 : 500
  res.status(status).json({ error: err.message || 'Internal server error' })
})

// Resolve static frontend path for both deployed package layout and local dev layout.
// In deployment we copy the built frontend into `backend/frontend` so prefer that.
const staticCandidates = [
  path.join(__dirname, 'frontend'),         // deployed: /home/site/wwwroot/frontend (contains index.html)
  path.join(__dirname, 'frontend', 'dist'), // alternative deployed layout
  path.join(__dirname, '../frontend/dist')  // local dev: backend served with sibling frontend/dist
]

let staticPath = null
for (const candidate of staticCandidates) {
  if (fs.existsSync(candidate)) {
    staticPath = candidate
    break
  }
}

if (staticPath) {
  app.use(express.static(staticPath))
  app.get('*', (req, res) => res.sendFile(path.join(staticPath, 'index.html')))
} else {
  app.get('/', (req, res) => {
    res.send('<h1>WinMovers - Operations (Backend)</h1><p>Build the frontend and place it in /frontend or /frontend/dist</p>')
  })
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
