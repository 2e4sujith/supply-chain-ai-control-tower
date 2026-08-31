from app.repositories.settings_repository import settings_repository
from app.schemas.settings import UserSettingsUpdate


class SettingsService:
    def get_settings(self, user_id: str = "default_user") -> dict:
        return settings_repository.get(user_id)

    def update_settings(self, changes: UserSettingsUpdate, user_id: str = "default_user") -> dict | None:
        updated = settings_repository.update(changes, user_id)
        if updated:
            try:
                from app.api import ws_manager
                ws_manager.publish_event("settings.updated", updated)
            except Exception:
                pass
        return updated


settings_service = SettingsService()
