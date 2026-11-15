from datetime import datetime, timedelta, timezone
from typing import Optional
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.comparison import (
    ComparisonRequest,
    ScenarioDefinition,
)
from app.schemas.mission import CelestialBodyStatus
from app.schemas.timeline import (
    TimelineMetadata,
    TimelineResponse,
    TimelineSample,
    TimelineScenarioResponse,
    VisibilityWindow,
)
from app.services.comparison_service import ComparisonService
from app.services.ephemeris_service import EphemerisService
from app.services.spice_service import SpiceService
from app.services.timeline_service import TimelineService

client = TestClient(app)


def create_mock_timeline_sample(
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


# --- 1. Two valid predefined sites ---
def test_1_two_valid_predefined_sites():
    """Verify comparison of two valid catalogue sites returns 200 with complete results."""
    payload = {
        "scenarios": [
            {"scenario_id": "shackleton_base", "site_id": "shackleton_region", "name": "Shackleton"},
            {"scenario_id": "malapert_base", "site_id": "malapert_massif", "name": "Malapert"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T03:00:00Z",
        "step_minutes": 60,
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["results"]) == 2
    res_a, res_b = data["results"][0], data["results"][1]

    assert res_a["scenario_id"] == "shackleton_base"
    assert res_a["site_id"] == "shackleton_region"
    assert res_a["name"] == "Shackleton"
    assert res_a["latitude_deg"] == -89.9
    assert len(res_a["samples"]) == 4

    assert res_b["scenario_id"] == "malapert_base"
    assert res_b["site_id"] == "malapert_massif"
    assert res_b["name"] == "Malapert"
    assert res_b["latitude_deg"] == -85.99
    assert len(res_b["samples"]) == 4

    meta = data["comparison_metadata"]
    assert meta["scenario_count"] == 2
    assert meta["sample_count"] == 4
    assert meta["step_minutes"] == 60
    assert len(meta["shared_timestamps_utc"]) == 4


# --- 2. Four valid scenarios ---
def test_2_four_valid_scenarios():
    """Verify comparison with maximum allowed limit of 4 scenarios."""
    payload = {
        "scenarios": [
            {"scenario_id": "s1", "site_id": "shackleton_region"},
            {"scenario_id": "s2", "site_id": "malapert_massif"},
            {"scenario_id": "s3", "site_id": "connecting_ridge"},
            {"scenario_id": "s4", "site_id": "nobile_crater_region"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
        "step_minutes": 30,
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["results"]) == 4
    assert [r["scenario_id"] for r in data["results"]] == ["s1", "s2", "s3", "s4"]
    assert data["comparison_metadata"]["scenario_count"] == 4


# --- 3. Custom coordinate scenarios ---
def test_3_custom_coordinate_scenarios():
    """Verify comparing catalogue sites against custom lunar coordinates."""
    payload = {
        "scenarios": [
            {"scenario_id": "cat_site", "site_id": "shackleton_region"},
            {"scenario_id": "custom_site_1", "latitude_deg": -88.0, "longitude_deg": 45.0, "name": "Custom Alpha"},
            {"scenario_id": "custom_site_2", "latitude_deg": -85.5, "longitude_deg": -120.0},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T01:00:00Z",
        "step_minutes": 30,
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["results"]) == 3
    custom_res = data["results"][1]
    assert custom_res["scenario_id"] == "custom_site_1"
    assert custom_res["site_id"] is None
    assert custom_res["name"] == "Custom Alpha"
    assert custom_res["latitude_deg"] == -88.0
    assert custom_res["longitude_deg"] == 45.0


# --- 4. Duplicate scenario IDs rejected ---
def test_4_duplicate_scenario_ids_rejected():
    """Verify that duplicate scenario_id values within a request are rejected with 422."""
    payload = {
        "scenarios": [
            {"scenario_id": "dup_id", "site_id": "shackleton_region"},
            {"scenario_id": "dup_id", "site_id": "malapert_massif"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 422
    assert "duplicate" in str(response.json()).lower()


# --- 5. Fewer than two scenarios rejected ---
def test_5_fewer_than_two_scenarios_rejected():
    """Verify that fewer than 2 scenarios is rejected with 422."""
    payload = {
        "scenarios": [
            {"scenario_id": "solo", "site_id": "shackleton_region"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 422


# --- 6. More than four scenarios rejected ---
def test_6_more_than_four_scenarios_rejected():
    """Verify that more than 4 scenarios is rejected with 422."""
    payload = {
        "scenarios": [
            {"scenario_id": "s1", "site_id": "shackleton_region"},
            {"scenario_id": "s2", "site_id": "malapert_massif"},
            {"scenario_id": "s3", "site_id": "connecting_ridge"},
            {"scenario_id": "s4", "site_id": "nobile_region"},
            {"scenario_id": "s5", "latitude_deg": -80.0, "longitude_deg": 0.0},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 422


# --- 7. Invalid site ID rejected ---
def test_7_invalid_site_id_rejected():
    """Verify that an unknown site ID causes an HTTP 404 error."""
    payload = {
        "scenarios": [
            {"scenario_id": "valid", "site_id": "shackleton_region"},
            {"scenario_id": "invalid", "site_id": "unknown_crater_999"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 404
    assert "unknown_crater_999" in str(response.json()).lower()


# --- 8. Invalid coordinates rejected ---
def test_8_invalid_coordinates_rejected():
    """Verify rejection of invalid latitude (> 90 or < -90) or partial coordinates."""
    # Latitude out of range
    res_lat = client.post(
        "/mission/compare",
        json={
            "scenarios": [
                {"scenario_id": "s1", "site_id": "shackleton_region"},
                {"scenario_id": "s2", "latitude_deg": -95.0, "longitude_deg": 0.0},
            ],
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T02:00:00Z",
        },
    )
    assert res_lat.status_code == 422

    # Incomplete coordinates (lat only)
    res_incomplete = client.post(
        "/mission/compare",
        json={
            "scenarios": [
                {"scenario_id": "s1", "site_id": "shackleton_region"},
                {"scenario_id": "s2", "latitude_deg": -85.0},
            ],
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T02:00:00Z",
        },
    )
    assert res_incomplete.status_code == 422


# --- 9. Naive datetime rejected ---
def test_9_naive_datetime_rejected():
    """Verify that naive timestamps without timezone information are rejected."""
    payload = {
        "scenarios": [
            {"scenario_id": "s1", "site_id": "shackleton_region"},
            {"scenario_id": "s2", "site_id": "malapert_massif"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00",  # Naive
        "end_datetime_utc": "2027-01-15T02:00:00Z",
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 422
    assert "timezone-aware" in str(response.json()).lower()


# --- 10. Invalid date range rejected ---
def test_10_invalid_date_range_rejected():
    """Verify rejection when end is before start, range > 7 days, or step out of bounds."""
    # End before start
    res_order = client.post(
        "/mission/compare",
        json={
            "scenarios": [
                {"scenario_id": "s1", "site_id": "shackleton_region"},
                {"scenario_id": "s2", "site_id": "malapert_massif"},
            ],
            "start_datetime_utc": "2027-01-15T12:00:00Z",
            "end_datetime_utc": "2027-01-15T06:00:00Z",
        },
    )
    assert res_order.status_code == 422
    assert "strictly after" in str(res_order.json()).lower()

    # Range > 7 days
    res_range = client.post(
        "/mission/compare",
        json={
            "scenarios": [
                {"scenario_id": "s1", "site_id": "shackleton_region"},
                {"scenario_id": "s2", "site_id": "malapert_massif"},
            ],
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-23T01:00:00Z",
        },
    )
    assert res_range.status_code == 422
    assert "7 days" in str(res_range.json()).lower()


# --- 11. Different timestamp grids cannot occur ---
def test_11_different_timestamp_grids_cannot_occur():
    """Verify that by contract design all scenarios share an identical timestamp grid."""
    payload = {
        "scenarios": [
            {"scenario_id": "s1", "site_id": "shackleton_region"},
            {"scenario_id": "s2", "site_id": "malapert_massif"},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T02:00:00Z",
        "step_minutes": 30,
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    shared_grid = data["comparison_metadata"]["shared_timestamps_utc"]
    assert len(shared_grid) == 5
    for result in data["results"]:
        scenario_timestamps = [s["datetime_utc"] for s in result["samples"]]
        assert scenario_timestamps == shared_grid


# --- 12. Identical timestamps across scenario results ---
def test_12_identical_timestamps_across_scenario_results():
    """Verify sample timestamps strictly match across 3 heterogeneous scenarios."""
    payload = {
        "scenarios": [
            {"scenario_id": "s1", "site_id": "shackleton_region"},
            {"scenario_id": "s2", "site_id": "malapert_massif"},
            {"scenario_id": "s3", "latitude_deg": -87.5, "longitude_deg": 10.0},
        ],
        "start_datetime_utc": "2027-01-15T00:00:00Z",
        "end_datetime_utc": "2027-01-15T04:00:00Z",
        "step_minutes": 60,
    }
    response = client.post("/mission/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    ts0 = [s["datetime_utc"] for s in data["results"][0]["samples"]]
    ts1 = [s["datetime_utc"] for s in data["results"][1]["samples"]]
    ts2 = [s["datetime_utc"] for s in data["results"][2]["samples"]]

    assert ts0 == ts1 == ts2
    assert ts0 == ["2027-01-15T00:00:00Z", "2027-01-15T01:00:00Z", "2027-01-15T02:00:00Z", "2027-01-15T03:00:00Z", "2027-01-15T04:00:00Z"]


# --- 13. Summary statistics calculated correctly ---
def test_13_summary_statistics_calculated_correctly():
    """Verify mathematical exactness of min, max, mean, sample counts, and durations."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Sun elevations: 1.0, 3.0, 5.0, -1.0
    # Min = -1.0, Max = 5.0, Mean = (1+3+5-1)/4 = 2.0
    # Valid = 4, Visible = 3 (1.0, 3.0, 5.0 > 0)
    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=1.0),
        create_mock_timeline_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=3.0),
        create_mock_timeline_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=5.0),
        create_mock_timeline_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=-1.0),
    ]

    mock_window = VisibilityWindow(
        start_datetime_utc="2027-01-15T00:00:00Z",
        end_datetime_utc="2027-01-15T02:50:00Z",
        duration_hours=2.8333,
        start_boundary_estimated=False,
        end_boundary_estimated=True,
        start_boundary_reason="range_boundary",
        end_boundary_reason="horizon_transition",
        truncated_at_start=True,
        truncated_at_end=False,
        visibility_type="geometric",
        status="estimated_from_samples",
    )

    metrics = service._compute_body_summary_metrics(
        samples=samples,
        windows=[mock_window],
        body="sun",
        step_minutes=60,
    )

    assert metrics.min_elevation_deg == -1.0
    assert metrics.max_elevation_deg == 5.0
    assert metrics.mean_elevation_deg == 2.0
    assert metrics.valid_sample_count == 4
    assert metrics.geometrically_visible_sample_count == 3
    # 3 visible samples spanning consecutive pairs (00:00->01:00 and 01:00->02:00) = 2.0 hours
    assert metrics.total_sampled_geometric_visibility_hours == 2.0
    assert metrics.interpolated_geometric_visibility_hours == 2.8333


# --- 14. Missing SPICE kernels produce graceful unavailable data ---
def test_14_missing_spice_kernels_produce_graceful_unavailable_data(tmp_path):
    """Verify that when kernels are missing, compare returns 200 with unavailable status and no crash."""
    empty_spice = SpiceService(kernel_dir=tmp_path)
    empty_timeline = TimelineService(
        ephemeris_service=EphemerisService(spice_service=empty_spice)
    )
    empty_comparison = ComparisonService(timeline_service=empty_timeline)

    from app.api.dependencies import get_comparison_service
    app.dependency_overrides[get_comparison_service] = lambda: empty_comparison

    try:
        payload = {
            "scenarios": [
                {"scenario_id": "s1", "site_id": "shackleton_region"},
                {"scenario_id": "s2", "site_id": "malapert_massif"},
            ],
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T02:00:00Z",
            "step_minutes": 60,
        }
        response = client.post("/mission/compare", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["comparison_metadata"]["all_data_complete"] is False
        assert any("unavailable" in w.lower() for w in data["comparison_metadata"]["warnings"])

        for result in data["results"]:
            assert result["metadata"]["data_mode"] == "unavailable"
            sun_sum = result["sun_summary"]
            # Null elevations must NOT be replaced with 0
            assert sun_sum["min_elevation_deg"] is None
            assert sun_sum["max_elevation_deg"] is None
            assert sun_sum["mean_elevation_deg"] is None
            assert sun_sum["valid_sample_count"] == 0
            assert sun_sum["geometrically_visible_sample_count"] == 0
            assert sun_sum["total_sampled_geometric_visibility_hours"] == 0.0
            assert sun_sum["interpolated_geometric_visibility_hours"] == 0.0
    finally:
        app.dependency_overrides.clear()


# --- 15. Partial unavailable data does not create misleading summary metrics ---
def test_15_partial_unavailable_data_does_not_create_misleading_summary_metrics():
    """Verify that samples with unavailable ephemeris are excluded from mean, min, and max (not treated as 0)."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # 3 calculated samples: elevations [2.0, 4.0, 6.0], and 1 UNAVAILABLE sample
    # If null was treated as 0, mean would be (2+4+6+0)/4 = 3.0 (WRONG).
    # True mean over valid samples is (2+4+6)/3 = 4.0 (CORRECT).
    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=4.0),
        create_mock_timeline_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), status="unavailable"),
        create_mock_timeline_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=6.0),
    ]

    metrics = service._compute_body_summary_metrics(
        samples=samples,
        windows=[],
        body="sun",
        step_minutes=60,
    )

    assert metrics.valid_sample_count == 3
    assert metrics.min_elevation_deg == 2.0
    assert metrics.max_elevation_deg == 6.0
    assert metrics.mean_elevation_deg == 4.0
    assert metrics.geometrically_visible_sample_count == 3
    # Pair (0->1) is visible (1.0h); gap at index 2 excludes (1->2) and (2->3)
    assert metrics.total_sampled_geometric_visibility_hours == 1.0


# --- 16. Existing mission and timeline endpoints remain unaffected ---
def test_16_existing_endpoints_remain_unaffected():
    """Verify that /health, /sites, /mission/calculate, and /mission/timeline continue to function."""
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

    # Calculate timeline
    res_time = client.post(
        "/mission/timeline",
        json={
            "site_id": "shackleton_region",
            "start_datetime_utc": "2027-01-15T00:00:00Z",
            "end_datetime_utc": "2027-01-15T02:00:00Z",
            "step_minutes": 60,
        },
    )
    assert res_time.status_code == 200
    assert len(res_time.json()["samples"]) == 3


# --- 17. Four visible hourly samples produce 3.0 observed hours ---
def test_17_four_visible_hourly_samples_produce_three_hours():
    """Verify that 4 visible hourly samples (00:00, 01:00, 02:00, 03:00) yield exactly 3.0 observed hours."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0)
        for i in range(4)
    ]
    metrics = service._compute_body_summary_metrics(samples=samples, windows=[], body="sun")
    assert metrics.valid_sample_count == 4
    assert metrics.geometrically_visible_sample_count == 4
    # 3 intervals of 1 hour = 3.0 observed hours (not 4.0!)
    assert metrics.total_sampled_geometric_visibility_hours == 3.0


# --- 18. Three visible samples produce 2.0 observed hours ---
def test_18_three_visible_samples_produce_two_hours():
    """Verify that 3 visible hourly samples (00:00, 01:00, 02:00) yield exactly 2.0 observed hours."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0)
        for i in range(3)
    ]
    metrics = service._compute_body_summary_metrics(samples=samples, windows=[], body="sun")
    assert metrics.valid_sample_count == 3
    assert metrics.geometrically_visible_sample_count == 3
    # 2 intervals of 1 hour = 2.0 observed hours
    assert metrics.total_sampled_geometric_visibility_hours == 2.0


# --- 19. Irregular final interval is measured correctly ---
def test_19_irregular_final_interval_measured_correctly():
    """Verify that an off-grid final interval (e.g. +15 min) uses actual timestamp difference."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # Samples at 00:00, 01:00, 02:00, and 02:15
    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=2, minutes=15)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
    ]
    metrics = service._compute_body_summary_metrics(samples=samples, windows=[], body="sun")
    assert metrics.valid_sample_count == 4
    assert metrics.geometrically_visible_sample_count == 4
    # Intervals: 1.0h + 1.0h + 0.25h = 2.25 hours
    assert metrics.total_sampled_geometric_visibility_hours == 2.25


# --- 20. Unavailable sample prevents counting interval across the gap ---
def test_20_unavailable_sample_prevents_counting_interval_across_gap():
    """Verify that an unavailable sample in the sequence prevents accumulating duration across the gap."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    # 00:00 (vis), 01:00 (UNAVAILABLE), 02:00 (vis), 03:00 (vis)
    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), status="unavailable"),
        create_mock_timeline_sample((t0 + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
    ]
    metrics = service._compute_body_summary_metrics(samples=samples, windows=[], body="sun")
    assert metrics.valid_sample_count == 3
    assert metrics.geometrically_visible_sample_count == 3
    # Pair (0->1) has unavail; Pair (1->2) has unavail; only Pair (2->3) is both visible = 1.0 hour
    assert metrics.total_sampled_geometric_visibility_hours == 1.0


# --- 21. No valid samples produce zero observed hours without fabricating elevation statistics ---
def test_21_no_valid_samples_produce_zero_observed_hours_no_fabricated_stats():
    """Verify that when no valid samples exist, duration is 0.0h and min/max/mean remain None."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), status="unavailable")
        for i in range(4)
    ]
    metrics = service._compute_body_summary_metrics(samples=samples, windows=[], body="sun")
    assert metrics.valid_sample_count == 0
    assert metrics.geometrically_visible_sample_count == 0
    assert metrics.total_sampled_geometric_visibility_hours == 0.0
    assert metrics.min_elevation_deg is None
    assert metrics.max_elevation_deg is None
    assert metrics.mean_elevation_deg is None


# --- 22. Existing interpolated visibility duration remains unchanged ---
def test_22_existing_interpolated_visibility_duration_remains_unchanged():
    """Verify that interpolated_geometric_visibility_hours strictly reflects window sum, independent of interval pairs."""
    service = ComparisonService()
    t0 = datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc)

    samples = [
        create_mock_timeline_sample((t0 + timedelta(hours=0)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
        create_mock_timeline_sample((t0 + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), sun_el=2.0),
    ]

    mock_windows = [
        VisibilityWindow(
            start_datetime_utc="2027-01-15T00:15:00Z",
            end_datetime_utc="2027-01-15T00:55:00Z",
            duration_hours=0.6667,
            start_boundary_estimated=True,
            end_boundary_estimated=True,
            start_boundary_reason="horizon_transition",
            end_boundary_reason="horizon_transition",
            truncated_at_start=False,
            truncated_at_end=False,
            visibility_type="geometric",
            status="estimated_from_samples",
        ),
        VisibilityWindow(
            start_datetime_utc="2027-01-15T01:10:00Z",
            end_datetime_utc="2027-01-15T01:40:00Z",
            duration_hours=0.5,
            start_boundary_estimated=True,
            end_boundary_estimated=True,
            start_boundary_reason="horizon_transition",
            end_boundary_reason="horizon_transition",
            truncated_at_start=False,
            truncated_at_end=False,
            visibility_type="geometric",
            status="estimated_from_samples",
        ),
    ]

    metrics = service._compute_body_summary_metrics(samples=samples, windows=mock_windows, body="sun")
    # Interval pairs = 1 hour
    assert metrics.total_sampled_geometric_visibility_hours == 1.0
    # Interpolated duration is sum of windows = 0.6667 + 0.5 = 1.1667 hours
    assert metrics.interpolated_geometric_visibility_hours == 1.1667

