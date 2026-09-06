"""
Redis Caching & Resilient Fallback Layer for SupplyChain AI Control Tower.

Provides high-speed caching for real-time external telemetry (weather, port AIS, traffic),
frequent route optimization calculations, and transient operational state.

Features:
- Automatic Redis connection with connection pooling and fast socket timeouts.
- Zero-crash fallback to thread-safe In-Memory TTL Cache if Redis is offline/unavailable.
- Transparent JSON serialization / deserialization.
- Health probe diagnostics for /api/health/readiness and /api/health/redis.
- Safe masking of credentials.
"""

import json
import logging
import threading
import time
from typing import Any, Dict, Optional, Tuple

from app.core.database import settings

logger = logging.getLogger(__name__)

# Attempt importing redis library
try:
    import redis
    REDIS_LIB_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_LIB_AVAILABLE = False


class InMemoryFallbackCache:
    """Thread-safe in-memory cache with TTL support used when Redis is unavailable."""

    def __init__(self, max_items: int = 2000):
        self._lock = threading.Lock()
        self._store: Dict[str, Tuple[Any, float]] = {}  # key -> (value, expiry_timestamp)
        self._max_items = max_items
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            if key in self._store:
                val, expiry = self._store[key]
                if expiry == 0.0 or now < expiry:
                    self.hits += 1
                    return val
                else:
                    # Expired
                    del self._store[key]
            self.misses += 1
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        expiry = (time.time() + ttl) if ttl and ttl > 0 else 0.0
        with self._lock:
            # Simple eviction if exceeding max capacity
            if len(self._store) >= self._max_items and key not in self._store:
                # Evict expired first, or oldest
                now = time.time()
                expired_keys = [k for k, (_, exp) in self._store.items() if exp != 0.0 and now >= exp]
                if expired_keys:
                    for k in expired_keys:
                        del self._store[k]
                else:
                    # Drop first inserted key
                    first_key = next(iter(self._store))
                    del self._store[first_key]

            self._store[key] = (value, expiry)
            return True

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def flush(self, prefix: Optional[str] = None) -> int:
        with self._lock:
            if prefix:
                keys_to_del = [k for k in self._store.keys() if k.startswith(prefix)]
                for k in keys_to_del:
                    del self._store[k]
                return len(keys_to_del)
            else:
                count = len(self._store)
                self._store.clear()
                return count

    def size(self) -> int:
        with self._lock:
            return len(self._store)


