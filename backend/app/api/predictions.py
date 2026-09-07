import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.predictions import PredictionHistoryItem, RiskPredictionRequest, RiskPredictionResponse
from app.services.risk_service import risk_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/risk", response_model=RiskPredictionResponse, summary="Predict shipment risk using XGBoost and SHAP")
def predict_risk(request: RiskPredictionRequest) -> RiskPredictionResponse:
    """Predict shipment disruption probability, risk tier, and SHAP explainability factors using trained XGBoost."""
    try:
        prediction = risk_service.predict_risk(request)
    except Exception as err:
        logger.error(
            "Prediction processing failed for shipment_id=%s: %s",
            request.shipment_id,
            err,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to process shipment risk prediction: {str(err)}",
        )

    if prediction is None:
        if request.shipment_id:
            msg = f"Shipment '{request.shipment_id}' not found. Please provide origin, destination, or route attributes to evaluate unlisted shipments."
        else:
            msg = "Shipment not found and insufficient route attributes provided."
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

    return prediction


@router.get("/history/{shipment_id}", response_model=list[PredictionHistoryItem], summary="Get prediction history for a shipment")
def get_prediction_history(
    shipment_id: str,
    limit: int = Query(default=20, ge=1, le=100, description="Max history records to return"),
) -> list[dict]:
    """Retrieve persistent ML disruption prediction history for a shipment ordered newest first."""
    return risk_service.get_prediction_history(shipment_id=shipment_id, limit=limit)



