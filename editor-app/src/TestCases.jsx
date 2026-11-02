import { useEffect, useRef, useState } from "react";

import { missingCredentials, runCode } from "./runners";
import { loadState, saveState, watchState } from "./storage";

const SAVE_DELAY_MS = 400;
const HEIGHT_STORAGE_KEY = "testsHeight";
const DEFAULT_HEIGHT_PX = 230;
const MIN_HEIGHT_PX = 120;
const MIN_EDITOR_HEIGHT_PX = 160;
const MAX_CASES = 10;  // examples included; every case in a run costs the runner a request

// The panel is docked to the bottom of the window, so its height follows from the pointer's y.
function clampHeight(heightPx) {
    return Math.min(Math.max(heightPx, MIN_HEIGHT_PX), window.innerHeight - MIN_EDITOR_HEIGHT_PX);
}

// Judges ignore trailing spaces and blank lines at the end, so the comparison does too.
function normalize(text) {
    return text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trimEnd();
}

// A small rounded square for each outcome of a run: pass, fail, error, or "ran, but nothing to compare".
const VERDICT_ICONS = {
    pass: { fill: "#4caf50", label: "Passed", glyph: <path d="M4.5 8.5l2.5 2.5 4.5-5" /> },
    fail: { fill: "#e53935", label: "Wrong answer", glyph: <path d="M5 5l6 6M11 5l-6 6" /> },
    error: { fill: "#fb8c00", label: "Run failed", glyph: <path d="M8 4.5v4.5M8 11.4v.1" /> },
    none: { fill: "#9e9e9e", label: "No expected output to compare", glyph: <path d="M5.5 11.5v-7l5 7v-7" /> },
};

const OVERALL_LABELS = {
    pass: "Accepted",
    fail: "Wrong answer",
    error: "Run failed",
    none: "Nothing to compare",
};

function VerdictIcon({ kind }) {
    const icon = VERDICT_ICONS[kind];
    return (
        <svg className="verdict-icon" viewBox="0 0 16 16" role="img" aria-label={icon.label}>
            <title>{icon.label}</title>
            <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill={icon.fill} />
            <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {icon.glyph}
            </g>
        </svg>
    );
}

function newCase() {
    return { id: crypto.randomUUID(), input: "", output: "" };
}

