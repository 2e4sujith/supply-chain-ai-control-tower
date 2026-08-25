"""
Unified External Disruption Aggregator Service.

Consolidates weather, port, and traffic disruption intelligence into a
standardized interface for downstream ML disruption prediction and route optimization.
"""

from typing import Optional
from app.schemas.disruptions import (
    DisruptionSeverity,
    DisruptionType,
    NormalizedDisruptionEvent,
    ProviderHealthResponse,
)
from app.services.external_data.base_provider import BaseDisruptionProvider
from app.services.external_data.weather_provider import GenericRestWeatherProvider, MockWeatherProvider
from app.services.external_data.port_provider import GenericRestPortProvider, MockPortCongestionProvider
from app.services.external_data.traffic_provider import GenericRestTrafficProvider, MockTrafficProvider
from app.core.config import settings


class ExternalDisruptionService:
    """Central service managing real-time and mock disruption telemetry providers."""

    def __init__(self):
        self.weather_provider: BaseDisruptionProvider = (
            GenericRestWeatherProvider() if settings.weather_api_key else MockWeatherProvider()
        )
        self.port_provider: BaseDisruptionProvider = (
            GenericRestPortProvider() if settings.port_api_key else MockPortCongestionProvider()
        )
        self.traffic_provider: BaseDisruptionProvider = (
            GenericRestTrafficProvider() if settings.traffic_api_key else MockTrafficProvider()
        )
        self.providers: list[BaseDisruptionProvider] = [
            self.weather_provider,
            self.port_provider,
            self.traffic_provider,
        ]

    def get_location_disruptions(
        self,
        location: str,
        disruption_type: Optional[DisruptionType] = None,
    ) -> list[NormalizedDisruptionEvent]:
        """Query all providers for active disruptions affecting a given supply chain location."""
        events: list[NormalizedDisruptionEvent] = []
        for provider in self.providers:
            try:
                if disruption_type and provider.provider_type != disruption_type.value:
                    continue
                fetched = provider.fetch_disruptions(location=location)
                if fetched:
                    events.extend(fetched)
            except Exception:
                pass
        return events

    def get_corridor_disruptions(
        self,
        origin: str,
        destination: str,
    ) -> list[NormalizedDisruptionEvent]:
        """Aggregate disruptions across origin, transit waypoints, and destination."""
        orig_events = self.get_location_disruptions(origin)
        dest_events = self.get_location_disruptions(destination)
        
        seen_ids = set()
        combined: list[NormalizedDisruptionEvent] = []
        for ev in orig_events + dest_events:
            if ev.event_id not in seen_ids:
                seen_ids.add(ev.event_id)
                combined.append(ev)
        return combined

    def get_active_disruptions(
        self,
        min_severity: Optional[DisruptionSeverity] = None,
    ) -> list[NormalizedDisruptionEvent]:
        """Retrieve all currently tracked global disruption events."""
        events: list[NormalizedDisruptionEvent] = []
        for provider in self.providers:
            try:
                fetched = provider.fetch_disruptions(location=None)
                if fetched:
                    events.extend(fetched)
            except Exception:
                pass

        if min_severity:
            severity_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
            min_lvl = severity_order.get(min_severity.value, 1)
            events = [e for e in events if severity_order.get(e.severity.value, 1) >= min_lvl]

        return events

    def get_providers_health(self) -> list[ProviderHealthResponse]:
        """Return connectivity and configuration health status for all integrated providers."""
        statuses = []
        for provider in self.providers:
            try:
                statuses.append(provider.health_check())
            except Exception as e:
                from app.schemas.disruptions import ProviderStatus
                statuses.append(
                    ProviderHealthResponse(
                        provider_name=provider.name,
                        provider_type=provider.provider_type,
                        status=ProviderStatus.UNAVAILABLE,
                        configured=provider.is_configured(),
                        is_mock=provider.is_mock_active(),
                        message=f"Health check failed: {str(e)}",
                    )
                )
        return statuses


external_disruption_service = ExternalDisruptionService()
