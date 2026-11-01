import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

import { LANGUAGES, STARTER_CODE } from "./languages";
import TestCases from "./TestCases";
import { loadState, saveState, watchState } from "./storage";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "./themes";

const DEFAULT_LANGUAGE = "cpp";
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

    // The theme is chosen in the popup, so follow it, including changes while the editor is open.
    useEffect(() => {
        loadState(THEME_STORAGE_KEY).then((saved) => saved && setThemeId(saved));
        return watchState(THEME_STORAGE_KEY, (value) => setThemeId(value ?? DEFAULT_THEME));
    }, []);

    useEffect(() => {
        loadState(storageKey).then((saved) => {
            if (saved) {
                setLanguage(saved.language ?? DEFAULT_LANGUAGE);
                setCodeByLanguage(saved.code ?? {});
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
    const current = LANGUAGES.find((entry) => entry.id === language);
    const code = codeByLanguage[language] ?? STARTER_CODE[language];

    const resetCode = () => {
        if (window.confirm(`Reset your ${current.label} code to the starter template?`)) {
            setCodeByLanguage((previous) => ({ ...previous, [language]: STARTER_CODE[language] }));
        }
    };

    return (
        <div className={`panel${theme.dark ? " dark" : ""}`}>
            <div className="toolbar">
                <span className="title">CodeTerra Editor</span>
                <span className="spacer" />
                <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    aria-label="Language"
                >
                    {LANGUAGES.map((entry) => (
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
                {loaded && (
                    <Editor
                        language={current.monaco}
                        value={code}
                        theme={theme.id}
                        options={EDITOR_OPTIONS}
                        onChange={(value) =>
                            setCodeByLanguage((previous) => ({ ...previous, [language]: value ?? "" }))
                        }
                    />
                )}
            </div>
            <TestCases problem={problem} />
        </div>
    );
}
