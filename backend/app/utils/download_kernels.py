"""Utility script for downloading official NASA NAIF SPICE kernels."""

import argparse
from pathlib import Path
import sys
import httpx

NAIF_KERNEL_URLS = {
    "naif0012.tls": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
    "pck00010.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
    "de421.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
    "de440s.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
    "moon_pa_de421_1900-2050.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
    "moon_080317.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
}

CORE_KERNELS = ["naif0012.tls", "pck00010.tpc", "de421.bsp"]
OPTIONAL_KERNELS = ["moon_pa_de421_1900-2050.bpc", "moon_080317.tf"]


def download_kernel(name: str, target_dir: Path, force: bool = False) -> bool:
    """Download a specific kernel from NAIF repository if not already present."""
    if name not in NAIF_KERNEL_URLS:
        print(f"[ERROR] Unknown kernel: {name}")
        return False

    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / name

    if file_path.exists() and not force:
        print(f"[SKIP] {name} already exists ({file_path.stat().st_size:,} bytes). Use --force to re-download.")
        return True

    url = NAIF_KERNEL_URLS[name]
    print(f"[DOWNLOADING] {name} from {url} ...")

    try:
        with httpx.stream("GET", url, timeout=120.0, follow_redirects=True) as response:
            response.raise_for_status()
            total = int(response.headers.get("content-length", 0))
            downloaded = 0
            with open(file_path, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=131072):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = (downloaded / total) * 100
                        print(f"\r  -> {pct:.1f}% ({downloaded:,} / {total:,} bytes)", end="", flush=True)
            print()
        print(f"[OK] Downloaded {name} -> {file_path}")
        return True
    except Exception as exc:
        print(f"\n[ERROR] Failed to download {name}: {exc}")
        if file_path.exists():
            file_path.unlink()
        return False


def main():
    parser = argparse.ArgumentParser(description="Download official NAIF SPICE kernels for LunaScope.")
    parser.add_argument("--core", action="store_true", help="Download core required kernels (LSK, PCK, SPK)")
    parser.add_argument("--all", action="store_true", help="Download all core and high-precision lunar kernels")
    parser.add_argument("--force", action="store_true", help="Force re-download even if files already exist")
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "kernels",
        help="Target directory for downloaded kernels",
    )
    args = parser.parse_args()

    selected = []
    if args.all:
        selected = CORE_KERNELS + OPTIONAL_KERNELS
    elif args.core or not (args.all or args.core):
        selected = CORE_KERNELS

    print(f"Target directory: {args.dir}")
    print(f"Kernels to download: {', '.join(selected)}")

    success_count = 0
    for kernel in selected:
        if download_kernel(kernel, args.dir, force=args.force):
            success_count += 1

    print(f"\nDone: {success_count}/{len(selected)} kernels ready.")
    if success_count < len(selected):
        sys.exit(1)


if __name__ == "__main__":
    main()
