"""SQLAlchemy model for persistent ML disruption predictions."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DisruptionPrediction(Base):
    __tablename__ = "disruption_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    shipment_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("shipments.shipment_id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    disruption_probability: Mapped[float] = mapped_column(Float, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prediction_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    top_risk_factors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    protective_factors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    shap_values: Mapped[Optional[dict[str, float]]] = mapped_column(JSONB, nullable=True)
    base_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_input_features: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    shipment: Mapped[Optional["Shipment"]] = relationship(back_populates="predictions")
