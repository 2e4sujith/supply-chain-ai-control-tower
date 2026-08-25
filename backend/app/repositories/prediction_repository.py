"""Repository for persistent DisruptionPrediction records."""

from datetime import datetime
from typing import Any, Optional
from sqlalchemy import desc, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models.prediction import DisruptionPrediction
from app.models.shipment import Shipment


def serialize_prediction(prediction: DisruptionPrediction) -> dict:
    return {
        "id": prediction.id,
        "shipment_id": prediction.shipment_id,
        "disruption_probability": prediction.disruption_probability,
        "risk_score": prediction.risk_score,
        "risk_level": prediction.risk_level,
        "model_name": prediction.model_name,
        "prediction_timestamp": prediction.prediction_timestamp.isoformat() if prediction.prediction_timestamp else datetime.utcnow().isoformat(),
        "top_risk_factors": prediction.top_risk_factors or [],
        "protective_factors": prediction.protective_factors or [],
        "shap_values": prediction.shap_values,
        "base_value": prediction.base_value,
        "raw_input_features": prediction.raw_input_features,
    }


class PredictionRepository:
    def create(
        self,
        disruption_probability: float,
        risk_score: int,
        risk_level: str,
        model_name: str,
        shipment_id: Optional[str] = None,
        top_risk_factors: Optional[list[dict[str, Any]]] = None,
        protective_factors: Optional[list[dict[str, Any]]] = None,
        shap_values: Optional[dict[str, float]] = None,
        base_value: Optional[float] = None,
        raw_input_features: Optional[dict[str, Any]] = None,
    ) -> dict:
        valid_shipment_id = None
        with SessionLocal() as session:
            if shipment_id:
                exists = session.scalar(select(Shipment.shipment_id).where(Shipment.shipment_id == shipment_id))
                if exists:
                    valid_shipment_id = shipment_id

            item = DisruptionPrediction(
                shipment_id=valid_shipment_id,
                disruption_probability=disruption_probability,
                risk_score=risk_score,
                risk_level=risk_level,
                model_name=model_name,
                prediction_timestamp=datetime.utcnow(),
                top_risk_factors=top_risk_factors or [],
                protective_factors=protective_factors or [],
                shap_values=shap_values,
                base_value=base_value,
                raw_input_features=raw_input_features,
            )
            session.add(item)
            try:
                session.commit()
                session.refresh(item)
                return serialize_prediction(item)
            except SQLAlchemyError:
                session.rollback()
                raise

    def get_by_shipment_id(self, shipment_id: str, limit: int = 50) -> list[dict]:
        with SessionLocal() as session:
            stmt = (
                select(DisruptionPrediction)
                .where(DisruptionPrediction.shipment_id == shipment_id)
                .order_by(desc(DisruptionPrediction.prediction_timestamp), desc(DisruptionPrediction.id))
                .limit(limit)
            )
            records = session.scalars(stmt).all()
            return [serialize_prediction(r) for r in records]

    def list_recent(self, limit: int = 50) -> list[dict]:
        with SessionLocal() as session:
            stmt = (
                select(DisruptionPrediction)
                .order_by(desc(DisruptionPrediction.prediction_timestamp), desc(DisruptionPrediction.id))
                .limit(limit)
            )
            records = session.scalars(stmt).all()
            return [serialize_prediction(r) for r in records]


prediction_repository = PredictionRepository()
