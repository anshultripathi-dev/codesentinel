"""Small, well-documented helpers (sample code for CodeSentinel demos)."""
from typing import Iterable, List, Optional


def clamp(value: float, low: float, high: float) -> float:
    """Return value limited to the inclusive range [low, high]."""
    return max(low, min(high, value))


def mean(values: Iterable[float]) -> Optional[float]:
    """Arithmetic mean, or None for an empty input."""
    data = list(values)
    return sum(data) / len(data) if data else None


def chunk(items: List, size: int) -> List[List]:
    """Split items into consecutive chunks of at most size elements."""
    if size <= 0:
        raise ValueError("size must be positive")
    return [items[i:i + size] for i in range(0, len(items), size)]


def slugify(text: str) -> str:
    """Lower-case text with words joined by single hyphens."""
    return "-".join(text.lower().split())


def is_palindrome(text: str) -> bool:
    """True when text reads the same forwards and backwards (letters only)."""
    letters = [c.lower() for c in text if c.isalnum()]
    return letters == letters[::-1]


def percent(part: float, whole: float) -> float:
    """Percentage of part in whole, 0 when whole is zero."""
    return 100.0 * part / whole if whole else 0.0


def first(items: Iterable, default=None):
    """First element of an iterable, or default."""
    for item in items:
        return item
    return default
