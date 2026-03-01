# Multi-stage Dockerfile
# 1) Build the frontend with Node
# 2) Install backend dependencies and copy built frontend into backend
# 3) Run the backend

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN node node_modules/vite/bin/vite.js build

FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci --production
RUN npx prisma generate
COPY backend/ .
# copy built frontend into backend/frontend so the server can serve static files
COPY --from=frontend-builder /app/frontend/dist ./frontend

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=backend-builder /app/backend ./
ENV PORT=8080
EXPOSE 8080
# Run prisma db push on startup to create/sync tables, then start the server.
# timeout 60 prevents a hung DB connection from blocking startup past 60s.
# ; (not &&) ensures node always starts even if db push fails.
CMD ["sh", "-c", "timeout 60 npx prisma db push --accept-data-loss; node index.js"]
