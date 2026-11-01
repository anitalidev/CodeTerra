from collections.abc import Mapping
from dataclasses import dataclass

from schemas.code_submission import Runners
from services import jdoodle
from services.code_runner import CodeRunner, RunnerAuthError
from services.language_repository import LanguageEntry, LanguageOption, UnknownLanguage


@dataclass(frozen=True)
class RunnerSpec:
    runner: Runners
    label: str
    languages: Mapping[str, LanguageEntry]
    runner_class: type[CodeRunner]
    credential_fields: tuple[str, ...]


class RunnerRegistry:
    def __init__(self) -> None:
        self._specs: dict[Runners, RunnerSpec] = {}

    def register(self, spec: RunnerSpec) -> None:
        if spec.runner in self._specs:
            raise ValueError(f"{spec.runner.value} is already registered")
        if not spec.languages:
            raise ValueError(f"{spec.runner.value} has no languages")
        for key, entry in spec.languages.items():
            if key != entry.id:
                raise ValueError(f"{spec.runner.value}: language key '{key}' does not match id '{entry.id}'")
        self._specs[spec.runner] = spec

    def validate(self) -> None:
        """Every Runners member must have been registered."""
        missing = set(Runners) - set(self._specs)
        if missing:
            raise RuntimeError(f"No spec registered for: {sorted(r.value for r in missing)}")

    def spec(self, runner: Runners) -> RunnerSpec:
        return self._specs[runner]

    def specs(self) -> list[RunnerSpec]:
        return list(self._specs.values())

    def options(self, runner: Runners) -> list[LanguageOption]:
        return [
            LanguageOption(id=entry.id, label=entry.presented_name)
            for entry in self.spec(runner).languages.values()
        ]

    def language(self, runner: Runners, language_id: str) -> LanguageEntry:
        try:
            return self.spec(runner).languages[language_id]
        except KeyError:
            raise UnknownLanguage(runner, language_id) from None

    def create(self, runner: Runners, credentials: Mapping[str, str]) -> CodeRunner:
        spec = self.spec(runner)
        missing = [field for field in spec.credential_fields if not credentials.get(field)]
        if missing:
            raise RunnerAuthError(f"Missing {spec.label} credentials: {', '.join(missing)}.")
        return spec.runner_class(credentials)


registry = RunnerRegistry()
registry.register(RunnerSpec(
    runner=Runners.JDOODLE,
    label="JDoodle",
    languages=jdoodle.LANGUAGES,
    runner_class=jdoodle.JDoodleRunner,
    credential_fields=jdoodle.JDoodleRunner.CREDENTIAL_FIELDS,
))
registry.validate()
