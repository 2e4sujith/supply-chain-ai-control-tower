"""
Abstract Base Disruption Provider Interface.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional
from app.schemas.disruptions import NormalizedDisruptionEvent, ProviderHealthResponse


class BaseDisruptionProvider(ABC):
    """Abstract interface defining the contract for all external data providers."""

    def __init__(self, name: str, provider_type: str):
        self.name = name
        self.provider_type = provider_type

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if required API credentials and base URLs are configured."""
        pass

    @abstractmethod
    def is_mock_active(self) -> bool:
        """Indicates whether this provider operates in mock/simulation mode."""
        pass

    @abstractmethod
    def fetch_disruptions(self, location: Optional[str] = None, **kwargs) -> list[NormalizedDisruptionEvent]:
        """Retrieve and normalize disruption events for a given location or globally."""
        pass

    @abstractmethod
    def health_check(self) -> ProviderHealthResponse:
        """Perform a connectivity/configuration health check."""
        pass
