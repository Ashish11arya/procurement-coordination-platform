# ==============================================================================
# Multi-Stage Production Dockerfile for Government-Grade Backend (Section 37)
# ==============================================================================

# Stage 1: Build & Compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build essentials for native dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package descriptors first for Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy full application source code
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

# Compile production bundle
RUN npm run build

# Prune devDependencies to keep image size minimal
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for healthcheck probe execution and dumb-init for PID 1 signal forwarding
RUN apk add --no-cache curl dumb-init

ENV NODE_ENV=production
ENV PORT=3000

# Run container as unprivileged non-root node user (Section 19 Security Hardening)
USER node

# Copy production artifacts from builder stage
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Container healthcheck probe (Section 37)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/live || exit 1

EXPOSE 3000

# Use dumb-init to properly handle SIGINT / SIGTERM graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
