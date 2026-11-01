from schemas.code_submission import Runners
from services import jdoodle
from services.language_repository import LanguageRepository

repository = LanguageRepository()
repository.register(Runners.JDOODLE, jdoodle.LANGUAGES)
