"""
Disruption Data API Endpoints.

Provides endpoints to query external weather, port, and traffic disruptions
affecting supply chain nodes and corridors.
"""

from typing import Optional
from fastapi import APIRouter, Query

from app.schemas.disruptions import (
    DisruptionSeverity,
    DisruptionType,
    NormalizedDisruptionEvent,
    ProviderHealthResponse,
)
from app.services.external_data import external_disruption_service

router = APIRouter(prefix="/disruptions", tags=["disruptions"])


@router.get(
    "/active",
    response_model=list[NormalizedDisruptionEvent],
    summary="Retrieve all active normalized disruption events",
)
def get_active_disruptions(
    min_severity: Optional[DisruptionSeverity] = Query(None, description="Filter by minimum severity level"),
) -> list[NormalizedDisruptionEvent]:
    """Return all currently tracked global weather, port, and traffic disruptions."""
    return external_disruption_service.get_active_disruptions(min_severity=min_severity)


@router.get(
    "/location/{location_name}",
    response_model=list[NormalizedDisruptionEvent],
    summary="Retrieve active disruptions affecting a specific location or hub",
)
def get_location_disruptions(
    location_name: str,
    disruption_type: Optional[DisruptionType] = Query(None, description="Optional filter by disruption type"),
) -> list[NormalizedDisruptionEvent]:
    """Query weather, port, and traffic events affecting the specified supply chain node."""
    return external_disruption_service.get_location_disruptions(
        location=location_name,
        disruption_type=disruption_type,
    )


@router.get(
    "/corridor",
    response_model=list[NormalizedDisruptionEvent],
    summary="Retrieve disruptions along a transit corridor between origin and destination",
)
def get_corridor_disruptions(
    origin: str = Query(..., description="Origin location name (e.g. 'Shanghai')"),
    destination: str = Query(..., description="Destination location name (e.g. 'Long_Beach')"),
) -> list[NormalizedDisruptionEvent]:
    """Aggregate all disruption events impacting an origin-destination corridor."""
    return external_disruption_service.get_corridor_disruptions(origin=origin, destination=destination)


@router.get(
    "/providers/health",
    response_model=list[ProviderHealthResponse],
    summary="Check health and configuration status of external disruption providers",
)
def get_providers_health() -> list[ProviderHealthResponse]:
    """Check configuration, API key presence, and connectivity status for all external providers."""
    return external_disruption_service.get_providers_health()
