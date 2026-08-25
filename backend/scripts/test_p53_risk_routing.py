"""
P5.3 Risk-Aware Route Optimization Test Suite.

Verifies:
1. Multi-criteria optimization: distance vs. time vs. risk_adjusted
2. Risk-weighting cost function: effective_cost = base_time_hours * risk_weight
3. Risk-aware route diversion when higher risk outweighs travel time
4. Average corridor risk and route risk tier classifications
5. API endpoints and error guardrails
6. Core system regression checks
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.services.route_service import route_network, route_service
from app.core.database import Base, engine
from app.repositories.shipment_repository import shipment_repository

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("P5.3 RISK-AWARE ROUTE OPTIMIZATION VERIFICATION SUITE")
    print("=" * 80)

    Base.metadata.create_all(bind=engine)
    shipment_repository.seed_demo_shipments()

    # 1. Distance criterion on Rotterdam -> Hamburg
    print("\n[TEST 1] Testing Rotterdam -> Hamburg under 'distance' criterion...")
    res_dist = route_network.dijkstra_shortest_path("Rotterdam", "Hamburg", criterion="distance")
    print(f"  Path: {' -> '.join(res_dist['path'])}")
    print(f"  Distance: {res_dist['total_distance_km']} km | Cost: {res_dist['total_cost']}")
    assert res_dist["path"] == ["Rotterdam", "Hamburg"]
    assert res_dist["total_distance_km"] == 480.0
    print("  -> PASS")

    # 2. Time criterion on Rotterdam -> Hamburg
    print("\n[TEST 2] Testing Rotterdam -> Hamburg under 'time' criterion...")
    res_time = route_network.dijkstra_shortest_path("Rotterdam", "Hamburg", criterion="time")
    print(f"  Path: {' -> '.join(res_time['path'])}")
    print(f"  Time: {res_time['estimated_time_hours']} hrs | Cost: {res_time['total_cost']}")
    assert res_time["path"] == ["Rotterdam", "Hamburg"]
    assert res_time["estimated_time_hours"] == 16.0
    print("  -> PASS")

    # 3. Risk-Adjusted criterion on Rotterdam -> Hamburg
    print("\n[TEST 3] Testing Rotterdam -> Hamburg under 'risk_adjusted' criterion...")
    res_risk = route_network.dijkstra_shortest_path("Rotterdam", "Hamburg", criterion="risk_adjusted")
    print(f"  Path: {' -> '.join(res_risk['path'])}")
    print(f"  Distance: {res_risk['total_distance_km']} km | Time: {res_risk['estimated_time_hours']} hrs | Cost: {res_risk['total_cost']}")
    print(f"  Avg Risk: {res_risk['average_risk_weight']} | Level: {res_risk['route_risk_level']}")
    assert res_risk["path"] == ["Rotterdam", "Frankfurt", "Hamburg"]
    assert res_risk["average_risk_weight"] == 0.95
    assert res_risk["total_cost"] == 16.15
    print("  -> PASS (Risk-adjusted selected safer rail corridor despite slightly longer scheduled time!)")

    # 4. API POST /api/routes/optimize with risk_adjusted
    print("\n[TEST 4] Testing FastAPI POST /api/routes/optimize (risk_adjusted)...")
    resp_opt = client.post("/api/routes/optimize", json={
        "origin": "Rotterdam",
        "destination": "Hamburg",
        "criterion": "risk_adjusted"
    })
    data_opt = resp_opt.json()
    assert resp_opt.status_code == 200
    assert data_opt["path"] == ["Rotterdam", "Frankfurt", "Hamburg"]
    assert data_opt["average_risk_weight"] == 0.95
    print("  -> PASS")

    # 5. API POST /api/routes/alternative for SHP-1048
    print("\n[TEST 5] Testing FastAPI POST /api/routes/alternative for SHP-1048...")
    resp_alt = client.post("/api/routes/alternative", json={"shipment_id": "SHP-1048", "criterion": "risk_adjusted"})
    data_alt = resp_alt.json()
    assert resp_alt.status_code == 200
    assert data_alt["algorithm"] == "NETWORKX_DIJKSTRA"
    assert data_alt["average_risk_weight"] is not None
    print("  -> PASS")

    # 6. Error boundaries
    print("\n[TEST 6] Testing Error Boundaries...")
    assert client.post("/api/routes/optimize", json={"origin": "UnknownLocation", "destination": "Hamburg"}).status_code == 404
    assert client.post("/api/routes/alternative", json={"shipment_id": "SHP-9999"}).status_code == 404
    assert client.post("/api/routes/alternative", json={"shipment_id": "INVALID"}).status_code == 422
    print("  -> PASS")

    # 7. Regression check
    print("\n[TEST 7] Core system regressions check...")
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health/db").status_code == 200
    assert client.get("/api/shipments").status_code == 200
    assert client.get("/api/alerts").status_code == 200
    assert client.get("/api/analytics/kpis").status_code == 200
    assert client.post("/api/predictions/risk", json={"shipment_id": "SHP-1048"}).status_code == 200
    print("  -> PASS")

    print("\n" + "=" * 80)
    print("ALL P5.3 RISK-AWARE ROUTE OPTIMIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
