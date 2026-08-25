from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


RiskTier = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class RiskFactor(BaseModel):
    name: str
    severity: RiskTier


class FactorDetail(BaseModel):
    feature: str
    display_name: str
    value: Any
    shap_value: float
    absolute_importance: float
    impact: Literal["INCREASES_RISK", "DECREASES_RISK"]
    magnitude: RiskTier
    severity: RiskTier
    description: str


class RiskPredictionRequest(BaseModel):
    shipment_id: Optional[str] = Field(default=None, pattern=r"^SHP-[A-Z0-9-]+$")
    origin: Optional[str] = None
    destination: Optional[str] = None
    transport_mode: Optional[Literal["Air", "Ocean", "Rail", "Road"]] = None
    origin_region: Optional[Literal["East_Asia", "Europe", "Latin_America", "Middle_East", "North_America", "South_Asia", "Southeast_Asia"]] = None
    destination_region: Optional[Literal["East_Asia", "Europe", "Latin_America", "Middle_East", "North_America", "Oceania", "South_Asia"]] = None
    route_distance_km: Optional[float] = Field(default=None, gt=0)
    planned_duration_hours: Optional[float] = Field(default=None, gt=0)
    elapsed_transit_hours: Optional[float] = Field(default=None, ge=0)
    transit_progress_pct: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    priority_level: Optional[Literal["Standard", "High", "Urgent"]] = None
    carrier_reliability_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    origin_port_congestion_index: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    dest_port_congestion_index: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    weather_severity_index: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    customs_inspection_risk: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    seasonal_disruption_factor: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class DisruptionEventSummary(BaseModel):
    event_id: str
    disruption_type: str
    severity: str
    severity_score: float
    location_name: str
    title: str
    is_mock: bool = False
    source_provider: str


class RiskPredictionResponse(BaseModel):
    shipment_id: Optional[str] = None
    disruption_probability: float = Field(ge=0.0, le=1.0)
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskTier
    top_risk_factors: list[FactorDetail] = []
    protective_factors: list[FactorDetail] = []
    factors: list[RiskFactor] = []  # For backward-compatible clients
    model: str = "XGBoost"
    model_name: str = "XGBoost (Disruption Risk v1.0)"
    base_value: Optional[float] = None
    shap_values: Optional[dict[str, float]] = None

    # Phase 7: Real-Time Disruption Metadata
    external_disruptions_used: bool = False
    weather_events_count: int = 0
    port_events_count: int = 0
    traffic_events_count: int = 0
    data_sources: list[str] = []
    is_mock_fallback_used: bool = False
    applied_disruption_events: list[DisruptionEventSummary] = []


class PredictionHistoryItem(BaseModel):
    id: int
    shipment_id: Optional[str] = None
    disruption_probability: float = Field(ge=0.0, le=1.0)
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskTier
    model_name: str
    prediction_timestamp: str
    top_risk_factors: list[FactorDetail] = []
    protective_factors: list[FactorDetail] = []
    shap_values: Optional[dict[str, float]] = None
    base_value: Optional[float] = None
    raw_input_features: Optional[dict[str, Any]] = None
    external_disruptions_used: Optional[bool] = False
    data_sources: Optional[list[str]] = None



# ============================================================================
# Phase 6: External Disruption Schemas
# ============================================================================

from datetime import datetime, timezone
from enum import Enum


class DisruptionType(str, Enum):
    WEATHER = "WEATHER"
    PORT_CONGESTION = "PORT_CONGESTION"
    TRAFFIC = "TRAFFIC"
    CUSTOMS = "CUSTOMS"
    GEOPOLITICAL = "GEOPOLITICAL"
    INFRASTRUCTURE = "INFRASTRUCTURE"


class DisruptionSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ProviderStatus(str, Enum):
    HEALTHY = "HEALTHY"
    UNCONFIGURED = "UNCONFIGURED"
    DEGRADED = "DEGRADED"
    UNAVAILABLE = "UNAVAILABLE"
    MOCK_ACTIVE = "MOCK_ACTIVE"


class DisruptionLocation(BaseModel):
    name: str = Field(..., description="Hub or location identifier, e.g. 'Shanghai', 'Rotterdam'")
    city: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class NormalizedDisruptionEvent(BaseModel):
    """Unified schema representing a real or simulated disruption event across any provider."""

    event_id: str = Field(..., description="Unique event identifier")
    disruption_type: DisruptionType
    severity: DisruptionSeverity
    severity_score: float = Field(..., ge=0.0, le=100.0, description="Normalized risk index from 0 to 100")
    location: DisruptionLocation
    title: str = Field(..., description="Concise summary title of the disruption")
    description: str = Field(..., description="Detailed description of the operational impact")
    source_provider: str = Field(..., description="Originating provider/data source name")
    is_mock: bool = Field(default=False, description="True if generated by mock/local provider, False if live external API")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: Optional[datetime] = None
    affected_radius_km: Optional[float] = None
    metrics: dict[str, Any] = Field(default_factory=dict, description="Domain-specific metrics (e.g. wind_speed, wait_days)")


class ProviderHealthResponse(BaseModel):
    """Health and connection status of an external disruption data provider."""

    provider_name: str
    provider_type: str
    status: ProviderStatus
    configured: bool
    is_mock: bool
    message: str
    last_checked: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DisruptionQueryRequest(BaseModel):
    location: Optional[str] = None
    disruption_type: Optional[DisruptionType] = None
    min_severity: Optional[DisruptionSeverity] = None



