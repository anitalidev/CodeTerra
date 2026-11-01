import { useEffect, useState } from "react";

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

function newCase() {
    return { id: crypto.randomUUID(), input: "", output: "" };
}

// Example cases come from the problem page and can't be edited. Custom cases are the user's own
// and are saved per problem.
export default function TestCases({ problem }) {
    const examplesKey = `examples:${problem}`;
    const customKey = `tests:${problem}`;

    const [examples, setExamples] = useState([]);
    const [custom, setCustom] = useState([]);
    const [customLoaded, setCustomLoaded] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [open, setOpen] = useState(true);
    const [height, setHeight] = useState(DEFAULT_HEIGHT_PX);

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
                            className={`tab${entry.id === selected?.id ? " active" : ""}${entry.isExample ? "" : " custom"}`}
                            onClick={() => {
                                setSelectedId(entry.id);
                                setOpen(true);
                            }}
                        >
                            {entry.label}
                        </button>
                    ))}
                    <button type="button" className="tab add" onClick={addCase} title="Add a test case">
                        + Add
                    </button>
                </div>
            </div>
            {open && (
                <div className="tests-body">
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
