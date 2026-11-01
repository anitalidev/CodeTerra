from fastapi import APIRouter
from pydantic import BaseModel

from schemas.code_submission import CodeSubmission, RunResult, Runners
from services.language_registry import repository
from services.language_repository import LanguageOption

router = APIRouter(prefix="/runners", tags=["runners"])

RUNNER_LABELS = {
    Runners.JDOODLE: "JDoodle",
}

class RunnerOption(BaseModel):
    id: Runners
    label: str
    languages: list[LanguageOption]


@router.get(path="/options", response_model=list[RunnerOption],
            description="The code runners a user can choose from, each with the languages it supports")
async def get_options():
    return [
        RunnerOption(id=runner, label=RUNNER_LABELS[runner], languages=repository.options(runner))
        for runner in repository.runners()
    ]


@router.post("/run", response_model=RunResult)
async def run_code(
    submission: CodeSubmission
):
    pass
