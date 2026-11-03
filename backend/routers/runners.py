from fastapi import APIRouter
from pydantic import BaseModel

from schemas.code_submission import CodeSubmission, RanTestCase, RunResult, Runners, RanTestCase
from services.code_runner import ExecutionRequest
from services.code_runner import ExecutionRequest
from services.language_repository import LanguageOption
from services.runner_registry import registry

router = APIRouter(prefix="/runners", tags=["runners"])

class RunnerOption(BaseModel):
    id: Runners
    label: str
    credential_fields: list[str]
    languages: list[LanguageOption]


@router.get(path="/options", response_model=list[RunnerOption],
            description="The code runners a user can choose from, each with the languages it supports")
async def get_options():
    return [
        RunnerOption(
            id=spec.runner,
            label=spec.label,
            credential_fields=list(spec.credential_fields),
            languages=registry.options(spec.runner),
        )
        for spec in registry.specs()
    ]


@router.post("/run", response_model=RunResult,
             description="Run the submitted code once for each test case and return what it printed")
async def run_code(
    submission: CodeSubmission
):
    runner = registry.create(submission.runner, submission.credentials)

    # One at a time: the free runner plans are tight on rate limits.
    ran = []
    for case in submission.testCases:
        result = await runner.run(ExecutionRequest(
            language_id=submission.language,
            source_code=submission.submittedCode,
            stdin=case.input,
        ))
        ran.append(RanTestCase(
            input=case.input,
            status=result.status,
            output=result.output,
            expectedOutput=case.expectedOutput,
            timeSeconds=result.time_s,
            memoryKb=result.memory_kb,
        ))
    return RunResult(testCases=ran)
