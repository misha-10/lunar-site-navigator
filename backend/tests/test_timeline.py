from datetime import datetime, timedelta, timezone
from typing import Optional
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.mission import CelestialBodyStatus
from app.schemas.timeline import TimelineSample
from app.services.ephemeris_service import EphemerisService
from app.services.mission_service import MissionService
from app.services.site_service import SiteService
from app.services.spice_service import SpiceService
from app.services.timeline_service import TimelineService
from app.services.visibility_service import VisibilityService

client = TestClient(app)


# Helper to build mock samples with boolean visibility flags
def create_mock_sample(dt_iso: str, sun_vis: bool, earth_vis: bool, status: str = "calculated") -> TimelineSample:
    return TimelineSample(
        datetime_utc=dt_iso,
        sun=CelestialBodyStatus(
            azimuth_deg=90.0 if status == "calculated" else None,
            elevation_deg=1.5 if (status == "calculated" and sun_vis) else (-1.0 if status == "calculated" else None),
            geometric_above_horizon=sun_vis if status == "calculated" else None,
            terrain_visible=None,
            status=status,
            reason=None if status == "calculated" else "Ephemeris unavailable",
        ),
        earth=CelestialBodyStatus(
            azimuth_deg=0.0 if status == "calculated" else None,
            elevation_deg=5.0 if (status == "calculated" and earth_vis) else (-2.0 if status == "calculated" else None),
            geometric_above_horizon=earth_vis if status == "calculated" else None,
            terrain_visible=None,
            status=status,
            reason=None if status == "calculated" else "Ephemeris unavailable",
        ),
    )


# Helper to build mock samples with explicit elevations for precise mathematical testing
def create_custom_sample(
    dt_iso: str,
    sun_el: Optional[float] = None,
    earth_el: Optional[float] = None,
    status: str = "calculated",
) -> TimelineSample:
    sun_vis = (sun_el is not None and sun_el > 0.0) if status == "calculated" else None
    earth_vis = (earth_el is not None and earth_el > 0.0) if status == "calculated" else None
    return TimelineSample(
        datetime_utc=dt_iso,
        sun=CelestialBodyStatus(
            azimuth_deg=90.0 if status == "calculated" else None,
            elevation_deg=sun_el if status == "calculated" else None,
            geometric_above_horizon=sun_vis,
            terrain_visible=None,
            status=status,
            reason=None if status == "calculated" else "Ephemeris unavailable",
        ),
        earth=CelestialBodyStatus(
            azimuth_deg=0.0 if status == "calculated" else None,
            elevation_deg=earth_el if status == "calculated" else None,
            geometric_above_horizon=earth_vis,
            terrain_visible=None,
            status=status,
            reason=None if status == "calculated" else "Ephemeris unavailable",
        ),
    )


# --- 1. API Request Validation Tests ---

