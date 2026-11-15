# NASA NAIF SPICE Kernels for LunaScope

This directory stores the official NASA Navigation and Ancillary Information Facility (NAIF) SPICE kernels used by LunaScope for high-accuracy lunar, solar, and terrestrial ephemeris calculations.

## Required Core Kernels

To run high-fidelity ephemeris calculations without an external network dependency, place the following kernels into this directory:

| Filename | Type | Size | Official NAIF Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `naif0012.tls` | LSK | ~5 KB | [NAIF LSK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) | Leapseconds table for converting UTC strings to Ephemeris Time (ET / TDB). |
| `pck00010.tpc` | PCK | ~125 KB | [NAIF PCK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc) | Planetary constants, triaxial dimensions, and IAU lunar orientation (`IAU_MOON`). |
| `de421.bsp` | SPK | ~16 MB | [NAIF SPK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de421.bsp) | JPL Planetary Ephemeris covering 1900–2050 (Sun, Earth, Moon, and barycenters). |

## Optional High-Precision Lunar Orientation Kernels

For higher precision lunar orientation (Mean Earth/Polar Axis frame `MOON_ME` and Principal Axes frame `MOON_PA`):

| Filename | Type | Size | Official NAIF Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `moon_pa_de421_1900-2050.bpc` | Binary PCK | ~2.5 MB | [NAIF Lunar PCK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc) | Sub-meter orientation and physical libration model. |
| `moon_080317.tf` | FK | ~10 KB | [NAIF Frame Kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf) | Frame specifications connecting `MOON_ME` and `MOON_PA`. |

## Download Utility

You can download the core kernels explicitly using the included utility script:

```bash
python -m app.utils.download_kernels --core
```

Or download both core and high-precision lunar kernels:

```bash
python -m app.utils.download_kernels --all
```

If kernels are not downloaded, the backend gracefully flags calculations as `status: "unavailable"` and explains which kernels are missing without crashing.
