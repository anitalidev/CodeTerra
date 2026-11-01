from pydantic import BaseModel

from services.language_repository import LanguageEntry


class JDoodleLanguage(LanguageEntry):
    version_index: str
    language: str


_LANGUAGE_LIST: list[JDoodleLanguage] = [
    # C and C++
    JDoodleLanguage(id="C", presented_name="C (GCC 5.3.0)", version_index="0", language="c"),
    JDoodleLanguage(id="CPP_17", presented_name="C++17 (GCC 9.1.0)", version_index="0", language="cpp17"),
    JDoodleLanguage(id="CPP_20", presented_name="C++20 (GCC 15.2.1)", version_index="0", language="cpp20"),
    JDoodleLanguage(id="CPP_23", presented_name="C++23 (GCC 15.2.1)", version_index="0", language="cpp23"),

    # .NET
    JDoodleLanguage(id="CSHARP_MONO", presented_name="C# (Mono 6.12.0)", version_index="4", language="csharp"),
    JDoodleLanguage(id="CSHARP_NET", presented_name="C# (.NET 10)", version_index="6", language="csharp"),
    JDoodleLanguage(id="FSHARP", presented_name="F# 10", version_index="3", language="fsharp"),

    # Other compiled languages
    JDoodleLanguage(id="D", presented_name="D (DMD 2.105.2)", version_index="3", language="d"),
    JDoodleLanguage(id="GO", presented_name="Go 1.21.4", version_index="5", language="go"),
    JDoodleLanguage(id="HASKELL", presented_name="Haskell (GHC 8.6.5)", version_index="3", language="haskell"),
    JDoodleLanguage(id="OCAML", presented_name="OCaml 4.03.0", version_index="0", language="ocaml"),
    JDoodleLanguage(id="RUST", presented_name="Rust 1.94.0", version_index="6", language="rust"),

    # JVM
    JDoodleLanguage(id="JAVA_8", presented_name="Java 8", version_index="0", language="java"),
    JDoodleLanguage(id="JAVA_21", presented_name="Java 21", version_index="5", language="java"),
    JDoodleLanguage(id="KOTLIN_1_9", presented_name="Kotlin 1.9.10", version_index="4", language="kotlin"),
    JDoodleLanguage(id="KOTLIN_2_3", presented_name="Kotlin 2.3.10", version_index="5", language="kotlin"),
    JDoodleLanguage(id="SCALA", presented_name="Scala 2.12.5", version_index="2", language="scala"),

    # Pascal
    JDoodleLanguage(id="FREE_PASCAL", presented_name="Free Pascal 3.2.2", version_index="3", language="pascal"),

    # Scripting languages
    JDoodleLanguage(id="PERL", presented_name="Perl 5.22.0", version_index="0", language="perl"),
    JDoodleLanguage(id="PHP", presented_name="PHP 8.2.12", version_index="5", language="php"),
    JDoodleLanguage(id="PYTHON_2", presented_name="Python 2.7.18", version_index="3", language="python2"),
    JDoodleLanguage(id="PYTHON_3", presented_name="Python 3.14.3", version_index="6", language="python3"),
    JDoodleLanguage(id="PYPY_3", presented_name="PyPy 3 (7.3.17)", version_index="0", language="pypy3"),
    JDoodleLanguage(id="RUBY", presented_name="Ruby 3.0.6", version_index="5", language="ruby"),
    JDoodleLanguage(id="NODE_JS", presented_name="JavaScript (Node.js 12.11.1)", version_index="3", language="nodejs"),
]

LANGUAGES: dict[str, JDoodleLanguage] = {item.id: item for item in _LANGUAGE_LIST}
assert len(LANGUAGES) == len(_LANGUAGE_LIST), "duplicate JDoodle language id"


class JDoodleExecuteBody(BaseModel):
    """Request body for JDoodle's /v1/execute."""

    clientId: str
    clientSecret: str
    language: str
    versionIndex: str
    script: str  # the code to run
    stdin: str  # the input
    compileOnly: bool = False
