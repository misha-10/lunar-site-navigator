import math
import numpy as np
import pytest

from app.services.coordinate_service import CoordinateService, MOON_MEAN_RADIUS_KM


@pytest.fixture
def coord_service():
    return CoordinateService()


def test_lunar_lat_lon_to_cartesian_equator(coord_service):
    """Test Cartesian conversion for equatorial points."""
    # (0° lat, 0° lon) should be on the +X axis
    pos_prime = coord_service.lunar_lat_lon_to_cartesian(0.0, 0.0)
    assert np.allclose(pos_prime, [MOON_MEAN_RADIUS_KM, 0.0, 0.0], atol=1e-5)

    # (0° lat, 90° lon) should be on the +Y axis
    pos_90e = coord_service.lunar_lat_lon_to_cartesian(0.0, 90.0)
    assert np.allclose(pos_90e, [0.0, MOON_MEAN_RADIUS_KM, 0.0], atol=1e-5)

    # (0° lat, -90° lon) should be on the -Y axis
    pos_90w = coord_service.lunar_lat_lon_to_cartesian(0.0, -90.0)
    assert np.allclose(pos_90w, [0.0, -MOON_MEAN_RADIUS_KM, 0.0], atol=1e-5)


def test_lunar_lat_lon_to_cartesian_poles(coord_service):
    """Test Cartesian conversion for North and South poles."""
    # North pole (+90°) should be on the +Z axis
    pos_north = coord_service.lunar_lat_lon_to_cartesian(90.0, 0.0)
    assert np.allclose(pos_north, [0.0, 0.0, MOON_MEAN_RADIUS_KM], atol=1e-5)

    # South pole (-90°) should be on the -Z axis
    pos_south = coord_service.lunar_lat_lon_to_cartesian(-90.0, 0.0)
    assert np.allclose(pos_south, [0.0, 0.0, -MOON_MEAN_RADIUS_KM], atol=1e-5)


def test_lunar_lat_lon_to_cartesian_with_altitude(coord_service):
    """Test that observer altitude in meters is correctly added to lunar radius."""
    alt_m = 5000.0  # 5 km
    pos_alt = coord_service.lunar_lat_lon_to_cartesian(0.0, 0.0, altitude_m=alt_m)
    assert np.allclose(pos_alt, [MOON_MEAN_RADIUS_KM + 5.0, 0.0, 0.0], atol=1e-5)


def test_observer_altitude_1000m_adds_exactly_1km(coord_service):
    """Verify that an altitude of 1000 meters changes the observer radius by exactly 1 kilometer."""
    # Test at lunar south pole (-89.9° lat, 0.0° lon)
    pos_0m = coord_service.lunar_lat_lon_to_cartesian(-89.9, 0.0, altitude_m=0.0)
    pos_1000m = coord_service.lunar_lat_lon_to_cartesian(-89.9, 0.0, altitude_m=1000.0)

    radius_0m = np.linalg.norm(pos_0m)
    radius_1000m = np.linalg.norm(pos_1000m)

    assert math.isclose(radius_0m, MOON_MEAN_RADIUS_KM, abs_tol=1e-9)
    assert math.isclose(radius_1000m, MOON_MEAN_RADIUS_KM + 1.0, abs_tol=1e-9)
    assert math.isclose(radius_1000m - radius_0m, 1.0, abs_tol=1e-9)


