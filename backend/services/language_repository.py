from collections.abc import Mapping

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


class LanguageRepository:
    def __init__(self) -> None:
        self._languages: dict[Runners, Mapping[str, LanguageEntry]] = {}

    def register(self, runner: Runners, languages: Mapping[str, LanguageEntry]) -> None:
        if runner in self._languages:
            raise ValueError(f"{runner.value} is already registered")
        self._languages[runner] = languages

    def runners(self) -> list[Runners]:
        return list(self._languages)

    def options(self, runner: Runners) -> list[LanguageOption]:
        return [
            LanguageOption(id=entry.id, label=entry.presented_name)
            for entry in self._languages[runner].values()
        ]

    def get(self, runner: Runners, language_id: str) -> LanguageEntry:
        try:
            return self._languages[runner][language_id]
        except KeyError:
            raise UnknownLanguage(runner, language_id) from None
