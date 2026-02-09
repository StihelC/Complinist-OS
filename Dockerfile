# CompliFlow Docker Image
# Multi-stage build for smaller final image

# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Production image
FROM node:20-slim AS production

# Install Python for ChromaDB
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install chromadb
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir chromadb

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies and rebuild native modules for Node.js
RUN npm ci --omit=dev && npm rebuild better-sqlite3

# Copy server code
COPY server/ ./server/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Copy static assets
COPY src/assets ./src/assets

# Create data directories
RUN mkdir -p /data/models /data/shared/chroma_db /data/uploads

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV MODELS_DIR=/data/models
ENV CHROMA_DIR=/data/shared/chroma_db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start server
CMD ["node", "server/index.js"]
