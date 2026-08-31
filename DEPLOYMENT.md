# SupplyChain AI Control Tower — Production Deployment Guide

This guide details the steps required to deploy, configure, and monitor the **SupplyChain AI Control Tower** platform in production and staging environments.

---

## 1. System Architecture

```
                      [ Client Browser ]
                              │
                    ┌─────────┴─────────┐
                    │                   │ HTTP / WS
                    ▼                   ▼
            [ Frontend (Nginx) ]   [ Reverse Proxy ]
                    │                   │
                    │ /api/             │ /ws
                    └─────────┬─────────┘
                              ▼
                  [ FastAPI Backend (Uvicorn) ]
                    │               │
         ┌──────────┴────────┐      └──────────────┐
         ▼                   ▼                     ▼
[ PostgreSQL 16 ]     [ Redis 7 Cache ]     [ ML / SHAP Engine ]
(Permanent DB)        (Pub/Sub & TTL)       (XGBoost Models)
```

---

## 2. Production Deployment via Docker Compose (Recommended)

To launch the full production stack (PostgreSQL 16, Redis 7, FastAPI Backend, React Frontend via Nginx):

```bash
# 1. Navigate to project root
cd supply-chain

# 2. Copy environment template
cp .env.example .env

# 3. Launch all containers in detached mode
docker compose up -d --build
```

### Verified Production Endpoints:
- **Frontend SPA**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Interactive API Documentation**: `http://localhost:8000/docs`
- **Readiness Health Probe**: `http://localhost:8000/api/health/readiness`
- **WebSocket Streaming Stream**: `ws://localhost:8000/ws`

---

## 3. Local Development Mode

To run in local development mode without modifying or breaking existing services:

### Prerequisites:
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ running on port 5432 (`supply_chain_ai` database)
- Redis 6+ running on port 6379 (e.g. `docker start supply-chain-redis`)

### Step 1: Start Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 2: Start Frontend
```bash
# From project root:
npm run dev
```

---

## 4. Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment (`development` or `production`) |
| `DATABASE_URL` | `postgresql://postgres:postgre1@localhost:5432/supply_chain_ai` | PostgreSQL connection string |
| `REDIS_ENABLED` | `true` | Enable/disable Redis caching layer |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `REDIS_SOCKET_TIMEOUT` | `1.5` | Socket fail-fast timeout in seconds |
| `REDIS_DEFAULT_TTL` | `300` | Default cache TTL in seconds |
| `REDIS_TELEMETRY_TTL` | `60` | Telemetry cache TTL in seconds |
| `REDIS_ROUTE_CACHE_TTL` | `120` | Dijkstra routing cache TTL in seconds |
| `ENABLE_MOCK_FALLBACK` | `true` | Fallback if external disruption APIs offline |
| `EXTERNAL_DATA_TIMEOUT_SECONDS` | `5.0` | Timeout for external provider requests |
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed CORS origins |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Frontend backend API target |
| `VITE_WS_URL` | `ws://127.0.0.1:8000/ws` | Frontend WebSocket streaming target |

---

## 5. Health Monitoring & Observability Probes

The FastAPI backend provides dedicated probes for Kubernetes / Docker container health monitoring:

1. **Liveness Probe**: `GET /api/health`
   - Returns `200 OK` if the web worker is alive.
2. **Database Probe**: `GET /api/health/db`
   - Returns `200 OK` when PostgreSQL connection and tables are verified.
3. **Redis Probe**: `GET /api/health/redis`
   - Returns `200 OK` with cache hit rate and reports whether backend is active `redis` or `in_memory_fallback`.
4. **Readiness Probe**: `GET /api/health/readiness`
   - Evaluates PostgreSQL connectivity, ML model loading status, NetworkX routing graph readiness, and Redis cache.
   - Returns `200 OK` when ready to serve operational traffic, or `503 Service Unavailable` if a critical component fails.
5. **System Config Probe**: `GET /api/system/config`
   - Returns operational configuration with all passwords and secrets fully masked.
