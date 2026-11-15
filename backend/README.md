# LunaScope Backend

Backend service for **LunaScope**: a decision-support application for evaluating candidate lunar south-pole landing sites and dates.

## Technology Stack

- **Python**: 3.11+
- **API Framework**: FastAPI
- **Data Validation & Settings**: Pydantic v2 & Pydantic-Settings
- **Server**: Uvicorn
- **Testing**: pytest & FastAPI TestClient

## Project Structure

```text
backend/
├── app/
│   ├── main.py                   # FastAPI application initialization & middleware
│   ├── config.py                 # Configuration settings (Pydantic Settings)
│   ├── api/
│   │   ├── dependencies.py       # FastAPI dependency injection
│   │   └── routes/
│   │       └── health.py         # Health check endpoint
│   ├── models/                   # Internal domain models
│   ├── schemas/                  # Pydantic request/response schemas
│   │   └── health.py
│   ├── services/                 # Scientific calculation services
│   ├── data/                     # Site catalogues and static data
│   └── utils/                    # Utility functions
├── tests/
│   └── test_health.py            # API tests for health and CORS
├── requirements.txt              # Production and development dependencies
├── .env.example                  # Environment configuration template
└── README.md
```

## Setup and Running Locally

### 1. Create and Activate Virtual Environment

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```

Linux / macOS:
```bash
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Development Server

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Endpoints

- **Health check**: `http://localhost:8000/health`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

### 5. Run Tests

```bash
pytest tests/ -v
```
