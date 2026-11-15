from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, mission, sites
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LunaScope backend providing qualified lunar ephemeris and landing site analysis.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS for local frontend integration (e.g. Vite on http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router)
app.include_router(sites.router)
app.include_router(mission.router)


@app.get("/", include_in_schema=False)
def read_root():
    """Service landing endpoint with references to documentation and health check."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }
