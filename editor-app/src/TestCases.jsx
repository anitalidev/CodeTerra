import { useEffect, useState } from "react";

import { missingCredentials, runCode } from "./runners";
import { loadState, saveState, watchState } from "./storage";

const SAVE_DELAY_MS = 400;
const HEIGHT_STORAGE_KEY = "testsHeight";
const DEFAULT_HEIGHT_PX = 230;
const MIN_HEIGHT_PX = 120;
const MIN_EDITOR_HEIGHT_PX = 160;

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

function newCase() {
    return { id: crypto.randomUUID(), input: "", output: "" };
}

// Example cases come from the problem page and can't be edited. Custom cases are the user's own
// and are saved per problem.
export default function TestCases({ problem, runner, language, code }) {
    const examplesKey = `examples:${problem}`;
    const customKey = `tests:${problem}`;

    const [examples, setExamples] = useState([]);
    const [custom, setCustom] = useState([]);
    const [customLoaded, setCustomLoaded] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [open, setOpen] = useState(true);
    const [height, setHeight] = useState(DEFAULT_HEIGHT_PX);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState({});  // case id -> { output, error }; error means output is an error message
    const [runError, setRunError] = useState("");

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

    // "error" if the code didn't run to completion, else pass / fail once a case has been run;
    // undefined before a run, or with no expected output to compare to
    const verdict = (entry) => {
        const result = results[entry.id];
        if (!result) {
            return undefined;
        }
        if (result.error) {
            return "error";
        }
        if (entry.output.trim() === "") {
            return undefined;
        }
        return normalize(result.output) === normalize(entry.output) ? "pass" : "fail";
    };

    const addCase = () => {
        const entry = newCase();
        setCustom((previous) => [...previous, entry]);
        setSelectedId(entry.id);
        setOpen(true);
    };

    const updateCase = (field, value) =>
        setCustom((previous) =>
            previous.map((entry) => (entry.id === selected.id ? { ...entry, [field]: value } : entry))
        );

    const deleteCase = () => {
        setCustom((previous) => previous.filter((entry) => entry.id !== selected.id));
        setSelectedId(null);
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
                <button type="button" className="tests-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
                    <span className="chevron">{open ? "▾" : "▸"}</span> Test cases
                </button>
                <div className="tests-tabs" role="tablist">
                    {cases.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={entry.id === selected?.id}
                            className={`tab${entry.id === selected?.id ? " active" : ""}${entry.isExample ? "" : " custom"}${
                                verdict(entry) ? ` ${verdict(entry)}` : ""
                            }`}
                            onClick={() => {
                                setSelectedId(entry.id);
                                setOpen(true);
                            }}
                        >
                            {entry.label}
                            {verdict(entry) === "pass" && " ✓"}
                            {verdict(entry) === "fail" && " ✗"}
                            {verdict(entry) === "error" && " ⚠"}
                        </button>
                    ))}
                    <button type="button" className="tab add" onClick={addCase} title="Add a test case">
                        + Add
                    </button>
                </div>
                <span className="spacer" />
                <button type="button" className="run" onClick={runAll} disabled={running}>
                    {running ? "Running…" : "▶ Run"}
                </button>
            </div>
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
                                    <button type="button" onClick={deleteCase}>Delete this case</button>
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
