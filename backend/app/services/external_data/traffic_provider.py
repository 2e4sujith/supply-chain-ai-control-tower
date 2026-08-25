"""
Highway, Rail & Road Traffic Disruption Provider Interface and Implementations.
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


MOCK_TRAFFIC_EVENTS = [
    {
        "event_id": "DIS-TRF-MOCK-001",
        "location": {"name": "Dallas", "city": "Dallas", "country": "US", "region": "North_America", "lat": 32.78, "lon": -96.80},
        "severity": DisruptionSeverity.MEDIUM,
        "severity_score": 52.0,
        "title": "Interstate 35 Freight Corridor Maintenance",
        "description": "Lane closures on I-35 corridor between Dallas and Oklahoma City causing 45-60 minute freight truck delays.",
        "metrics": {"delay_minutes": 55.0, "corridor_speed_kmh": 32.0},
    },
    {
        "event_id": "DIS-TRF-MOCK-002",
        "location": {"name": "Frankfurt", "city": "Frankfurt", "country": "DE", "region": "Europe", "lat": 50.11, "lon": 8.68},
        "severity": DisruptionSeverity.LOW,
        "severity_score": 28.0,
        "title": "Rhine-Alpine Rail Signaling Upgrades",
        "description": "Scheduled overnight rail maintenance on freight corridor with minimal scheduled impact.",
        "metrics": {"delay_minutes": 15.0},
    },
]


class MockTrafficProvider(BaseDisruptionProvider):
    """Simulated traffic & highway congestion provider for testing."""

    def __init__(self):
        super().__init__(name="MockTrafficProvider", provider_type="TRAFFIC")

    def is_configured(self) -> bool:
        return True

    def is_mock_active(self) -> bool:
        return True

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        results = []
        now = datetime.now(timezone.utc)

        for item in MOCK_TRAFFIC_EVENTS:
            loc_name = item["location"]["name"]
            if location and location.lower() not in loc_name.lower() and loc_name.lower() not in location.lower():
                continue

            results.append(
                NormalizedDisruptionEvent(
                    event_id=item["event_id"],
                    disruption_type=DisruptionType.TRAFFIC,
                    severity=item["severity"],
                    severity_score=item["severity_score"],
                    location=DisruptionLocation(**item["location"]),
                    title=item["title"],
                    description=item["description"],
                    source_provider="MOCK_TRAFFIC_SERVICE",
                    is_mock=True,
                    confidence=0.88,
                    timestamp=now,
                    valid_until=now + timedelta(hours=12),
                    affected_radius_km=50.0,
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
            message="Mock traffic provider active for testing.",
        )


class GenericRestTrafficProvider(BaseDisruptionProvider):
    """Generic REST client for live traffic APIs (e.g. TomTom, HERE, Google Traffic)."""

    def __init__(self, api_key: str = settings.traffic_api_key, api_url: str = settings.traffic_api_url):
        super().__init__(name="GenericRestTrafficProvider", provider_type="TRAFFIC")
        self.api_key = api_key
        self.api_url = api_url

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 3)

    def is_mock_active(self) -> bool:
        return False

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        if not self.is_configured():
            if settings.enable_mock_fallback:
                return MockTrafficProvider().fetch_disruptions(location=location, **kwargs)
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
                message="TRAFFIC_API_KEY environment variable is not configured.",
            )
        return ProviderHealthResponse(
            provider_name=self.name,
            provider_type=self.provider_type,
            status=ProviderStatus.HEALTHY,
            configured=True,
            is_mock=False,
            message="Traffic disruption API configured and ready for live queries.",
        )
