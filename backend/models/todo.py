from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, DateTime, Index, UniqueConstraint, func, text
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
    # NOT NULL, and a CHECK constraint limits each column to the enum's values
    completion_mode: Mapped[CompletionMode] = mapped_column(
        SAEnum(CompletionMode, native_enum=False, create_constraint=True, name="ck_todo_completion_mode")
    )
    # The default is set both here (so the value is known right after an insert) and in the database
    status: Mapped[TodoStatus] = mapped_column(
        SAEnum(TodoStatus, native_enum=False, create_constraint=True, name="ck_todo_status"),
        default=TodoStatus.TODO,
        server_default=TodoStatus.TODO.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class TodoCounter(Base):
    """Last todo_number handed out to each user. Bumped atomically in the same transaction as the insert."""
    __tablename__ = "todo_counters"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    last_number: Mapped[int] = mapped_column(default=0)


# Duplicate rules, enforced by partial unique indexes: they only cover rows that are still open (TODO).
_ON_ACCEPTED_OPEN = text("completion_mode = 'ON_ACCEPTED' AND status = 'TODO'")
_MANUAL_OPEN = text("completion_mode = 'MANUAL' AND status = 'TODO'")

# ON_ACCEPTED: one open todo per (user, problem); the description doesn't matter.
Index(
    "uq_todo_open_on_accepted",
    Todo.user_id, Todo.contest_id, Todo.index,
    unique=True,
    postgresql_where=_ON_ACCEPTED_OPEN,
    sqlite_where=_ON_ACCEPTED_OPEN,
)

# MANUAL: one open todo per (user, problem, description). On Postgres the description is indexed through its
# md5 hash, because an index entry over a long note would exceed the btree size limit. SQLite (dev) has no
# md5(), so it indexes the text directly.
Index(
    "uq_todo_open_manual",
    Todo.user_id, Todo.contest_id, Todo.index, func.md5(Todo.description),
    unique=True,
    postgresql_where=_MANUAL_OPEN,
).ddl_if(dialect="postgresql")
Index(
    "uq_todo_open_manual",
    Todo.user_id, Todo.contest_id, Todo.index, Todo.description,
    unique=True,
    sqlite_where=_MANUAL_OPEN,
).ddl_if(dialect="sqlite")