class RedisCacheManager:
    """
    Unified Caching Gateway with Redis backend and automatic In-Memory fallback.
    """

    def __init__(self):
        self._client = None
        self._fallback_cache = InMemoryFallbackCache()
        self._is_connected = False
        self._last_connect_attempt = 0.0
        self._reconnect_cooldown = 15.0  # Retry connecting every 15s if down
        self.hits = 0
        self.misses = 0

        self._initialize_client()

    def _initialize_client(self):
        """Attempt to configure Redis client with fast timeout."""
        if not settings.REDIS_ENABLED or not REDIS_LIB_AVAILABLE:
            self._is_connected = False
            self._client = None
            return

        try:
            # Use connection pooling with short socket timeout
            if settings.REDIS_URL:
                self._client = redis.from_url(
                    settings.REDIS_URL,
                    socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    decode_responses=True,
                )
            else:
                self._client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    db=settings.REDIS_DB,
                    socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                    decode_responses=True,
                )

            # Test connection
            self._client.ping()
            self._is_connected = True
            logger.info("Connected to Redis cache at %s", settings.get_masked_redis_url())
        except Exception as e:
            self._is_connected = False
            self._client = None
            logger.info("Redis server not reachable (%s). Activated in-memory fallback cache.", e)

    def _get_active_redis(self):
        """Return connected Redis client or attempt reconnect if cooldown elapsed."""
        if not settings.REDIS_ENABLED or not REDIS_LIB_AVAILABLE:
            return None

        now = time.time()
        if self._is_connected and self._client:
            return self._client

        # Reconnect throttled
        if now - self._last_connect_attempt > self._reconnect_cooldown:
            self._last_connect_attempt = now
            self._initialize_client()
            if self._is_connected:
                return self._client

        return None

    def get(self, key: str) -> Optional[Any]:
        """
        Retrieve value by key. Deserializes JSON automatically.
        """
        client = self._get_active_redis()
        if client:
            try:
                raw = client.get(key)
                if raw is not None:
                    self.hits += 1
                    try:
                        return json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        return raw
                else:
                    self.misses += 1
                    return None
            except Exception as err:
                logger.debug("Redis get error for key '%s': %s. Falling back to memory.", key, err)
                self._is_connected = False

        # Fallback
        val = self._fallback_cache.get(key)
        if val is not None:
            self.hits += 1
        else:
            self.misses += 1
        return val

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Store value under key with optional TTL (seconds). Serializes dict/list to JSON.
        """
        effective_ttl = ttl if ttl is not None else settings.REDIS_DEFAULT_TTL
        
        # Serialize if not primitive string/num/bool
        if isinstance(value, (dict, list)):
            serialized = json.dumps(value)
        else:
            serialized = str(value)

        client = self._get_active_redis()
        if client:
            try:
                if effective_ttl and effective_ttl > 0:
                    client.setex(key, effective_ttl, serialized)
                else:
                    client.set(key, serialized)
                # Keep fallback in sync as secondary cache
                self._fallback_cache.set(key, value, ttl=effective_ttl)
                return True
            except Exception as err:
                logger.debug("Redis set error for key '%s': %s. Using memory fallback.", key, err)
                self._is_connected = False

        # Fallback
        return self._fallback_cache.set(key, value, ttl=effective_ttl)

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        deleted = False
        client = self._get_active_redis()
        if client:
            try:
                deleted = bool(client.delete(key))
            except Exception:
                self._is_connected = False

        fallback_del = self._fallback_cache.delete(key)
        return deleted or fallback_del

    def flush(self, prefix: Optional[str] = None) -> int:
        """Clear cache keys (optionally matching prefix)."""
        count = 0
        client = self._get_active_redis()
        if client:
            try:
                if prefix:
                    keys = client.keys(f"{prefix}*")
                    if keys:
                        count = client.delete(*keys)
                else:
                    client.flushdb()
                    count = 1
            except Exception:
                self._is_connected = False

        fallback_count = self._fallback_cache.flush(prefix)
        return count or fallback_count

    def get_telemetry(self, location: str, provider: str = "ALL") -> Optional[Any]:
        """Helper to get cached telemetry data."""
        cache_key = f"telemetry:{location.lower()}:{provider.lower()}"
        return self.get(cache_key)

    def set_telemetry(self, location: str, provider: str = "ALL", data: Any = None, ttl: Optional[int] = None) -> bool:
        """Helper to set cached telemetry data."""
        cache_key = f"telemetry:{location.lower()}:{provider.lower()}"
        return self.set(cache_key, data, ttl=ttl or settings.REDIS_TELEMETRY_TTL)

    def ping(self) -> bool:
        """Ping Redis server to check live connectivity."""
        client = self._get_active_redis()
        if client:
            try:
                return bool(client.ping())
            except Exception:
                self._is_connected = False
                return False
        return False

    def get_status(self) -> dict:
        """Diagnostic metadata on Redis health and fallback metrics."""
        is_live = self.ping()
        total_ops = self.hits + self.misses
        hit_rate = round((self.hits / total_ops) * 100.0, 1) if total_ops > 0 else 0.0

        if not settings.REDIS_ENABLED:
            status_text = "disabled"
            backend_text = "in_memory_fallback"
        elif is_live:
            status_text = "connected"
            backend_text = "redis"
        else:
            status_text = "unavailable (fallback active)"
            backend_text = "in_memory_fallback"

        return {
            "status": status_text,
            "backend": backend_text,
            "redis_enabled": settings.REDIS_ENABLED,
            "redis_library_installed": REDIS_LIB_AVAILABLE,
            "redis_url_configured": settings.get_masked_redis_url(),
            "is_connected": is_live,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_pct": hit_rate,
            "fallback_items_in_memory": self._fallback_cache.size(),
            "default_ttl_seconds": settings.REDIS_DEFAULT_TTL,
            "telemetry_ttl_seconds": settings.REDIS_TELEMETRY_TTL,
            "route_cache_ttl_seconds": settings.REDIS_ROUTE_CACHE_TTL,
        }


# Singleton instance
redis_cache = RedisCacheManager()
