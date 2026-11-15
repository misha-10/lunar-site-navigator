"""Service for deriving continuous geometric visibility windows from sampled time-series data."""

from datetime import datetime, timedelta, timezone
import math
from typing import List, Literal, Optional, Tuple

from app.schemas.timeline import TimelineSample, VisibilityWindow

BoundaryReason = Literal["horizon_transition", "range_boundary", "data_gap"]


class VisibilityService:
    """Detects geometric horizon transitions and derives bounded visibility windows."""

    @staticmethod
    def _parse_utc_iso(iso_str: str) -> datetime:
        """Parse an ISO 8601 UTC timestamp string into a timezone-aware UTC datetime."""
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def _format_utc_iso(dt: datetime) -> str:
        """Format a timezone-aware UTC datetime into standard ISO 8601 UTC string."""
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def _get_sample_info(
        self, sample: TimelineSample, body: str
    ) -> Tuple[bool, Optional[float], datetime]:
        """Extract validity, elevation in degrees, and UTC datetime from a sample."""
        dt = self._parse_utc_iso(sample.datetime_utc)
        body_status = getattr(sample, body, None)
        if body_status is None:
            return False, None, dt
        if body_status.status != "calculated" or body_status.elevation_deg is None:
            return False, None, dt
        el = float(body_status.elevation_deg)
        if not math.isfinite(el):
            return False, None, dt
        return True, el, dt

    def derive_windows(
        self,
        samples: List[TimelineSample],
        body: str = "sun",
    ) -> List[VisibilityWindow]:
        """Derive geometric visibility windows from a chronological list of timeline samples.

        Parameters:
            samples: Chronologically ordered list of TimelineSample objects.
            body: Target body to evaluate ('sun' or 'earth').

        Rules:
        - A sample is valid if status == 'calculated' and elevation_deg is finite.
        - A valid sample is geometrically visible if elevation_deg > 0.0.
        - A valid sample is not visible if elevation_deg <= 0.0.
        - When transitioning between valid adjacent samples across the horizon:
              fraction = -e1 / (e2 - e1)
              crossing_time = t1 + fraction * (t2 - t1)
          The boundary reason is 'horizon_transition', and the boundary is marked estimated.
        - If a window is active at index 0, it is bounded by the start of the evaluation range:
          start timestamp is samples[0].datetime_utc, reason is 'range_boundary',
          truncated_at_start is True, and start_boundary_estimated is False.
        - If a window is active at index N-1, it is bounded by the end of the evaluation range:
          end timestamp is samples[N-1].datetime_utc, reason is 'range_boundary',
          truncated_at_end is True, and end_boundary_estimated is False.
        - Unavailable samples (or samples with non-finite elevation) represent data gaps:
          * They never bridge visibility.
          * They terminate any active window at the last observed valid visible sample,
            setting end_boundary_reason to 'data_gap', end_boundary_estimated to False,
            and truncated_at_end to False.
          * If a visible sample follows an unavailable sample, a new window begins at that
            observed sample, setting start_boundary_reason to 'data_gap',
            start_boundary_estimated to False, and truncated_at_start to False.
          * No interpolation is ever performed across unavailable samples.
        - Duration is calculated as (end_dt - start_dt) in hours, rounded to 4 decimal places.
        """
        if not samples:
            return []

        windows: List[VisibilityWindow] = []

        active_window_start_dt: Optional[datetime] = None
        active_start_reason: Optional[BoundaryReason] = None
        active_start_estimated: bool = False
        active_start_truncated: bool = False
        last_visible_dt: Optional[datetime] = None

        for i in range(len(samples)):
            is_valid, el, dt = self._get_sample_info(samples[i], body)
            is_vis = is_valid and (el is not None) and (el > 0.0)

            if active_window_start_dt is None:
                # No active window
                if is_vis:
                    # Need to open a new visibility window
                    if i == 0:
                        # Window open at the start of the timeline range
                        active_window_start_dt = dt
                        active_start_reason = "range_boundary"
                        active_start_estimated = False
                        active_start_truncated = True
                    else:
                        # Check sample i - 1
                        prev_valid, prev_el, prev_dt = self._get_sample_info(samples[i - 1], body)
                        if prev_valid and prev_el is not None and prev_el <= 0.0:
                            # Horizon transition from prev_el (<= 0) to el (> 0)
                            denom = el - prev_el  # type: ignore[operator]
                            fraction = -prev_el / denom if denom != 0.0 else 0.0
                            dt_diff_sec = (dt - prev_dt).total_seconds()
                            offset_sec = round(fraction * dt_diff_sec)
                            active_window_start_dt = prev_dt + timedelta(seconds=offset_sec)
                            active_start_reason = "horizon_transition"
                            active_start_estimated = True
                            active_start_truncated = False
                        else:
                            # Previous sample was unavailable (data gap)
                            active_window_start_dt = dt
                            active_start_reason = "data_gap"
                            active_start_estimated = False
                            active_start_truncated = False

                    last_visible_dt = dt
            else:
                # An active window is open
                if is_vis:
                    # Continues to be visible
                    last_visible_dt = dt
                elif is_valid:
                    # Valid sample, but el <= 0.0 (Horizon transition / sunset)
                    prev_valid, prev_el, prev_dt = self._get_sample_info(samples[i - 1], body)
                    if prev_valid and prev_el is not None and prev_el > 0.0:
                        denom = el - prev_el  # type: ignore[operator]
                        fraction = -prev_el / denom if denom != 0.0 else 1.0
                        dt_diff_sec = (dt - prev_dt).total_seconds()
                        offset_sec = round(fraction * dt_diff_sec)
                        end_dt = prev_dt + timedelta(seconds=offset_sec)
                        end_reason: BoundaryReason = "horizon_transition"
                        end_estimated = True
                    else:
                        # Fallback (should not occur since active window was open at i - 1)
                        end_dt = last_visible_dt or dt
                        end_reason = "range_boundary"
                        end_estimated = False

                    duration = round((end_dt - active_window_start_dt).total_seconds() / 3600.0, 4)
                    windows.append(
                        VisibilityWindow(
                            start_datetime_utc=self._format_utc_iso(active_window_start_dt),
                            end_datetime_utc=self._format_utc_iso(end_dt),
                            duration_hours=duration,
                            start_boundary_estimated=active_start_estimated,
                            end_boundary_estimated=end_estimated,
                            start_boundary_reason=active_start_reason or "horizon_transition",
                            end_boundary_reason=end_reason,
                            truncated_at_start=active_start_truncated,
                            truncated_at_end=False,
                            visibility_type="geometric",
                            status="estimated_from_samples",
                        )
                    )
                    active_window_start_dt = None
                    last_visible_dt = None
                else:
                    # Unavailable sample / data gap interrupting an active window
                    end_dt = last_visible_dt or dt
                    duration = round((end_dt - active_window_start_dt).total_seconds() / 3600.0, 4)
                    windows.append(
                        VisibilityWindow(
                            start_datetime_utc=self._format_utc_iso(active_window_start_dt),
                            end_datetime_utc=self._format_utc_iso(end_dt),
                            duration_hours=duration,
                            start_boundary_estimated=active_start_estimated,
                            end_boundary_estimated=False,
                            start_boundary_reason=active_start_reason or "data_gap",
                            end_boundary_reason="data_gap",
                            truncated_at_start=active_start_truncated,
                            truncated_at_end=False,
                            visibility_type="geometric",
                            status="estimated_from_samples",
                        )
                    )
                    active_window_start_dt = None
                    last_visible_dt = None

        # Check if a window is still active at the end of the timeline
        if active_window_start_dt is not None:
            end_dt = last_visible_dt or self._parse_utc_iso(samples[-1].datetime_utc)
            duration = round((end_dt - active_window_start_dt).total_seconds() / 3600.0, 4)
            windows.append(
                VisibilityWindow(
                    start_datetime_utc=self._format_utc_iso(active_window_start_dt),
                    end_datetime_utc=self._format_utc_iso(end_dt),
                    duration_hours=duration,
                    start_boundary_estimated=active_start_estimated,
                    end_boundary_estimated=False,
                    start_boundary_reason=active_start_reason or "range_boundary",
                    end_boundary_reason="range_boundary",
                    truncated_at_start=active_start_truncated,
                    truncated_at_end=True,
                    visibility_type="geometric",
                    status="estimated_from_samples",
                )
            )

        return windows


_visibility_service_instance: Optional[VisibilityService] = None


def get_visibility_service() -> VisibilityService:
    """Singleton getter for VisibilityService."""
    global _visibility_service_instance
    if _visibility_service_instance is None:
        _visibility_service_instance = VisibilityService()
    return _visibility_service_instance
