import logging
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine, settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])
system_router = APIRouter(prefix="/system", tags=["system"])


@router.get("/db", summary="Check PostgreSQL connectivity")
def database_health() -> dict[str, str]:
    """Attempt a lightweight PostgreSQL connection without creating tables."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "unavailable",
                "message": "PostgreSQL is unavailable. Start PostgreSQL and verify DATABASE_URL.",
            },
        )
    return {"status": "healthy", "database": "connected"}


@router.get("/readiness", summary="Check application dependency readiness")
def readiness_check() -> dict:
    """Verify that all core subsystems (PostgreSQL, ML model, NetworkX graph) are ready to serve requests."""
    # 1. Database Connectivity
    db_healthy = False
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            db_healthy = True
    except Exception as e:
        logger.warning("Readiness probe DB check failed: %s", e)
        db_healthy = False

    # 2. ML Explainability Engine
    ml_ready = False
    try:
        from app.ml.explainability import get_explainability_service
        svc = get_explainability_service()
        ml_ready = svc is not None and svc.explainer is not None
    except Exception as e:
        logger.warning("Readiness probe ML check failed: %s", e)
        ml_ready = False


    # 3. Route Network Topology
    graph_ready = False
    node_count = 0
    edge_count = 0
    try:
        from app.services.route_service import route_network
        node_count = route_network.graph.number_of_nodes()
        edge_count = route_network.graph.number_of_edges()
        graph_ready = node_count >= 20
    except Exception:
        graph_ready = False

    # 4. Telemetry Providers (Optional - reporting only, does not fail overall readiness)
    telemetry_status = "operational"
    try:
        from app.services.alert_service import external_disruption_service
        h_list = external_disruption_service.get_providers_health()
        providers_active = len(h_list)
    except Exception:
        providers_active = 0

    all_ready = db_healthy and ml_ready and graph_ready

    payload = {
        "status": "ready" if all_ready else "not_ready",
        "environment": settings.ENVIRONMENT,
        "dependencies": {
            "database": {"status": "healthy" if db_healthy else "unavailable", "type": "PostgreSQL"},
            "ml_model": {"status": "loaded" if ml_ready else "unavailable", "model": "XGBoost", "version": "v1.0"},
            "routing_graph": {"status": "ready" if graph_ready else "unavailable", "engine": "NetworkX", "nodes": node_count, "edges": edge_count},
            "telemetry_providers": {"status": telemetry_status, "providers_active": providers_active, "fallback_enabled": settings.ENABLE_MOCK_FALLBACK},
        },
    }

    if not all_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=payload,
        )

    return payload


@system_router.get("/version", summary="Safe application and deployment version information")
def get_system_version() -> dict:
    """Return safe deployment version metadata without exposing infrastructure details."""
    return {
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "api_version": "v1",
        "environment": settings.ENVIRONMENT,
    }


@system_router.get("/config", summary="Safe system configuration & operational status")
def get_system_config() -> dict:
    """Return safe operational configuration and runtime health without leaking any credentials."""
    safe_config = settings.get_safe_system_config()
    
    # Check DB status
    db_ok = False
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False
        
    # Check ML model status
    ml_loaded = False
    try:
        from app.ml.explainability import get_explainability_service
        svc = get_explainability_service()
        ml_loaded = svc is not None
    except Exception:
        ml_loaded = False

    # Provider health status
    provider_health = []
    try:
        from app.services.alert_service import external_disruption_service
        health_list = external_disruption_service.get_providers_health()
        provider_health = [h.model_dump() for h in health_list]
    except Exception:
        pass

    return {
        "status": "operational",
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database_connected": db_ok,
        "ml_model_loaded": ml_loaded,
        "providers_health": provider_health,
        "config": safe_config,
    }


@system_router.get("/metrics", summary="Safe operational performance metrics")
def get_system_metrics() -> dict:
    """Return operational request counters, latencies, ML inference, and routing metrics."""
    from app.core.database import metrics_tracker
    return metrics_tracker.get_metrics_summary()


@system_router.get("/audit", summary="Recent operational decision audit log (bounded)")
def get_audit_log(
    limit: int = 50,
) -> list[dict]:
    """Retrieve recent operational decision audit records (newest first)."""
    from app.core.database import audit_logger
    return audit_logger.get_recent_events(limit=limit)



