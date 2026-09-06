import logging
import os
import time
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from sqlalchemy.exc import SQLAlchemyError

from app.api import alerts, analytics, health as health_api, predictions, routes, settings as settings_api, shipments, websocket_router
from app.core.database import Base, engine, settings, metrics_tracker, audit_logger, request_id_ctx
from app.models import Alert, DisruptionPrediction, Shipment, UserSettings  # noqa: F401

from app.repositories.shipment_repository import shipment_repository
from app.repositories.alert_repository import alert_repository

load_dotenv()

# Configure Structured Production Logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("supply_chain_ai")

openapi_tags = [
    {"name": "health", "description": "Liveness, readiness, and PostgreSQL database connectivity checks."},
    {"name": "system", "description": "Safe operational configuration, deployment version, metrics, and audit logs."},
    {"name": "shipments", "description": "Monitored supply chain freight shipments and tracking operations."},
    {"name": "alerts", "description": "Real-time supply chain operational disruption alerts."},
    {"name": "predictions", "description": "XGBoost ML disruption risk prediction and PureTreeSHAP explainability."},
    {"name": "disruptions", "description": "Real-time weather, port AIS, and highway freight disruption telemetry."},
    {"name": "routes", "description": "NetworkX multimodal logistics network and Dijkstra multi-criteria route optimization."},
    {"name": "analytics", "description": "Supply chain executive KPIs, disruption distributions, and performance metrics."},
]

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Enterprise Supply Chain AI Control Tower API with real-time disruption-aware risk routing, "
        "XGBoost + PureTreeSHAP explainability, and multi-criteria Dijkstra optimization."
    ),
    version=settings.APP_VERSION,
    openapi_tags=openapi_tags,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# Production CORS Hardening
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)



# Request Correlation ID & Latency Tracking Middleware
@app.middleware("http")
async def correlation_and_observability_middleware(request: Request, call_next):
    """Assign/propagate X-Request-ID, measure execution duration, and record observability metrics."""
    incoming_id = request.headers.get("X-Request-ID")
    req_id = incoming_id.strip() if incoming_id and len(incoming_id.strip()) <= 64 else f"req-{uuid.uuid4().hex[:12]}"
    
    token = request_id_ctx.set(req_id)
    request.state.request_id = req_id
    
    t0 = time.time()
    try:
        response = await call_next(request)
        duration_ms = (time.time() - t0) * 1000.0
        response.headers["X-Request-ID"] = req_id
        
        # Production Security Hardening Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Track metrics
        metrics_tracker.record_request(request.method, request.url.path, response.status_code, duration_ms)

        
        logger.info(
            "[%s] %s %s -> Status %s (%.2f ms)",
            req_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
    except Exception as exc:
        duration_ms = (time.time() - t0) * 1000.0
        metrics_tracker.record_request(request.method, request.url.path, 500, duration_ms)
        logger.error(
            "[%s] %s %s -> UNHANDLED SERVER EXCEPTION (%.2f ms): %s",
            req_id,
            request.method,
            request.url.path,
            duration_ms,
            exc,
            exc_info=True,
        )
        raise exc
    finally:
        request_id_ctx.reset(token)


# Global Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle standard HTTP exceptions with consistent JSON response."""
    req_id = getattr(request.state, "request_id", "req-unknown")
    return JSONResponse(
        status_code=exc.status_code,
        headers={"X-Request-ID": req_id},
        content={
            "error": "HTTP_ERROR",
            "request_id": req_id,
            "status_code": exc.status_code,
            "detail": exc.detail,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic request validation errors with clear actionable details."""
    req_id = getattr(request.state, "request_id", "req-unknown")
    logger.warning("[%s] Validation error on %s %s: %s", req_id, request.method, request.url.path, exc.errors())
    
    formatted_errors = []
    error_messages = []
    for err in exc.errors():
        field_path = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body") or "payload"
        msg = err.get("msg", "Invalid value")
        formatted_errors.append({"field": field_path, "message": msg})
        error_messages.append(f"{field_path}: {msg}")
    
    detail_msg = "; ".join(error_messages) if error_messages else "Invalid request payload or parameters."

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        headers={"X-Request-ID": req_id},
        content={
            "error": "VALIDATION_ERROR",
            "request_id": req_id,
            "status_code": 422,
            "detail": detail_msg,
            "errors": formatted_errors,
        },
    )



@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all unexpected error handler to prevent internal tracebacks from leaking to clients."""
    req_id = getattr(request.state, "request_id", "req-unknown")
    logger.error("[%s] Unhandled server exception on %s %s: %s", req_id, request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        headers={"X-Request-ID": req_id},
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "request_id": req_id,
            "status_code": 500,
            "detail": "An unexpected server error occurred. Please contact the system administrator.",
        },
    )



api_router = APIRouter(prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


# Mount API Routers
app.include_router(api_router)
app.include_router(health_api.router, prefix="/api")
app.include_router(health_api.system_router, prefix="/api")
app.include_router(shipments.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(alerts.disruptions_router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(routes.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(websocket_router)



@app.on_event("startup")
def create_database_tables() -> None:
    """Initialize PostgreSQL tables, structured startup logging, and seed demo records."""
    logger.info("================================================================")
    logger.info(" Starting %s v%s in [%s] mode", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)
    logger.info(" Active Database: %s", settings.get_masked_database_url())
    logger.info(" Allowed CORS Origins: %s", settings.CORS_ORIGINS)
    logger.info(" Telemetry Timeouts: %.1fs (Mock Fallback: %s)", settings.TIMEOUT_SECONDS, settings.ENABLE_MOCK_FALLBACK)
    logger.info("================================================================")

    try:
        Base.metadata.create_all(bind=engine)
        seeded_count = shipment_repository.seed_demo_shipments()
        if seeded_count:
            logger.info("Seeded %s demo shipments.", seeded_count)
        alert_seeded_count = alert_repository.seed_demo_alerts()
        if alert_seeded_count:
            logger.info("Seeded %s demo alerts.", alert_seeded_count)
    except SQLAlchemyError as db_err:
        logger.warning("Database initialization warning (verify PostgreSQL connectivity): %s", db_err)

