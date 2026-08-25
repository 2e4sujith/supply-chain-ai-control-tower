"""
Application Configuration and External API Settings.
"""

import os
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()


class ExternalDataSettings(BaseModel):
    """Configuration settings for external weather, port, and traffic APIs."""

    weather_api_key: str = Field(default_factory=lambda: os.getenv("WEATHER_API_KEY", ""))
    weather_api_url: str = Field(default_factory=lambda: os.getenv("WEATHER_API_URL", "https://api.weatherapi.com/v1"))
    weather_provider: str = Field(default_factory=lambda: os.getenv("WEATHER_PROVIDER", "mock"))

    traffic_api_key: str = Field(default_factory=lambda: os.getenv("TRAFFIC_API_KEY", ""))
    traffic_api_url: str = Field(default_factory=lambda: os.getenv("TRAFFIC_API_URL", "https://api.tomtom.com/traffic"))
    traffic_provider: str = Field(default_factory=lambda: os.getenv("TRAFFIC_PROVIDER", "mock"))

    port_api_key: str = Field(default_factory=lambda: os.getenv("PORT_API_KEY", ""))
    port_api_url: str = Field(default_factory=lambda: os.getenv("PORT_API_URL", "https://api.marinetraffic.com/v1"))
    port_provider: str = Field(default_factory=lambda: os.getenv("PORT_PROVIDER", "mock"))

    timeout_seconds: float = Field(default_factory=lambda: float(os.getenv("EXTERNAL_DATA_TIMEOUT_SECONDS", "5.0")))
    enable_mock_fallback: bool = Field(default_factory=lambda: os.getenv("ENABLE_MOCK_FALLBACK", "true").lower() in ("true", "1", "yes"))


settings = ExternalDataSettings()
