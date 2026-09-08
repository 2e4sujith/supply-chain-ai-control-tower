"""
Verification test suite for GNN inference, Dual-Model Comparison, and What-If Simulation.
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine
from app.repositories.shipment_repository import shipment_repository

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("TESTING GNN, DUAL-MODEL COMPARISON & WHAT-IF SIMULATION ENDPOINTS")
    print("=" * 80)

    Base.metadata.create_all(bind=engine)
    shipment_repository.seed_demo_shipments()

    # 1. Test GNN Prediction Endpoint
    print("\n[TEST 1] Testing POST /api/predictions/gnn...")
    gnn_payload = {
        "origin_region": "East_Asia",
        "destination_region": "North_America",
        "department_name": "Apparel",
        "route_distance_km": 11000.0,
        "planned_duration_hours": 320.0,
        "weather_severity_index": 45.0,
        "origin_port_congestion_index": 70.0,
        "customs_inspection_risk": 0.40,
        "carrier_reliability_score": 0.85,
        "transport_mode": "Ocean",
        "priority_level": "Standard"
    }
    r1 = client.post("/api/predictions/gnn", json=gnn_payload)
    print("  Status Code:", r1.status_code)
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}: {r1.text}"
    d1 = r1.json()
    print("  GNN Risk Score:", d1["risk_score"], "| Level:", d1["risk_level"], "| Confidence:", d1["confidence_score"])
    print("  Graph Attribution Origin Hub:", d1["attribution"]["origin_hub"]["name"], "| Share:", d1["attribution"]["origin_hub"]["importance_pct"])
    assert "attribution" in d1
    assert "origin_hub" in d1["attribution"]
    assert "destination_region" in d1["attribution"]
    print("  -> PASS")

    # 2. Test Dual-Model Comparison Endpoint
    print("\n[TEST 2] Testing POST /api/predictions/compare...")
    r2 = client.post("/api/predictions/compare", json=gnn_payload)
    print("  Status Code:", r2.status_code)
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    d2 = r2.json()
    print(f"  XGBoost Score: {d2['xgboost']['risk_score']} | GNN Score: {d2['gnn']['risk_score']}")
    print(f"  Fused Consensus Score: {d2['consensus']['fused_risk_score']} | Agreement: {d2['consensus']['agreement_status']}")
    assert "xgboost" in d2 and "gnn" in d2 and "consensus" in d2
    assert d2["consensus"]["fused_risk_score"] >= 0
    print("  -> PASS")

    # 3. Test Model Benchmark Comparison Report Endpoint
    print("\n[TEST 3] Testing GET /api/predictions/models/comparison...")
    r3 = client.get("/api/predictions/models/comparison")
    print("  Status Code:", r3.status_code)
    assert r3.status_code == 200, f"Expected 200, got {r3.status_code}: {r3.text}"
    d3 = r3.json()
    print("  Dataset:", d3["dataset"])
    print("  Models evaluated:", list(d3["models"].keys()))
    assert "GCN_Graph_Neural_Network" in d3["models"]
    assert "XGBoost_Disruption_Model" in d3["models"]
    gcn_m = d3["models"]["GCN_Graph_Neural_Network"]["metrics"]
    print(f"  GNN Test Accuracy: {gcn_m['accuracy']} | F1: {gcn_m['f1_score']} | ROC-AUC: {gcn_m['roc_auc']}")
    print("  -> PASS")

    # 4. Test What-If Scenario Simulation Endpoint
    print("\n[TEST 4] Testing POST /api/routes/what-if...")
    whatif_payload = {
        "origin": "Shanghai",
        "destination": "Long_Beach",
        "simulated_mode": "Air",
        "weather_severity": 80.0,
        "port_congestion": 85.0,
        "customs_risk": 0.50,
        "priority_level": "Urgent",
        "sla_days_delta": -2.0,
        "avoid_nodes": ["Tokyo"]
    }
    r4 = client.post("/api/routes/what-if", json=whatif_payload)
    print("  Status Code:", r4.status_code)
    assert r4.status_code == 200, f"Expected 200, got {r4.status_code}: {r4.text}"
    d4 = r4.json()
    print("  Baseline Path:", " -> ".join(d4["baseline"]["path"]))
    print(f"  Baseline Time: {d4['baseline']['estimated_time_hours']}h | Fused Risk: {d4['baseline']['fused_risk_score']}")
    print("  Simulated Path:", " -> ".join(d4["simulated"]["path"]))
    print(f"  Simulated Time: {d4['simulated']['estimated_time_hours']}h | Fused Risk: {d4['simulated']['fused_risk_score']}")
    print(f"  Delta Risk: {d4['delta']['risk_score_delta']} | Feasibility: {d4['feasibility_status']}")
    print("  Recommendation:", d4["recommendation"])
    assert "baseline" in d4 and "simulated" in d4 and "delta" in d4
    print("  -> PASS")

    print("\n" + "=" * 80)
    print("ALL GNN, DUAL-MODEL COMPARISON & WHAT-IF TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