def test_1_valid_site_timeline_request():
    """Verify that a valid site timeline request returns 200 with samples and metadata."""
    payload = {
        "site_id": "shackleton_region",
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T06:00:00Z",
        "step_minutes": 60,
    }
    response = client.post("/mission/timeline", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"]["site_id"] == "shackleton_region"
    assert data["scenario"]["latitude_deg"] == -89.9
    assert data["scenario"]["longitude_deg"] == 0.0
    assert len(data["samples"]) == 7  # 00:00, 01:00, 02:00, 03:00, 04:00, 05:00, 06:00
    assert "sun_visibility_windows" in data
    assert "earth_visibility_windows" in data
    assert data["metadata"]["sample_count"] == 7


def test_2_valid_custom_coordinate_timeline_request():
    """Verify that custom coordinates timeline request returns 200."""
    payload = {
        "latitude_deg": -88.0,
        "longitude_deg": 45.0,
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
        "step_minutes": 30,
    }
    response = client.post("/mission/timeline", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"]["site_id"] is None
    assert data["scenario"]["latitude_deg"] == -88.0
    assert data["scenario"]["longitude_deg"] == 45.0
    assert len(data["samples"]) == 5  # 00:00, 00:30, 01:00, 01:30, 02:00


def test_3_invalid_or_naive_timestamps():
    """Verify that naive timestamps without timezone information are rejected."""
    payload = {
        "site_id": "shackleton_region",
        "start_datetime_utc": "2027-01-15T00:00:00",  # Naive
        "end_datetime_utc": "2027-01-15T06:00:00Z",
    }
    response = client.post("/mission/timeline", json=payload)
    assert response.status_code == 422
    assert "timezone-aware" in str(response.json()).lower()


def test_4_end_timestamp_before_start_timestamp():
    """Verify that end_datetime_utc before start_datetime_utc causes 422 validation error."""
    payload = {
        "site_id": "shackleton_region",
        "start_datetime_utc": "2027-01-15T12:00:00Z",
        "end_datetime_utc": "2027-01-15T06:00:00Z",  # Before start
    }
    response = client.post("/mission/timeline", json=payload)
    assert response.status_code == 422
    assert "strictly after" in str(response.json()).lower()


def test_5_range_exceeding_seven_days():
    """Verify that requested intervals greater than 7 days are rejected with 422."""
    payload = {
        "site_id": "shackleton_region",
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-23T01:00:00Z",  # 8+ days
        "step_minutes": 60,
    }
    response = client.post("/mission/timeline", json=payload)
    assert response.status_code == 422
    assert "exceeds maximum limit of 7 days" in str(response.json()).lower()


def test_6_invalid_sampling_interval():
    """Verify that step_minutes < 15 or > 360 is rejected with 422."""
    res_under = client.post(
        "/mission/timeline",
        json={
            "site_id": "shackleton_region",
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T02:00:00Z",
            "step_minutes": 10,
        },
    )
    assert res_under.status_code == 422

    res_over = client.post(
        "/mission/timeline",
        json={
            "site_id": "shackleton_region",
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-16T00:00:00Z",
            "step_minutes": 400,
        },
    )
    assert res_over.status_code == 422


def test_7_sample_count_limit():
    """Verify that requests generating > 700 samples are rejected."""
    response = client.post(
        "/mission/timeline",
        json={
            "site_id": "shackleton_region",
            "start_datetime_utc": "2027-01-01T00:00:00Z",
            "end_datetime_utc": "2027-01-08T12:00:00Z",
            "step_minutes": 15,
        },
    )
    assert response.status_code == 422
    assert "exceeds the maximum allowed limit of 700" in str(response.json()).lower()


def test_8_correct_timestamp_generation():
    """Verify monotonic timestamp grid generation and step interval matching."""
    service = TimelineService()
    start = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)
    end = datetime(2027, 1, 15, 2, 0, tzinfo=timezone.utc)
    step = 30

    grid = service.generate_timestamps(start, end, step)
    assert len(grid) == 5
    assert grid[0] == start
    assert grid[-1] == end

    end_offgrid = datetime(2027, 1, 15, 2, 15, tzinfo=timezone.utc)
    grid_off = service.generate_timestamps(start, end_offgrid, step)
    assert len(grid_off) == 6
    assert grid_off[-1] == end_offgrid


# --- 2. Deterministic Visibility Window Tests (Using VisibilityService) ---

def test_9_sun_visibility_window_detection():
    """Verify detection of a rising and setting sun visibility window with linear interpolation."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sequence: Below (-1.0), Below (-1.0), Above (+1.5), Above (+1.5), Above (+1.5), Below (-1.0), Below (-1.0)
    samples = [
        create_mock_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=(2 <= i <= 4), earth_vis=False)
        for i in range(7)
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    # Sunrise: e1 = -1.0 at 01:00, e2 = +1.5 at 02:00 -> frac = 1.0/2.5 = 0.4 -> 01:24:00Z
    assert w.start_datetime_utc == "2027-01-15T01:24:00Z"
    # Sunset: e1 = +1.5 at 04:00, e2 = -1.0 at 05:00 -> frac = 1.5/2.5 = 0.6 -> 04:36:00Z
    assert w.end_datetime_utc == "2027-01-15T04:36:00Z"
    assert w.duration_hours == 3.2
    assert w.start_boundary_estimated is True
    assert w.end_boundary_estimated is True
    assert w.start_boundary_reason == "horizon_transition"
    assert w.end_boundary_reason == "horizon_transition"
    assert w.truncated_at_start is False
    assert w.truncated_at_end is False


def test_10_earth_visibility_window_detection():
    """Verify detection of Earth geometric visibility window with linear interpolation."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_mock_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=False, earth_vis=(1 <= i <= 3))
        for i in range(5)
    ]

    windows = vis_service.derive_windows(samples, body="earth")
    assert len(windows) == 1
    w = windows[0]
    # Rising: e0 = -2.0 at 00:00, e1 = 5.0 at 01:00 -> frac = 2.0/7.0 * 3600 = 1029s (17m09s) -> 00:17:09Z
    assert w.start_datetime_utc == "2027-01-15T00:17:09Z"
    # Setting: e3 = 5.0 at 03:00, e4 = -2.0 at 04:00 -> frac = 5.0/7.0 * 3600 = 2571s (42m51s) -> 03:42:51Z
    assert w.end_datetime_utc == "2027-01-15T03:42:51Z"
    assert w.duration_hours == 3.4283
    assert w.start_boundary_reason == "horizon_transition"
    assert w.end_boundary_reason == "horizon_transition"


