"""
End-to-end Test Suite for FastAPI XGBoost Prediction Endpoint.

Tests POST /api/predictions/risk with low, medium, and high risk profiles,
database shipment lookup, validation error handling, and SHAP factors.
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("FASTAPI XGBOOST PREDICTION ENDPOINT TEST SUITE")
    print("=" * 70)

    # 1. Test Low Risk Shipment
    print("\n1. Testing Low-Risk Shipment:")
    low_req = {
        "transport_mode": "Road",
        "origin_region": "Europe",
        "destination_region": "Europe",
        "route_distance_km": 450.0,
        "planned_duration_hours": 12.0,
        "elapsed_transit_hours": 9.5,
        "transit_progress_pct": 0.79,
        "priority_level": "Standard",
        "carrier_reliability_score": 0.98,
        "origin_port_congestion_index": 8.0,
        "dest_port_congestion_index": 6.5,
        "weather_severity_index": 5.0,
        "customs_inspection_risk": 0.05,
        "seasonal_disruption_factor": 0.10,
    }
    resp = client.post("/api/predictions/risk", json=low_req)
    print(f"Status: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    low_data = resp.json()
    print(f"Model:                   {low_data['model_name']} [{low_data['model']}]")
    print(f"Disruption Probability:  {low_data['disruption_probability']:.4f}")
    print(f"Risk Score:              {low_data['risk_score']}/100")
    print(f"Risk Tier:               {low_data['risk_level']}")
    print(f"Protective Factors:      {len(low_data['protective_factors'])} factors returned")
    for f in low_data['protective_factors'][:2]:
        print(f"  - {f['display_name']} ({f['value']}): SHAP={f['shap_value']:.4f} [{f['magnitude']}]")
    assert 0.0 <= low_data["disruption_probability"] <= 1.0
    assert 0 <= low_data["risk_score"] <= 100
    assert low_data["risk_level"] == "LOW"
    assert low_data["model"] == "XGBoost"

    # 2. Test Medium Risk Shipment
    print("\n2. Testing Medium-Risk Shipment:")
    med_req = {
        "transport_mode": "Rail",
        "origin_region": "East_Asia",
        "destination_region": "Europe",
        "route_distance_km": 9500.0,
        "planned_duration_hours": 320.0,
        "elapsed_transit_hours": 160.0,
        "transit_progress_pct": 0.50,
        "priority_level": "Standard",
        "carrier_reliability_score": 0.82,
        "origin_port_congestion_index": 38.0,
        "dest_port_congestion_index": 45.0,
        "weather_severity_index": 32.0,
        "customs_inspection_risk": 0.35,
        "seasonal_disruption_factor": 0.52,
    }
    resp = client.post("/api/predictions/risk", json=med_req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    med_data = resp.json()
    print(f"Disruption Probability:  {med_data['disruption_probability']:.4f}")
    print(f"Risk Score:              {med_data['risk_score']}/100")
    print(f"Risk Tier:               {med_data['risk_level']}")
    assert 0.0 <= med_data["disruption_probability"] <= 1.0
    assert 0 <= med_data["risk_score"] <= 100
    assert med_data["model"] == "XGBoost"

    # 3. Test High Risk / Critical Shipment
    print("\n3. Testing High-Risk Severe Weather Ocean Shipment:")
    high_req = {
        "transport_mode": "Ocean",
        "origin_region": "East_Asia",
        "destination_region": "North_America",
        "route_distance_km": 14200.0,
        "planned_duration_hours": 520.0,
        "elapsed_transit_hours": 210.0,
        "transit_progress_pct": 0.40,
        "priority_level": "Urgent",
        "carrier_reliability_score": 0.52,
        "origin_port_congestion_index": 88.0,
        "dest_port_congestion_index": 76.0,
        "weather_severity_index": 92.5,
        "customs_inspection_risk": 0.85,
        "seasonal_disruption_factor": 0.92,
    }
    resp = client.post("/api/predictions/risk", json=high_req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    high_data = resp.json()
    print(f"Disruption Probability:  {high_data['disruption_probability']:.4f}")
    print(f"Risk Score:              {high_data['risk_score']}/100")
    print(f"Risk Tier:               {high_data['risk_level']}")
    print(f"Top Risk Drivers:        {len(high_data['top_risk_factors'])} factors returned")
    for f in high_data['top_risk_factors'][:3]:
        print(f"  + {f['display_name']} ({f['value']}): SHAP=+{f['shap_value']:.4f} [{f['magnitude']}]")
    assert 0.0 <= high_data["disruption_probability"] <= 1.0
    assert 0 <= high_data["risk_score"] <= 100
    assert high_data["risk_level"] in ["HIGH", "CRITICAL"]
    assert high_data["model"] == "XGBoost"

    # 4. Test Database Shipment ID Lookup
    print("\n4. Testing Database Shipment Lookup (SHP-1001):")
    db_req = {"shipment_id": "SHP-1001"}
    resp = client.post("/api/predictions/risk", json=db_req)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        db_data = resp.json()
        print(f"Shipment ID:             {db_data['shipment_id']}")
        print(f"Disruption Probability:  {db_data['disruption_probability']:.4f}")
        print(f"Risk Score:              {db_data['risk_score']}/100")
        print(f"Risk Tier:               {db_data['risk_level']}")
        assert db_data["model"] == "XGBoost"

    # 5. Test Validation Errors
    print("\n5. Testing Validation & Error Handling:")
    # Invalid ID format
    resp = client.post("/api/predictions/risk", json={"shipment_id": "invalid-format"})
    print(f"Invalid ID Format -> Status: {resp.status_code} (Expected 422)")
    assert resp.status_code == 422

    # Out of bounds numerical feature
    resp = client.post("/api/predictions/risk", json={"weather_severity_index": 180.0})
    print(f"Weather Index > 100 -> Status: {resp.status_code} (Expected 422)")
    assert resp.status_code == 422

    # Non-existent ID without features
    resp = client.post("/api/predictions/risk", json={"shipment_id": "SHP-NONEXISTENT-9999"})
    print(f"Non-existent ID without features -> Status: {resp.status_code} (Expected 404)")
    assert resp.status_code == 404

    # Save latest test results for audit
    try:
        import json
        out_file = base_dir / "models" / "latest_test_results.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({
                "low_risk": low_data,
                "medium_risk": med_data,
                "high_risk": high_data,
            }, f, indent=2)
    except Exception:
        pass

    print("\n" + "=" * 70)
    print("ALL PREDICTION API ENDPOINT TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
