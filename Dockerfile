# ==============================================================================
# Multi-Stage Production Dockerfile for Early-Stage Startup Cloud Deployment
# Stacks: NestJS (API + WebSockets) + React/Vite (SPA Frontend)
# Targets: Render, Railway, Fly.io, DigitalOcean App Platform, or Linux VM
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React/Vite Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
# Pass build-time environment variable if frontend is decoupled
ARG VITE_API_URL=""
ARG VITE_WS_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build NestJS Backend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Minimal Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only in backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev && npm cache clean --force

# Copy compiled backend output
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy compiled frontend SPA static assets into frontend/dist
# The NestJS backend automatically detects and serves static assets from ../frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

# Expose HTTP & WebSocket port
EXPOSE 3000

# Container health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Launch production NestJS server
CMD ["node", "dist/main.js"]
