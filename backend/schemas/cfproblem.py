from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from models.problem import ExtraTag


class CFProblem(BaseModel):
    """ Represents a problem as it is in Codeforces """
    # Codeforces JSON uses camelCase ("contestId"); our code uses contestID.
    model_config = ConfigDict(populate_by_name=True)

    contestID: int = Field(alias="contestId")
    index: str
    name: str
    type: Literal["PROGRAMMING", "QUESTION"]
    problemsetName: str | None = None
    points: float | None = None
    rating: int | None = None
    tags: list[str] = Field(default_factory=list)  # Codeforces' own tags
    extraTags: list[ExtraTag] = Field(default_factory=list, max_length=7)  # our tags
