import os
from typing import Optional
import logging

logger = logging.getLogger("redis")

def get_redis_client():
    """Returns a Redis client if available and configured, otherwise None."""
    try:
        import redis
        url = os.environ.get("REDIS_URL")
        if not url:
            # Only attempt localhost if we're explicitly in a dev environment that might have it
            if os.getenv("VERCEL_ENV") == "development":
                url = "redis://localhost:6379"
            else:
                return None
        
        client = redis.from_url(url, decode_responses=True, socket_connect_timeout=1)
        # Ping to check if server is actually up
        client.ping()
        return client
    except (ImportError, Exception) as e:
        # Graceful fallback: Redis is not mandatory
        return None

def store_dataset(key: str, csv_data: str, ttl: int = 3600):
    """Stores the CSV string in Redis with an expiration time."""
    r = get_redis_client()
    if r:
        try:
            r.setex(f"dataset:{key}", ttl, csv_data)
        except Exception as e:
            logger.warning(f"Failed to cache to Redis: {e}")

def get_dataset(key: str) -> Optional[str]:
    """Retrieves the CSV string from Redis by its unique key."""
    r = get_redis_client()
    if r:
        try:
            return r.get(f"dataset:{key}")
        except Exception as e:
            logger.warning(f"Failed to fetch from Redis: {e}")
    return None
