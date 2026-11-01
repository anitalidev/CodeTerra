from pydantic import BaseModel, ConfigDict, Field

from models.problem import ExtraTag


class ProblemIn(BaseModel):
    contestID: int
    index: str

class ProblemOut(ProblemIn):
    model_config = ConfigDict(from_attributes=True)
    extraTags: list[ExtraTag] = Field(default_factory=list, max_length=7)
