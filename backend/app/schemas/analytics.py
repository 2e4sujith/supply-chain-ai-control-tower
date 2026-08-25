from pydantic import BaseModel, Field


class AnalyticsOverview(BaseModel):
    total_shipments: int = Field(ge=0)
    active_shipments: int = Field(ge=0)
    high_risk_shipments: int = Field(ge=0)
    on_time_delivery: float = Field(ge=0, le=100)


class RiskDistribution(BaseModel):
    low: int = Field(ge=0)
    medium: int = Field(ge=0)
    high: int = Field(ge=0)
    critical: int = Field(ge=0)


class ActivityPoint(BaseModel):
    timestamp: str
    shipments: int = Field(ge=0)


class PerformanceMetrics(BaseModel):
    average_delay: float = Field(ge=0)
    disruption_frequency: int = Field(ge=0)
    route_performance: float = Field(ge=0, le=100)
