"""
Weather Data Provider Interface and Implementations.
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


MOCK_WEATHER_EVENTS = [
    {
        "event_id": "DIS-WEA-MOCK-001",
        "location": {"name": "Shanghai", "city": "Shanghai", "country": "CN", "region": "East_Asia", "lat": 31.23, "lon": 121.47},
        "severity": DisruptionSeverity.HIGH,
        "severity_score": 82.0,
        "title": "Severe Tropical Typhoon Warning",
        "description": "Category 3 Typhoon approaching East China Sea causing 6-8m sea swells and temporary port berthing suspensions.",
        "metrics": {"wind_speed_kmh": 135.0, "wave_height_m": 7.2, "precipitation_mm_h": 45.0},
    },
    {
        "event_id": "DIS-WEA-MOCK-002",
        "location": {"name": "Rotterdam", "city": "Rotterdam", "country": "NL", "region": "Europe", "lat": 51.92, "lon": 4.48},
        "severity": DisruptionSeverity.MEDIUM,
        "severity_score": 58.0,
        "title": "Dense Fog and Gale Advisory",
        "description": "Reduced visibility (<200m) in North Sea approaches causing vessel speed reductions.",
        "metrics": {"visibility_m": 180.0, "wind_speed_kmh": 65.0},
    },
    {
        "event_id": "DIS-WEA-MOCK-003",
        "location": {"name": "Chicago", "city": "Chicago", "country": "US", "region": "North_America", "lat": 41.88, "lon": -87.63},
        "severity": DisruptionSeverity.HIGH,
        "severity_score": 75.0,
        "title": "Winter Blizzard & Deep Freeze",
        "description": "Sub-zero temperatures and heavy snowfall slowing intermodal rail switching at BNSF logistics terminals.",
        "metrics": {"temperature_c": -18.0, "snow_accumulation_cm": 28.0},
    },
]


class MockWeatherProvider(BaseDisruptionProvider):
    """Simulated weather provider for testing and development when no live API key is configured."""

    def __init__(self):
        super().__init__(name="MockWeatherProvider", provider_type="WEATHER")

    def is_configured(self) -> bool:
        return True

    def is_mock_active(self) -> bool:
        return True

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        results = []
        now = datetime.now(timezone.utc)
        
        for item in MOCK_WEATHER_EVENTS:
            loc_name = item["location"]["name"]
            if location and location.lower() not in loc_name.lower() and loc_name.lower() not in location.lower():
                continue

            results.append(
                NormalizedDisruptionEvent(
                    event_id=item["event_id"],
                    disruption_type=DisruptionType.WEATHER,
                    severity=item["severity"],
                    severity_score=item["severity_score"],
                    location=DisruptionLocation(**item["location"]),
                    title=item["title"],
                    description=item["description"],
                    source_provider="MOCK_WEATHER_SERVICE",
                    is_mock=True,
                    confidence=0.95,
                    timestamp=now,
                    valid_until=now + timedelta(hours=24),
                    affected_radius_km=150.0,
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
            message="Mock weather provider active for local development and testing.",
        )


class GenericRestWeatherProvider(BaseDisruptionProvider):
    """Generic REST Weather API client for live providers (e.g. OpenWeatherMap, WeatherAPI)."""

    def __init__(self, api_key: str = settings.weather_api_key, api_url: str = settings.weather_api_url):
        super().__init__(name="GenericRestWeatherProvider", provider_type="WEATHER")
        self.api_key = api_key
        self.api_url = api_url

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 3)

    def is_mock_active(self) -> bool:
        return False

    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        if not self.is_configured():
            if settings.enable_mock_fallback:
                return MockWeatherProvider().fetch_disruptions(location=location, **kwargs)
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
                message="WEATHER_API_KEY environment variable is not configured.",
            )
        return ProviderHealthResponse(
            provider_name=self.name,
            provider_type=self.provider_type,
            status=ProviderStatus.HEALTHY,
            configured=True,
            is_mock=False,
            message="Weather API configured and ready for live queries.",
        )
