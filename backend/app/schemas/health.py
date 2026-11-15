from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response payload schema."""

    status: str = Field(default="ok", description="Service operational status")
    service: str = Field(default="lunascope-backend", description="Service identifier")
    version: str = Field(default="0.1.0", description="API semantic version")
