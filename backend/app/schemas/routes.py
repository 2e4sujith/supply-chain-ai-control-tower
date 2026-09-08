from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

RouteCriterion = Literal["time", "distance", "risk_adjusted"]


class RouteSegmentDetail(BaseModel):
    origin: str
    destination: str
    distance_km: float = Field(ge=0.0)
    base_time_hours: float = Field(ge=0.0)
    mode: str
    corridor_name: str
    status: str = "Active"
    risk_weight: float = Field(default=1.0, ge=0.0)
    effective_cost: Optional[float] = None


class AlternativeRouteRequest(BaseModel):
    shipment_id: str = Field(min_length=3, max_length=40, pattern=r"^SHP-[A-Z0-9-]+$")
    criterion: Optional[RouteCriterion] = "risk_adjusted"


class AlternativeRouteResponse(BaseModel):
    shipment_id: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    current_route: list[str] = Field(min_length=2)
    recommended_route: list[str] = Field(min_length=2)
    total_distance_km: Optional[float] = None
    estimated_time_hours: Optional[float] = None
    total_cost: Optional[float] = None
    average_risk_weight: Optional[float] = None
    route_risk_level: Optional[str] = None
    transport_modes: Optional[list[str]] = None
    segments: Optional[list[dict[str, Any]]] = None
    reason: str
    algorithm: str = "NETWORKX_DIJKSTRA"
    route_geometry: list[list[float]] = Field(default_factory=list)

    # Phase 7: Real-Time Risk & Disruption Routing Decision Metadata
    ml_risk_score: Optional[int] = None
    ml_risk_level: Optional[str] = None
    external_disruptions_considered: bool = True
    weather_disruption_count: int = 0
    port_disruption_count: int = 0
    traffic_disruption_count: int = 0
    route_risk_before: Optional[float] = None
    route_risk_after: Optional[float] = None
    dynamic_risk_penalty: Optional[float] = None
    is_strictly_safer: bool = False
    risk_reduction: float = 0.0
    decision_reason: Optional[str] = None
    data_sources: list[str] = []
    is_mock_fallback_used: bool = False



class RouteOptimizationRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=50)
    destination: str = Field(min_length=2, max_length=50)
    criterion: Optional[RouteCriterion] = "time"
    avoid_nodes: Optional[list[str]] = Field(default_factory=list)
    ml_risk_score: Optional[int] = Field(default=None, ge=0, le=100)



class RouteOptimizationResponse(BaseModel):
    origin: str
    destination: str
    path: list[str] = Field(min_length=2)
    criterion: str = "time"
    total_distance_km: float
    estimated_time_hours: float
    total_cost: float
    transport_modes: list[str]
    average_risk_weight: float = 1.0
    max_segment_risk_weight: float = 1.0
    route_risk_level: str = "LOW"
    reason: Optional[str] = None
    segments: list[RouteSegmentDetail]
    algorithm: str = "NETWORKX_DIJKSTRA"
    route_geometry: list[list[float]] = Field(default_factory=list)

    # Phase 7: Real-Time Risk Decision Metadata
    ml_risk_score: Optional[int] = None
    ml_risk_level: Optional[str] = None
    external_disruptions_considered: bool = True
    weather_disruption_count: int = 0
    port_disruption_count: int = 0
    traffic_disruption_count: int = 0
    route_risk_before: Optional[float] = None
    route_risk_after: Optional[float] = None
    dynamic_risk_penalty: Optional[float] = None
    decision_reason: Optional[str] = None
    data_sources: list[str] = []
    is_mock_fallback_used: bool = False


class WhatIfSimulationRequest(BaseModel):
    shipment_id: Optional[str] = Field(default=None, pattern=r"^SHP-[A-Z0-9-]+$")
    origin: Optional[str] = None
    destination: Optional[str] = None
    simulated_mode: Optional[Literal["Road", "Rail", "Air", "Ocean"]] = None
    weather_severity: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    port_congestion: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    customs_risk: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    priority_level: Optional[Literal["Standard", "High", "Urgent"]] = None
    sla_days_delta: Optional[float] = Field(default=0.0, ge=-5.0, le=10.0)
    avoid_nodes: Optional[list[str]] = Field(default_factory=list)


class RouteScenarioSummary(BaseModel):
    path: list[str]
    total_distance_km: float
    estimated_time_hours: float
    transport_modes: list[str]
    fused_risk_score: int
    fused_risk_tier: str
    gnn_risk_score: int
    xgboost_risk_score: int
    effective_cost: float
    route_geometry: list[list[float]] = Field(default_factory=list)


class WhatIfSimulationResponse(BaseModel):
    shipment_id: Optional[str] = None
    origin: str
    destination: str
    baseline: RouteScenarioSummary
    simulated: RouteScenarioSummary
    delta: dict[str, Any]
    feasibility_status: str
    recommendation: str
    parameter_adjustments: dict[str, Any]




