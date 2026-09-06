import logging
import time
from pathlib import Path
from typing import Any, Optional

from app.ml.explainability import get_explainability_service
from app.repositories.prediction_repository import prediction_repository
from app.schemas.predictions import (
    DisruptionEventSummary,
    DisruptionSeverity,
    DisruptionType,
    FactorDetail,
    RiskFactor,
    RiskPredictionRequest,
    RiskPredictionResponse,
)
from app.services.alert_service import external_disruption_service
from app.services.shipment_service import shipment_service

logger = logging.getLogger(__name__)

# DataCo Regional and Market mapping dictionaries
REGION_KEYWORDS = {
    "Eastern Asia": ["shanghai", "ningbo", "shenzhen", "hong kong", "tokyo", "busan", "china", "japan", "korea", "yantian", "qingdao"],
    "South Asia": ["mumbai", "chennai", "colombo", "nhava sheva", "karachi", "india", "pakistan", "sri lanka", "delhi"],
    "Southeast Asia": ["singapore", "bangkok", "jakarta", "klang", "vietnam", "ho chi minh", "malaysia", "indonesia", "thailand"],
    "Western Europe": ["rotterdam", "hamburg", "antwerp", "germany", "france", "netherlands", "le havre", "belgium"],
    "Northern Europe": ["felixstowe", "uk", "london", "sweden", "norway", "denmark", "southampton"],
    "Southern Europe": ["valencia", "genoa", "barcelona", "italy", "spain", "greece", "piraeus"],
    "West of USA ": ["los angeles", "long beach", "seattle", "oakland", "san francisco", "california", "washington", "vancouver"],
    "East of USA": ["new york", "savannah", "charleston", "norfolk", "miami", "new jersey", "georgia"],
    "US Center ": ["chicago", "dallas", "houston", "memphis", "atlanta", "illinois", "texas"],
    "Central America": ["panama", "mexico", "costa rica", "guatemala", "monterrey", "honduras"],
    "South America": ["santos", "buenos aires", "callao", "brazil", "chile", "peru", "colombia", "cartagena", "valparaiso"],
    "Middle East": ["dubai", "jebel ali", "dammam", "salalah", "uae", "saudi", "doha", "qatar", "oman", "suez"],
    "Oceania": ["sydney", "melbourne", "auckland", "australia", "new zealand", "brisbane", "fremantle"],
}

MARKET_MAPPING = {
    "Eastern Asia": "Pacific Asia",
    "South Asia": "Pacific Asia",
    "Southeast Asia": "Pacific Asia",
    "Oceania": "Pacific Asia",
    "Western Europe": "Europe",
    "Northern Europe": "Europe",
    "Southern Europe": "Europe",
    "West of USA ": "USCA",
    "East of USA": "USCA",
    "US Center ": "USCA",
    "Central America": "LATAM",
    "South America": "LATAM",
    "Middle East": "Africa",
}


def _infer_dataco_region(location_text: str, default: str = "Eastern Asia") -> str:
    loc_lower = (location_text or "").lower()
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in loc_lower for kw in keywords):
            return region
    return default


def _infer_dataco_market(region: str) -> str:
    return MARKET_MAPPING.get(region, "Pacific Asia")


def _infer_shipping_mode(priority: str) -> tuple[str, float]:
    p = (priority or "Standard").capitalize()
    if p == "Urgent":
        return "First Class", 1.0
    elif p == "High":
        return "Second Class", 2.0
    return "Standard Class", 4.0


