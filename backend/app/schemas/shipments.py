from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ShipmentStatus = Literal[
    "Booked",
    "Processing",
    "In transit",
    "Delayed",
    "Rerouting",
    "Weather watch",
]
ShipmentRiskLevel = Literal["Low", "Medium", "High", "Critical"]
ShipmentPriority = Literal["Standard", "High", "Urgent"]


class ShipmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    shipment_id: str = Field(min_length=3, max_length=40)
    origin: str = Field(min_length=2, max_length=120)
    destination: str = Field(min_length=2, max_length=120)
    current_location: str = Field(default="", min_length=0, max_length=120)
    status: ShipmentStatus = "Booked"
    risk_score: int = Field(default=10, ge=0, le=100)
    risk_level: ShipmentRiskLevel = "Low"
    eta: str = Field(min_length=2, max_length=80)
    last_updated: str = Field(default="Just now", min_length=2, max_length=80)
    priority: ShipmentPriority = "Standard"
    risk_factors: list[str] = Field(default_factory=lambda: ["New shipment awaiting monitoring"], min_length=1, max_length=10)

    @field_validator("shipment_id", mode="before")
    @classmethod
    def clean_shipment_id(cls, v: str) -> str:
        if not isinstance(v, str):
            v = str(v)
        v = v.strip().upper()
        if v and not v.startswith("SHP-"):
            if v.startswith("SHP"):
                v = "SHP-" + v[3:].lstrip("-_ ")
            else:
                v = f"SHP-{v}"
        return v

    @field_validator("current_location", mode="before")
    @classmethod
    def validate_current_location(cls, v: str, info) -> str:
        if not v or not str(v).strip():
            data = getattr(info, "data", {})
            return data.get("origin", "Origin Port")
        return str(v).strip()

    @field_validator("risk_factors", mode="before")
    @classmethod
    def validate_risk_factors(cls, factors: list[str] | None) -> list[str]:
        if not factors:
            return ["New shipment awaiting monitoring"]
        cleaned = [f.strip() for f in factors if f and str(f).strip()]
        return cleaned or ["New shipment awaiting monitoring"]


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    origin: str | None = Field(default=None, min_length=2, max_length=120)
    destination: str | None = Field(default=None, min_length=2, max_length=120)
    current_location: str | None = Field(default=None, min_length=2, max_length=120)
    status: ShipmentStatus | None = None
    risk_score: int | None = Field(default=None, ge=0, le=100)
    risk_level: ShipmentRiskLevel | None = None
    eta: str | None = Field(default=None, min_length=2, max_length=80)
    last_updated: str | None = Field(default=None, min_length=2, max_length=80)
    priority: ShipmentPriority | None = None
    risk_factors: list[str] | None = Field(default=None, min_length=1, max_length=10)

    @field_validator("risk_factors", mode="before")
    @classmethod
    def validate_risk_factors(cls, factors: list[str] | None) -> list[str] | None:
        if factors is None:
            return None
        cleaned = [f.strip() for f in factors if f and str(f).strip()]
        return cleaned or ["New shipment awaiting monitoring"]


class ShipmentResponse(ShipmentBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


def current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
