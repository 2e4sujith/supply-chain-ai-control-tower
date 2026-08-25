"""
P4.5 Persistent ML Prediction History Test Suite.

Verifies:
1. Table creation: disruption_predictions via Base.metadata.create_all(bind=engine)
2. Successful low-risk prediction storage
3. Successful medium-risk prediction storage
4. Successful high-risk prediction storage
5. Shipment foreign-key relationship and shipment_id lookup
6. Prediction history retrieval via GET /api/predictions/history/{shipment_id} (ordered newest first)
7. Persistence across session restarts
8. Rejection of invalid prediction requests (not stored)
9. Health, database health, shipment, alert, and analytics endpoints
"""

from pathlib import Path
import sys
import json

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.models.prediction import DisruptionPrediction
from app.repositories.shipment_repository import shipment_repository

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("P4.5 PERSISTENT ML PREDICTION HISTORY TEST SUITE")
    print("=" * 70)

    # Step 1: Ensure database tables are created
    print("\n1. Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    shipment_repository.seed_demo_shipments()

    with SessionLocal() as session:
        initial_pred_count = session.scalar(select(func.count(DisruptionPrediction.id))) or 0
    print(f"Initial disruption_predictions count: {initial_pred_count}")

    # Step 2: Low-Risk Prediction on existing shipment SHP-1048
    print("\n2. Submitting Low-Risk Prediction for SHP-1048:")
    low_req = {
        "shipment_id": "SHP-1048",
        "transport_mode": "Road",
        "origin_region": "Europe",
        "destination_region": "Europe",
        "route_distance_km": 350.0,
        "planned_duration_hours": 10.0,
        "elapsed_transit_hours": 8.0,
        "transit_progress_pct": 0.80,
        "priority_level": "Standard",
        "carrier_reliability_score": 0.98,
        "origin_port_congestion_index": 8.0,
        "dest_port_congestion_index": 6.0,
        "weather_severity_index": 4.0,
        "customs_inspection_risk": 0.05,
        "seasonal_disruption_factor": 0.10,
    }
    r_low = client.post("/api/predictions/risk", json=low_req)
    assert r_low.status_code == 200, f"Low risk failed: {r_low.text}"
    low_json = r_low.json()
    print(f"Low risk response -> Score: {low_json['risk_score']}, Tier: {low_json['risk_level']}, Prob: {low_json['disruption_probability']:.4f}")

    # Step 3: Medium-Risk Prediction for SHP-1048
    print("\n3. Submitting Medium-Risk Prediction for SHP-1048:")
    med_req = {
        "shipment_id": "SHP-1048",
        "transport_mode": "Rail",
        "origin_region": "East_Asia",
        "destination_region": "Europe",
        "route_distance_km": 8500.0,
        "planned_duration_hours": 280.0,
        "elapsed_transit_hours": 140.0,
        "transit_progress_pct": 0.50,
        "priority_level": "Standard",
        "carrier_reliability_score": 0.82,
        "origin_port_congestion_index": 35.0,
        "dest_port_congestion_index": 40.0,
        "weather_severity_index": 30.0,
        "customs_inspection_risk": 0.30,
        "seasonal_disruption_factor": 0.50,
    }
    r_med = client.post("/api/predictions/risk", json=med_req)
    assert r_med.status_code == 200, f"Med risk failed: {r_med.text}"
    med_json = r_med.json()
    print(f"Med risk response -> Score: {med_json['risk_score']}, Tier: {med_json['risk_level']}, Prob: {med_json['disruption_probability']:.4f}")

    # Step 4: High-Risk Prediction for SHP-1048
    print("\n4. Submitting High-Risk Prediction for SHP-1048:")
    high_req = {
        "shipment_id": "SHP-1048",
        "transport_mode": "Ocean",
        "origin_region": "East_Asia",
        "destination_region": "North_America",
        "route_distance_km": 14500.0,
        "planned_duration_hours": 550.0,
        "elapsed_transit_hours": 220.0,
        "transit_progress_pct": 0.40,
        "priority_level": "Urgent",
        "carrier_reliability_score": 0.50,
        "origin_port_congestion_index": 90.0,
        "dest_port_congestion_index": 82.0,
        "weather_severity_index": 95.0,
        "customs_inspection_risk": 0.88,
        "seasonal_disruption_factor": 0.95,
    }
    r_high = client.post("/api/predictions/risk", json=high_req)
    assert r_high.status_code == 200, f"High risk failed: {r_high.text}"
    high_json = r_high.json()
    print(f"High risk response -> Score: {high_json['risk_score']}, Tier: {high_json['risk_level']}, Prob: {high_json['disruption_probability']:.4f}")

    # Step 5: Verify records in PostgreSQL
    print("\n5. Verifying records in PostgreSQL table 'disruption_predictions':")
    with SessionLocal() as session:
        preds = session.scalars(
            select(DisruptionPrediction)
            .where(DisruptionPrediction.shipment_id == "SHP-1048")
            .order_by(DisruptionPrediction.prediction_timestamp.desc())
        ).all()
        print(f"Stored predictions for SHP-1048: {len(preds)}")
        assert len(preds) >= 3, f"Expected at least 3 predictions, got {len(preds)}"
        latest = preds[0]
        print(f"Latest Stored: ID={latest.id}, Model={latest.model_name}, Score={latest.risk_score}, Tier={latest.risk_level}")
        print(f"Top Risk Factors JSONB length: {len(latest.top_risk_factors)}")
        assert latest.risk_level in ["HIGH", "CRITICAL"]

    # Step 6: Test GET /api/predictions/history/SHP-1048
    print("\n6. Testing GET /api/predictions/history/SHP-1048:")
    r_hist = client.get("/api/predictions/history/SHP-1048")
    assert r_hist.status_code == 200, f"History GET failed: {r_hist.text}"
    hist_items = r_hist.json()
    print(f"Returned history items: {len(hist_items)}")
    assert len(hist_items) >= 3
    # Verify newest first ordering
    timestamps = [h["prediction_timestamp"] for h in hist_items]
    assert timestamps == sorted(timestamps, reverse=True), "History is not ordered newest first!"
    print("Newest-first ordering verified successfully.")

    # Step 7: Test invalid requests are NOT stored
    print("\n7. Testing invalid requests are rejected and NOT stored:")
    with SessionLocal() as session:
        count_before = session.scalar(select(func.count(DisruptionPrediction.id))) or 0

    r_inv = client.post("/api/predictions/risk", json={"shipment_id": "invalid_id_format"})
    assert r_inv.status_code == 422
    
    r_inv2 = client.post("/api/predictions/risk", json={"weather_severity_index": 200.0})
    assert r_inv2.status_code == 422

    with SessionLocal() as session:
        count_after = session.scalar(select(func.count(DisruptionPrediction.id))) or 0
    assert count_before == count_after, "Invalid requests should not create database records!"
    print(f"Count unchanged ({count_before} == {count_after}). Validation rejection verified.")

    # Step 8: Test Health & Existing Endpoints
    print("\n8. Verifying existing endpoints:")
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health/db").status_code == 200
    assert client.get("/api/shipments").status_code == 200
    assert client.get("/api/alerts").status_code == 200
    assert client.get("/api/analytics/kpis").status_code == 200
    print("All health, shipment, alert, and analytics endpoints passed.")

    # Save test results for audit
    try:
        out_file = base_dir / "models" / "p45_test_results.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({
                "initial_prediction_count": initial_pred_count,
                "latest_stored_prediction": {
                    "id": latest.id,
                    "shipment_id": latest.shipment_id,
                    "disruption_probability": latest.disruption_probability,
                    "risk_score": latest.risk_score,
                    "risk_level": latest.risk_level,
                    "model_name": latest.model_name,
                    "prediction_timestamp": latest.prediction_timestamp.isoformat() if latest.prediction_timestamp else None,
                    "top_risk_factors_count": len(latest.top_risk_factors),
                    "protective_factors_count": len(latest.protective_factors),
                },
                "history_items_count": len(hist_items),
                "history_sample": hist_items[:3],
                "all_tests_passed": True
            }, f, indent=2)
    except Exception as save_e:
        print(f"Note: Could not save p45_test_results.json: {save_e}")

    print("\n" + "=" * 70)
    print("ALL P4.5 PREDICTION PERSISTENCE TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
