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

# Regional matching dictionaries
REGION_KEYWORDS = {
    "East_Asia": ["shanghai", "ningbo", "shenzhen", "hong kong", "tokyo", "busan", "china", "japan", "korea", "yantian", "qingdao"],
    "Southeast_Asia": ["singapore", "bangkok", "jakarta", "klang", "vietnam", "ho chi minh", "malaysia", "indonesia", "thailand"],
    "South_Asia": ["mumbai", "chennai", "colombo", "nhava sheva", "karachi", "india", "pakistan", "sri lanka", "delhi"],
    "Europe": ["rotterdam", "hamburg", "antwerp", "felixstowe", "germany", "uk", "france", "netherlands", "london", "le havre", "valencia", "genoa"],
    "North_America": ["los angeles", "long beach", "new york", "chicago", "savannah", "usa", "canada", "mexico", "vancouver", "seattle", "houston", "dallas"],
    "Latin_America": ["santos", "buenos aires", "callao", "panama", "brazil", "chile", "peru", "colombia", "cartagena", "valparaiso"],
    "Middle_East": ["dubai", "jebel ali", "dammam", "salalah", "uae", "saudi", "doha", "qatar", "oman", "suez"],
    "Oceania": ["sydney", "melbourne", "auckland", "australia", "new zealand", "brisbane", "fremantle"],
}


def _infer_region(location_text: str, default: str = "East_Asia") -> str:
    loc_lower = (location_text or "").lower()
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in loc_lower for kw in keywords):
            return region
    return default


def _infer_transport_mode(shipment: dict) -> str:
    text = (shipment.get("origin", "") + " " + shipment.get("destination", "") + " " + shipment.get("current_location", "")).lower()
    if any(term in text for term in ["air", "express", "flight", "cargo jet"]):
        return "Air"
    if any(term in text for term in ["rail", "train", "freight train"]):
        return "Rail"
    if any(term in text for term in ["ocean", "sea", "port", "pacific", "atlantic", "vessel"]):
        return "Ocean"
    return "Ocean"  # Default global freight mode


