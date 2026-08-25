import sys
from pathlib import Path
import json

base_dir = Path("c:/Users/User/Desktop/supply-chain/backend")
sys.path.insert(0, str(base_dir))

# Import app.core to trigger file initialization
import app.core
from app.core import ensure_explainability_files

print("Calling ensure_explainability_files directly...")
ensure_explainability_files(base_dir)
print("Files generated successfully.")

# Now test the imports and verify P6.1 functionality
from app.schemas.disruptions import (
    DisruptionType,
    DisruptionSeverity,
    ProviderStatus,
    DisruptionLocation,
    NormalizedDisruptionEvent,
    ProviderHealthResponse,
)
from app.core.config import settings
from app.services.external_data import (
    external_disruption_service,
    ExternalDisruptionService,
    MockWeatherProvider,
    MockPortCongestionProvider,
    MockTrafficProvider,
)
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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
    print(f"  Provider '{h.provider_name}' [{h.provider_type}]: Status = {h.status.value}, is_mock = {h.is_mock}, Message = '{h.message}'")
    assert h.status in [ProviderStatus.HEALTHY, ProviderStatus.UNCONFIGURED, ProviderStatus.MOCK_ACTIVE]
print("  -> PASS")

# 3. Location disruptions query
print("\n[TEST 3] Querying disruptions for Shanghai...")
sh_events = external_disruption_service.get_location_disruptions("Shanghai")
assert len(sh_events) >= 1
ev = sh_events[0]
print(f"  Event ID: {ev.event_id}")
print(f"  Type: {ev.disruption_type.value} | Severity: {ev.severity.value} ({ev.severity_score}/100)")
print(f"  Title: {ev.title}")
print(f"  Description: {ev.description}")
print(f"  Source: {ev.source_provider} (is_mock: {ev.is_mock})")
print(f"  Metrics: {ev.metrics}")
assert ev.location.name == "Shanghai"
assert ev.is_mock is True
assert ev.severity == DisruptionSeverity.HIGH
print("  -> PASS")

# 4. Location disruptions query for Long_Beach
print("\n[TEST 4] Querying disruptions for Long_Beach...")
lb_events = external_disruption_service.get_location_disruptions("Long_Beach")
assert len(lb_events) >= 1
ev_lb = lb_events[0]
print(f"  Event: {ev_lb.title} | Severity: {ev_lb.severity.value} ({ev_lb.severity_score}/100)")
assert ev_lb.disruption_type == DisruptionType.PORT_CONGESTION
print("  -> PASS")

# 5. Corridor disruptions query for Shanghai -> Long_Beach
print("\n[TEST 5] Querying corridor disruptions (Shanghai -> Long_Beach)...")
corridor_events = external_disruption_service.get_corridor_disruptions("Shanghai", "Long_Beach")
assert len(corridor_events) >= 2
print(f"  Found {len(corridor_events)} active disruptions along corridor:")
for c in corridor_events:
    print(f"    - [{c.disruption_type.value}] {c.location.name}: {c.title} ({c.severity.value})")
print("  -> PASS")

# 6. API Endpoints
print("\n[TEST 6] Testing FastAPI Disruption Endpoints...")
r_act = client.get("/api/disruptions/active")
assert r_act.status_code == 200
print(f"  GET /api/disruptions/active -> {len(r_act.json())} global events")

r_loc = client.get("/api/disruptions/location/Rotterdam")
assert r_loc.status_code == 200
print(f"  GET /api/disruptions/location/Rotterdam -> {len(r_loc.json())} events")

r_cor = client.get("/api/disruptions/corridor?origin=Shanghai&destination=Long_Beach")
assert r_cor.status_code == 200
print(f"  GET /api/disruptions/corridor -> {len(r_cor.json())} events")

r_hlth = client.get("/api/disruptions/providers/health")
assert r_hlth.status_code == 200
print(f"  GET /api/disruptions/providers/health -> {len(r_hlth.json())} providers checked")
print("  -> PASS")

# 7. Safe error handling (invalid/unknown location query)
print("\n[TEST 7] Testing safe error handling on non-existent locations...")
r_none = client.get("/api/disruptions/location/NonExistentCityXYZ")
assert r_none.status_code == 200
assert r_none.json() == []
print("  GET /api/disruptions/location/NonExistentCityXYZ -> returned empty list [] without crashing")
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
print("  All core endpoints remain functional (100%)")
print("  -> PASS")

print("\n" + "=" * 80)
print("ALL P6.1 EXTERNAL DISRUPTION DATA FOUNDATION CHECKS PASSED SUCCESSFULLY!")
print("=" * 80)