class RiskService:
    """Production risk prediction service powered by trained DataCo XGBoost model, SHAP explainability, and real-time disruption data."""

    def __init__(self, models_dir: Optional[Path] = None):
        self.models_dir = models_dir
        self._ml_service = None

    def _get_ml_service(self):
        if self._ml_service is None:
            try:
                self._ml_service = get_explainability_service(self.models_dir)
            except Exception as e:
                logger.warning("Could not initialize ML service: %s. Will use fallback.", e)
        return self._ml_service

    def predict_risk(self, request: RiskPredictionRequest) -> Optional[RiskPredictionResponse]:
        """Perform real DataCo XGBoost disruption prediction with SHAP explainability and real-time disruption telemetry."""
        db_shipment = None
        if request.shipment_id:
            db_shipment = shipment_service.get_shipment(request.shipment_id)
            if db_shipment is None and not any([
                request.origin, request.destination,
                request.transport_mode, request.origin_region, request.destination_region,
                request.weather_severity_index, request.origin_port_congestion_index
            ]):
                return None

        features, disruption_meta = self._build_feature_dict(request, db_shipment)
        ml_service = self._get_ml_service()
        t0 = time.time()

        if ml_service is not None:
            try:
                explanation = ml_service.explain_shipment(features, top_n=5)
                duration_ms = (time.time() - t0) * 1000.0
                
                top_risk_factors = [
                    FactorDetail(
                        feature=f["feature"],
                        display_name=f["display_name"],
                        value=f["value"],
                        shap_value=f["shap_value"],
                        absolute_importance=f["absolute_importance"],
                        impact=f["impact"],
                        magnitude=f["magnitude"],
                        severity=f["magnitude"],
                        description=f["description"],
                    )
                    for f in explanation["top_risk_factors"]
                ]

                protective_factors = [
                    FactorDetail(
                        feature=f["feature"],
                        display_name=f["display_name"],
                        value=f["value"],
                        shap_value=f["shap_value"],
                        absolute_importance=f["absolute_importance"],
                        impact=f["impact"],
                        magnitude=f["magnitude"],
                        severity=f["magnitude"],
                        description=f["description"],
                    )
                    for f in explanation["top_protective_factors"]
                ]

                compat_factors = [
                    RiskFactor(name=f.display_name, severity=f.severity)
                    for f in top_risk_factors[:3]
                ]
                if not compat_factors and protective_factors:
                    compat_factors = [
                        RiskFactor(name=protective_factors[0].display_name, severity="LOW")
                    ]

                resolved_shipment_id = request.shipment_id or (db_shipment["shipment_id"] if db_shipment else None)

                # Persist prediction to PostgreSQL
                try:
                    prediction_repository.create(
                        disruption_probability=explanation["predicted_probability"],
                        risk_score=explanation["risk_score"],
                        risk_level=explanation["risk_level"],
                        model_name="XGBoost (DataCo Disruption Risk v2.0)",
                        shipment_id=resolved_shipment_id,
                        top_risk_factors=[f.model_dump() for f in top_risk_factors],
                        protective_factors=[f.model_dump() for f in protective_factors],
                        shap_values=explanation.get("shap_values"),
                        base_value=explanation.get("base_value"),
                        raw_input_features=features,
                    )
                except Exception as save_err:
                    logger.warning("Could not persist prediction to PostgreSQL: %s", save_err)

                # Observability & Audit Logging
                try:
                    from app.core.database import audit_logger, metrics_tracker
                    metrics_tracker.record_prediction(success=True, duration_ms=duration_ms, risk_score=explanation["risk_score"])
                    audit_logger.record_event(
                        event_type="RISK_PREDICTION",
                        shipment_id=resolved_shipment_id,
                        risk_score=explanation["risk_score"],
                        outcome="SUCCESS",
                        details={"risk_level": explanation["risk_level"], "duration_ms": round(duration_ms, 2)},
                    )
                except Exception:
                    pass

                # Broadcast WebSocket risk.updated event
                try:
                    from app.api import ws_manager
                    ws_manager.publish_event("risk.updated", {
                        "shipment_id": resolved_shipment_id,
                        "disruption_probability": explanation["predicted_probability"],
                        "risk_score": explanation["risk_score"],
                        "risk_level": explanation["risk_level"],
                        "top_risk_factors": [f.model_dump() for f in top_risk_factors],
                        "model": "XGBoost",
                    })
                except Exception:
                    pass

                return RiskPredictionResponse(
                    shipment_id=resolved_shipment_id,
                    disruption_probability=explanation["predicted_probability"],
                    risk_score=explanation["risk_score"],
                    risk_level=explanation["risk_level"],
                    top_risk_factors=top_risk_factors,
                    protective_factors=protective_factors,
                    factors=compat_factors,
                    model="XGBoost",
                    model_name="XGBoost (DataCo Disruption Risk v2.0)",
                    base_value=explanation.get("base_value"),
                    shap_values=explanation.get("shap_values"),
                    external_disruptions_used=disruption_meta["external_disruptions_used"],
                    weather_events_count=disruption_meta["weather_events_count"],
                    port_events_count=disruption_meta["port_events_count"],
                    traffic_events_count=disruption_meta["traffic_events_count"],
                    data_sources=disruption_meta["data_sources"],
                    is_mock_fallback_used=disruption_meta["is_mock_fallback_used"],
                    applied_disruption_events=disruption_meta["applied_disruption_events"],
                )
            except Exception as e:
                duration_ms = (time.time() - t0) * 1000.0
                try:
                    from app.core.database import audit_logger, metrics_tracker
                    metrics_tracker.record_prediction(success=False, duration_ms=duration_ms)
                    audit_logger.record_event(
                        event_type="RISK_PREDICTION_ERROR",
                        shipment_id=request.shipment_id,
                        outcome="FAILED",
                        details={"error": str(e)},
                    )
                except Exception:
                    pass
                logger.error("XGBoost prediction failed: %s. Falling back to demo mode.", e, exc_info=True)

        return self._demo_fallback(request.shipment_id, db_shipment)


    def get_prediction_history(self, shipment_id: str, limit: int = 50) -> list[dict]:
        """Retrieve historical predictions for a shipment ordered newest first."""
        return prediction_repository.get_by_shipment_id(shipment_id, limit=limit)

    def _build_feature_dict(self, req: RiskPredictionRequest, db_shipment: Optional[dict]) -> tuple[dict[str, Any], dict[str, Any]]:
        """Merge database shipment attributes with explicit request feature overrides, sensible DataCo defaults, and real-time disruption data."""
        features: dict[str, Any] = {}

        # 1. Priority & Shipping Mode / Scheduled SLA
        priority_str = req.priority_level or (db_shipment.get("priority") if db_shipment else "Standard")
        shipping_mode, sched_days = _infer_shipping_mode(priority_str)
        features["Shipping Mode"] = shipping_mode
        features["Days for shipment (scheduled)"] = sched_days

        # 2. Region & Market
        dest_loc = req.destination or (db_shipment.get("destination") if db_shipment else None) or "Long Beach"
        origin_loc = req.origin or (db_shipment.get("origin") if db_shipment else None) or "Shanghai"
        order_region = _infer_dataco_region(dest_loc, default="Eastern Asia")
        features["Order Region"] = order_region
        features["Market"] = _infer_dataco_market(order_region)

        # 3. Categorical standard defaults
        features["Type"] = "DEBIT"
        features["Customer Segment"] = "Consumer"
        features["Department Name"] = "Apparel"

        # 4. Numerical business and order values
        features["Order Item Product Price"] = 129.99
        features["Order Item Quantity"] = 1.0
        features["Order Item Discount Rate"] = 0.08
        features["Order Item Discount"] = 10.40
        features["Order Item Total"] = 119.59
        features["Order Profit Per Order"] = 32.50
        features["Order Item Profit Ratio"] = 0.27
        features["Latitude"] = 18.25
        features["Longitude"] = -66.0
        features["order_hour"] = 14.0
        features["order_dayofweek"] = 2.0
        features["order_month"] = 6.0

        # Adjust defaults if DB shipment risk factors indicate disruption
        if db_shipment:
            factors_text = " ".join(db_shipment.get("risk_factors", [])).lower()
            if "congestion" in factors_text or "weather" in factors_text or "storm" in factors_text:
                features["Order Item Discount Rate"] = 0.16
                features["Order Item Quantity"] = 2.0
                features["Days for shipment (scheduled)"] = max(1.0, features["Days for shipment (scheduled)"] - 1.0)

        # ====================================================================
        # Dynamic Real-Time Disruption Telemetry Enrichment Layer
        # ====================================================================
        meta = {
            "external_disruptions_used": False,
            "weather_events_count": 0,
            "port_events_count": 0,
            "traffic_events_count": 0,
            "data_sources": [],
            "is_mock_fallback_used": False,
            "applied_disruption_events": [],
        }

        try:
            disruptions = external_disruption_service.get_corridor_disruptions(
                origin=origin_loc,
                destination=dest_loc,
            )

            if disruptions:
                meta["external_disruptions_used"] = True
                data_sources = set()
                weather_events = []
                port_events = []
                traffic_events = []

                for d in disruptions:
                    if d.source_provider:
                        data_sources.add(d.source_provider)
                    if d.is_mock:
                        meta["is_mock_fallback_used"] = True

                    summary = DisruptionEventSummary(
                        event_id=d.event_id,
                        disruption_type=d.disruption_type.value,
                        severity=d.severity.value,
                        severity_score=d.severity_score,
                        location_name=d.location.name,
                        title=d.title,
                        is_mock=d.is_mock,
                        source_provider=d.source_provider,
                    )
                    meta["applied_disruption_events"].append(summary)

                    if d.disruption_type == DisruptionType.WEATHER:
                        weather_events.append(d)
                    elif d.disruption_type == DisruptionType.PORT_CONGESTION:
                        port_events.append(d)
                    elif d.disruption_type == DisruptionType.TRAFFIC:
                        traffic_events.append(d)

                meta["weather_events_count"] = len(weather_events)
                meta["port_events_count"] = len(port_events)
                meta["traffic_events_count"] = len(traffic_events)
                meta["data_sources"] = sorted(list(data_sources))

                # Real-time Telemetry Impact on Order/Shipping Feature Dynamics
                if weather_events:
                    max_weather = max(w.severity_score for w in weather_events)
                    if max_weather >= 60.0:
                        features["Days for shipment (scheduled)"] = 1.0  # Tightens SLA tolerance
                        features["Order Item Discount Rate"] = 0.18

                if port_events:
                    max_port = max(p.severity_score for p in port_events)
                    if max_port >= 50.0:
                        features["Shipping Mode"] = "Standard Class"
                        features["Order Item Discount"] = 18.50

                if traffic_events:
                    max_delay = max(t.metrics.get("delay_minutes", 0.0) for t in traffic_events)
                    if max_delay >= 45.0:
                        features["Order Profit Per Order"] = max(5.0, features["Order Profit Per Order"] - 15.0)

        except Exception as err:
            logger.warning("Could not fetch real-time disruptions for shipment prediction: %s", err)

        return features, meta

    def _demo_fallback(self, shipment_id: Optional[str], db_shipment: Optional[dict]) -> Optional[RiskPredictionResponse]:
        """Preserve deterministic demo behavior as fallback."""
        if db_shipment is None and shipment_id:
            db_shipment = shipment_service.get_shipment(shipment_id)
            if db_shipment is None:
                return None

        score = max(0, min(100, db_shipment["risk_score"] - 7)) if db_shipment else 45
        risk_level = db_shipment["risk_level"].upper() if db_shipment else "MEDIUM"
        prob = score / 100.0

        factors = [
            RiskFactor(name=factor, severity="HIGH" if idx == 0 and risk_level in ["HIGH", "CRITICAL"] else "MEDIUM")
            for idx, factor in enumerate((db_shipment.get("risk_factors", []) if db_shipment else ["Standard Operational Variance"])[:3])
        ]
        return RiskPredictionResponse(
            shipment_id=shipment_id or (db_shipment["shipment_id"] if db_shipment else None),
            disruption_probability=prob,
            risk_score=score,
            risk_level=risk_level,
            top_risk_factors=[],
            protective_factors=[],
            factors=factors,
            model="DEMO",
            model_name="DEMO Fallback",
            external_disruptions_used=False,
            weather_events_count=0,
            port_events_count=0,
            traffic_events_count=0,
            data_sources=[],
            is_mock_fallback_used=False,
            applied_disruption_events=[],
        )


risk_service = RiskService()
