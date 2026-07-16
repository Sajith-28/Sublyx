import json
import logging
import sqlite3
from datetime import datetime
from uuid import uuid4
import aiosqlite
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger("captionai.db")

class DatabaseManager:
    def __init__(self):
        self.client = None
        self.mongo_db = None
        self.use_mongo = False
        self.sqlite_path = settings.sqlite_db_path

    async def initialize(self):
        if settings.MONGO_URI:
            try:
                logger.info(f"Connecting to MongoDB at {settings.MONGO_URI}")
                self.client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000)
                # Check connection
                await self.client.admin.command('ping')
                self.mongo_db = self.client[settings.MONGO_DB_NAME]
                self.use_mongo = True
                logger.info("MongoDB connected successfully!")
                return
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}. Falling back to SQLite.")
        
        logger.info(f"Using SQLite database at {self.sqlite_path}")
        await self._init_sqlite()

    async def _init_sqlite(self):
        async with aiosqlite.connect(self.sqlite_path) as db:
            # Create jobs table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT,
                    progress_pct REAL,
                    video_path TEXT,
                    audio_path TEXT,
                    duration_sec REAL,
                    created_at TEXT,
                    updated_at TEXT,
                    error TEXT,
                    source_lang TEXT,
                    target_lang TEXT
                )
            """)
            # Add columns if they don't exist in case the table was created previously
            for col in ["source_lang", "target_lang"]:
                try:
                    await db.execute(f"ALTER TABLE jobs ADD COLUMN {col} TEXT")
                except Exception:
                    # Column already exists
                    pass

            # Create segments table
            await db.execute("""
                CREATE TABLE IF NOT EXISTS segments (
                    id TEXT PRIMARY KEY,
                    job_id TEXT,
                    "index" INTEGER,
                    start_ms REAL,
                    end_ms REAL,
                    detected_language TEXT,
                    raw_text TEXT,
                    caption_text TEXT,
                    edited INTEGER,
                    confidence REAL,
                    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
                )
            """)
            await db.commit()

    async def get_job(self, job_id: str) -> dict | None:
        if self.use_mongo:
            job = await self.mongo_db.jobs.find_one({"_id": job_id})
            if job:
                job["id"] = job.pop("_id")
            return job
        else:
            async with aiosqlite.connect(self.sqlite_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
                    row = await cursor.fetchone()
                    return dict(row) if row else None

    async def insert_job(self, job_data: dict) -> str:
        job_id = job_data.get("id") or str(uuid4())
        job_data["id"] = job_id
        if "created_at" not in job_data:
            job_data["created_at"] = datetime.utcnow().isoformat()
        if "updated_at" not in job_data:
            job_data["updated_at"] = datetime.utcnow().isoformat()
        
        if self.use_mongo:
            mongo_doc = job_data.copy()
            mongo_doc["_id"] = mongo_doc.pop("id")
            await self.mongo_db.jobs.insert_one(mongo_doc)
        else:
            async with aiosqlite.connect(self.sqlite_path) as db:
                await db.execute(
                    """
                    INSERT INTO jobs (id, status, progress_pct, video_path, audio_path, duration_sec, created_at, updated_at, error, source_lang, target_lang)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        job_data.get("status", "queued"),
                        job_data.get("progress_pct", 0.0),
                        job_data.get("video_path"),
                        job_data.get("audio_path"),
                        job_data.get("duration_sec", 0.0),
                        job_data["created_at"],
                        job_data["updated_at"],
                        job_data.get("error"),
                        job_data.get("source_lang", "ta"),
                        job_data.get("target_lang", "tanglish")
                    )
                )
                await db.commit()
        return job_id

    async def update_job(self, job_id: str, update_data: dict):
        update_data["updated_at"] = datetime.utcnow().isoformat()
        if self.use_mongo:
            await self.mongo_db.jobs.update_one({"_id": job_id}, {"$set": update_data})
        else:
            fields = []
            values = []
            for k, v in update_data.items():
                fields.append(f"{k} = ?")
                values.append(v)
            values.append(job_id)
            query = f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?"
            async with aiosqlite.connect(self.sqlite_path) as db:
                await db.execute(query, tuple(values))
                await db.commit()

    async def get_segments(self, job_id: str) -> list[dict]:
        if self.use_mongo:
            cursor = self.mongo_db.segments.find({"job_id": job_id}).sort("index", 1)
            segments = []
            async for doc in cursor:
                doc["id"] = doc.pop("_id")
                segments.append(doc)
            return segments
        else:
            async with aiosqlite.connect(self.sqlite_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT * FROM segments WHERE job_id = ? ORDER BY \"index\" ASC", (job_id,)) as cursor:
                    rows = await cursor.fetchall()
                    result = []
                    for row in rows:
                        d = dict(row)
                        d["edited"] = bool(d["edited"])
                        result.append(d)
                    return result

    async def insert_segments(self, segments: list[dict]):
        if not segments:
            return
        
        for seg in segments:
            if "id" not in seg:
                seg["id"] = str(uuid4())
            if "edited" not in seg:
                seg["edited"] = False

        if self.use_mongo:
            mongo_docs = []
            for seg in segments:
                doc = seg.copy()
                doc["_id"] = doc.pop("id")
                mongo_docs.append(doc)
            await self.mongo_db.segments.insert_many(mongo_docs)
        else:
            async with aiosqlite.connect(self.sqlite_path) as db:
                for seg in segments:
                    await db.execute(
                        """
                        INSERT INTO segments (id, job_id, "index", start_ms, end_ms, detected_language, raw_text, caption_text, edited, confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            seg["id"],
                            seg["job_id"],
                            seg["index"],
                            seg["start_ms"],
                            seg["end_ms"],
                            seg["detected_language"],
                            seg["raw_text"],
                            seg["caption_text"],
                            1 if seg["edited"] else 0,
                            seg["confidence"]
                        )
                    )
                await db.commit()

    async def update_segment(self, segment_id: str, update_data: dict):
        if "edited" in update_data:
            if self.use_mongo:
                pass
            else:
                update_data["edited"] = 1 if update_data["edited"] else 0

        if self.use_mongo:
            await self.mongo_db.segments.update_one({"_id": segment_id}, {"$set": update_data})
        else:
            fields = []
            values = []
            for k, v in update_data.items():
                fields.append(f"\"{k}\" = ?")
                values.append(v)
            values.append(segment_id)
            query = f"UPDATE segments SET {', '.join(fields)} WHERE id = ?"
            async with aiosqlite.connect(self.sqlite_path) as db:
                await db.execute(query, tuple(values))
                await db.commit()

    async def list_jobs(self, limit: int = 30) -> list[dict]:
        """Return the most recent jobs, newest first."""
        if self.use_mongo:
            cursor = self.mongo_db.jobs.find().sort("created_at", -1).limit(limit)
            jobs = []
            async for doc in cursor:
                doc["id"] = doc.pop("_id")
                jobs.append(doc)
            return jobs
        else:
            async with aiosqlite.connect(self.sqlite_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]

db_mgr = DatabaseManager()

