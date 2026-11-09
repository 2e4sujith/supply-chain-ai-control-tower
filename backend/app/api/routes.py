from fastapi import APIRouter, HTTPException, status

from app.schemas.routes import (
    AlternativeRouteRequest,
    AlternativeRouteResponse,
    RouteGeometryRequest,
    RouteGeometryResponse,
    RouteOptimizationRequest,
    RouteOptimizationResponse,
    WhatIfSimulationRequest,
    WhatIfSimulationResponse,
)
from app.services.route_service import route_service, route_network

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post(
    "/what-if",
    response_model=WhatIfSimulationResponse,
    summary="Simulate What-If logistics scenarios and dynamically recalculate routes and risks",
)
def simulate_what_if(request: WhatIfSimulationRequest) -> dict:
    """Run interactive scenario simulation adjusting transport mode, disruptions, customs, and SLA."""
    try:
        return route_service.simulate_what_if(
            origin=request.origin,
            destination=request.destination,
            shipment_id=request.shipment_id,
            simulated_mode=request.simulated_mode,
            weather_severity=request.weather_severity,
            port_congestion=request.port_congestion,
            customs_risk=request.customs_risk,
            priority_level=request.priority_level,
            sla_days_delta=request.sla_days_delta,
            avoid_nodes=request.avoid_nodes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Scenario simulation failed: {str(e)}")


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


@router.post(
    "/geometry",
    response_model=RouteGeometryResponse,
    summary="Resolve turn-by-turn road geometry from OSRM or precomputed road registry",
)
def get_route_geometry(request: RouteGeometryRequest) -> dict:
    """Return genuine road-following polyline coordinates for any corridor."""
    try:
        from app.routing.road_geometries import get_precomputed_road_geometry
    except Exception:
        get_precomputed_road_geometry = None

    u_norm = route_network._normalize_node_name(request.origin)
    v_norm = route_network._normalize_node_name(request.destination)

    # 1. Check verified precomputed road geometry
    if get_precomputed_road_geometry:
        pre = get_precomputed_road_geometry(u_norm, v_norm)
        if pre and len(pre) >= 2:
            return {
                "coordinates": pre,
                "distance_km": 0.0,
                "duration_hours": 0.0,
                "source": "PRECOMPUTED_OSRM",
            }

    # 2. Dynamic live OSRM resolution if coordinates provided or resolvable
    lat1, lon1 = request.origin_lat, request.origin_lon
    lat2, lon2 = request.dest_lat, request.dest_lon
    if lat1 is None or lon1 is None:
        c1 = route_network.get_node_coordinates(u_norm)
        if c1:
            lat1, lon1 = c1.get("lat"), c1.get("lon")
    if lat2 is None or lon2 is None:
        c2 = route_network.get_node_coordinates(v_norm)
        if c2:
            lat2, lon2 = c2.get("lat"), c2.get("lon")

    if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
        import urllib.request, json, ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SupplyChainControlTower/1.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=4) as res:
                data = json.loads(res.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    r0 = data["routes"][0]
                    coords = [[round(p[1], 5), round(p[0], 5)] for p in r0["geometry"]["coordinates"]]
                    return {
                        "coordinates": coords,
                        "distance_km": round(r0.get("distance", 0) / 1000.0, 1),
                        "duration_hours": round(r0.get("duration", 0) / 3600.0, 2),
                        "source": "LIVE_OSRM",
                    }
        except Exception:
            pass

    # Fallback coordinates
    coords = []
    if lat1 is not None and lon1 is not None:
        coords.append([lat1, lon1])
    if lat2 is not None and lon2 is not None:
        coords.append([lat2, lon2])
    return {
        "coordinates": coords,
        "distance_km": 0.0,
        "duration_hours": 0.0,
        "source": "FALLBACK",
    }


