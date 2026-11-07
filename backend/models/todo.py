from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, DateTime, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class CompletionMode(str, Enum):
    ON_ACCEPTED = "ON_ACCEPTED"  # completed automatically, never by the user through the API
    MANUAL = "MANUAL"  # the user marks it done


class TodoStatus(str, Enum):
    TODO = "TODO"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (UniqueConstraint("user_id", "todo_number", name="uq_todo_user_number"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Counts up from 1 separately for each user (the number the user sees)
    todo_number: Mapped[int]
    # Owner's Discord ID (64-bit, too big for Postgres' 32-bit INTEGER)
    user_id: Mapped[int] = mapped_column(BigInteger)
    # The Codeforces problem, same key as the Problem table
    contest_id: Mapped[int]
    index: Mapped[str]
    description: Mapped[str] = mapped_column(default="")
    # Stored as plain text rather than a Postgres enum type, so adding a value later needs no migration
    completion_mode: Mapped[CompletionMode] = mapped_column(SAEnum(CompletionMode, native_enum=False))
    status: Mapped[TodoStatus] = mapped_column(SAEnum(TodoStatus, native_enum=False), default=TodoStatus.TODO)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
