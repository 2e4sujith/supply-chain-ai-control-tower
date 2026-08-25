from fastapi import APIRouter, HTTPException, status

from app.schemas.routes import (
    AlternativeRouteRequest,
    AlternativeRouteResponse,
    RouteOptimizationRequest,
    RouteOptimizationResponse,
)
from app.services.route_service import route_service, route_network

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post(
    "/alternative",
    response_model=AlternativeRouteResponse,
    summary="Calculate Dijkstra alternative route for a shipment",
)
def find_alternative_route(request: AlternativeRouteRequest) -> dict:
    """Return a real Dijkstra-optimized alternative route for an existing shipment."""
    alternative = route_service.alternative(request.shipment_id, criterion=request.criterion or "risk_adjusted")
    if alternative is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shipment '{request.shipment_id}' not found")
    return alternative


@router.post(
    "/optimize",
    response_model=RouteOptimizationResponse,
    summary="Compute optimal shortest path between any two supply chain locations using Dijkstra",
)
def optimize_route(request: RouteOptimizationRequest) -> dict:
    """Compute the shortest or risk-optimized route between origin and destination."""
    try:
        return route_service.optimize_route(
            origin=request.origin,
            destination=request.destination,
            criterion=request.criterion or "time",
            avoid_nodes=request.avoid_nodes or [],
            ml_risk_score=request.ml_risk_score,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Route calculation failed: {str(e)}")


@router.get("/network", summary="Retrieve global supply chain topology summary")
def get_network_summary() -> dict:
    """Return global logistics network summary metrics and statistics."""
    return route_network.get_network_summary()

