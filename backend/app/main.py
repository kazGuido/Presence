import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import Base, engine
from app.routers import analytics, attendance_sessions, auth, employees, punches, work_schedules, work_sites


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    Path(settings.database_url.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if os.getenv("DEMO_SEED", "").lower() in ("1", "true", "yes"):
        from app.seed import seed_demo

        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            seed_demo(db)
        finally:
            db.close()
    yield


app = FastAPI(title="Geofence Attendance API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(work_sites.router, prefix="/api")
app.include_router(work_schedules.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(punches.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(attendance_sessions.router, prefix="/api")

_settings = get_settings()
Path(_settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_settings.upload_dir), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str) -> FileResponse:
    if full_path.startswith("api") or full_path.startswith("uploads"):
        raise HTTPException(404)
    if not STATIC_DIR.exists():
        raise HTTPException(503, detail="Frontend not built (missing static/)")
    candidate = (STATIC_DIR / full_path).resolve()
    try:
        candidate.relative_to(STATIC_DIR.resolve())
    except ValueError:
        raise HTTPException(404)
    if candidate.is_file():
        return FileResponse(candidate)
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(503, detail="Frontend not built")
