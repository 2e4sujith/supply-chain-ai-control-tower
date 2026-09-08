import math
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator


RiskTier = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def _coerce_numeric_input(val: Any) -> Optional[float]:
    """Pre-clean numeric inputs from strings, numbers, or nulls."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    if isinstance(val, str):
        cleaned = val.strip()
        if not cleaned or cleaned.lower() in ("null", "none", "nan", "inf", "-inf", "undefined"):
            return None
        is_pct = cleaned.endswith("%")
        cleaned = (
            cleaned.replace("$", "")
            .replace("€", "")
            .replace("£", "")
            .replace("%", "")
            .replace(",", "")
            .strip()
        )
        try:
            f_val = float(cleaned)
            if math.isnan(f_val) or math.isinf(f_val):
                return None
            return f_val / 100.0 if is_pct and f_val > 1.0 else f_val
        except (ValueError, TypeError):
            return None
    return None


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

    # Optional direct DataCo / Order features
    shipping_mode: Optional[str] = None
    days_for_shipment_scheduled: Optional[float] = None
    order_item_product_price: Optional[float] = None
    order_item_quantity: Optional[float] = None
    order_item_discount_rate: Optional[float] = None
    order_item_discount: Optional[float] = None
    order_item_total: Optional[float] = None
    order_profit_per_order: Optional[float] = None
    order_item_profit_ratio: Optional[float] = None
    payment_type: Optional[str] = None
    customer_segment: Optional[str] = None
    department_name: Optional[str] = None
    market: Optional[str] = None
    order_region: Optional[str] = None
    order_date: Optional[str] = None
    order_hour: Optional[float] = None
    order_dayofweek: Optional[float] = None
    order_month: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_input(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)

        # 1. Clean and normalize shipment_id
        if "shipment_id" in d:
            sid = d["shipment_id"]
            if sid is None:
                d["shipment_id"] = None
            elif isinstance(sid, str):
                sid_str = sid.strip()
                if not sid_str:
                    d["shipment_id"] = None
                else:
                    sid_clean = sid_str.upper()
                    if not sid_clean.startswith("SHP-"):
                        if sid_clean.startswith("SHP"):
                            sid_clean = "SHP-" + sid_clean[3:].lstrip("-_ ")
                    d["shipment_id"] = sid_clean

        # 2. Pre-coerce numeric fields
        num_fields = [
            "route_distance_km",
            "planned_duration_hours",
            "elapsed_transit_hours",
            "transit_progress_pct",
            "carrier_reliability_score",
            "origin_port_congestion_index",
            "dest_port_congestion_index",
            "weather_severity_index",
            "customs_inspection_risk",
            "seasonal_disruption_factor",
            "days_for_shipment_scheduled",
            "order_item_product_price",
            "order_item_quantity",
            "order_item_discount_rate",
            "order_item_discount",
            "order_item_total",
            "order_profit_per_order",
            "order_item_profit_ratio",
            "latitude",
            "longitude",
            "order_hour",
            "order_dayofweek",
            "order_month",
        ]
        for field in num_fields:
            if field in d and d[field] is not None:
                d[field] = _coerce_numeric_input(d[field])

        # 3. Normalize progress percentage if passed in [0, 100]
        if d.get("transit_progress_pct") is not None:
            pct = d["transit_progress_pct"]
            if 1.0 < pct <= 100.0:
                d["transit_progress_pct"] = pct / 100.0

        # 4. Clean strings
        for str_field in [
            "origin",
            "destination",
            "transport_mode",
            "origin_region",
            "destination_region",
            "priority_level",
            "shipping_mode",
            "payment_type",
            "customer_segment",
            "department_name",
            "market",
            "order_region",
            "order_date",
        ]:
            if str_field in d and isinstance(d[str_field], str):
                cleaned_str = d[str_field].strip()
                d[str_field] = cleaned_str if cleaned_str else None

        return d


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
    model_name: str = "XGBoost (DataCo Disruption Risk v2.0)"
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


class GNNPredictionResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100)
    risk_probability: float = Field(..., ge=0.0, le=1.0)
    risk_level: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    attribution: dict[str, Any]
    model_info: dict[str, Any]


class DualModelComparisonResponse(BaseModel):
    shipment_id: Optional[str] = None
    origin: str
    destination: str
    category: str
    xgboost: dict[str, Any]
    gnn: dict[str, Any]
    consensus: dict[str, Any]


class ModelBenchmarkMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    pr_auc: float
    confusion_matrix: Optional[dict[str, int]] = None
    mean_latency_ms: Optional[float] = None
    sample_count: Optional[int] = None


class ModelBenchmarkItem(BaseModel):
    architecture: str
    modality: str
    metrics: ModelBenchmarkMetrics
    strengths: Optional[list[str]] = None


class ModelComparisonReportResponse(BaseModel):
    dataset: str
    benchmark_timestamp: str
    test_sample_size: int
    models: dict[str, Any]




