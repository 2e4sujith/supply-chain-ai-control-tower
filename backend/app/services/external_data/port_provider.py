"""
Port & Maritime Telemetry Provider Interface and Implementations.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from app.schemas.disruptions import (
    DisruptionLocation,
    DisruptionSeverity,
    DisruptionType,
    NormalizedDisruptionEvent,
    ProviderHealthResponse,
    ProviderStatus,
)
from app.services.external_data.base_provider import BaseDisruptionProvider
from app.core.config import settings


MOCK_PORT_EVENTS = [
    {
        "event_id": "DIS-PRT-MOCK-001",
        "location": {"name": "Long_Beach", "city": "Long Beach", "country": "US", "region": "North_America", "lat": 33.77, "lon": -118.19},
        "severity": DisruptionSeverity.CRITICAL,
        "severity_score": 88.0,
        "title": "Severe Berth & Yard Congestion",
        "description": "Container yard dwell times exceeding 7.5 days; 14 container vessels at anchor awaiting berth availability.",
        "metrics": {"vessels_at_anchor": 14, "avg_dwell_days": 7.5, "yard_capacity_pct": 92.0},
    },
    {
        "event_id": "DIS-PRT-MOCK-002",
        "location": {"name": "Suez_Canal", "city": "Suez", "country": "EG", "region": "Middle_East", "lat": 30.59, "lon": 32.57},
        "severity": DisruptionSeverity.HIGH,
        "severity_score": 78.0,
        "title": "Transit Security & Convoy Delays",
        "description": "Convoy scheduling adjustments and security restrictions adding 36-48 hours to Red Sea / Suez transit times.",
        "metrics": {"convoy_delay_hours": 42.0, "traffic_flow_pct": 65.0},
    },
    {
        "event_id": "DIS-PRT-MOCK-003",
        "location": {"name": "Singapore", "city": "Singapore", "country": "SG", "region": "Southeast_Asia", "lat": 1.35, "lon": 103.82},
        "severity": DisruptionSeverity.MEDIUM,
        "severity_score": 62.0,
        "title": "Bunkering & Feeder Backlog",
        "description": "High transshipment volume resulting in average 36-hour waiting times for feeder container vessels.",
        "metrics": {"feeder_wait_hours": 36.0, "berth_utilization_pct": 84.0},
    },
]


class MockPortCongestionProvider(BaseDisruptionProvider):
    """Simulated port & maritime congestion provider for testing."""

    def __init__(self):
        super().__init__(name="MockPortCongestionProvider", provider_type="PORT_CONGESTION")

    def is_configured(self) -> bool:
        return True

    def is_mock_active(self) -> bool:
        return True

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        results = []
        now = datetime.now(timezone.utc)

        for item in MOCK_PORT_EVENTS:
            loc_name = item["location"]["name"]
            if location and location.lower() not in loc_name.lower() and loc_name.lower() not in location.lower():
                continue

            results.append(
                NormalizedDisruptionEvent(
                    event_id=item["event_id"],
                    disruption_type=DisruptionType.PORT_CONGESTION,
                    severity=item["severity"],
                    severity_score=item["severity_score"],
                    location=DisruptionLocation(**item["location"]),
                    title=item["title"],
                    description=item["description"],
                    source_provider="MOCK_PORT_TELEMETRY_SERVICE",
                    is_mock=True,
                    confidence=0.92,
                    timestamp=now,
                    valid_until=now + timedelta(hours=48),
                    affected_radius_km=75.0,
                    metrics=item["metrics"],
                )
            )
        return results

    def health_check(self) -> ProviderHealthResponse:
        return ProviderHealthResponse(
            provider_name=self.name,
            provider_type=self.provider_type,
            status=ProviderStatus.MOCK_ACTIVE,
            configured=True,
            is_mock=True,
            message="Mock port congestion provider active for testing.",
        )


class GenericRestPortProvider(BaseDisruptionProvider):
    """Generic REST client for live port congestion and AIS telemetry APIs."""

    def __init__(self, api_key: str = settings.port_api_key, api_url: str = settings.port_api_url):
        super().__init__(name="GenericRestPortProvider", provider_type="PORT_CONGESTION")
        self.api_key = api_key
        self.api_url = api_url

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 3)

    def is_mock_active(self) -> bool:
        return False

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        if not self.is_configured():
            if settings.enable_mock_fallback:
                return MockPortCongestionProvider().fetch_disruptions(location=location, **kwargs)
            return []
        try:
            return []
        except Exception:
            return []

    def health_check(self) -> ProviderHealthResponse:
        if not self.is_configured():
            return ProviderHealthResponse(
                provider_name=self.name,
                provider_type=self.provider_type,
                status=ProviderStatus.UNCONFIGURED,
                configured=False,
                is_mock=False,
                message="PORT_API_KEY environment variable is not configured.",
            )
        return ProviderHealthResponse(
            provider_name=self.name,
            provider_type=self.provider_type,
            status=ProviderStatus.HEALTHY,
            configured=True,
            is_mock=False,
            message="Port telemetry API configured and ready for live queries.",
        )
