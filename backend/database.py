import os

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


def async_database_url(raw_url: str):
    """Turns the connection string Neon gives you into one SQLAlchemy's async driver accepts."""
    url = make_url(raw_url)
    if not url.drivername.startswith("postgres"):
        return url
    # asyncpg wants ssl=require, not libpq's sslmode=require, and rejects channel_binding.
    ssl_required = url.query.get("sslmode") in ("require", "verify-ca", "verify-full")
    url = url.set(drivername="postgresql+asyncpg").difference_update_query(["sslmode", "channel_binding"])
    return url.update_query_dict({"ssl": "require"}) if ssl_required else url


engine = create_async_engine(
    async_database_url(os.environ["DATABASE_URL"]),
    pool_pre_ping=True,  # Neon pauses idle databases, which drops pooled connections
)
# expire_on_commit=False: async sessions can't lazily reload attributes after a commit
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as db:
        yield db
