from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AlertSeverity = Literal["CRITICAL", "HIGH", "MEDIUM", "INFORMATION"]
AlertType = Literal["Weather", "Traffic", "Shipment Risk", "Delay", "Route", "Operational"]


class AlertBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    alert_id: str = Field(min_length=3, max_length=40, pattern=r"^ALT-[A-Z0-9-]+$")
    shipment_id: str = Field(min_length=3, max_length=40, pattern=r"^SHP-[A-Z0-9-]+$")
    severity: AlertSeverity
    type: AlertType
    title: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=3, max_length=500)
    recommended_action: str = Field(min_length=3, max_length=250)
    timestamp: str = Field(min_length=3, max_length=80)
    read: bool = False

    @field_validator("alert_id", "shipment_id")
    @classmethod
    def normalize_identifiers(cls, value: str) -> str:
        return value.upper()


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    model_config = ConfigDict(from_attributes=True)
