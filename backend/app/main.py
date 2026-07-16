import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import db_mgr
from app.api.jobs import router as jobs_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("captionai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing database...")
    await db_mgr.initialize()
    logger.info("Database initialization completed.")
    yield
    # Shutdown actions (if any)
    logger.info("Shutting down application...")

app = FastAPI(
    title="Video to Caption Generator API",
    description="ASR and Tanglish/Multilingual Caption Processing Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all origins. Can be restricted via settings.ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(jobs_router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "Sublyx Backend",
        "whisper_model": settings.WHISPER_MODEL,
        "database_type": "mongodb" if db_mgr.use_mongo else "sqlite"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
