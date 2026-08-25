from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.predictions import PredictionHistoryItem, RiskPredictionRequest, RiskPredictionResponse
from app.services.risk_service import risk_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/risk", response_model=RiskPredictionResponse, summary="Predict shipment risk using XGBoost and SHAP")
def predict_risk(request: RiskPredictionRequest) -> RiskPredictionResponse:
    """Predict shipment disruption probability, risk tier, and SHAP explainability factors using trained XGBoost."""
    prediction = risk_service.predict_risk(request)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return prediction


@router.get("/history/{shipment_id}", response_model=list[PredictionHistoryItem], summary="Get prediction history for a shipment")
def get_prediction_history(
    shipment_id: str,
    limit: int = Query(default=20, ge=1, le=100, description="Max history records to return"),
) -> list[dict]:
    """Retrieve persistent ML disruption prediction history for a shipment ordered newest first."""
    return risk_service.get_prediction_history(shipment_id=shipment_id, limit=limit)


