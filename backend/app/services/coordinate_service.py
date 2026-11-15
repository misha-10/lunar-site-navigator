"""Coordinate transformation and local horizon frame service for lunar observers."""

import math
from typing import Optional, Tuple
import numpy as np

# Standard IAU triaxial mean lunar radius in kilometers
MOON_MEAN_RADIUS_KM: float = 1737.4


class CoordinateService:
    """Provides coordinate frame transformations between lunar body-fixed and local observer ENU frames."""

    def __init__(self, moon_radius_km: float = MOON_MEAN_RADIUS_KM):
        self.moon_radius_km = moon_radius_km

    def lunar_lat_lon_to_cartesian(
        self,
        latitude_deg: float,
        longitude_deg: float,
        altitude_m: float = 0.0,
    ) -> np.ndarray:
        """Convert spherical lunar latitude and east-positive longitude to body-fixed Cartesian coordinates (km).

        Convention:
        - X axis: points to (0° latitude, 0° longitude)
        - Y axis: points to (0° latitude, 90°E longitude)
        - Z axis: points to the lunar North Pole (+90° latitude)
        """
        lat_rad = math.radians(latitude_deg)
        lon_rad = math.radians(longitude_deg)
        r_km = self.moon_radius_km + (altitude_m / 1000.0)

        x = r_km * math.cos(lat_rad) * math.cos(lon_rad)
        y = r_km * math.cos(lat_rad) * math.sin(lon_rad)
        z = r_km * math.sin(lat_rad)

        return np.array([x, y, z], dtype=np.float64)

    def compute_enu_basis(
        self,
        latitude_deg: float,
        longitude_deg: float,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Compute the local East-North-Up (ENU) orthonormal unit vectors in the lunar body-fixed frame.

        Parameters:
            latitude_deg: Lunar latitude in degrees [-90, +90], negative south.
            longitude_deg: Lunar east-positive longitude in degrees [-180, +180].

        Returns:
            Tuple of unit vectors (e_hat, n_hat, u_hat):
            - e_hat: Eastward unit vector (parallel to lines of latitude)
            - n_hat: Northward unit vector (along local meridian toward north pole)
            - u_hat: Upward unit vector (radial outward normal to spherical surface)
        """
        lat_rad = math.radians(latitude_deg)
        lon_rad = math.radians(longitude_deg)

        cos_lat = math.cos(lat_rad)
        sin_lat = math.sin(lat_rad)
        cos_lon = math.cos(lon_rad)
        sin_lon = math.sin(lon_rad)

        # Up unit vector (radial outward)
        u_hat = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat], dtype=np.float64)

        # Handle exact poles where meridians converge
        if math.isclose(abs(lat_rad), math.pi / 2.0, abs_tol=1e-9):
            if lat_rad > 0:  # Exact North Pole
                n_hat = np.array([-1.0, 0.0, 0.0], dtype=np.float64)
                e_hat = np.array([0.0, 1.0, 0.0], dtype=np.float64)
            else:  # Exact South Pole
                n_hat = np.array([1.0, 0.0, 0.0], dtype=np.float64)
                e_hat = np.array([0.0, 1.0, 0.0], dtype=np.float64)
        else:
            # East unit vector (d/d_lon, normalized)
            e_hat = np.array([-sin_lon, cos_lon, 0.0], dtype=np.float64)
            # North unit vector: cross product u_hat x e_hat
            n_hat = np.array([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat], dtype=np.float64)

        # Normalize to ensure numerical unit vectors
        e_hat = e_hat / np.linalg.norm(e_hat)
        n_hat = n_hat / np.linalg.norm(n_hat)
        u_hat = u_hat / np.linalg.norm(u_hat)

        return e_hat, n_hat, u_hat

    def body_fixed_to_enu(
        self,
        vector_bf: np.ndarray,
        latitude_deg: float,
        longitude_deg: float,
    ) -> np.ndarray:
        """Transform a 3D vector from lunar body-fixed coordinates into the observer's local ENU frame.

        Returns vector as [East, North, Up].
        """
        e_hat, n_hat, u_hat = self.compute_enu_basis(latitude_deg, longitude_deg)
        v_e = float(np.dot(e_hat, vector_bf))
        v_n = float(np.dot(n_hat, vector_bf))
        v_u = float(np.dot(u_hat, vector_bf))

        return np.array([v_e, v_n, v_u], dtype=np.float64)

    def vector_to_azimuth_elevation(self, vector_enu: np.ndarray) -> Tuple[float, float]:
        """Convert a local East-North-Up direction vector to local azimuth and elevation.

        Conventions:
        - Azimuth: degrees clockwise from local North in range [0.0, 360.0).
          0° = North, 90° = East, 180° = South, 270° = West.
        - Elevation: degrees relative to local geometric horizontal plane in range [-90.0, +90.0].
          +90° = Zenith, 0° = Horizon, -90° = Nadir.
        """
        e = float(vector_enu[0])
        n = float(vector_enu[1])
        u = float(vector_enu[2])

        # Azimuth: angle clockwise from North (N is y-axis, E is x-axis)
        az_rad = math.atan2(e, n)
        az_deg = math.degrees(az_rad) % 360.0
        if az_deg < 0:
            az_deg += 360.0

        # Elevation: angle above horizontal plane (E-N plane)
        horiz_dist = math.hypot(e, n)
        el_rad = math.atan2(u, horiz_dist)
        el_deg = math.degrees(el_rad)

        return float(az_deg), float(el_deg)

    def is_above_geometric_horizon(self, elevation_deg: float) -> bool:
        """Determine if a celestial body is geometrically above the local tangent horizon (elevation > 0°)."""
        return elevation_deg > 0.0


_coordinate_service_instance: Optional[CoordinateService] = None


def get_coordinate_service() -> CoordinateService:
    """Singleton getter for CoordinateService."""
    global _coordinate_service_instance
    if _coordinate_service_instance is None:
        _coordinate_service_instance = CoordinateService()
    return _coordinate_service_instance
