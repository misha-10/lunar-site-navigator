"""Service for orchestrating multi-site lunar landing scenario comparisons."""

from datetime import datetime, timezone
import logging
import math
from typing import List, Optional, Tuple

from fastapi import HTTPException

from app.schemas.comparison import (
    BodySummaryMetrics,
    ComparisonMetadata,
    ComparisonRequest,
    ComparisonResponse,
    ScenarioComparisonResult,
)
from app.schemas.timeline import TimelineRequest, TimelineSample, VisibilityWindow
from app.services.site_service import SiteService, get_site_service
from app.services.timeline_service import TimelineService, get_timeline_service

logger = logging.getLogger(__name__)


class ComparisonService:
    """Orchestrates scenario evaluations, summary metrics calculations, and scientific consistency checks."""

    def __init__(
        self,
        site_service: Optional[SiteService] = None,
        timeline_service: Optional[TimelineService] = None,
    ):
        self.site_service = site_service or get_site_service()
        self.timeline_service = timeline_service or get_timeline_service()

    def _compute_body_summary_metrics(
        self,
        samples: List[TimelineSample],
        windows: List[VisibilityWindow],
        body: str,
        step_minutes: int = 30,
    ) -> BodySummaryMetrics:
        """Compute summary statistics and geometric visibility durations for a body.

        Scientific Rules:
        - Valid samples are strictly those with status == 'calculated' and finite elevation_deg.
        - Unavailable samples are excluded from elevation calculations; they are NEVER treated as zero.
        - If no valid samples exist, min, max, and mean elevations are returned as None.
        - Geometrically visible count is the number of valid samples with geometric_above_horizon is True.
        - Observed geometric visibility duration is computed by summing adjacent valid, visible sample intervals.
          For each consecutive pair:
          * Both samples must have status 'calculated'
          * Both elevations must be finite
          * Both samples must be geometrically above the horizon
          * Time difference between the two timestamps is calculated and added to the duration
          * Intervals containing unavailable or below-horizon samples are never counted.
          * Actual timestamp differences are used rather than assuming a fixed step.
        - Interpolated visibility duration is the sum of durations of all derived visibility windows.
        """
        valid_elevations: List[float] = []
        visible_count = 0

        def is_sample_valid_and_visible(s: TimelineSample) -> Tuple[bool, Optional[float]]:
            body_status = getattr(s, body, None)
            if body_status and body_status.status == "calculated" and body_status.elevation_deg is not None:
                el = float(body_status.elevation_deg)
                if math.isfinite(el):
                    is_vis = body_status.geometric_above_horizon is True
                    return is_vis, el
            return False, None

        for sample in samples:
            is_vis, el = is_sample_valid_and_visible(sample)
            if el is not None:
                valid_elevations.append(el)
            if is_vis:
                visible_count += 1

        valid_count = len(valid_elevations)
        if valid_count > 0:
            min_el = round(min(valid_elevations), 4)
            max_el = round(max(valid_elevations), 4)
            mean_el = round(sum(valid_elevations) / valid_count, 4)
        else:
            min_el = None
            max_el = None
            mean_el = None

        # Observed geometric visibility duration by summing adjacent valid, visible sample intervals
        total_observed_seconds = 0.0
        for i in range(len(samples) - 1):
            vis1, _ = is_sample_valid_and_visible(samples[i])
            vis2, _ = is_sample_valid_and_visible(samples[i + 1])
            if vis1 and vis2:
                dt1 = datetime.fromisoformat(samples[i].datetime_utc.replace("Z", "+00:00"))
                dt2 = datetime.fromisoformat(samples[i + 1].datetime_utc.replace("Z", "+00:00"))
                interval_sec = (dt2 - dt1).total_seconds()
                if interval_sec > 0:
                    total_observed_seconds += interval_sec

        total_sampled_hours = round(total_observed_seconds / 3600.0, 4)
        total_interpolated_hours = round(sum(w.duration_hours for w in windows), 4)

        return BodySummaryMetrics(
            min_elevation_deg=min_el,
            max_elevation_deg=max_el,
            mean_elevation_deg=mean_el,
            valid_sample_count=valid_count,
            geometrically_visible_sample_count=visible_count,
            total_sampled_geometric_visibility_hours=total_sampled_hours,
            interpolated_geometric_visibility_hours=total_interpolated_hours,
        )

    def compare_scenarios(self, request: ComparisonRequest) -> ComparisonResponse:
        """Evaluate and compare 2-4 landing site scenarios over a shared evaluation timeline."""
        # 1. Generate the common timestamp grid once to guarantee identical sample instants
        timestamps = self.timeline_service.generate_timestamps(
            request.start_datetime_utc,
            request.end_datetime_utc,
            request.step_minutes,
        )
        shared_timestamps_str = [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in timestamps]

        results: List[ScenarioComparisonResult] = []
        reference_frames: List[Optional[str]] = []
        any_unavailable_scenario = False

        # 2. Evaluate each scenario in the exact order requested
        for scenario_def in request.scenarios:
            # Resolve site ID or custom coordinates
            resolved_site_id: Optional[str] = None
            if scenario_def.site_id:
                site = self.site_service.get_site_by_id(scenario_def.site_id)
                if not site:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            f"Site '{scenario_def.site_id}' in scenario '{scenario_def.scenario_id}' "
                            f"not found in catalogue."
                        ),
                    )
                resolved_site_id = site.id
                resolved_lat = site.latitude_deg
                resolved_lon = site.longitude_deg
            else:
                resolved_site_id = None
                resolved_lat = scenario_def.latitude_deg  # type: ignore[assignment]
                resolved_lon = scenario_def.longitude_deg  # type: ignore[assignment]

            # Altitude: scenario-specific override or top-level default
            alt_m = (
                float(scenario_def.observer_altitude_m)
                if scenario_def.observer_altitude_m is not None
                else float(request.observer_altitude_m or 0.0)
            )

            # Construct TimelineRequest reusing common time parameters
            t_req = TimelineRequest(
                site_id=resolved_site_id,
                latitude_deg=resolved_lat if not resolved_site_id else None,
                longitude_deg=resolved_lon if not resolved_site_id else None,
                start_datetime_utc=request.start_datetime_utc,
                end_datetime_utc=request.end_datetime_utc,
                step_minutes=request.step_minutes,
                observer_altitude_m=alt_m,
            )

            # Re-use timeline_service (re-uses SPICE kernels already loaded in memory)
            t_resp = self.timeline_service.calculate_timeline(t_req)

            # Compute summary metrics for Sun and Earth
            sun_summary = self._compute_body_summary_metrics(
                t_resp.samples, t_resp.sun_visibility_windows, "sun", request.step_minutes
            )
            earth_summary = self._compute_body_summary_metrics(
                t_resp.samples, t_resp.earth_visibility_windows, "earth", request.step_minutes
            )

            if t_resp.metadata.data_mode != "real_ephemeris":
                any_unavailable_scenario = True

            reference_frames.append(t_resp.metadata.reference_frame)

            results.append(
                ScenarioComparisonResult(
                    scenario_id=scenario_def.scenario_id,
                    name=scenario_def.name,
                    site_id=resolved_site_id,
                    latitude_deg=resolved_lat,
                    longitude_deg=resolved_lon,
                    observer_altitude_m=alt_m,
                    sun_summary=sun_summary,
                    earth_summary=earth_summary,
                    samples=t_resp.samples,
                    sun_visibility_windows=t_resp.sun_visibility_windows,
                    earth_visibility_windows=t_resp.earth_visibility_windows,
                    windows=t_resp.windows,
                    metadata=t_resp.metadata,
                )
            )

        # 3. Assess consistency across scenarios
        distinct_frames = set(reference_frames)
        # Check if all frames are consistent and non-None
        if len(distinct_frames) == 1 and None not in distinct_frames:
            common_frame = reference_frames[0]
            frames_consistent = True
        else:
            common_frame = None
            frames_consistent = False

        warnings: List[str] = []
        if not frames_consistent:
            warnings.append(
                f"Discrepant reference frames across scenarios: {distinct_frames}. "
                "Comparisons between scenarios evaluated under different astronomical reference frames are not scientifically equivalent."
            )

        # Check if all data is complete across all samples
        all_data_complete = (
            not any_unavailable_scenario
            and all(
                all(
                    s.sun.status == "calculated" and s.earth.status == "calculated"
                    for s in res.samples
                )
                for res in results
            )
        )

        if not all_data_complete:
            warnings.append(
                "One or more scenarios contain unavailable ephemeris data. "
                "Missing samples are excluded from summary statistics and must not be interpreted as zero elevation or loss of visibility."
            )

        limitations = [
            f"Common evaluation timeline of {len(shared_timestamps_str)} samples evaluated at {request.step_minutes}-minute step.",
            "All summary metrics represent geometric visibility above the local tangent horizon (elevation > 0°); local terrain obstruction is not evaluated.",
            "Interpolated visibility durations are approximations derived from discrete elevation samples and do not model astronomical topocentric trajectory curvature.",
            "Geometric visibility durations must not be construed as actual solar power availability or guaranteed Earth communication link availability.",
            "Scenarios are presented in requested order without subjective ranking, arbitrary weighting, or feasibility scores.",
        ]

        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        comparison_metadata = ComparisonMetadata(
            start_datetime_utc=request.start_datetime_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end_datetime_utc=request.end_datetime_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            step_minutes=request.step_minutes,
            sample_count=len(shared_timestamps_str),
            scenario_count=len(results),
            all_data_complete=all_data_complete,
            shared_timestamps_utc=shared_timestamps_str,
            common_reference_frame=common_frame,
            frames_consistent=frames_consistent,
            warnings=warnings,
            limitations=limitations,
            calculated_at_utc=now_utc,
        )

        return ComparisonResponse(
            results=results,
            comparison_metadata=comparison_metadata,
        )


_comparison_service_instance: Optional[ComparisonService] = None


def get_comparison_service() -> ComparisonService:
    """Singleton getter for ComparisonService."""
    global _comparison_service_instance
    if _comparison_service_instance is None:
        _comparison_service_instance = ComparisonService()
    return _comparison_service_instance
