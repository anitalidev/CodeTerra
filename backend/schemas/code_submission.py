from enum import Enum
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class Runners(str, Enum):
    JDOODLE = "jdoodle"
    # JUDGEZ = "judge0"

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class RanTestCase(BaseModel):
    input: str
    status: Literal["ok", "compileErr", "runtimeErr"]  # if not "ok", then output is the error message. Otherwise it is output
    output: str
    expectedOutput: str
    timeSeconds: float | None = None  # None when the runner gave no figure
    memoryKb: int | None = None

class CodeSubmission(BaseModel):
    runner: Runners
    language: str
    submittedCode : str
    testCases : list[TestCase]
    credentials : dict[str, str]

class RunResult(BaseModel):
    testCases : list[RanTestCase]
