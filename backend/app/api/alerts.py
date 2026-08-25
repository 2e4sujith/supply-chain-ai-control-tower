from fastapi import APIRouter, HTTPException, status

from app.schemas.alerts import AlertCreate, AlertResponse
from app.services.alert_service import alert_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse], summary="List alerts")
def list_alerts() -> list[dict]:
	"""Return all alert records from the PostgreSQL-backed alert repository."""
	return alert_service.list_alerts()


@router.get("/{alert_id}", response_model=AlertResponse, summary="Get an alert")
def get_alert(alert_id: str) -> dict:
	"""Return one alert by its unique alert ID."""
	alert = alert_service.get_alert(alert_id)
	if alert is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
	return alert


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED, summary="Create an alert")
def create_alert(alert: AlertCreate) -> dict:
	"""Create an alert in the PostgreSQL-backed alert repository."""
	created = alert_service.create_alert(alert)
	if created is None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Alert ID already exists")
	return created


@router.put("/{alert_id}/read", response_model=AlertResponse, summary="Mark an alert as read")
def mark_alert_read(alert_id: str) -> dict:
	"""Mark one alert as read and return its updated representation."""
	alert = alert_service.mark_read(alert_id)
	if alert is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
	return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an alert")
def delete_alert(alert_id: str) -> None:
	"""Delete one alert from the PostgreSQL-backed alert repository."""
	if not alert_service.delete_alert(alert_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")


# ============================================================================
# Phase 6: External Disruption API Router & Endpoints
# ============================================================================

from typing import Optional
from fastapi import Query
from app.schemas.predictions import (
	DisruptionSeverity,
	DisruptionType,
	NormalizedDisruptionEvent,
	ProviderHealthResponse,
)
from app.services.alert_service import external_disruption_service

disruptions_router = APIRouter(prefix="/disruptions", tags=["disruptions"])


@disruptions_router.get(
	"/active",
	response_model=list[NormalizedDisruptionEvent],
	summary="Retrieve all active normalized disruption events",
)
def get_active_disruptions(
	min_severity: Optional[DisruptionSeverity] = Query(None, description="Filter by minimum severity level"),
) -> list[NormalizedDisruptionEvent]:
	"""Return all currently tracked global weather, port, and traffic disruptions."""
	return external_disruption_service.get_active_disruptions(min_severity=min_severity)


@disruptions_router.get(
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


@disruptions_router.get(
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


@disruptions_router.get(
	"/providers/health",
	response_model=list[ProviderHealthResponse],
	summary="Check health and configuration status of external disruption providers",
)
def get_providers_health() -> list[ProviderHealthResponse]:
	"""Check configuration, API key presence, and connectivity status for all external providers."""
	return external_disruption_service.get_providers_health()

