"""SPICE ephemeris service wrapping NASA NAIF SpiceyPy toolkit."""

import logging
from pathlib import Path
import threading
from typing import List, Optional, Tuple
import numpy as np
import spiceypy
from spiceypy.utils.exceptions import NotFoundError, SpiceyError, SpiceyPyError

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class SpiceService:
    """Thread-safe service for managing NASA NAIF SPICE kernels and computations."""

    _lock = threading.RLock()

    def __init__(self, kernel_dir: Optional[Path] = None, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

        if kernel_dir is not None:
            self.kernel_dir = Path(kernel_dir).resolve()
        else:
            self.kernel_dir = Path(self.settings.SPICE_KERNEL_DIR)
            if not self.kernel_dir.is_absolute():
                self.kernel_dir = (Path(__file__).resolve().parent.parent.parent / self.kernel_dir).resolve()

        self._loaded_kernel_paths: List[Path] = []
        self._is_ready: bool = False
        self._missing_required: List[str] = []

        self.ensure_kernels_loaded()

    def get_missing_kernels(self) -> List[str]:
        """Return list of missing required kernel filenames."""
        missing = []
        for req in self.settings.SPICE_REQUIRED_KERNELS:
            path = self.kernel_dir / req
            if not path.is_file():
                missing.append(req)
        return missing

    def is_ready(self) -> bool:
        """Return True if all required SPICE kernels are present and successfully validated."""
        with self._lock:
            return self._is_ready and len(self.get_missing_kernels()) == 0

    def ensure_kernels_loaded(self) -> bool:
        """Inspect kernel directory, load present kernels into SPICE pool, and validate contents."""
        with self._lock:
            # Clear SPICE pool to ensure a clean state for this service instance
            try:
                spiceypy.kclear()
            except Exception:
                pass
            self._loaded_kernel_paths.clear()

            self._missing_required = self.get_missing_kernels()
            if self._missing_required:
                self._is_ready = False
                logger.info(
                    "SPICE kernels missing from %s: %s",
                    self.kernel_dir,
                    ", ".join(self._missing_required),
                )
                return False

            if not self.kernel_dir.exists():
                self._is_ready = False
                return False

            # Load Core required kernels
            for req in self.settings.SPICE_REQUIRED_KERNELS:
                kpath = (self.kernel_dir / req).resolve()
                if not kpath.is_file():
                    self._is_ready = False
                    return False
                try:
                    spiceypy.furnsh(str(kpath))
                    self._loaded_kernel_paths.append(kpath)
                    logger.info("Loaded SPICE kernel: %s", kpath.name)
                except (SpiceyError, SpiceyPyError, Exception) as exc:
                    logger.error("Failed loading SPICE kernel %s: %s", kpath.name, exc)
                    self._is_ready = False
                    return False

            # Validate that essential kernel variables exist in the loaded pool
            try:
                # naif0012.tls must supply leapseconds variable
                spiceypy.dtpool("DELTET/DELTA_T_A")
                # pck00010.tpc must supply lunar dimensions
                spiceypy.dtpool("BODY301_RADII")
            except (NotFoundError, Exception) as exc:
                logger.error("SPICE kernel pool failed sanity check: %s", exc)
                self._is_ready = False
                return False

            # Optional kernels (if present)
            for opt in self.settings.SPICE_OPTIONAL_KERNELS:
                kpath = (self.kernel_dir / opt).resolve()
                if kpath.is_file():
                    try:
                        spiceypy.furnsh(str(kpath))
                        self._loaded_kernel_paths.append(kpath)
                    except Exception as exc:
                        logger.warning("Optional SPICE kernel %s failed to load: %s", kpath.name, exc)

            self._is_ready = True
            return True

    def get_loaded_kernels(self) -> List[str]:
        """Return list of currently loaded kernel filenames."""
        with self._lock:
            loaded = []
            try:
                count = spiceypy.ktotal("ALL")
                for i in range(count):
                    data = spiceypy.kdata(i, "ALL")
                    loaded.append(Path(data[0]).name)
            except Exception:
                pass
            return loaded

    def utc_to_et(self, utc_iso_str: str) -> float:
        """Convert ISO 8601 UTC timestamp to Ephemeris Time (ET / TDB seconds past J2000).

        Requires leapseconds kernel (LSK) to be loaded.
        """
        with self._lock:
            if not self.is_ready():
                raise RuntimeError(
                    f"SPICE kernels not ready. Missing: {', '.join(self.get_missing_kernels())}"
                )
            try:
                return float(spiceypy.str2et(utc_iso_str))
            except (SpiceyError, SpiceyPyError) as exc:
                raise ValueError(f"SPICE failed to convert UTC timestamp '{utc_iso_str}': {exc}") from exc

    def determine_lunar_frame(self, et: float) -> str:
        """Determine highest-fidelity available lunar body-fixed reference frame at instant ET."""
        with self._lock:
            # Check MOON_ME first (Mean Earth/Polar Axis frame, requires frame/binary PCK)
            try:
                if spiceypy.namfrm("MOON_ME") != 0:
                    try:
                        spiceypy.pxform("J2000", "MOON_ME", et)
                        return "MOON_ME"
                    except (SpiceyError, SpiceyPyError, Exception):
                        try:
                            spiceypy.reset()
                        except Exception:
                            pass
            except (SpiceyError, SpiceyPyError, Exception):
                try:
                    spiceypy.reset()
                except Exception:
                    pass

            # Check IAU_MOON (standard IAU analytical lunar body-fixed frame)
            try:
                if spiceypy.namfrm("IAU_MOON") != 0:
                    try:
                        spiceypy.pxform("J2000", "IAU_MOON", et)
                        return "IAU_MOON"
                    except (SpiceyError, SpiceyPyError, Exception):
                        try:
                            spiceypy.reset()
                        except Exception:
                            pass
            except (SpiceyError, SpiceyPyError, Exception):
                try:
                    spiceypy.reset()
                except Exception:
                    pass

            raise RuntimeError("No valid lunar body-fixed reference frame (MOON_ME or IAU_MOON) available in SPICE pool.")

    def get_body_position_wrt_moon(
        self,
        target_body: str,
        et: float,
        frame: str,
        abcorr: str = "LT+S",
    ) -> Tuple[np.ndarray, float]:
        """Compute 3D position vector (km) of target relative to Moon body center in specified frame."""
        with self._lock:
            try:
                pos, lt = spiceypy.spkpos(target_body, et, frame, abcorr, "MOON")
                return np.array(pos, dtype=np.float64), float(lt)
            except (SpiceyError, SpiceyPyError) as exc:
                raise RuntimeError(f"SPICE spkpos failed for target {target_body} relative to MOON: {exc}") from exc

    def unload_all(self) -> None:
        """Unload all kernels and reset the SPICE kernel pool."""
        with self._lock:
            try:
                spiceypy.kclear()
            except Exception:
                pass
            self._loaded_kernel_paths.clear()
            self._is_ready = False


_spice_service_instance: Optional[SpiceService] = None


def get_spice_service() -> SpiceService:
    """Singleton getter for SpiceService."""
    global _spice_service_instance
    if _spice_service_instance is None or not _spice_service_instance.is_ready():
        _spice_service_instance = SpiceService()
    return _spice_service_instance
