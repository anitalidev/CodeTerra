import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

import { FALLBACK_LANGUAGES, LEGACY_LANGUAGE_IDS, monacoLanguage, starterCode } from "./languages";
import { loadRunnerOptions, RUNNER_KEY } from "./runners";
import TestCases from "./TestCases";
import { loadState, saveState, watchState } from "./storage";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "./themes";

const DEFAULT_LANGUAGE = "CPP_17";
const SAVE_DELAY_MS = 400;

const EDITOR_OPTIONS = {
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 4,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8 },
    glyphMargin: false,
    lineNumbersMinChars: 3,  // room for line numbers up to 999
    lineDecorationsWidth: 6,
};

// The editor runs in an iframe; the page around it (the content script) owns opening and closing.
function requestClose() {
    window.parent.postMessage({ source: "codeterra-editor", type: "close" }, "https://codeforces.com");
}

export default function App() {
    // The problem page passes e.g. ?problem=2272/C so each problem keeps its own code.
    const problem = new URLSearchParams(window.location.search).get("problem") ?? "scratch";
    const storageKey = `editor:${problem}`;

    const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
    const [codeByLanguage, setCodeByLanguage] = useState({});
    const [loaded, setLoaded] = useState(false);
    const [themeId, setThemeId] = useState(DEFAULT_THEME);
    const [runnerOptions, setRunnerOptions] = useState([]);
    const [runnerId, setRunnerId] = useState("");
    const [runnerLoaded, setRunnerLoaded] = useState(false);

    // The popup chooses the code runner, and the runner decides which languages are offered.
    useEffect(() => {
        Promise.all([loadRunnerOptions(), loadState(RUNNER_KEY)]).then(([options, chosen]) => {
            setRunnerOptions(options);
            setRunnerId(chosen ?? "");
            setRunnerLoaded(true);
        });
        return watchState(RUNNER_KEY, (value) => setRunnerId(value ?? ""));
    }, []);

    // The theme is chosen in the popup, so follow it, including changes while the editor is open.
    useEffect(() => {
        loadState(THEME_STORAGE_KEY).then((saved) => saved && setThemeId(saved));
        return watchState(THEME_STORAGE_KEY, (value) => setThemeId(value ?? DEFAULT_THEME));
    }, []);

    useEffect(() => {
        loadState(storageKey).then((saved) => {
            if (saved) {
                // Code saved before languages came from the runner is filed under the old ids.
                const migrate = (id) => LEGACY_LANGUAGE_IDS[id] ?? id;
                setLanguage(migrate(saved.language ?? DEFAULT_LANGUAGE));
                setCodeByLanguage(
                    Object.fromEntries(Object.entries(saved.code ?? {}).map(([id, text]) => [migrate(id), text]))
                );
            }
            setLoaded(true);
        });
    }, [storageKey]);

    useEffect(() => {
        if (!loaded) {
            return;
        }
        const timer = setTimeout(
            () => saveState(storageKey, { language, code: codeByLanguage }),
            SAVE_DELAY_MS
        );
        return () => clearTimeout(timer);
    }, [language, codeByLanguage, loaded, storageKey]);

    const theme = THEMES.find((entry) => entry.id === themeId) ?? THEMES[0];
    const runner = runnerOptions.find((entry) => entry.id === runnerId) ?? runnerOptions[0];
    const languages = runner?.languages ?? FALLBACK_LANGUAGES;
    // The saved choice may not exist on this runner (after switching runners); `language` is kept
    // so the choice comes back if the user switches back.
    const activeId = languages.some((entry) => entry.id === language)
        ? language
        : (languages.find((entry) => entry.id === DEFAULT_LANGUAGE) ?? languages[0]).id;
    const current = languages.find((entry) => entry.id === activeId);
    const code = codeByLanguage[activeId] ?? starterCode(activeId);

    // Shared with the popup's storage, so the choice is remembered across problems and sessions.
    const chooseRunner = (id) => {
        setRunnerId(id);
        saveState(RUNNER_KEY, id);
    };

    const resetCode = () => {
        if (window.confirm(`Reset your ${current.label} code to the starter template?`)) {
            setCodeByLanguage((previous) => ({ ...previous, [activeId]: starterCode(activeId) }));
        }
    };

    return (
        <div className={`panel${theme.dark ? " dark" : ""}`}>
            <div className="toolbar">
                <span className="title">CodeTerra Editor</span>
                <span className="spacer" />
                {runnerOptions.length > 0 && (
                    <select
                        value={runner.id}
                        onChange={(event) => chooseRunner(event.target.value)}
                        aria-label="Code runner"
                    >
                        {runnerOptions.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                )}
                <select
                    value={activeId}
                    onChange={(event) => setLanguage(event.target.value)}
                    aria-label="Language"
                >
                    {languages.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                            {entry.label}
                        </option>
                    ))}
                </select>
                <button type="button" onClick={resetCode}>Reset</button>
                <button type="button" className="close" onClick={requestClose} aria-label="Close editor" title="Close editor">
                    &times;
                </button>
            </div>
            <div className="editor">
                {loaded && runnerLoaded && (
                    <Editor
                        language={monacoLanguage(activeId)}
                        value={code}
                        theme={theme.id}
                        options={EDITOR_OPTIONS}
                        onChange={(value) =>
                            setCodeByLanguage((previous) => ({ ...previous, [activeId]: value ?? "" }))
                        }
                    />
                )}
            </div>
            <TestCases problem={problem} />
        </div>
    );
}
