"""
P6.1 External Disruption Data Foundation Test Suite.
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.disruptions import DisruptionSeverity, DisruptionType, ProviderStatus
from app.core.config import settings
from app.services.external_data import external_disruption_service

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("P6.1 EXTERNAL DISRUPTION DATA FOUNDATION TEST SUITE")
    print("=" * 80)

    # 1. Config loading
    print("\n[TEST 1] Configuration loading from environment...")
    print(f"  Weather API URL: {settings.weather_api_url}")
    print(f"  Traffic API URL: {settings.traffic_api_url}")
    print(f"  Port API URL: {settings.port_api_url}")
    print(f"  Mock Fallback Enabled: {settings.enable_mock_fallback}")
    assert settings.weather_api_url is not None
    assert settings.timeout_seconds > 0
    print("  -> PASS")

    # 2. Providers health check
    print("\n[TEST 2] External Data Providers Health Check...")
    health_list = external_disruption_service.get_providers_health()
    assert len(health_list) == 3
    for h in health_list:
        print(f"  Provider '{h.provider_name}' [{h.provider_type}]: Status = {h.status.value}, is_mock = {h.is_mock}")
        assert h.status in [ProviderStatus.HEALTHY, ProviderStatus.UNCONFIGURED, ProviderStatus.MOCK_ACTIVE]
    print("  -> PASS")

    # 3. Location disruptions query (Shanghai)
    print("\n[TEST 3] Querying disruptions for Shanghai...")
    sh_events = external_disruption_service.get_location_disruptions("Shanghai")
    assert len(sh_events) >= 1
    ev = sh_events[0]
    print(f"  Event ID: {ev.event_id}")
    print(f"  Type: {ev.disruption_type.value} | Severity: {ev.severity.value} ({ev.severity_score}/100)")
    print(f"  Title: {ev.title}")
    print(f"  Source: {ev.source_provider} (is_mock: {ev.is_mock})")
    assert ev.location.name == "Shanghai"
    assert ev.is_mock is True
    assert ev.severity == DisruptionSeverity.HIGH
    print("  -> PASS")

    # 4. Location disruptions query (Long_Beach)
    print("\n[TEST 4] Querying disruptions for Long_Beach...")
    lb_events = external_disruption_service.get_location_disruptions("Long_Beach")
    assert len(lb_events) >= 1
    ev_lb = lb_events[0]
    print(f"  Event: {ev_lb.title} | Severity: {ev_lb.severity.value}")
    assert ev_lb.disruption_type == DisruptionType.PORT_CONGESTION
    print("  -> PASS")

    # 5. Corridor disruptions query
    print("\n[TEST 5] Querying corridor disruptions (Shanghai -> Long_Beach)...")
    corridor_events = external_disruption_service.get_corridor_disruptions("Shanghai", "Long_Beach")
    assert len(corridor_events) >= 2
    print(f"  Found {len(corridor_events)} active disruptions along corridor.")
    print("  -> PASS")

    # 6. API Endpoints
    print("\n[TEST 6] Testing FastAPI Disruption Endpoints...")
    r_act = client.get("/api/disruptions/active")
    assert r_act.status_code == 200
    r_loc = client.get("/api/disruptions/location/Rotterdam")
    assert r_loc.status_code == 200
    r_cor = client.get("/api/disruptions/corridor?origin=Shanghai&destination=Long_Beach")
    assert r_cor.status_code == 200
    r_hlth = client.get("/api/disruptions/providers/health")
    assert r_hlth.status_code == 200
    print("  All disruption API endpoints 200 OK")
    print("  -> PASS")

    # 7. Safe error handling on non-existent locations
    print("\n[TEST 7] Testing safe error handling on non-existent locations...")
    r_none = client.get("/api/disruptions/location/NonExistentCityXYZ")
    assert r_none.status_code == 200
    assert r_none.json() == []
    print("  -> PASS")

    # 8. Regression checks across core systems
    print("\n[TEST 8] Core system regression checks...")
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health/db").status_code == 200
    assert client.get("/api/shipments").status_code == 200
    assert client.get("/api/alerts").status_code == 200
    assert client.get("/api/analytics/kpis").status_code == 200
    assert client.post("/api/predictions/risk", json={"shipment_id": "SHP-1048"}).status_code == 200
    assert client.post("/api/routes/alternative", json={"shipment_id": "SHP-1048"}).status_code == 200
    print("  All core endpoints functional (100%)")
    print("  -> PASS")

    print("\n" + "=" * 80)
    print("ALL P6.1 EXTERNAL DISRUPTION DATA FOUNDATION CHECKS PASSED!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
