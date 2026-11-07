from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from models.todo import CompletionMode, TodoStatus


class TodoCreate(BaseModel):
    # forbid: sending id, todo_number, status or created_at is an error, not silently ignored
    model_config = ConfigDict(extra="forbid")

    contest_id: int
    index: str
    completion_mode: CompletionMode
    description: str = ""


class TodoUpdate(BaseModel):
    # Only these two can be edited; anything else is rejected
    model_config = ConfigDict(extra="forbid")

    description: str | None = None
    status: TodoStatus | None = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if self.description is None and self.status is None:
            raise ValueError("Send description and/or status")
        return self


class TodoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    todo_number: int
    user_id: int
    contest_id: int
    index: str
    description: str
    completion_mode: CompletionMode
    status: TodoStatus
    created_at: datetime