def test_11_window_open_at_beginning_of_range():
    """Verify that a window open at index 0 is marked range_boundary and truncated_at_start=True."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sequence: Above, Above, Below, Below
    samples = [
        create_mock_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=(i < 2), earth_vis=False)
        for i in range(4)
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    assert w.start_datetime_utc == samples[0].datetime_utc
    assert w.end_datetime_utc == "2027-01-15T01:36:00Z"
    assert w.truncated_at_start is True
    assert w.start_boundary_estimated is False
    assert w.start_boundary_reason == "range_boundary"
    assert w.truncated_at_end is False
    assert w.end_boundary_estimated is True
    assert w.end_boundary_reason == "horizon_transition"


def test_12_window_open_at_end_of_range():
    """Verify that a window still open at index N-1 is marked range_boundary and truncated_at_end=True."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sequence: Below, Below, Above, Above
    samples = [
        create_mock_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=(i >= 2), earth_vis=False)
        for i in range(4)
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    assert w.start_datetime_utc == "2027-01-15T01:24:00Z"
    assert w.end_datetime_utc == samples[3].datetime_utc
    assert w.truncated_at_start is False
    assert w.start_boundary_estimated is True
    assert w.start_boundary_reason == "horizon_transition"
    assert w.truncated_at_end is True
    assert w.end_boundary_estimated is False
    assert w.end_boundary_reason == "range_boundary"


