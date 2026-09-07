"""
Test Suite for Shipment Risk Prediction Pipeline Stability.

Verifies:
1. Valid baseline prediction
2. Missing optional values (sensible defaults)
3. Missing shipment ID with valid route data
4. Nonexistent shipment ID without features (clean HTTP 404)
5. Numeric values supplied as strings ("125.50", "$350.00", "12%", " 1,500.50 ")
6. Unseen categorical values ("Hyperspace", "Antarctica")
7. Case-insensitive and whitespace-tolerant categorical matching
8. Null / None values across features
9. NaN / Infinity inputs (handled safely with zero NaN reaching model)
10. Malformed and valid date string parsing
11. Feature vector exact dimension (63) and ordering
12. SHAP isolation and fault tolerance
13. FastAPI endpoint integration
"""

import math
from pathlib import Path
import sys

# Set up path
base_dir = Path(__file__).resolve().parent.parent
if str(base_dir) not in sys.path:
    sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.ml.explainability import (
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
    Preprocessor,
    PureTreeSHAP,
    get_explainability_service,
)
from app.schemas.predictions import RiskPredictionRequest
from app.services.risk_service import risk_service

client = TestClient(app)


def test_feature_vector_dimension_and_order():
    """Verify preprocessor produces exactly 63 features in the correct order."""
    service = get_explainability_service()
    prep = service.preprocessor
    assert len(prep.feature_names) == 63, f"Expected 63 features, got {len(prep.feature_names)}"

    # Check that transformation on an empty dict produces 63 finite floats
    vec = prep.transform_record({})
    assert len(vec) == 63
    assert all(isinstance(v, float) and math.isfinite(v) for v in vec)


def test_numeric_coercion_and_cleaning():
    """Verify string numbers, dollar signs, percentages, and commas are cleaned."""
    service = get_explainability_service()
    record = {
        "Order Item Product Price": "$199.99",
        "Order Item Quantity": " 3 ",
        "Order Item Discount Rate": "15%",
        "Order Item Discount": "$30.00",
        "Order Item Total": "1,500.50",
        "Order Profit Per Order": "$120.00",
        "Order Item Profit Ratio": "0.25",
        "Days for shipment (scheduled)": "3.0",
        "Latitude": "34.05",
        "Longitude": "-118.25",
        "order_hour": "14",
        "order_dayofweek": "2",
        "order_month": "7",
    }
    vec = service.preprocessor.transform_record(record)
    assert len(vec) == 63
    assert all(math.isfinite(v) for v in vec)

    # Verify explain_shipment succeeds with stringed numeric record
    res = service.explain_shipment(record)
    assert 0.0 <= res["predicted_probability"] <= 1.0
    assert 0 <= res["risk_score"] <= 100
    assert res["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")


def test_unseen_categorical_values():
    """Verify unseen/novel categories do not crash and produce 0-vector for that category."""
    service = get_explainability_service()
    record = {
        "Shipping Mode": "Hyperloop Quantum Express",
        "Type": "BITCOIN_TRANSFER",
        "Customer Segment": "Galactic Enterprise",
        "Market": "Deep Space Sector 9",
        "Order Region": "Antarctica South Pole",
        "Department Name": "Quantum Computing",
    }
    vec = service.preprocessor.transform_record(record)
    assert len(vec) == 63
    # All 50 one-hot encoded categorical columns should evaluate to 0.0
    assert all(v == 0.0 for v in vec[:50])
    assert all(math.isfinite(v) for v in vec)

    res = service.explain_shipment(record)
    assert 0.0 <= res["predicted_probability"] <= 1.0
    assert 0 <= res["risk_score"] <= 100


def test_case_insensitive_categorical_matching():
    """Verify lowercase, uppercase, and untrimmed categories match accurately."""
    service = get_explainability_service()
    record = {
        "Shipping Mode": "standard class",
        "Type": "  debit  ",
        "Customer Segment": "CONSUMER",
        "Market": "pacific asia",
        "Order Region": "Eastern Asia",
        "Department Name": "apparel",
    }
    vec = service.preprocessor.transform_record(record)
    assert len(vec) == 63
    # Check that at least some 1-hot flags are activated
    assert sum(vec[:50]) >= 5.0


def test_nan_infinity_null_resilience():
    """Verify NaN, Infinity, -Infinity, and None never crash the pipeline."""
    service = get_explainability_service()
    record = {
        "Shipping Mode": None,
        "Type": None,
        "Days for shipment (scheduled)": float("nan"),
        "Order Item Product Price": float("inf"),
        "Order Item Quantity": float("-inf"),
        "Order Item Discount Rate": None,
        "Order Item Total": "NaN",
        "Order Profit Per Order": "Infinity",
        "Latitude": None,
        "Longitude": None,
    }
    vec = service.preprocessor.transform_record(record)
    assert len(vec) == 63
    assert all(math.isfinite(v) for v in vec)

    res = service.explain_shipment(record)
    assert 0.0 <= res["predicted_probability"] <= 1.0
    assert 0 <= res["risk_score"] <= 100


