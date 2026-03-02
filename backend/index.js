require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/dashboard',          require('./routes/dashboard'))
app.use('/api/clients',            require('./routes/clients'))
app.use('/api/contacts',           require('./routes/contacts'))
app.use('/api/agents',             require('./routes/agents'))
app.use('/api/visits',             require('./routes/visits'))
app.use('/api/quotes',             require('./routes/quotes'))
app.use('/api/jobs/:jobId/files',  require('./routes/jobFiles'))  // must be before /api/jobs
app.use('/api/jobs',               require('./routes/jobs'))

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
