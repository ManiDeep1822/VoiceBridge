# ==========================================
# Stage 1: Build React Production Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python Production ASGI Runtime
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system utilities and audio dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy compiled frontend SPA bundle into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend application source
COPY backend/ ./backend/

# Expose default port
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:socket_app --host 0.0.0.0 --port ${PORT:-8000}"]
