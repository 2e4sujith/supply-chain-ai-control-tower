from fastapi import APIRouter, HTTPException

from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate
from app.services.settings_service import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=UserSettingsResponse)
def get_user_settings() -> dict:
    """Retrieve persistent workspace and profile settings."""
    return settings_service.get_settings()


@router.put("", response_model=UserSettingsResponse)
def update_user_settings(changes: UserSettingsUpdate) -> dict:
    """Update persistent workspace, profile, notification, and display settings."""
    updated = settings_service.update_settings(changes)
    if not updated:
        raise HTTPException(status_code=400, detail="Unable to update settings.")
    return updated
