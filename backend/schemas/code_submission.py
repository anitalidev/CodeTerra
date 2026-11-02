from enum import Enum
from pydantic import BaseModel, ConfigDict, Field

class Runners(str, Enum):
    JDOODLE = "jdoodle"
    # JUDGEZ = "judge0"

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class RanTestCase(BaseModel):
    input: str
    error: bool # if true, then output is error message. Otherwise it is output
    output: str
    expectedOutput: str

class CodeSubmission(BaseModel):
    runner: Runners
    language: str
    submittedCode : str
    testCases : list[TestCase]
    credentials : dict[str, str]

class RunResult(BaseModel):
    testCases : list[RanTestCase]