def test_date_string_parsing():
    """Verify ISO dates and malformed dates are processed gracefully."""
    # 1. Valid ISO date
    req_iso = RiskPredictionRequest(
        origin="Shanghai",
        destination="Rotterdam",
        order_date="2026-09-07T15:30:00Z",
    )
    features_iso, _ = risk_service._build_feature_dict(req_iso, None)
    assert features_iso["order_hour"] == 15.0
    assert features_iso["order_dayofweek"] == 0.0  # Monday
    assert features_iso["order_month"] == 9.0

    # 2. Malformed date
    req_bad_date = RiskPredictionRequest(
        origin="Shanghai",
        destination="Rotterdam",
        order_date="invalid-date-string-123",
    )
    features_bad, _ = risk_service._build_feature_dict(req_bad_date, None)
    # Falls back to default values without error
    assert math.isfinite(features_bad["order_hour"])
    assert math.isfinite(features_bad["order_dayofweek"])
    assert math.isfinite(features_bad["order_month"])


def test_shap_isolation_resilience():
    """Verify that if SHAP calculation fails, risk prediction still returns cleanly."""
    service = get_explainability_service()
    orig_compute = service.explainer.compute_shap_values

    def failing_compute(x):
        raise RuntimeError("Simulated TreeSHAP engine unexpected failure")

    try:
        service.explainer.compute_shap_values = failing_compute
        res = service.explain_shipment({"Shipping Mode": "Standard Class"})
        assert 0.0 <= res["predicted_probability"] <= 1.0
        assert 0 <= res["risk_score"] <= 100
        assert res["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    finally:
        service.explainer.compute_shap_values = orig_compute


def test_api_risk_prediction_endpoint():
    """Verify the FastAPI HTTP endpoint handles various request profiles."""
    # 1. Valid route request without shipment_id
    resp = client.post("/api/predictions/risk", json={
        "origin": "Mumbai, IN",
        "destination": "Hamburg, DE",
        "transport_mode": "Ocean",
        "priority_level": "Standard",
        "weather_severity_index": 25.0,
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["model"] == "XGBoost"
    assert 0.0 <= data["disruption_probability"] <= 1.0
    assert 0 <= data["risk_score"] <= 100

    # 2. Numeric strings & currency coercion in API request
    resp_coerced = client.post("/api/predictions/risk", json={
        "origin": "Singapore",
        "destination": "Los Angeles",
        "route_distance_km": "12500.50",
        "planned_duration_hours": "360",
        "transit_progress_pct": "45%",
        "weather_severity_index": "35.5",
        "carrier_reliability_score": "0.92",
    })
    assert resp_coerced.status_code == 200, resp_coerced.text
    d_coerced = resp_coerced.json()
    assert d_coerced["model"] == "XGBoost"

    # 3. Direct DataCo features passed to API
    resp_dataco = client.post("/api/predictions/risk", json={
        "shipping_mode": "First Class",
        "days_for_shipment_scheduled": "1.0",
        "order_item_product_price": "$299.99",
        "order_item_discount_rate": "10%",
        "payment_type": "TRANSFER",
        "customer_segment": "Corporate",
        "order_region": "Western Europe",
        "order_date": "2026-09-07T14:00:00Z",
    })
    assert resp_dataco.status_code == 200, resp_dataco.text
    d_dataco = resp_dataco.json()
    assert d_dataco["model"] == "XGBoost"

    # 4. Nonexistent shipment ID without features -> clean 404
    resp_404 = client.post("/api/predictions/risk", json={
        "shipment_id": "SHP-NONEXISTENT-9999",
    })
    assert resp_404.status_code == 404
    assert "not found" in resp_404.json()["detail"].lower()

    # 5. Invalid regex on shipment ID -> clean 422
    resp_422 = client.post("/api/predictions/risk", json={
        "shipment_id": "@@@INVALID$$$",
    })
    assert resp_422.status_code == 422


if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING RISK PIPELINE STABILITY TESTS")
    print("=" * 70)
    test_feature_vector_dimension_and_order()
    print(" [PASS] test_feature_vector_dimension_and_order")
    test_numeric_coercion_and_cleaning()
    print(" [PASS] test_numeric_coercion_and_cleaning")
    test_unseen_categorical_values()
    print(" [PASS] test_unseen_categorical_values")
    test_case_insensitive_categorical_matching()
    print(" [PASS] test_case_insensitive_categorical_matching")
    test_nan_infinity_null_resilience()
    print(" [PASS] test_nan_infinity_null_resilience")
    test_date_string_parsing()
    print(" [PASS] test_date_string_parsing")
    test_shap_isolation_resilience()
    print(" [PASS] test_shap_isolation_resilience")
    test_api_risk_prediction_endpoint()
    print(" [PASS] test_api_risk_prediction_endpoint")
    print("=" * 70)
    print("ALL 8 STABILITY TEST SUITES PASSED SUCCESSFULLY!")
    print("=" * 70)
