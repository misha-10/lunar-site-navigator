from functools import lru_cache
from typing import List, Union
import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings and environment configuration."""

    PROJECT_NAME: str = "LunaScope Backend"
    SERVICE_NAME: str = "lunascope-backend"
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Allowed CORS origins for frontend integration (Vite dev server default: http://localhost:5173)
    # Allowed CORS origins for frontend integration
    # Allowed CORS origins for frontend integration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]

    # SPICE ephemeris kernel configuration
    SPICE_KERNEL_DIR: str = "app/data/kernels"
    SPICE_REQUIRED_KERNELS: List[str] = [
        "naif0012.tls",  # Leapseconds Kernel (LSK)
        "pck00010.tpc",  # Planetary Constants Kernel (PCK)
        "de421.bsp",     # JPL Planetary Ephemeris (SPK)
    ]
    SPICE_OPTIONAL_KERNELS: List[str] = [
        "moon_pa_de421_1900-2050.bpc",  # High-precision binary lunar PCK
        "moon_080317.tf",               # Lunar frame specification
    ]
    SPICE_AUTO_DOWNLOAD: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        return []


@lru_cache
def get_settings() -> Settings:
    """Retrieve cached application settings instance."""
    return Settings()
