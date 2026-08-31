from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(60), unique=True, index=True, default="default_user", nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), default="Alex Morgan", nullable=False)
    email: Mapped[str] = mapped_column(String(120), default="alex.morgan@supplychain.ai", nullable=False)
    role: Mapped[str] = mapped_column(String(100), default="Operations Administrator", nullable=False)
    workspace: Mapped[str] = mapped_column(String(120), default="North America Operations", nullable=False)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_digest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    compact_density: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    theme: Mapped[str] = mapped_column(String(30), default="dark", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
