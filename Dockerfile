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
# Retry prisma db push up to 3 times (10s apart) in case of a slow DB connection,
# then start the server. Using || true on the loop so node always starts.
CMD ["sh", "-c", "for i in 1 2 3; do timeout 120 npx prisma db push --accept-data-loss --skip-generate && break; echo 'db push attempt failed, retrying in 10s...'; sleep 10; done; node index.js"]
