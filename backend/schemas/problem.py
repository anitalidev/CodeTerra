from pydantic import BaseModel, ConfigDict, Field

from models.problem import ExtraTag

class ProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contestID: int
    index: str
    extraTags: list[ExtraTag] = Field(default_factory=list, max_length=7)

class ProblemIn(BaseModel):
    problemText: str = Field(max_length=20000)