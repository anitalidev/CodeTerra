from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.todo import CompletionMode, Todo, TodoStatus
from schemas.todo import TodoCreate, TodoOut, TodoUpdate

router = APIRouter(prefix="/todos", tags=["todos"])


async def has_conflict(
        db: AsyncSession,
        *,
        user_id: int,
        contest_id: int,
        index: str,
        completion_mode: CompletionMode,
        description: str,
        exclude_id: int | None = None,
) -> bool:
    """Is there already an open (TODO) task this one would duplicate?

    MANUAL tasks clash on (user, problem, description, mode); ON_ACCEPTED tasks ignore the description.
    """
    query = select(Todo.id).where(
        Todo.user_id == user_id,
        Todo.contest_id == contest_id,
        Todo.index == index,
        Todo.completion_mode == completion_mode,
        Todo.status == TodoStatus.TODO,
    )
    if completion_mode == CompletionMode.MANUAL:
        query = query.where(Todo.description == description)
    if exclude_id is not None:
        query = query.where(Todo.id != exclude_id)
    return (await db.execute(query.limit(1))).first() is not None


@router.post("/{user_id}", response_model=TodoOut, status_code=201)
async def create_todo(user_id: int, body: TodoCreate, db: AsyncSession = Depends(get_db)):
    if await has_conflict(
            db, user_id=user_id, contest_id=body.contest_id, index=body.index,
            completion_mode=body.completion_mode, description=body.description,
    ):
        raise HTTPException(status_code=409, detail="An identical open todo already exists")

    # todo_number is max + 1 for this user. If two requests race for the same number the unique
    # constraint rejects one of them, so try again with a fresh number.
    for _ in range(3):
        highest = await db.scalar(select(func.max(Todo.todo_number)).where(Todo.user_id == user_id))
        todo = Todo(
            user_id=user_id,
            todo_number=(highest or 0) + 1,
            contest_id=body.contest_id,
            index=body.index,
            description=body.description,
            completion_mode=body.completion_mode,
            status=TodoStatus.TODO,
        )
        db.add(todo)
        try:
            await db.commit()
            return todo
        except IntegrityError:
            await db.rollback()
    raise HTTPException(status_code=409, detail="Could not assign a todo number, try again")


@router.get("/{user_id}", response_model=list[TodoOut])
async def list_todos(
        user_id: int,
        todo_number: int | None = None,
        contest_id: int | None = None,
        index: str | None = None,
        description: str | None = None,
        completion_mode: CompletionMode | None = None,
        status: TodoStatus | None = None,
        created_before: datetime | None = None,
        created_after: datetime | None = None,
        db: AsyncSession = Depends(get_db),
):
    query = select(Todo).where(Todo.user_id == user_id)
    filters = {
        Todo.todo_number: todo_number,
        Todo.contest_id: contest_id,
        Todo.index: index,
        Todo.description: description,
        Todo.completion_mode: completion_mode,
        Todo.status: status,
    }
    for column, value in filters.items():
        if value is not None:
            query = query.where(column == value)
    if created_before is not None:
        query = query.where(Todo.created_at < created_before)
    if created_after is not None:
        query = query.where(Todo.created_at > created_after)

    result = await db.execute(query.order_by(Todo.todo_number))
    return result.scalars().all()


async def get_or_404(db: AsyncSession, user_id: int, todo_number: int) -> Todo:
    result = await db.execute(select(Todo).where(Todo.user_id == user_id, Todo.todo_number == todo_number))
    todo = result.scalar_one_or_none()
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.get("/{user_id}/{todo_number}", response_model=TodoOut)
async def get_todo(user_id: int, todo_number: int, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, user_id, todo_number)


@router.patch("/{user_id}/{todo_number}", response_model=TodoOut)
async def edit_todo(user_id: int, todo_number: int, body: TodoUpdate, db: AsyncSession = Depends(get_db)):
    todo = await get_or_404(db, user_id, todo_number)

    # DONE and CANCELLED are final
    if todo.status != TodoStatus.TODO:
        raise HTTPException(status_code=409, detail=f"Todo is already {todo.status.value} and cannot be changed")

    if body.status == TodoStatus.DONE and todo.completion_mode == CompletionMode.ON_ACCEPTED:
        raise HTTPException(status_code=403, detail="ON_ACCEPTED todos are completed automatically, not by hand")

    new_status = body.status or todo.status
    new_description = todo.description if body.description is None else body.description

    # Editing the description could make this MANUAL task a duplicate of another open one
    if (
            new_status == TodoStatus.TODO
            and todo.completion_mode == CompletionMode.MANUAL
            and new_description != todo.description
            and await has_conflict(
                db, user_id=user_id, contest_id=todo.contest_id, index=todo.index,
                completion_mode=todo.completion_mode, description=new_description, exclude_id=todo.id,
            )
    ):
        raise HTTPException(status_code=409, detail="An identical open todo already exists")

    todo.description = new_description
    todo.status = new_status
    await db.commit()
    return todo
