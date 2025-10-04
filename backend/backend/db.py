"""Database engine and helpers for the backend service."""

import sqlite3
from typing import TYPE_CHECKING

from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.models import Base

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection
    from sqlalchemy.pool import ConnectionPoolEntry

DATABASE_URL = "sqlite+aiosqlite:////data/nodes.db"

engine = create_async_engine(DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def do_connect(
    dbapi_connection: sqlite3.Connection,
    _connection_record: "ConnectionPoolEntry",
) -> None:
    """Configure SQLite connection on connect.

    - Disable implicit BEGIN/COMMIT emitted by aiosqlite
    - Enable WAL mode for better concurrent writes
    """
    dbapi_connection.isolation_level = None

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.close()


@event.listens_for(engine.sync_engine, "begin")
def do_begin(conn: "Connection") -> None:
    """Emit an explicit BEGIN for each transaction."""
    conn.exec_driver_sql("BEGIN")


async def init_db() -> None:
    """Create all tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
