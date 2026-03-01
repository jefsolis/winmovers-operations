# Multi-stage Dockerfile
# 1) Build the frontend with Node
# 2) Install backend dependencies and copy built frontend into backend
# 3) Run the backend

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ .
# copy built frontend into backend/frontend so the server can serve static files
COPY --from=frontend-builder /app/frontend/dist ./frontend

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/backend ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