// Example cases come from the problem page and can't be edited. Custom cases are the user's own
// and are saved per problem.
export default function TestCases({ problem, runner, language, code }) {
    const examplesKey = `examples:${problem}`;
    const customKey = `tests:${problem}`;
    const caseHintKey = `caseHint:${problem}`;
    const ignoreCaseKey = `ignoreCase:${problem}`;

    const [examples, setExamples] = useState([]);
    const [custom, setCustom] = useState([]);
    const [customLoaded, setCustomLoaded] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [open, setOpen] = useState(true);
    const [height, setHeight] = useState(DEFAULT_HEIGHT_PX);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState({});  // case id -> { output, error }; error means output is an error message
    const [runError, setRunError] = useState("");
    const [caseHint, setCaseHint] = useState(false);  // the statement says any letter case is accepted
    const [ignoreCaseChoice, setIgnoreCaseChoice] = useState(undefined);  // the user's own choice, if any
    const tabsRef = useRef(null);

    useEffect(() => {
        loadState(HEIGHT_STORAGE_KEY).then((saved) => saved && setHeight(clampHeight(saved)));
    }, []);

    useEffect(() => {
        const useExamples = (found) =>
            setExamples((found ?? []).map((example, index) => ({ ...example, id: `example-${index}` })));
        loadState(examplesKey).then(useExamples);
        return watchState(examplesKey, useExamples);
    }, [examplesKey]);

    useEffect(() => {
        loadState(caseHintKey).then((found) => setCaseHint(Boolean(found)));
        loadState(ignoreCaseKey).then(setIgnoreCaseChoice);
    }, [caseHintKey, ignoreCaseKey]);

    useEffect(() => {
        loadState(customKey).then((saved) => {
            setCustom(saved ?? []);
            setCustomLoaded(true);
        });
    }, [customKey]);

    useEffect(() => {
        if (!customLoaded) {
            return;
        }
        const timer = setTimeout(() => saveState(customKey, custom), SAVE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [custom, customLoaded, customKey]);

    const cases = [
        ...examples.map((example, index) => ({ ...example, label: `Example ${index + 1}`, isExample: true })),
        ...custom.map((entry, index) => ({ ...entry, label: `Case ${index + 1}`, isExample: false })),
    ];
    const selected = cases.find((entry) => entry.id === selectedId) ?? cases[0];

    // The tabs sit in one scrolling row, so keep the chosen one in view (e.g. a new case at the far end).
    useEffect(() => {
        tabsRef.current?.querySelector(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [selected?.id, cases.length]);

    const runAll = async () => {
        setRunError("");
        if (!runner) {
            setRunError("No code runner is available. Check that the CodeTerra backend is reachable.");
            return;
        }
        if (cases.length === 0) {
            setRunError('Add a test case first (use "+ Add").');
            return;
        }
        const missing = await missingCredentials(runner);
        if (missing.length > 0) {
            setRunError(
                `Add your ${runner.label} ${missing.join(" and ")} in the CodeTerra popup (the extension icon) to run code.`
            );
            return;
        }

        setRunning(true);
        setOpen(true);
        const reply = await runCode({
            runner: runner.id,
            language,
            submittedCode: code,
            testCases: cases.map((entry) => ({ input: entry.input, expectedOutput: entry.output })),
        });
        setRunning(false);

        if (!reply?.ok) {
            setRunError(reply?.error ?? "The run failed.");
            return;
        }
        setResults(
            Object.fromEntries(
                cases.map((entry, index) => [
                    entry.id,
                    { output: reply.testCases[index].output, error: reply.testCases[index].error },
                ])
            )
        );
    };

    // The user's choice wins; without one, follow what the statement says.
    const ignoreCase = ignoreCaseChoice ?? caseHint;
    const toggleIgnoreCase = (checked) => {
        setIgnoreCaseChoice(checked);
        saveState(ignoreCaseKey, checked);
    };

    // undefined before a run. After one: "error" if the code didn't run to completion, "none" if
    // there is no expected output to compare to, otherwise "pass" or "fail".
    const verdict = (entry) => {
        const result = results[entry.id];
        if (!result) {
            return undefined;
        }
        if (result.error) {
            return "error";
        }
        if (entry.output.trim() === "") {
            return "none";
        }
        const [actual, expected] = [normalize(result.output), normalize(entry.output)];
        const same = ignoreCase ? actual.toLowerCase() === expected.toLowerCase() : actual === expected;
        return same ? "pass" : "fail";
    };

    // The whole run in one word: any wrong answer makes it wrong. A case that failed to run isn't
    // an accepted one either, and with no expected outputs there is nothing to judge.
    const overall = (() => {
        const kinds = cases.map(verdict).filter(Boolean);
        for (const kind of ["fail", "error", "pass"]) {
            if (kinds.includes(kind)) {
                return kind;
            }
        }
        return kinds.length > 0 ? "none" : undefined;
    })();

    const atLimit = cases.length >= MAX_CASES;

    const addCase = () => {
        if (atLimit) {
            return;
        }
        const entry = newCase();
        setCustom((previous) => [...previous, entry]);
        setSelectedId(entry.id);
        setOpen(true);
    };

    const updateCase = (field, value) =>
        setCustom((previous) =>
            previous.map((entry) => (entry.id === selected.id ? { ...entry, [field]: value } : entry))
        );

    // Deleting the selected case moves the selection back to the first one.
    const deleteCase = (id) => {
        setCustom((previous) => previous.filter((entry) => entry.id !== id));
        if (id === selected?.id) {
            setSelectedId(null);
        }
    };

    // Drag the strip on the panel's top edge to resize it. Pointer capture keeps the drag going
    // when the cursor leaves the strip.
    const startDrag = (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const drag = (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            setHeight(clampHeight(window.innerHeight - event.clientY));
        }
    };
    const endDrag = (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            saveState(HEIGHT_STORAGE_KEY, height);
        }
    };
    const resetHeight = () => {
        setHeight(DEFAULT_HEIGHT_PX);
        saveState(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT_PX);
    };

    return (
        <div className={`tests${open ? "" : " collapsed"}`} style={open ? { height: `${height}px` } : undefined}>
            {open && (
                <div
                    className="tests-resize"
                    title="Drag to resize (double-click to reset)"
                    onPointerDown={startDrag}
                    onPointerMove={drag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={resetHeight}
                />
            )}
            <div className="tests-bar">
                <div className="tests-side">
                    <button type="button" className="tests-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
                        <span className="chevron">{open ? "▾" : "▸"}</span> Test cases
                    </button>
                </div>
                {overall && !running && (
                    <div className={`overall ${overall}`} role="status">
                        <VerdictIcon kind={overall} />
                        {OVERALL_LABELS[overall]}
                    </div>
                )}
                <div className="tests-actions">
                    <label
                        className="ignore-case"
                        title={
                            ignoreCaseChoice === undefined && caseHint
                                ? "This problem says any letter case is accepted"
                                : "Treat YES, yes and yEs as the same answer"
                        }
                    >
                        <input type="checkbox" checked={ignoreCase} onChange={(event) => toggleIgnoreCase(event.target.checked)} />
                        Ignore case
                    </label>
                    <button type="button" className="run" onClick={runAll} disabled={running}>
                        {running ? "Running…" : "▶ Run"}
                    </button>
                </div>
            </div>
            {open && (
                <div className="tests-tabrow">
                    <div
                        className="tests-tabs"
                        role="tablist"
                        ref={tabsRef}
                        onWheel={(event) => {
                            // a plain mouse wheel scrolls the row sideways
                            if (event.deltaX === 0) {
                                event.currentTarget.scrollLeft += event.deltaY;
                            }
                        }}
                    >
                        {cases.map((entry) => (
                            <div
                                key={entry.id}
                                className={`tab${entry.id === selected?.id ? " active" : ""}${entry.isExample ? "" : " custom"}${
                                    verdict(entry) ? ` ${verdict(entry)}` : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    className="tab-select"
                                    aria-selected={entry.id === selected?.id}
                                    onClick={() => {
                                        setSelectedId(entry.id);
                                        setOpen(true);
                                    }}
                                >
                                    {entry.label}
                                    {verdict(entry) && <VerdictIcon kind={verdict(entry)} />}
                                </button>
                                {!entry.isExample && (
                                    <button
                                        type="button"
                                        className="tab-close"
                                        onClick={() => deleteCase(entry.id)}
                                        aria-label={`Delete ${entry.label}`}
                                        title={`Delete ${entry.label}`}
                                    >
                                        <svg viewBox="0 0 10 10" aria-hidden="true">
                                            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="tab add"
                        onClick={addCase}
                        disabled={atLimit}
                        title={atLimit ? `Limit of ${MAX_CASES} test cases` : "Add a test case"}
                    >
                        + Add
                    </button>
                </div>
            )}
            {runError && (
                <div className="run-error" role="alert">
                    {runError}
                </div>
            )}
            {open && (
                <div className={`tests-body${selected && selected.id in results ? " has-output" : ""}`}>
                    {selected ? (
                        <>
                            <label className="case-field">
                                <span className="case-label">Input</span>
                                <textarea
                                    value={selected.input}
                                    readOnly={selected.isExample}
                                    onChange={(event) => updateCase("input", event.target.value)}
                                    spellCheck={false}
                                />
                            </label>
                            <label className="case-field">
                                <span className="case-label">Expected output</span>
                                <textarea
                                    value={selected.output}
                                    readOnly={selected.isExample}
                                    onChange={(event) => updateCase("output", event.target.value)}
                                    spellCheck={false}
                                />
                            </label>
                            {selected.id in results && (
                                <label className="case-field your-output">
                                    <span className="case-label">
                                        {results[selected.id].error ? "Error" : "Your output"}
                                        {verdict(selected) === "error" && <b className="fail"> · Run failed</b>}
                                        {verdict(selected) === "none" && (
                                            <b className="none"> · No expected output to compare</b>
                                        )}
                                        {verdict(selected) === "pass" && <b className="pass"> · Passed</b>}
                                        {verdict(selected) === "fail" && <b className="fail"> · Wrong answer</b>}
                                    </span>
                                    <textarea value={results[selected.id].output} readOnly spellCheck={false} />
                                </label>
                            )}
                            <div className="case-actions">
                                {selected.isExample ? (
                                    <span className="case-note">Examples come from the problem and can't be edited.</span>
                                ) : (
                                    <button type="button" onClick={() => deleteCase(selected.id)}>Delete this case</button>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="empty">No examples found on this page. Use "+ Add" to make your own test case.</p>
                    )}
                </div>
            )}
        </div>
    );
}
