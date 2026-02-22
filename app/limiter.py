"""Rate limiter for API (SlowAPI)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import RATE_LIMIT_DEFAULT, RATE_LIMIT_ENABLED

# Key by client IP; default_limits applied when enabled
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[RATE_LIMIT_DEFAULT] if RATE_LIMIT_ENABLED else [],
)
