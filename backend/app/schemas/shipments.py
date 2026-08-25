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
    model_config = ConfigDict(str_strip_whitespace=True)

    shipment_id: str = Field(min_length=3, max_length=40, pattern=r"^SHP-[A-Z0-9-]+$")
    origin: str = Field(min_length=2, max_length=120)
    destination: str = Field(min_length=2, max_length=120)
    current_location: str = Field(min_length=2, max_length=120)
    status: ShipmentStatus
    risk_score: int = Field(ge=0, le=100)
    risk_level: ShipmentRiskLevel
    eta: str = Field(min_length=3, max_length=80)
    last_updated: str = Field(min_length=3, max_length=80)
    priority: ShipmentPriority
    risk_factors: list[str] = Field(min_length=1, max_length=10)

    @field_validator("risk_factors")
    @classmethod
    def validate_risk_factors(cls, factors: list[str]) -> list[str]:
        if any(not factor.strip() for factor in factors):
            raise ValueError("risk_factors cannot contain blank values")
        return factors


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    origin: str | None = Field(default=None, min_length=2, max_length=120)
    destination: str | None = Field(default=None, min_length=2, max_length=120)
    current_location: str | None = Field(default=None, min_length=2, max_length=120)
    status: ShipmentStatus | None = None
    risk_score: int | None = Field(default=None, ge=0, le=100)
    risk_level: ShipmentRiskLevel | None = None
    eta: str | None = Field(default=None, min_length=3, max_length=80)
    last_updated: str | None = Field(default=None, min_length=3, max_length=80)
    priority: ShipmentPriority | None = None
    risk_factors: list[str] | None = Field(default=None, min_length=1, max_length=10)

    @field_validator("risk_factors")
    @classmethod
    def validate_risk_factors(cls, factors: list[str] | None) -> list[str] | None:
        if factors is not None and any(not factor.strip() for factor in factors):
            raise ValueError("risk_factors cannot contain blank values")
        return factors


class ShipmentResponse(ShipmentBase):
    model_config = ConfigDict(from_attributes=True)


def current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
