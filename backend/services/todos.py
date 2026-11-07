"""Todo writes that the API and the automatic completion worker share."""
from sqlalchemy import update
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from models.todo import Todo, TodoCounter, TodoStatus


async def next_todo_number(db: AsyncSession, user_id: int) -> int:
    """Hands out this user's next todo number.

    One atomic upsert: on Postgres the row lock it takes is held until the surrounding transaction ends,
    so concurrent creates for the same user queue up instead of drawing the same number. If the todo insert
    later fails and the transaction rolls back, the bump rolls back with it.
    """
    insert = postgresql.insert if db.get_bind().dialect.name == "postgresql" else sqlite.insert
    statement = insert(TodoCounter).values(user_id=user_id, last_number=1)
    statement = statement.on_conflict_do_update(
        index_elements=[TodoCounter.user_id],
        set_={"last_number": TodoCounter.last_number + 1},
    ).returning(TodoCounter.last_number)
    return (await db.execute(statement)).scalar_one()


async def update_open_todo(db: AsyncSession, todo_id: int, **values) -> bool:
    """Updates a todo only if it is still TODO. Returns False if it had already been completed or cancelled.

    The status check lives in the UPDATE itself, so a request that finishes the task between our read and
    our write can't be overwritten. Use this for every status change, including the automatic completion.
    Does not commit.
    """
    result = await db.execute(
        update(Todo)
        .where(Todo.id == todo_id, Todo.status == TodoStatus.TODO)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1
