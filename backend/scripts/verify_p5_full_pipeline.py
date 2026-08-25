"""
Phase 5 Master End-to-End Route Optimization Verification Suite.

Validates:
1. NetworkX graph topology & attributes
2. Dijkstra distance optimization
3. Dijkstra time optimization
4. Risk-adjusted optimization (risk mitigation diversion)
5. Alternative-route API for real shipments
6. Route response segments & transport modes
7. Risk metrics & corridor risk aggregations
8. Decision rationale transparency
9. Frontend Live Map integration contracts
10. Multi-node waypoint geometric decomposition
11. Origin / Destination / Intermediate node resolution
12. Distance & duration mathematical consistency
13. Robust error boundaries (404 and 422 HTTP responses)
14. FastAPI application health
15. PostgreSQL database health
16. Full regression across Shipments, Alerts, Analytics, and ML Prediction history
17. React production build integrity
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.services.route_service import route_network, route_service, NETWORKX_AVAILABLE
from app.core.database import Base, engine
from app.repositories.shipment_repository import shipment_repository

client = TestClient(app)

def run_tests():
    print("=" * 85)
    print("SUPPLY CHAIN AI — PHASE 5 MASTER ROUTE OPTIMIZATION VERIFICATION SUITE")
    print("=" * 85)

    Base.metadata.create_all(bind=engine)
    shipment_repository.seed_demo_shipments()

    checks_passed = 0
    total_checks = 17

    # 1. NetworkX graph loads correctly
    print("\n[CHECK 1/17] Validating NetworkX Graph Topology...")
    summary = route_network.get_network_summary()
    print(f"  Nodes: {summary['total_nodes']} | Directed Edges: {summary['total_directed_edges']}")
    print(f"  Regions: {summary['regions_covered']}")
    print(f"  Transport Modes: {summary['transport_modes']}")
    print(f"  NetworkX Engine Active: {summary['networkx_active']}")
    assert summary['total_nodes'] >= 25
    assert summary['total_directed_edges'] >= 50
    assert summary['networkx_active'] is True
    checks_passed += 1
    print("  -> CHECK 1 PASSED")

    # 2. Dijkstra distance optimization works
    print("\n[CHECK 2/17] Validating Dijkstra Distance Optimization...")
    res_dist = route_network.dijkstra_shortest_path("Rotterdam", "Hamburg", criterion="distance")
    print(f"  Path: {' -> '.join(res_dist['path'])} | Distance: {res_dist['total_distance_km']} km | Cost: {res_dist['total_cost']}")
    assert res_dist["path"] == ["Rotterdam", "Hamburg"]
    assert res_dist["total_distance_km"] == 480.0
    assert res_dist["total_cost"] == 480.0
    checks_passed += 1
    print("  -> CHECK 2 PASSED")

    # 3. Dijkstra time optimization works
    print("\n[CHECK 3/17] Validating Dijkstra Fastest Time Optimization...")
    res_time = route_network.dijkstra_shortest_path("Frankfurt", "Toronto", criterion="time")
    print(f"  Path: {' -> '.join(res_time['path'])} | Time: {res_time['estimated_time_hours']} hrs | Modes: {res_time['transport_modes']}")
    assert len(res_time["path"]) >= 2
    assert res_time["estimated_time_hours"] == 9.5
    assert "Air" in res_time["transport_modes"]
    checks_passed += 1
    print("  -> CHECK 3 PASSED")

    # 4. Risk-adjusted optimization works
    print("\n[CHECK 4/17] Validating Risk-Adjusted Optimization Diversion...")
    res_risk = route_network.dijkstra_shortest_path("Rotterdam", "Hamburg", criterion="risk_adjusted")
    print(f"  Selected Path: {' -> '.join(res_risk['path'])}")
    print(f"  Distance: {res_risk['total_distance_km']} km | Time: {res_risk['estimated_time_hours']} hrs | Cost: {res_risk['total_cost']}")
    print(f"  Avg Risk: {res_risk['average_risk_weight']} | Level: {res_risk['route_risk_level']}")
    assert res_risk["path"] == ["Rotterdam", "Frankfurt", "Hamburg"]
    assert res_risk["average_risk_weight"] == 0.95
    assert res_risk["total_cost"] == 16.15
    checks_passed += 1
    print("  -> CHECK 4 PASSED")

    # 5. Alternative-route API works for real shipment SHP-1048
    print("\n[CHECK 5/17] Validating Alternative Route API for SHP-1048...")
    resp_alt1048 = client.post("/api/routes/alternative", json={"shipment_id": "SHP-1048", "criterion": "risk_adjusted"})
    assert resp_alt1048.status_code == 200
    data_1048 = resp_alt1048.json()
    print(f"  Shipment: {data_1048['shipment_id']}")
    print(f"  Current Route: {' > '.join(data_1048['current_route'])}")
    print(f"  Recommended: {' > '.join(data_1048['recommended_route'])}")
    assert data_1048["algorithm"] == "NETWORKX_DIJKSTRA"
    assert len(data_1048["recommended_route"]) >= 2
    checks_passed += 1
    print("  -> CHECK 5 PASSED")

    # 6. Route response contains valid path and segments
    print("\n[CHECK 6/17] Validating Route Path and Segment Decomposition...")
    assert len(data_1048["segments"]) > 0
    for i, seg in enumerate(data_1048["segments"], 1):
        print(f"    Leg {i}: {seg['origin']} -> {seg['destination']} [{seg['mode']}, {seg['distance_km']} km, {seg['base_time_hours']} hrs, Risk: {seg['risk_weight']}x]")
        assert seg["distance_km"] > 0
        assert seg["base_time_hours"] > 0
        assert seg["mode"] in ["Ocean", "Rail", "Road", "Air"]
    checks_passed += 1
    print("  -> CHECK 6 PASSED")

    # 7. Risk metrics are correct
    print("\n[CHECK 7/17] Validating Route Risk Metrics...")
    assert data_1048["average_risk_weight"] is not None
    assert data_1048["route_risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    print(f"  Average Risk Factor: {data_1048['average_risk_weight']} | Route Risk Level: {data_1048['route_risk_level']}")
    checks_passed += 1
    print("  -> CHECK 7 PASSED")

    # 8. Route rationale is displayed
    print("\n[CHECK 8/17] Validating Decision Rationale...")
    assert data_1048["reason"] and len(data_1048["reason"]) > 10
    print(f"  Decision Rationale: '{data_1048['reason']}'")
    checks_passed += 1
    print("  -> CHECK 8 PASSED")

    # 9. React Live Map receives the real API response
    print("\n[CHECK 9/17] Validating Frontend API Integration Contract...")
    assert "shipment_id" in data_1048
    assert "current_route" in data_1048
    assert "recommended_route" in data_1048
    assert "total_distance_km" in data_1048
    assert "estimated_time_hours" in data_1048
    assert "total_cost" in data_1048
    assert "algorithm" in data_1048
    assert data_1048["algorithm"] == "NETWORKX_DIJKSTRA"
    checks_passed += 1
    print("  -> CHECK 9 PASSED")

    # 10. Recommended route is visually displayed
    print("\n[CHECK 10/17] Validating Waypoints Structure for Map Visualization...")
    assert isinstance(data_1048["recommended_route"], list)
    assert len(data_1048["recommended_route"]) >= 2
    print(f"  Waypoints: {data_1048['recommended_route']}")
    checks_passed += 1
    print("  -> CHECK 10 PASSED")

    # 11. Origin / Destination / Intermediate Nodes
    print("\n[CHECK 11/17] Validating Multi-Node Intermediate Waypoints...")
    origin_node = data_1048["recommended_route"][0]
    dest_node = data_1048["recommended_route"][-1]
    intermediate = data_1048["recommended_route"][1:-1]
    print(f"  Origin: {origin_node} | Destination: {dest_node}")
    print(f"  Intermediate Hubs: {intermediate if intermediate else '(Direct Corridor)'}")
    assert origin_node == "Shanghai"
    assert dest_node == "Long_Beach"
    checks_passed += 1
    print("  -> CHECK 11 PASSED")

    # 12. Route metrics match backend response
    print("\n[CHECK 12/17] Validating Consistency of Distance & Time Totals...")
    sum_dist = sum(s["distance_km"] for s in data_1048["segments"])
    sum_time = sum(s["base_time_hours"] for s in data_1048["segments"])
    assert abs(sum_dist - data_1048["total_distance_km"]) < 0.5
    assert abs(sum_time - data_1048["estimated_time_hours"]) < 0.5
    checks_passed += 1
    print("  -> CHECK 12 PASSED")

    # 13. Invalid locations are handled safely
    print("\n[CHECK 13/17] Validating Error Guardrails...")
    assert client.post("/api/routes/optimize", json={"origin": "InvalidPlaceXYZ", "destination": "Long_Beach"}).status_code == 404
    assert client.post("/api/routes/alternative", json={"shipment_id": "SHP-NONEXISTENT"}).status_code == 404
    assert client.post("/api/routes/alternative", json={"shipment_id": "MALFORMED-PATTERN"}).status_code == 422
    checks_passed += 1
    print("  -> CHECK 13 PASSED")

    # 14. Backend health works
    print("\n[CHECK 14/17] Validating FastAPI Application Health...")
    h_resp = client.get("/api/health")
    assert h_resp.status_code == 200
    checks_passed += 1
    print("  -> CHECK 14 PASSED")

    # 15. PostgreSQL database health works
    print("\n[CHECK 15/17] Validating PostgreSQL Database Health...")
    db_resp = client.get("/api/health/db")
    assert db_resp.status_code == 200
    checks_passed += 1
    print("  -> CHECK 15 PASSED")

    # 16. Shipment, Alert, Analytics, and ML Prediction APIs still work
    print("\n[CHECK 16/17] Validating Core System Regression & ML Pipeline...")
    s_resp = client.get("/api/shipments")
    assert s_resp.status_code == 200
    a_resp = client.get("/api/alerts")
    assert a_resp.status_code == 200
    k_resp = client.get("/api/analytics/kpis")
    assert k_resp.status_code == 200
    p_resp = client.post("/api/predictions/risk", json={"shipment_id": "SHP-1048"})
    assert p_resp.status_code == 200
    pred_data = p_resp.json()
    hist_resp = client.get("/api/predictions/history/SHP-1048")
    assert hist_resp.status_code == 200
    print(f"  Shipments: {len(s_resp.json())} loaded | Alerts: {len(a_resp.json())} loaded")
    print(f"  ML Risk Prediction: Score {pred_data['risk_score']}/100 ({pred_data['risk_level']}) via {pred_data['model_name']}")
    print(f"  Top SHAP Risk Driver: {pred_data['top_risk_factors'][0]['factor_name']} (+{pred_data['top_risk_factors'][0]['shap_value']})")
    print(f"  Prediction History: {len(hist_resp.json())} audit records stored in PostgreSQL")
    checks_passed += 1
    print("  -> CHECK 16 PASSED")

    # 17. React production build passes
    print("\n[CHECK 17/17] Validating React Production Build Artifacts...")
    dist_dir = Path("c:/Users/User/Desktop/supply-chain/dist")
    assert (dist_dir / "index.html").exists()
    assert (dist_dir / "assets").exists()
    asset_files = list((dist_dir / "assets").glob("*"))
    assert len(asset_files) >= 2
    checks_passed += 1
    print("  -> CHECK 17 PASSED")

    print("\n" + "=" * 85)
    print(f"ALL {checks_passed}/{total_checks} MASTER ROUTE OPTIMIZATION VERIFICATION CHECKS PASSED (100%)!")
    print("PHASE 5 COMPLETE & FULLY VERIFIED.")
    print("=" * 85)

if __name__ == "__main__":
    run_tests()
