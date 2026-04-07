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
