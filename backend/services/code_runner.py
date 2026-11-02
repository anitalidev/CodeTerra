from abc import ABC, abstractmethod
from collections.abc import Mapping

from pydantic import BaseModel


class ExecutionRequest(BaseModel):
    language_id: str  # one of the runner's own language ids
    source_code: str
    stdin: str = ""


class ExecutionResult(BaseModel):
    # Runners differ in how much they report: JDoodle merges stdout, stderr and compile
    # errors into one text, so that is all this carries for now.
    output: str
    time_s: float | None = None
    memory_kb: int | None = None


class RunnerError(Exception):
    """The runner service failed (down, rate limited, bad reply)."""


class RunnerAuthError(RunnerError):
    """The runner rejected the credentials, or none were given."""


class RunnerRateLimitError(RunnerError):
    """The runner refused because of a rate limit or used-up credits."""


class CodeRunner(ABC):
    def __init__(self, credentials: Mapping[str, str]) -> None:
        self.credentials = credentials

    @abstractmethod
    async def run(self, request: ExecutionRequest) -> ExecutionResult:
        """Run one program with one input.

        Raises:
            UnknownLanguage: the runner does not offer request.language_id.
            RunnerAuthError: the credentials were rejected.
            RunnerRateLimitError: rate limited, or out of credits.
            RunnerError: any other failure talking to the runner.
        """
