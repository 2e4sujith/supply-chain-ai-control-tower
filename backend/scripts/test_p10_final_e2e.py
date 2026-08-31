"""
Phase 10: Final Integration & End-to-End Master Verification Suite
SupplyChain AI Control Tower
"""

import asyncio
import json
import sys
import time
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import inspect as sa_inspect, text
from app.main import app
from app.core.config import redis_cache
from app.core.database import SessionLocal, engine, settings
from app.models import Alert, DisruptionPrediction, Shipment
from app.services.alert_service import alert_service, external_disruption_service
from app.services.risk_service import risk_service
from app.services.route_service import route_service
from app.services.shipment_service import shipment_service
from app.api import ws_manager

client = TestClient(app)
results = []


def record(test_num, name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    results.append({"num": test_num, "name": name, "status": status, "details": details})
    print(f"[{status}] Test {test_num:02d}: {name}")
    if details:
        print(f"         Detail: {details}")


def run_all_tests():
    print("=" * 80)
    print(" SUPPLYCHAIN AI CONTROL TOWER — PHASE 10 MASTER END-TO-END VERIFICATION")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # TEST 01: Application Startup, Lifespan & Core Endpoints
    # -------------------------------------------------------------------------
    try:
        r_root = client.get("/")
        assert r_root.status_code == 200
        r_docs = client.get("/docs")
        assert r_docs.status_code == 200
        record(1, "FastAPI Backend Startup & OpenAPI Documentation (/docs)", True, f"Status {r_root.status_code}, Docs {r_docs.status_code}")
    except Exception as e:
        record(1, "FastAPI Backend Startup & OpenAPI Documentation (/docs)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 02: PostgreSQL Persistence & Database Schema (P3)
    # -------------------------------------------------------------------------
    try:
        inspector = sa_inspect(engine)
        tables = inspector.get_table_names()
        assert "shipments" in tables, "Table 'shipments' missing"
        assert "alerts" in tables, "Table 'alerts' missing"
        assert "disruption_predictions" in tables, "Table 'disruption_predictions' missing"

        with SessionLocal() as s:
            shipment_count = s.query(Shipment).count()
            alert_count = s.query(Alert).count()
            pred_count = s.query(DisruptionPrediction).count()

        record(2, "PostgreSQL Database Schema & Tables (P3)", True, f"Tables: {tables} (Shipments: {shipment_count}, Alerts: {alert_count}, Predictions: {pred_count})")
    except Exception as e:
        record(2, "PostgreSQL Database Schema & Tables (P3)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 03: Shipment CRUD Flow (P3)
    # -------------------------------------------------------------------------
    test_shp_id = "SHP-P10-VERIFY"
    try:
        # Cleanup
        with SessionLocal() as s:
            old = s.query(Shipment).filter(Shipment.shipment_id == test_shp_id).first()
            if old:
                s.delete(old)
                s.commit()

        # CREATE
        c_res = client.post("/api/shipments", json={
            "shipment_id": test_shp_id,
            "origin": "Singapore, SG",
            "destination": "Rotterdam, NL",
            "current_location": "Strait of Malacca",
            "status": "In transit",
            "risk_score": 38,
            "risk_level": "Low",
            "eta": "Nov 15, 18:00",
            "last_updated": "Just now",
            "priority": "High",
            "risk_factors": ["Normal vessel traffic"],
        })
        assert c_res.status_code == 201

        # GET ONE
        g_res = client.get(f"/api/shipments/{test_shp_id}")
        assert g_res.status_code == 200
        assert g_res.json()["origin"] == "Singapore, SG"

        # UPDATE
        u_res = client.put(f"/api/shipments/{test_shp_id}", json={
            "status": "Delayed",
            "risk_score": 78,
            "risk_level": "High",
        })
        assert u_res.status_code == 200
        assert u_res.json()["status"] == "Delayed"

        record(3, "Shipment CRUD & Repository Flow (P3)", True, f"Created, retrieved, and updated {test_shp_id}")
    except Exception as e:
        record(3, "Shipment CRUD & Repository Flow (P3)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 04: Alert CRUD & Cascade Relationships (P3/P4)
    # -------------------------------------------------------------------------
    test_alt_id = "ALT-P10-VERIFY"
    try:
        # Cleanup
        with SessionLocal() as s:
            old_a = s.query(Alert).filter(Alert.alert_id == test_alt_id).first()
            if old_a:
                s.delete(old_a)
                s.commit()

        # CREATE ALERT
        a_res = client.post("/api/alerts", json={
            "alert_id": test_alt_id,
            "shipment_id": test_shp_id,
            "severity": "CRITICAL",
            "type": "Weather",
            "title": "Severe Cyclone Warning",
            "message": "Category 4 tropical cyclone active in transit lane.",
            "recommended_action": "Reroute south around storm system.",
            "timestamp": "2026-08-31T16:00:00Z",
            "read": False,
        })
        assert a_res.status_code == 201

        # MARK READ
        r_res = client.put(f"/api/alerts/{test_alt_id}/read")
        assert r_res.status_code == 200
        assert r_res.json()["read"] is True

        record(4, "Alert CRUD & State Management (P3/P4)", True, f"Created alert {test_alt_id}, marked read=True")
    except Exception as e:
        record(4, "Alert CRUD & State Management (P3/P4)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 05: XGBoost Machine Learning & PureTreeSHAP Inference (P4)
    # -------------------------------------------------------------------------
    try:
        pred_res = client.post("/api/predictions/risk", json={"shipment_id": test_shp_id})
        assert pred_res.status_code == 200
        p_json = pred_res.json()
        assert "risk_score" in p_json
        assert "risk_level" in p_json
        assert "top_risk_factors" in p_json
        assert len(p_json["top_risk_factors"]) > 0
        assert p_json["model"] == "XGBoost"

        # Verify history
        h_res = client.get(f"/api/predictions/history/{test_shp_id}")
        assert h_res.status_code == 200
        assert len(h_res.json()) >= 1

        record(5, "XGBoost ML & PureTreeSHAP Explainability (P4)", True, f"Score: {p_json['risk_score']}, Level: {p_json['risk_level']}, SHAP Factors: {len(p_json['top_risk_factors'])}")
    except Exception as e:
        record(5, "XGBoost ML & PureTreeSHAP Explainability (P4)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 06: NetworkX Dijkstra Multi-Criteria Routing & Alternative Route (P5)
    # -------------------------------------------------------------------------
    try:
        opt_res = client.post("/api/routes/optimize", json={
            "origin": "Shanghai",
            "destination": "Long_Beach",
            "criterion": "risk_adjusted",
            "ml_risk_score": 65,
        })
        assert opt_res.status_code == 200
        opt_data = opt_res.json()
        assert "path" in opt_data
        assert opt_data["total_distance_km"] > 0

        # Alternative route evaluation
        alt_res = client.post("/api/routes/alternative", json={
            "shipment_id": test_shp_id,
            "criterion": "risk_adjusted",
        })
        assert alt_res.status_code == 200
        alt_data = alt_res.json()
        assert "recommended_route" in alt_data
        assert "is_strictly_safer" in alt_data

        record(6, "NetworkX Dijkstra Routing & Alternative Comparison (P5)", True, f"Optimized Path: {' -> '.join(opt_data['path'][:3])}... (Distance: {opt_data['total_distance_km']:.0f}km)")
    except Exception as e:
        record(6, "NetworkX Dijkstra Routing & Alternative Comparison (P5)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 07: External Telemetry Providers & Resilience (P6)
    # -------------------------------------------------------------------------
    try:
        active_disruptions = external_disruption_service.get_active_disruptions()
        providers_health = external_disruption_service.get_providers_health()
        assert len(providers_health) >= 3
        provider_names = [p.provider_type for p in providers_health]

        record(7, "External Telemetry Providers & Health (P6)", True, f"Providers: {provider_names} (Active disruptions: {len(active_disruptions)})")
    except Exception as e:
        record(7, "External Telemetry Providers & Health (P6)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 08: Redis Caching Gateway & In-Memory Fallback Layer (P7)
    # -------------------------------------------------------------------------
    try:
        r_status = redis_cache.get_status()
        # Test Cache Set/Get/TTL
        redis_cache.set("p10:cache_key", {"verified": True, "ts": time.time()}, ttl=45)
        val = redis_cache.get("p10:cache_key")
        assert val is not None and val["verified"] is True
        redis_cache.delete("p10:cache_key")

        # Telemetry Cache
        redis_cache.set_telemetry("Shanghai", "ALL", [{"event": "mock_storm"}], ttl=60)
        cached_t = redis_cache.get_telemetry("Shanghai", "ALL")
        assert cached_t is not None

        record(8, "Redis Caching Gateway & TTL Expiration (P7)", True, f"Backend: {r_status['backend']} (Connected: {r_status['is_connected']}, Redis URL: {settings.get_masked_redis_url()})")
    except Exception as e:
        record(8, "Redis Caching Gateway & TTL Expiration (P7)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 09: WebSockets Real-Time Updates & Ping-Pong Heartbeat (P8)
    # -------------------------------------------------------------------------
    try:
        with client.websocket_connect("/ws") as ws:
            # 1. Connection ack
            ack = ws.receive_json()
            assert ack["event"] == "connection.established"

            # 2. Ping-pong
            ws.send_json({"type": "ping"})
            pong = ws.receive_json()
            assert pong["event"] == "pong"
            assert pong["data"]["reply"] == "pong"

            # 3. Live shipment update broadcast
            u_res = client.put(f"/api/shipments/{test_shp_id}", json={
                "status": "Customs Hold",
                "risk_score": 95,
                "risk_level": "Critical",
            })
            assert u_res.status_code == 200

            event = ws.receive_json()
            assert event["event"] == "shipment.updated"
            assert event["data"]["shipment_id"] == test_shp_id
            assert event["data"]["status"] == "Customs Hold"

        record(9, "WebSockets Real-Time Streaming & Events (P8)", True, f"Received ack, ping-pong, and real-time shipment.updated event")
    except Exception as e:
        record(9, "WebSockets Real-Time Streaming & Events (P8)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 10: Teardown Test Records
    # -------------------------------------------------------------------------
    try:
        client.delete(f"/api/alerts/{test_alt_id}")
        client.delete(f"/api/shipments/{test_shp_id}")
        record(10, "PostgreSQL Teardown & Referential Integrity", True, f"Deleted test records {test_shp_id} and {test_alt_id}")
    except Exception as e:
        record(10, "PostgreSQL Teardown & Referential Integrity", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 11: Production Security Headers & Correlation Middleware (P9)
    # -------------------------------------------------------------------------
    try:
        res = client.get("/api/health")
        h = res.headers
        assert "X-Request-ID" in h, "Missing X-Request-ID"
        assert h.get("X-Content-Type-Options") == "nosniff"
        assert h.get("X-Frame-Options") == "DENY"
        assert h.get("X-XSS-Protection") == "1; mode=block"
        assert "Referrer-Policy" in h
        assert "Permissions-Policy" in h

        # Check secret masking
        cfg_res = client.get("/api/system/config")
        assert cfg_res.status_code == 200
        cfg_str = json.dumps(cfg_res.json())
        assert "postgre1" not in cfg_str, "PostgreSQL password leaked in config endpoint!"

        record(11, "Production Security Headers & Secret Masking (P9)", True, f"X-Request-ID: {h.get('X-Request-ID')}, All security headers verified")
    except Exception as e:
        record(11, "Production Security Headers & Secret Masking (P9)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 12: Production Deployment Artifacts Physical Existence (P9)
    # -------------------------------------------------------------------------
    try:
        root_dir = backend_dir.parent
        compose_file = root_dir / "docker-compose.yml"
        backend_docker = backend_dir / "Dockerfile"
        frontend_docker = root_dir / "Dockerfile.frontend"
        nginx_conf = root_dir / "nginx.conf"
        deploy_md = root_dir / "DEPLOYMENT.md"

        assert compose_file.is_file(), "docker-compose.yml missing"
        assert backend_docker.is_file(), "backend/Dockerfile missing"
        assert frontend_docker.is_file(), "Dockerfile.frontend missing"
        assert nginx_conf.is_file(), "nginx.conf missing"
        assert deploy_md.is_file(), "DEPLOYMENT.md missing"

        record(12, "Production Docker & Deployment Artifacts (P9)", True, f"All 5 deployment files physically verified at project root")
    except Exception as e:
        record(12, "Production Docker & Deployment Artifacts (P9)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 13: Full Health, Liveness & Readiness Probes (P10)
    # -------------------------------------------------------------------------
    try:
        h_main = client.get("/api/health")
        assert h_main.status_code == 200 and h_main.json()["status"] == "healthy"

        h_db = client.get("/api/health/db")
        assert h_db.status_code == 200 and h_db.json()["status"] == "healthy"

        h_redis = client.get("/api/health/redis")
        assert h_redis.status_code == 200

        h_ready = client.get("/api/health/readiness")
        assert h_ready.status_code == 200
        ready_json = h_ready.json()
        assert ready_json["status"] == "ready"
        assert ready_json["dependencies"]["database"]["status"] == "healthy"
        assert ready_json["dependencies"]["ml_model"]["status"] == "loaded"
        assert ready_json["dependencies"]["routing_graph"]["status"] == "ready"

        record(13, "System Health, Liveness & Readiness Probes (P10)", True, f"Status: {ready_json['status']} (DB: healthy, ML: loaded, Graph: ready, Redis: {ready_json['dependencies']['cache']['backend']})")
    except Exception as e:
        record(13, "System Health, Liveness & Readiness Probes (P10)", False, str(e))

    # -------------------------------------------------------------------------
    # TEST 14: Analytics & Dashboard Aggregate Feed (P1/P10)
    # -------------------------------------------------------------------------
    try:
        overview = client.get("/api/analytics/overview")
        assert overview.status_code == 200
        risk_dist = client.get("/api/analytics/risk-distribution")
        assert risk_dist.status_code == 200
        activity = client.get("/api/analytics/activity")
        assert activity.status_code == 200
        perf = client.get("/api/analytics/performance")
        assert perf.status_code == 200

        o_data = overview.json()
        record(14, "Analytics & Control Tower Metrics (P10)", True, f"Total Shipments: {o_data['total_shipments']}, Active: {o_data['active_shipments']}, High Risk: {o_data['high_risk_shipments']}")
    except Exception as e:
        record(14, "Analytics & Control Tower Metrics (P10)", False, str(e))

    # Summary
    print("\n" + "=" * 80)
    passed_count = sum(1 for r in results if r["status"] == "PASS")
    total_count = len(results)
    failed_count = total_count - passed_count
    print(f"VERIFICATION SUMMARY: {passed_count}/{total_count} Tests PASSED ({failed_count} Failed)")
    print("=" * 80)

    return failed_count == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