class RiskService:
    """Production risk prediction service powered by trained XGBoost, SHAP explainability, and real-time disruption data."""

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
        """Perform real XGBoost disruption prediction with SHAP explainability and real-time disruption telemetry."""
        db_shipment = None
        if request.shipment_id:
            db_shipment = shipment_service.get_shipment(request.shipment_id)
            if db_shipment is None and not any([
                request.origin, request.destination,
                request.transport_mode, request.origin_region, request.destination_region,
                request.weather_severity_index, request.origin_port_congestion_index
            ]):
                return None

        # Build base features + enrich with real-time disruption events
        features, disruption_meta = self._build_feature_dict(request, db_shipment)
        ml_service = self._get_ml_service()
        t0 = time.time()

        if ml_service is not None:
            try:
                explanation = ml_service.explain_shipment(features, top_n=5)
                duration_ms = (time.time() - t0) * 1000.0
                
                # Format factors for backward compatibility and rich detail
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

                # Backward-compatible list
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
                        model_name="XGBoost (Disruption Risk v1.0)",
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
                    model_name="XGBoost (Disruption Risk v1.0)",
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
                logger.error("XGBoost prediction failed: %s. Falling back to demo mode.", e)

        # Fallback to demo prediction
        return self._demo_fallback(request.shipment_id, db_shipment)


    def get_prediction_history(self, shipment_id: str, limit: int = 50) -> list[dict]:
        """Retrieve historical predictions for a shipment ordered newest first."""
        return prediction_repository.get_by_shipment_id(shipment_id, limit=limit)

    def _build_feature_dict(self, req: RiskPredictionRequest, db_shipment: Optional[dict]) -> tuple[dict[str, Any], dict[str, Any]]:
        """Merge database shipment attributes with explicit request feature overrides, sensible defaults, and real-time disruption data."""
        features: dict[str, Any] = {}

        # 1. Transport Mode
        if req.transport_mode:
            features["transport_mode"] = req.transport_mode
        elif db_shipment:
            features["transport_mode"] = _infer_transport_mode(db_shipment)
        else:
            features["transport_mode"] = "Ocean"

        # 2. Origin Region
        origin_loc = req.origin or (db_shipment.get("origin") if db_shipment else None) or "Shanghai"
        if req.origin_region:
            features["origin_region"] = req.origin_region
        elif db_shipment:
            features["origin_region"] = _infer_region(db_shipment.get("origin", ""), default="East_Asia")
        else:
            features["origin_region"] = _infer_region(origin_loc, default="East_Asia")

        # 3. Destination Region
        dest_loc = req.destination or (db_shipment.get("destination") if db_shipment else None) or "Long_Beach"
        if req.destination_region:
            features["destination_region"] = req.destination_region
        elif db_shipment:
            features["destination_region"] = _infer_region(db_shipment.get("destination", ""), default="North_America")
        else:
            features["destination_region"] = _infer_region(dest_loc, default="North_America")

        # 4. Priority Level
        if req.priority_level:
            features["priority_level"] = req.priority_level
        elif db_shipment:
            p_val = (db_shipment.get("priority") or "Standard").capitalize()
            features["priority_level"] = p_val if p_val in ["Standard", "High", "Urgent"] else "Standard"
        else:
            features["priority_level"] = "Standard"

        # 5. Numerical features with base overrides or defaults
        features["route_distance_km"] = req.route_distance_km if req.route_distance_km is not None else 6500.0
        features["planned_duration_hours"] = req.planned_duration_hours if req.planned_duration_hours is not None else 190.0
        features["elapsed_transit_hours"] = req.elapsed_transit_hours if req.elapsed_transit_hours is not None else 95.0
        features["transit_progress_pct"] = req.transit_progress_pct if req.transit_progress_pct is not None else 0.50
        features["carrier_reliability_score"] = req.carrier_reliability_score if req.carrier_reliability_score is not None else 0.85
        features["origin_port_congestion_index"] = req.origin_port_congestion_index if req.origin_port_congestion_index is not None else 35.0
        features["dest_port_congestion_index"] = req.dest_port_congestion_index if req.dest_port_congestion_index is not None else 35.0
        features["weather_severity_index"] = req.weather_severity_index if req.weather_severity_index is not None else 25.0
        features["customs_inspection_risk"] = req.customs_inspection_risk if req.customs_inspection_risk is not None else 0.30
        features["seasonal_disruption_factor"] = req.seasonal_disruption_factor if req.seasonal_disruption_factor is not None else 0.50

        # Adjust defaults slightly if DB shipment risk factors indicate specific issues
        if db_shipment:
            factors_text = " ".join(db_shipment.get("risk_factors", [])).lower()
            if "weather" in factors_text or "storm" in factors_text:
                features["weather_severity_index"] = req.weather_severity_index if req.weather_severity_index is not None else 75.0
            if "port congestion" in factors_text or "terminal" in factors_text:
                features["dest_port_congestion_index"] = req.dest_port_congestion_index if req.dest_port_congestion_index is not None else 68.0
            if "customs" in factors_text:
                features["customs_inspection_risk"] = req.customs_inspection_risk if req.customs_inspection_risk is not None else 0.65

        # ====================================================================
        # Phase 7: Dynamic Real-Time Disruption Telemetry Enrichment Layer
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

                # Feature 1: Weather severity index
                if req.weather_severity_index is None and weather_events:
                    max_weather = max(w.severity_score for w in weather_events)
                    features["weather_severity_index"] = round(float(max(10.0, min(100.0, max_weather))), 1)

                # Feature 2 & 3: Origin & Destination Port Congestion
                if port_events:
                    origin_port_events = [
                        p for p in port_events
                        if origin_loc.lower() in p.location.name.lower() or (p.location.city and origin_loc.lower() in p.location.city.lower())
                    ]
                    dest_port_events = [
                        p for p in port_events
                        if dest_loc.lower() in p.location.name.lower() or (p.location.city and dest_loc.lower() in p.location.city.lower())
                    ]

                    if req.origin_port_congestion_index is None and origin_port_events:
                        max_orig = max(p.severity_score for p in origin_port_events)
                        features["origin_port_congestion_index"] = round(float(max(10.0, min(100.0, max_orig))), 1)

                    if req.dest_port_congestion_index is None and dest_port_events:
                        max_dest = max(p.severity_score for p in dest_port_events)
                        features["dest_port_congestion_index"] = round(float(max(10.0, min(100.0, max_dest))), 1)

                # Feature 4: Carrier reliability / Traffic congestion
                if req.carrier_reliability_score is None and traffic_events:
                    max_traffic_delay = max(t.metrics.get("delay_minutes", 0.0) for t in traffic_events)
                    if max_traffic_delay > 45.0:
                        penalty = min(0.20, (max_traffic_delay / 120.0) * 0.15)
                        base_rel = features.get("carrier_reliability_score", 0.85)
                        features["carrier_reliability_score"] = round(float(max(0.30, min(0.99, base_rel - penalty))), 2)

                # Feature 5: Seasonal / Macro disruption factor
                if req.seasonal_disruption_factor is None:
                    high_critical_count = sum(
                        1 for d in disruptions
                        if d.severity in [DisruptionSeverity.HIGH, DisruptionSeverity.CRITICAL]
                    )
                    if high_critical_count >= 2:
                        features["seasonal_disruption_factor"] = round(min(0.95, features.get("seasonal_disruption_factor", 0.50) + 0.25), 2)

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