def test_13_multiple_separate_visibility_windows():
    """Verify that multiple disjoint visibility windows are derived separately."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sequence: Above, Above, Below, Above, Above, Above
    vis_flags = [True, True, False, True, True, True]
    samples = [
        create_mock_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=vis_flags[i], earth_vis=False)
        for i in range(len(vis_flags))
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 2
    # Window 1: Range start to sunset between 1 and 2
    assert windows[0].start_datetime_utc == samples[0].datetime_utc
    assert windows[0].end_datetime_utc == "2027-01-15T01:36:00Z"
    assert windows[0].truncated_at_start is True
    assert windows[0].start_boundary_reason == "range_boundary"
    assert windows[0].end_boundary_reason == "horizon_transition"

    # Window 2: Sunrise between 2 and 3 to range end at 5
    assert windows[1].start_datetime_utc == "2027-01-15T02:24:00Z"
    assert windows[1].end_datetime_utc == samples[5].datetime_utc
    assert windows[1].start_boundary_reason == "horizon_transition"
    assert windows[1].end_boundary_reason == "range_boundary"
    assert windows[1].truncated_at_end is True


def test_14_unavailable_samples_do_not_produce_false_windows():
    """Verify that encountering an unavailable sample closes an open window and does not bridge visibility."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sequence: Visible, Visible, UNAVAILABLE, Visible, Visible
    samples = [
        create_mock_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=True, earth_vis=False),
        create_mock_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=True, earth_vis=False),
        create_mock_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=True, earth_vis=False, status="unavailable"),
        create_mock_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=True, earth_vis=False),
        create_mock_sample((t0 + timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_vis=True, earth_vis=False),
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 2

    # Window 1 is terminated by data gap at sample 2; ends at last confirmed sample 1
    assert windows[0].start_datetime_utc == samples[0].datetime_utc
    assert windows[0].end_datetime_utc == samples[1].datetime_utc
    assert windows[0].end_boundary_reason == "data_gap"
    assert windows[0].end_boundary_estimated is False
    assert windows[0].duration_hours == 1.0

    # Window 2 begins after data gap at sample 3; does not interpolate across sample 2
    assert windows[1].start_datetime_utc == samples[3].datetime_utc
    assert windows[1].end_datetime_utc == samples[4].datetime_utc
    assert windows[1].start_boundary_reason == "data_gap"
    assert windows[1].start_boundary_estimated is False
    assert windows[1].end_boundary_reason == "range_boundary"


def test_15_missing_kernels_produce_graceful_unavailable_timeline(tmp_path):
    """Verify that when kernels are missing, timeline returns unavailable metadata and no false windows."""
    empty_spice = SpiceService(kernel_dir=tmp_path)
    empty_timeline = TimelineService(
        ephemeris_service=EphemerisService(spice_service=empty_spice)
    )

    from app.api.dependencies import get_timeline_service
    app.dependency_overrides[get_timeline_service] = lambda: empty_timeline

    try:
        payload = {
            "site_id": "shackleton_region",
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T03:00:00Z",
            "step_minutes": 60,
        }
        response = client.post("/mission/timeline", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["metadata"]["data_mode"] == "unavailable"
        assert len(data["sun_visibility_windows"]) == 0
        assert len(data["earth_visibility_windows"]) == 0
        assert all(s["sun"]["status"] == "unavailable" for s in data["samples"])
    finally:
        app.dependency_overrides.clear()


def test_16_existing_endpoints_remain_unaffected():
    """Verify that /health, /sites, and /mission/calculate continue to operate flawlessly."""
    # Health check
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # Sites catalogue
    res_sites = client.get("/sites")
    assert res_sites.status_code == 200
    assert len(res_sites.json()["sites"]) == 4

    # Calculate single timestamp
    res_calc = client.post(
        "/mission/calculate",
        json={
            "site_id": "shackleton_region",
            "datetime_utc": "2027-01-15T12:00:00Z",
        },
    )
    assert res_calc.status_code == 200
    assert res_calc.json()["scenario"]["site_id"] == "shackleton_region"


# --- 3. Refined Milestone 5 Boundary Interpolation and Reason Tests ---

def test_17_sunrise_linear_interpolation():
    """Verify sunrise linear interpolation: e1 = -2.0 deg at t1, e2 = +1.0 deg at t2 -> crossing at t1 + 2/3 * dt."""
    vis_service = VisibilityService()
    t1 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2027, 1, 15, 1, 0, tzinfo=timezone.utc)

    samples = [
        create_custom_sample(t1.strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-2.0),
        create_custom_sample(t2.strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=1.0),
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]

    # fraction = -(-2.0) / (1.0 - (-2.0)) = 2/3. dt = 3600s. Offset = 2400s (40 min).
    # Crossing = 00:00:00 + 40 min = 00:40:00Z
    assert w.start_datetime_utc == "2027-01-15T00:40:00Z"
    assert w.start_boundary_reason == "horizon_transition"
    assert w.start_boundary_estimated is True
    assert w.truncated_at_start is False


def test_18_sunset_linear_interpolation():
    """Verify sunset linear interpolation: e1 = +3.0 deg at t1, e2 = -1.0 deg at t2 -> crossing at t1 + 3/4 * dt."""
    vis_service = VisibilityService()
    t1 = datetime(2027, 1, 15, 1, 0, tzinfo=timezone.utc)
    t2 = datetime(2027, 1, 15, 2, 0, tzinfo=timezone.utc)

    # Start visible at t1, setting below horizon at t2
    samples = [
        create_custom_sample(t1.strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
        create_custom_sample(t2.strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]

    # fraction = -3.0 / (-1.0 - 3.0) = 3/4 = 0.75. dt = 3600s. Offset = 2700s (45 min).
    # Crossing = 01:00:00 + 45 min = 01:45:00Z
    assert w.end_datetime_utc == "2027-01-15T01:45:00Z"
    assert w.end_boundary_reason == "horizon_transition"
    assert w.end_boundary_estimated is True
    assert w.truncated_at_end is False


def test_19_exact_zero_degree_sample_handling():
    """Verify consistent handling of exact 0.0 degree elevation samples on rising and setting."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Case A: Rising with sample exactly at 0.0 deg
    # e0 = -1.0 at 00:00, e1 = 0.0 at 01:00, e2 = +2.0 at 02:00
    samples_rising = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=0.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
    ]
    w_rising = vis_service.derive_windows(samples_rising, body="sun")
    assert len(w_rising) == 1
    # Fraction between e1=0.0 and e2=2.0 is -0.0/(2.0-0.0) = 0.0 -> Start is exactly at t1 (01:00:00Z)
    assert w_rising[0].start_datetime_utc == "2027-01-15T01:00:00Z"
    assert w_rising[0].start_boundary_reason == "horizon_transition"
    assert w_rising[0].start_boundary_estimated is True

    # Case B: Setting with sample exactly at 0.0 deg
    # e0 = +2.0 at 00:00, e1 = 0.0 at 01:00, e2 = -1.0 at 02:00
    samples_setting = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=0.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
    ]
    w_setting = vis_service.derive_windows(samples_setting, body="sun")
    assert len(w_setting) == 1
    # Fraction between e0=2.0 and e1=0.0 is -2.0/(0.0-2.0) = 1.0 -> End is exactly at t1 (01:00:00Z)
    assert w_setting[0].end_datetime_utc == "2027-01-15T01:00:00Z"
    assert w_setting[0].end_boundary_reason == "horizon_transition"
    assert w_setting[0].end_boundary_estimated is True


def test_20_window_open_at_start_range_boundary():
    """Verify that a window open at index 0 receives reason 'range_boundary' and start_boundary_estimated=False."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
    ]
    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    assert w.start_datetime_utc == samples[0].datetime_utc
    assert w.start_boundary_reason == "range_boundary"
    assert w.start_boundary_estimated is False
    assert w.truncated_at_start is True
    # Setting between 1 and 2: e1=3.0, e2=-1.0 -> frac=3/4 -> 01:45:00Z
    assert w.end_datetime_utc == "2027-01-15T01:45:00Z"
    assert w.end_boundary_reason == "horizon_transition"
    assert w.end_boundary_estimated is True
    assert w.duration_hours == 1.75


def test_21_window_open_at_end_range_boundary():
    """Verify that a window still open at index N-1 receives reason 'range_boundary' and end_boundary_estimated=False."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=1.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
    ]
    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    # Sunrise between 0 and 1: e0=-2.0, e1=1.0 -> frac=2/3 -> 00:40:00Z
    assert w.start_datetime_utc == "2027-01-15T00:40:00Z"
    assert w.start_boundary_reason == "horizon_transition"
    assert w.start_boundary_estimated is True
    assert w.end_datetime_utc == samples[2].datetime_utc
    assert w.end_boundary_reason == "range_boundary"
    assert w.end_boundary_estimated is False
    assert w.truncated_at_end is True
    # Duration: 02:00:00 - 00:40:00 = 80 min = 1.3333 hours
    assert w.duration_hours == 1.3333


def test_22_unavailable_sample_interruption_data_gap():
    """Verify that an unavailable sample terminates a window with reason 'data_gap' without false sunset."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), status="unavailable"),
    ]
    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    assert w.start_datetime_utc == samples[0].datetime_utc
    assert w.start_boundary_reason == "range_boundary"
    assert w.end_datetime_utc == samples[1].datetime_utc
    assert w.end_boundary_reason == "data_gap"
    assert w.end_boundary_estimated is False
    assert w.truncated_at_end is False
    assert w.duration_hours == 1.0


def test_23_no_interpolation_across_unavailable_samples():
    """Verify that no linear interpolation is attempted across unavailable samples."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), status="unavailable"),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_custom_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
    ]
    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    # Starts directly at sample 2 without interpolation across sample 1
    assert w.start_datetime_utc == samples[2].datetime_utc
    assert w.start_boundary_reason == "data_gap"
    assert w.start_boundary_estimated is False
    assert w.end_datetime_utc == samples[3].datetime_utc
    assert w.end_boundary_reason == "range_boundary"
    assert w.duration_hours == 1.0


def test_24_duration_calculated_from_estimated_boundaries():
    """Verify that window duration is calculated from estimated crossing timestamps when both boundaries are available."""
    vis_service = VisibilityService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # e0 = -2.0 at 00:00, e1 = +1.0 at 01:00 (sunrise: 00:40:00Z)
    # e2 = +3.0 at 02:00, e3 = -1.0 at 03:00 (sunset: 02:45:00Z)
    samples = [
        create_custom_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-2.0),
        create_custom_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=1.0),
        create_custom_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
        create_custom_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
    ]

    windows = vis_service.derive_windows(samples, body="sun")
    assert len(windows) == 1
    w = windows[0]
    assert w.start_datetime_utc == "2027-01-15T00:40:00Z"
    assert w.end_datetime_utc == "2027-01-15T02:45:00Z"
    assert w.start_boundary_estimated is True
    assert w.end_boundary_estimated is True
    assert w.start_boundary_reason == "horizon_transition"
    assert w.end_boundary_reason == "horizon_transition"

    # Total duration = 02:45:00 - 00:40:00 = 125 minutes = 7500 seconds -> 7500 / 3600 = 2.08333... hours
    assert w.duration_hours == 2.0833
