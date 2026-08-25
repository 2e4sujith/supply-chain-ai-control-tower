"""
P5.2 Dijkstra Route Optimization Test Suite.

Verifies:
1. Dynamic route calculation using NetworkX Dijkstra shortest path
2. Multi-node path traversal and segment decomposition
3. Weight metrics: distance, duration, and risk-adjusted cost
4. Integration with FastAPI endpoints (/api/routes/optimize, /api/routes/alternative)
5. Robust error handling for unknown origins, destinations, and shipments
6. System regression verification
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
    print("=" * 75)
    print("P5.2 DIJKSTRA ROUTE OPTIMIZATION VERIFICATION SUITE")
    print("=" * 75)

    Base.metadata.create_all(bind=engine)
    shipment_repository.seed_demo_shipments()

    # 1. Direct Dijkstra Calculation: Shanghai -> Long_Beach
    print("\n[TEST 1] Testing Shanghai -> Long_Beach Dijkstra Route...")
    res1 = route_network.dijkstra_shortest_path("Shanghai", "Long_Beach", criterion="time")
    print(f"  Path: {' -> '.join(res1['path'])}")
    print(f"  Distance: {res1['total_distance_km']} km | Time: {res1['estimated_time_hours']} hrs | Cost: {res1['total_cost']}")
    print(f"  Modes: {res1['transport_modes']} | Algorithm: {res1['algorithm']}")
    assert len(res1["path"]) >= 2, "Path should contain at least origin and destination"
    assert res1["total_distance_km"] > 5000, "Distance should be positive and realistic"
    assert res1["estimated_time_hours"] > 0, "Time should be positive"
    assert res1["algorithm"] == "NETWORKX_DIJKSTRA"
    print("  -> PASS")

    # 2. Dijkstra Avoid Nodes (Diverting from bottleneck hub)
    print("\n[TEST 2] Testing Shanghai -> Long_Beach avoiding Long_Beach...")
    res2 = route_network.dijkstra_shortest_path("Shanghai", "Long_Beach", criterion="risk_adjusted", avoid_nodes=["Long_Beach"])
    print(f"  Diverted Path: {' -> '.join(res2['path'])}")
    print(f"  Distance: {res2['total_distance_km']} km | Time: {res2['estimated_time_hours']} hrs")
    assert len(res2["path"]) >= 3, "Diverted path should route through alternate hubs"
    assert "Long_Beach" not in res2["path"][:-1]
    print("  -> PASS")

    # 3. Dijkstra Calculation: Chicago -> Dallas
    print("\n[TEST 3] Testing Chicago -> Dallas Dijkstra Route...")
    res3 = route_network.dijkstra_shortest_path("Chicago", "Dallas", criterion="distance")
    print(f"  Path: {' -> '.join(res3['path'])}")
    print(f"  Distance: {res3['total_distance_km']} km | Modes: {res3['transport_modes']}")
    assert len(res3["path"]) >= 2
    assert res3["total_distance_km"] > 0
    print("  -> PASS")

    # 4. Dijkstra Calculation: Frankfurt -> Toronto
    print("\n[TEST 4] Testing Frankfurt -> Toronto Dijkstra Route...")
    res4 = route_network.dijkstra_shortest_path("Frankfurt", "Toronto", criterion="time")
    print(f"  Path: {' -> '.join(res4['path'])}")
    print(f"  Distance: {res4['total_distance_km']} km | Time: {res4['estimated_time_hours']} hrs")
    assert len(res4["path"]) >= 2
    print("  -> PASS")

    # 5. FastAPI Endpoint: POST /api/routes/optimize
    print("\n[TEST 5] Testing FastAPI POST /api/routes/optimize Endpoint...")
    resp_opt = client.post("/api/routes/optimize", json={
        "origin": "Rotterdam",
        "destination": "Hamburg",
        "criterion": "time"
    })
    data_opt = resp_opt.json()
    print(f"  Optimal Path: {' -> '.join(data_opt['path'])}")
    print(f"  Distance: {data_opt['total_distance_km']} km | Time: {data_opt['estimated_time_hours']} hrs")
    assert resp_opt.status_code == 200
    assert data_opt["algorithm"] == "NETWORKX_DIJKSTRA"
    assert len(data_opt["segments"]) > 0
    print("  -> PASS")

    # 6. FastAPI Endpoint: POST /api/routes/alternative (SHP-1048)
    print("\n[TEST 6] Testing FastAPI POST /api/routes/alternative for SHP-1048...")
    resp_alt = client.post("/api/routes/alternative", json={
        "shipment_id": "SHP-1048",
        "criterion": "risk_adjusted"
    })
    data_alt = resp_alt.json()
    print(f"  Shipment: {data_alt['shipment_id']}")
    print(f"  Current Route: {' > '.join(data_alt['current_route'])}")
    print(f"  Recommended Route: {' > '.join(data_alt['recommended_route'])}")
    print(f"  Reason: {data_alt['reason']}")
    print(f"  Distance: {data_alt['total_distance_km']} km | Time: {data_alt['estimated_time_hours']} hrs")
    assert resp_alt.status_code == 200
    assert data_alt["algorithm"] == "NETWORKX_DIJKSTRA"
    assert len(data_alt["recommended_route"]) >= 2
    assert data_alt["total_distance_km"] > 0
    print("  -> PASS")

    # 7. Error Handling for Unknown Locations & IDs
    print("\n[TEST 7] Testing Error Guardrails...")
    resp_err1 = client.post("/api/routes/optimize", json={"origin": "UnknownPlaceXYZ", "destination": "Long_Beach"})
    assert resp_err1.status_code == 404
    resp_err2 = client.post("/api/routes/alternative", json={"shipment_id": "SHP-9999"})
    assert resp_err2.status_code == 404
    resp_err3 = client.post("/api/routes/alternative", json={"shipment_id": "INVALID-ID"})
    assert resp_err3.status_code == 422
    print("  -> PASS (All error boundaries returned expected HTTP codes)")

    # 8. Core System Regression Checks
    print("\n[TEST 8] Verifying Core System Health & APIs...")
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health/db").status_code == 200
    assert client.get("/api/shipments").status_code == 200
    assert client.get("/api/alerts").status_code == 200
    assert client.get("/api/analytics/kpis").status_code == 200
    assert client.post("/api/predictions/risk", json={"shipment_id": "SHP-1048"}).status_code == 200
    print("  -> PASS (FastAPI, DB, Shipments, Alerts, Analytics, and XGBoost Risk active)")

    print("\n" + "=" * 75)
    print("ALL P5.2 DIJKSTRA ROUTE OPTIMIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
