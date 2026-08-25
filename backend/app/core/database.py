import os
import logging
from typing import List, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

logger = logging.getLogger(__name__)


class Settings(BaseModel):
    # Application Info
    APP_NAME: str = "SupplyChain AI Control Tower"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ["true", "1", "yes"]
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgre1@localhost:5432/supply_chain_ai",
    )

    # CORS
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            os.getenv("FRONTEND_URL", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
        ).split(",")
        if origin.strip()
    ])

    # Network / Provider Timeouts
    TIMEOUT_SECONDS: float = float(os.getenv("EXTERNAL_DATA_TIMEOUT_SECONDS", "5.0"))
    ENABLE_MOCK_FALLBACK: bool = os.getenv("ENABLE_MOCK_FALLBACK", "true").lower() in ["true", "1", "yes"]

    # External Provider Credentials (Optional)
    WEATHER_PROVIDER: str = os.getenv("WEATHER_PROVIDER", "open-meteo")
    WEATHER_API_KEY: Optional[str] = os.getenv("WEATHER_API_KEY")
    WEATHER_API_URL: str = os.getenv("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast")

    PORT_PROVIDER: str = os.getenv("PORT_PROVIDER", "portwatch")
    PORT_API_KEY: Optional[str] = os.getenv("PORT_API_KEY")
    PORT_API_URL: str = os.getenv("PORT_API_URL", "https://portwatch.imf.org/api/v1")

    TRAFFIC_PROVIDER: str = os.getenv("TRAFFIC_PROVIDER", "openfreight")
    TRAFFIC_API_KEY: Optional[str] = os.getenv("TRAFFIC_API_KEY")
    TRAFFIC_API_URL: str = os.getenv("TRAFFIC_API_URL", "https://api.openfreight.org/v1")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    def get_masked_database_url(self) -> str:
        """Return database URL with password safely masked for logs and diagnostics."""
        try:
            parsed = urlparse(self.DATABASE_URL)
            if parsed.password:
                masked_netloc = f"{parsed.username}:*****@{parsed.hostname}:{parsed.port}"
                return parsed._replace(netloc=masked_netloc).geturl()
            return self.DATABASE_URL
        except Exception:
            return "postgresql://***:***@localhost:5432/supply_chain_ai"

    def get_safe_system_config(self) -> dict:
        """Return safe operational configuration metadata with zero exposed secrets."""
        return {
            "app_name": self.APP_NAME,
            "app_version": self.APP_VERSION,
            "environment": self.ENVIRONMENT,
            "debug": self.DEBUG,
            "cors_origins": self.CORS_ORIGINS,
            "timeout_seconds": self.TIMEOUT_SECONDS,
            "enable_mock_fallback": self.ENABLE_MOCK_FALLBACK,
            "providers": {
                "weather": {
                    "provider": self.WEATHER_PROVIDER,
                    "has_key": bool(self.WEATHER_API_KEY),
                    "url": self.WEATHER_API_URL,
                },
                "port": {
                    "provider": self.PORT_PROVIDER,
                    "has_key": bool(self.PORT_API_KEY),
                    "url": self.PORT_API_URL,
                },
                "traffic": {
                    "provider": self.TRAFFIC_PROVIDER,
                    "has_key": bool(self.TRAFFIC_API_KEY),
                    "url": self.TRAFFIC_API_URL,
                },
            },
            "database": {
                "configured": bool(self.DATABASE_URL),
                "masked_url": self.get_masked_database_url(),
            },
        }


settings = Settings()

DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from collections import deque
import contextvars
from datetime import datetime, timezone
import threading
import time
from typing import Any

# Context variable for request correlation tracking
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="sys-init")


