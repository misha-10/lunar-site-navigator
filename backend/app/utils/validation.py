"""Validation utilities for coordinates, dates, and input constraints."""

from typing import Tuple


def validate_lunar_coordinates(latitude_deg: float, longitude_deg: float) -> Tuple[float, float]:
    """Validate and normalize lunar spherical coordinates.

    Conventions:
    - Latitude: [-90.0, +90.0] degrees, positive North, negative South.
    - Longitude: [-180.0, +180.0] degrees, East-positive.
      If longitude is provided in the [0, 360) degree system with values > 180,
      it is normalized to [-180.0, +180.0] (e.g. 357.0° -> -3.0°).

    Raises:
        ValueError: If latitude or longitude values are outside acceptable ranges.
    """
    if not isinstance(latitude_deg, (int, float)):
        raise ValueError(f"Latitude must be a numeric value, got {type(latitude_deg).__name__}")
    if not isinstance(longitude_deg, (int, float)):
        raise ValueError(f"Longitude must be a numeric value, got {type(longitude_deg).__name__}")

    if latitude_deg < -90.0 or latitude_deg > 90.0:
        raise ValueError(
            f"Invalid latitude {latitude_deg}°: must be within [-90.0, 90.0] degrees."
        )

    # Normalize longitude in [0, 360) to [-180, 180] if provided in 0..360 system
    norm_lon = float(longitude_deg)
    if norm_lon > 180.0 and norm_lon <= 360.0:
        norm_lon -= 360.0

    if norm_lon < -180.0 or norm_lon > 180.0:
        raise ValueError(
            f"Invalid longitude {longitude_deg}°: must be within [-180.0, 180.0] degrees (or [0, 360])."
        )

    return float(latitude_deg), norm_lon