def test_compute_enu_basis_orthonormality(coord_service):
    """Verify that compute_enu_basis produces orthonormal right-handed vectors across locations."""
    test_locations = [
        (0.0, 0.0),
        (-89.9, 0.0),      # Shackleton region
        (-85.99, -2.93),   # Malapert Massif
        (-89.44, -137.3),  # Connecting Ridge
        (-85.28, 37.8),    # Nobile region
        (45.0, 45.0),
        (-90.0, 0.0),      # Exact South Pole
        (90.0, 0.0),       # Exact North Pole
    ]

    for lat, lon in test_locations:
        e, n, u = coord_service.compute_enu_basis(lat, lon)

        # Unit lengths
        assert math.isclose(np.linalg.norm(e), 1.0, abs_tol=1e-6)
        assert math.isclose(np.linalg.norm(n), 1.0, abs_tol=1e-6)
        assert math.isclose(np.linalg.norm(u), 1.0, abs_tol=1e-6)

        # Mutually orthogonal
        assert math.isclose(np.dot(e, n), 0.0, abs_tol=1e-6)
        assert math.isclose(np.dot(e, u), 0.0, abs_tol=1e-6)
        assert math.isclose(np.dot(n, u), 0.0, abs_tol=1e-6)

        # Right-handed (e x n = u)
        cross_en = np.cross(e, n)
        assert np.allclose(cross_en, u, atol=1e-5)


def test_vector_to_azimuth_elevation_cardinal_directions(coord_service):
    """Verify azimuth and elevation calculations for cardinal local directions."""
    # North: E=0, N=1, U=0 -> Az=0°, El=0°
    az_n, el_n = coord_service.vector_to_azimuth_elevation(np.array([0.0, 1.0, 0.0]))
    assert math.isclose(az_n, 0.0, abs_tol=1e-5)
    assert math.isclose(el_n, 0.0, abs_tol=1e-5)

    # East: E=1, N=0, U=0 -> Az=90°, El=0°
    az_e, el_e = coord_service.vector_to_azimuth_elevation(np.array([1.0, 0.0, 0.0]))
    assert math.isclose(az_e, 90.0, abs_tol=1e-5)
    assert math.isclose(el_e, 0.0, abs_tol=1e-5)

    # South: E=0, N=-1, U=0 -> Az=180°, El=0°
    az_s, el_s = coord_service.vector_to_azimuth_elevation(np.array([0.0, -1.0, 0.0]))
    assert math.isclose(az_s, 180.0, abs_tol=1e-5)
    assert math.isclose(el_s, 0.0, abs_tol=1e-5)

    # West: E=-1, N=0, U=0 -> Az=270°, El=0°
    az_w, el_w = coord_service.vector_to_azimuth_elevation(np.array([-1.0, 0.0, 0.0]))
    assert math.isclose(az_w, 270.0, abs_tol=1e-5)
    assert math.isclose(el_w, 0.0, abs_tol=1e-5)


def test_vector_to_azimuth_elevation_vertical(coord_service):
    """Verify elevation calculation for zenith and nadir."""
    # Zenith (straight up): E=0, N=0, U=1 -> El=+90°
    az_zen, el_zen = coord_service.vector_to_azimuth_elevation(np.array([0.0, 0.0, 1.0]))
    assert math.isclose(el_zen, 90.0, abs_tol=1e-5)

    # Nadir (straight down): E=0, N=0, U=-1 -> El=-90°
    az_nad, el_nad = coord_service.vector_to_azimuth_elevation(np.array([0.0, 0.0, -1.0]))
    assert math.isclose(el_nad, -90.0, abs_tol=1e-5)


def test_vector_to_azimuth_elevation_45_deg_angles(coord_service):
    """Verify 45-degree azimuth and elevation."""
    # North-East, 45° elevation: E=1, N=1, U=sqrt(2)
    vec = np.array([1.0, 1.0, math.sqrt(2.0)])
    az, el = coord_service.vector_to_azimuth_elevation(vec)
    assert math.isclose(az, 45.0, abs_tol=1e-4)
    assert math.isclose(el, 45.0, abs_tol=1e-4)


def test_geometric_horizon_check(coord_service):
    """Verify geometric horizon decision boundary."""
    assert coord_service.is_above_geometric_horizon(0.001) is True
    assert coord_service.is_above_geometric_horizon(0.0) is False
    assert coord_service.is_above_geometric_horizon(-0.5) is False
    assert coord_service.is_above_geometric_horizon(15.0) is True
