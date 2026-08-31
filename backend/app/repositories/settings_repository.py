from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models.settings import UserSettings
from app.schemas.settings import UserSettingsUpdate


def serialize_settings(settings: UserSettings) -> dict:
    return {
        "user_id": settings.user_id,
        "display_name": settings.display_name,
        "email": settings.email,
        "role": settings.role,
        "workspace": settings.workspace,
        "email_alerts": settings.email_alerts,
        "daily_digest": settings.daily_digest,
        "compact_density": settings.compact_density,
        "theme": settings.theme,
        "updated_at": settings.updated_at,
    }


class SettingsRepository:
    def get(self, user_id: str = "default_user") -> dict:
        with SessionLocal() as session:
            record = session.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
            if not record:
                # Seed default user settings
                record = UserSettings(
                    user_id=user_id,
                    display_name="Alex Morgan",
                    email="alex.morgan@supplychain.ai",
                    role="Operations Administrator",
                    workspace="North America Operations",
                    email_alerts=True,
                    daily_digest=False,
                    compact_density=False,
                    theme="dark",
                )
                session.add(record)
                session.commit()
                session.refresh(record)
            return serialize_settings(record)

    def update(self, changes: UserSettingsUpdate, user_id: str = "default_user") -> dict | None:
        with SessionLocal() as session:
            record = session.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
            if not record:
                record = UserSettings(user_id=user_id)
                session.add(record)

            data = changes.model_dump(exclude_unset=True)
            for field, value in data.items():
                if hasattr(record, field) and value is not None:
                    setattr(record, field, value)

            session.commit()
            session.refresh(record)
            return serialize_settings(record)


settings_repository = SettingsRepository()
