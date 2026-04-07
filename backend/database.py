"""
Async database module using asyncpg + SQLAlchemy 2 async engine.

Env vars:
  DATABASE_URL — asyncpg-compatible PostgreSQL URL, e.g.:
                 postgresql+asyncpg://user:pass@host/dbname

When DATABASE_URL is unset the module operates in a no-op mode so the app
starts without a DB (useful for local dev without Neon credentials).
"""
import os
from typing import Optional, AsyncGenerator

from loguru import logger
from sqlalchemy import String, DateTime, func
from sqlalchemy.ext.asyncio import (
    AsyncSession, AsyncEngine,
    create_async_engine, async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# Normalise Railway/Neon postgres:// → postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


# ── ORM base + models ─────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class User(Base):
    """OAuth-authenticated users."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)   # UUID
    provider: Mapped[str] = mapped_column(String(32))                # "google"|"github"
    provider_id: Mapped[str] = mapped_column(String(256))            # provider's user ID
    email: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_login: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AnalysisResult(Base):
    """Stores metadata for each audio analysis run (STO-007)."""
    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)    # audio_id
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    duration: Mapped[Optional[float]] = mapped_column(nullable=True)
    bpm: Mapped[Optional[float]] = mapped_column(nullable=True)
    has_lyrics: Mapped[bool] = mapped_column(default=False)
    has_stems: Mapped[bool] = mapped_column(default=False)
    # JSON blob of the full ExtendedAudioAnalysisResponse
    analysis_json: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RenderJob(Base):
    """Tracks video render jobs (STO-008)."""
    __tablename__ = "render_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)    # video_id
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    audio_id: Mapped[str] = mapped_column(String(36))
    visual_mode: Mapped[str] = mapped_column(String(32))
    aspect_ratio: Mapped[str] = mapped_column(String(8))
    resolution_preset: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    # "pending" | "rendering" | "done" | "failed"
    error_message: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── Engine + session factory ──────────────────────────────────────────────────

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> Optional[AsyncEngine]:
    return _engine


async def init_db() -> None:
    """Create engine, run migrations, and create tables if needed."""
    global _engine, _session_factory

    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set — running without persistent user storage.")
        return

    try:
        _engine = create_async_engine(
            DATABASE_URL,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            echo=False,
        )
        _session_factory = async_sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
        # Create tables (idempotent; production should use Alembic migrations)
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database connected and tables verified.")
    except Exception as exc:
        logger.error(f"Database init failed: {exc}")
        _engine = None
        _session_factory = None


async def close_db() -> None:
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
        logger.info("Database connection closed.")


async def get_session() -> AsyncGenerator[Optional[AsyncSession], None]:
    """FastAPI dependency that yields a DB session, or None when DB is unavailable."""
    if _session_factory is None:
        yield None
        return
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── User CRUD ─────────────────────────────────────────────────────────────────

import uuid


async def upsert_user(
    session: AsyncSession,
    provider: str,
    provider_id: str,
    email: Optional[str],
    display_name: Optional[str],
    avatar_url: Optional[str],
) -> User:
    """Create or update user; returns the User row."""
    from sqlalchemy import select

    stmt = select(User).where(
        User.provider == provider,
        User.provider_id == provider_id,
    )
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            provider=provider,
            provider_id=provider_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        session.add(user)
    else:
        user.email = email
        user.display_name = display_name
        user.avatar_url = avatar_url

    await session.flush()
    return user


async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
    from sqlalchemy import select
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# ── AnalysisResult CRUD (STO-007) ─────────────────────────────────────────────

async def save_analysis_result(
    session: AsyncSession,
    audio_id: str,
    user_id: Optional[str],
    filename: Optional[str],
    duration: Optional[float],
    bpm: Optional[float],
    has_lyrics: bool,
    has_stems: bool,
    analysis_json: Optional[str] = None,
) -> AnalysisResult:
    """Upsert analysis metadata row."""
    from sqlalchemy import select

    result = await session.execute(
        select(AnalysisResult).where(AnalysisResult.id == audio_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = AnalysisResult(
            id=audio_id,
            user_id=user_id,
            filename=filename,
            duration=duration,
            bpm=bpm,
            has_lyrics=has_lyrics,
            has_stems=has_stems,
            analysis_json=analysis_json,
        )
        session.add(row)
    else:
        row.analysis_json = analysis_json
        row.has_lyrics = has_lyrics
        row.has_stems = has_stems
    await session.flush()
    return row


# ── RenderJob CRUD (STO-008) ──────────────────────────────────────────────────

async def create_render_job(
    session: AsyncSession,
    video_id: str,
    user_id: Optional[str],
    audio_id: str,
    visual_mode: str,
    aspect_ratio: str,
    resolution_preset: str,
) -> RenderJob:
    row = RenderJob(
        id=video_id,
        user_id=user_id,
        audio_id=audio_id,
        visual_mode=visual_mode,
        aspect_ratio=aspect_ratio,
        resolution_preset=resolution_preset,
        status="rendering",
    )
    session.add(row)
    await session.flush()
    return row


async def complete_render_job(
    session: AsyncSession, video_id: str, success: bool, error: Optional[str] = None
) -> None:
    from sqlalchemy import select, func as sqlfunc
    import datetime

    result = await session.execute(
        select(RenderJob).where(RenderJob.id == video_id)
    )
    row = result.scalar_one_or_none()
    if row:
        row.status = "done" if success else "failed"
        row.error_message = error
        row.completed_at = datetime.datetime.now(datetime.timezone.utc)
        await session.flush()
