"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.persistence_routes import router as persistence_router
from .api.routes import router as api_router
from .db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="MMRA Web API",
    description="Probabilistic subsurface resource and risk evaluation API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(persistence_router)

# Also expose health at root for convenience
@app.get("/health")
def root_health():
    from .api.routes import API_FEATURES
    from .services.engine_adapter import ENGINE_VERSION, SCHEMA_VERSION

    return {
        "status": "ok",
        "engine_version": ENGINE_VERSION,
        "schema_version": SCHEMA_VERSION,
        "api_features": API_FEATURES,
    }
