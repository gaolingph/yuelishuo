import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db, SessionLocal
from routers import auth, packs, learning, practice, stats, pk, admin, parent, game, reading, garden, vocab_test, ai, teacher
from services.seed import run_seed

app = FastAPI(
    title="英语单词速记系统",
    description="Vocabulary Rapid Memorization System API",
    version="1.0.0",
)

# CORS — allow all origins in development; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers (each router has its own prefix)
app.include_router(auth.router)
app.include_router(packs.router)
app.include_router(learning.router)
app.include_router(practice.router)
app.include_router(stats.router)
app.include_router(pk.router)
app.include_router(admin.router)
app.include_router(parent.router)
app.include_router(game.router)
app.include_router(reading.router)
app.include_router(garden.router)
app.include_router(vocab_test.router)
app.include_router(ai.router)
app.include_router(teacher.router)


@app.on_event("startup")
def on_startup():
    """Initialize database and seed data on startup."""
    init_db()
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()


@app.get("/api/status")
def api_status():
    return {
        "message": "英语单词速记系统 API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# ------------------------------------------------------------
# Serve built frontend SPA — API routes take precedence above
# ------------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