class MetricsTracker:
    """Thread-safe, lightweight in-memory metrics aggregator."""

    def __init__(self):
        self._lock = threading.Lock()
        self.start_time = time.time()
        self.total_requests = 0
        self.successful_requests = 0  # 2xx / 3xx
        self.client_errors = 0       # 4xx
        self.server_errors = 0       # 5xx
        self.total_latency_ms = 0.0

        # Endpoint latency statistics: { "METHOD /path": { count, total_ms, max_ms } }
        self.endpoint_stats: dict[str, dict[str, Any]] = {}

        # ML Prediction metrics
        self.ml_predictions_total = 0
        self.ml_predictions_successful = 0
        self.ml_predictions_failed = 0
        self.ml_total_latency_ms = 0.0
        self.last_prediction_time: Optional[str] = None

        # Route Optimization metrics
        self.route_optimizations_total = 0
        self.route_optimizations_successful = 0
        self.route_optimizations_failed = 0
        self.route_total_latency_ms = 0.0
        self.route_criteria_counts = {"risk_adjusted": 0, "time": 0, "distance": 0}
        self.last_optimization_time: Optional[str] = None

        # Disruption Provider metrics
        self.provider_stats = {
            "WEATHER": {"calls": 0, "success": 0, "failures": 0, "fallbacks": 0, "total_ms": 0.0, "last_call": None},
            "PORT_CONGESTION": {"calls": 0, "success": 0, "failures": 0, "fallbacks": 0, "total_ms": 0.0, "last_call": None},
            "TRAFFIC": {"calls": 0, "success": 0, "failures": 0, "fallbacks": 0, "total_ms": 0.0, "last_call": None},
        }

    def record_request(self, method: str, path: str, status_code: int, duration_ms: float) -> None:
        """Record an incoming HTTP request and update counters."""
        with self._lock:
            self.total_requests += 1
            self.total_latency_ms += duration_ms

            if 200 <= status_code < 400:
                self.successful_requests += 1
            elif 400 <= status_code < 500:
                self.client_errors += 1
            elif status_code >= 500:
                self.server_errors += 1

            # Sanitize path to prevent high-cardinality noise
            clean_path = path.split("?")[0]
            if "/shipments/SHP-" in clean_path:
                clean_path = "/api/shipments/{shipment_id}"
            elif "/predictions/history/SHP-" in clean_path:
                clean_path = "/api/predictions/history/{shipment_id}"
            elif "/alerts/ALT-" in clean_path:
                clean_path = "/api/alerts/{alert_id}"

            key = f"{method.upper()} {clean_path}"
            if key not in self.endpoint_stats:
                self.endpoint_stats[key] = {"count": 0, "total_ms": 0.0, "max_ms": 0.0}
            
            stat = self.endpoint_stats[key]
            stat["count"] += 1
            stat["total_ms"] += duration_ms
            if duration_ms > stat["max_ms"]:
                stat["max_ms"] = duration_ms

    def record_prediction(self, success: bool, duration_ms: float, risk_score: Optional[int] = None) -> None:
        """Record an ML risk prediction execution."""
        with self._lock:
            self.ml_predictions_total += 1
            self.ml_total_latency_ms += duration_ms
            if success:
                self.ml_predictions_successful += 1
            else:
                self.ml_predictions_failed += 1
            self.last_prediction_time = datetime.now(timezone.utc).isoformat()

    def record_routing(self, criterion: str, success: bool, duration_ms: float) -> None:
        """Record a Dijkstra route optimization execution."""
        with self._lock:
            self.route_optimizations_total += 1
            self.route_total_latency_ms += duration_ms
            if success:
                self.route_optimizations_successful += 1
            else:
                self.route_optimizations_failed += 1
            
            crit_key = criterion.lower() if criterion else "risk_adjusted"
            if crit_key in self.route_criteria_counts:
                self.route_criteria_counts[crit_key] += 1
            else:
                self.route_criteria_counts[crit_key] = 1

            self.last_optimization_time = datetime.now(timezone.utc).isoformat()

    def record_provider_call(self, provider_type: str, success: bool, is_fallback: bool, duration_ms: float) -> None:
        """Record an external disruption telemetry provider call."""
        with self._lock:
            p_key = provider_type.upper()
            if p_key not in self.provider_stats:
                self.provider_stats[p_key] = {"calls": 0, "success": 0, "failures": 0, "fallbacks": 0, "total_ms": 0.0, "last_call": None}
            
            stat = self.provider_stats[p_key]
            stat["calls"] += 1
            stat["total_ms"] += duration_ms
            if success:
                stat["success"] += 1
            else:
                stat["failures"] += 1
            if is_fallback:
                stat["fallbacks"] += 1
            stat["last_call"] = datetime.now(timezone.utc).isoformat()

    def get_metrics_summary(self) -> dict:
        """Return safe, operational observability metrics."""
        with self._lock:
            uptime_seconds = round(time.time() - self.start_time, 2)
            avg_req_latency = round(self.total_latency_ms / self.total_requests, 2) if self.total_requests > 0 else 0.0
            avg_ml_latency = round(self.ml_total_latency_ms / self.ml_predictions_total, 2) if self.ml_predictions_total > 0 else 0.0
            avg_route_latency = round(self.route_total_latency_ms / self.route_optimizations_total, 2) if self.route_optimizations_total > 0 else 0.0

            formatted_endpoints = {}
            for k, v in self.endpoint_stats.items():
                formatted_endpoints[k] = {
                    "count": v["count"],
                    "avg_latency_ms": round(v["total_ms"] / v["count"], 2) if v["count"] > 0 else 0.0,
                    "max_latency_ms": round(v["max_ms"], 2),
                }

            return {
                "status": "operational",
                "uptime_seconds": uptime_seconds,
                "requests": {
                    "total": self.total_requests,
                    "successful": self.successful_requests,
                    "client_errors_4xx": self.client_errors,
                    "server_errors_5xx": self.server_errors,
                    "avg_latency_ms": avg_req_latency,
                },
                "ml_inference": {
                    "total_predictions": self.ml_predictions_total,
                    "successful": self.ml_predictions_successful,
                    "failed": self.ml_predictions_failed,
                    "avg_latency_ms": avg_ml_latency,
                    "last_prediction_time": self.last_prediction_time,
                },
                "route_optimization": {
                    "total_optimizations": self.route_optimizations_total,
                    "successful": self.route_optimizations_successful,
                    "failed": self.route_optimizations_failed,
                    "avg_latency_ms": avg_route_latency,
                    "criteria_breakdown": self.route_criteria_counts,
                    "last_optimization_time": self.last_optimization_time,
                },
                "telemetry_providers": self.provider_stats,
                "endpoints": formatted_endpoints,
            }


class AuditLogger:
    """Thread-safe, bounded in-memory audit log for operational decisions."""

    def __init__(self, max_events: int = 500):
        self._lock = threading.Lock()
        self.events: deque[dict[str, Any]] = deque(maxlen=max_events)

    def record_event(
        self,
        event_type: str,
        request_id: Optional[str] = None,
        shipment_id: Optional[str] = None,
        risk_score: Optional[int] = None,
        criterion: Optional[str] = None,
        outcome: str = "SUCCESS",
        details: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Record an operational audit event into the bounded ring buffer."""
        curr_req_id = request_id or request_id_ctx.get()
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": curr_req_id,
            "event_type": event_type,
            "shipment_id": shipment_id,
            "risk_score": risk_score,
            "criterion": criterion,
            "outcome": outcome,
            "details": details or {},
        }
        with self._lock:
            self.events.append(entry)
        return entry

    def get_recent_events(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieve recent audit events ordered newest first."""
        with self._lock:
            items = list(self.events)
        items.reverse()
        return items[:limit]

    def clear(self) -> None:
        """Clear audit history (for testing)."""
        with self._lock:
            self.events.clear()


metrics_tracker = MetricsTracker()
audit_logger = AuditLogger(max_events=500)


