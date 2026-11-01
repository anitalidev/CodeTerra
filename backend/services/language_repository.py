from pydantic import BaseModel, ConfigDict

from schemas.code_submission import Runners


class LanguageEntry(BaseModel):
    """What every runner's language has in common; each runner adds its own fields."""

    model_config = ConfigDict(frozen=True)

    id: str  # stable key sent by the client; never change or reuse
    presented_name: str


class LanguageOption(BaseModel):
    """The part of a language the frontend is told about."""

    id: str
    label: str


class UnknownLanguage(Exception):
    def __init__(self, runner: Runners, language_id: str):
        super().__init__(f"{runner.value} does not support the language '{language_id}'.")
