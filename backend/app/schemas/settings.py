from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserSettingsBase(BaseModel):
    display_name: str = Field(default="Alex Morgan", max_length=100)
    email: str = Field(default="alex.morgan@supplychain.ai", max_length=120)
    role: str = Field(default="Operations Administrator", max_length=100)
    workspace: str = Field(default="North America Operations", max_length=120)
    email_alerts: bool = Field(default=True)
    daily_digest: bool = Field(default=False)
    compact_density: bool = Field(default=False)
    theme: str = Field(default="dark", max_length=30)


class UserSettingsUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    workspace: Optional[str] = None
    email_alerts: Optional[bool] = None
    daily_digest: Optional[bool] = None
    compact_density: Optional[bool] = None
    theme: Optional[str] = None


class UserSettingsResponse(UserSettingsBase):
    user_id: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
