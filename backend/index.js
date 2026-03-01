const express = require('express')
const path = require('path')
const fs = require('fs')

const app = express()
const port = process.env.PORT || 3000

app.use('/api', express.json())

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from WinMovers API' })
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
