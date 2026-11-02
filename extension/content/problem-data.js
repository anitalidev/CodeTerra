// Per-problem data (your code, test cases, examples) is kept for KEEP_DAYS after the problem was
// last opened in the editor, then deleted. Runs whenever the editor opens.
//
// Keep PROBLEM_DATA_PREFIXES in step with the keys the editor saves (editor-app/src/App.jsx and
// TestCases.jsx) and the ones editor-panel.js saves: each is "<prefix><contest>/<index>".
const PROBLEM_DATA_PREFIXES = ["editor:", "tests:", "examples:", "caseHint:", "ignoreCase:"];
const LAST_USED_KEY = "problemLastUsed";  // { "2272/C": time the editor was last opened on it }
const KEEP_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function problemOfKey(key) {
    const prefix = PROBLEM_DATA_PREFIXES.find((candidate) => key.startsWith(candidate));
    return prefix ? key.slice(prefix.length) : null;
}

// Marks `currentProblem` as used now and deletes everything saved for problems not opened within
// KEEP_DAYS. Data saved before this existed has no date, so it starts its grace period now.
async function removeStaleProblemData(currentProblem, storage = chrome.storage.local, now = Date.now()) {
    const all = await storage.get(null);
    const lastUsed = { ...(all[LAST_USED_KEY] ?? {}) };
    const cutoff = now - KEEP_DAYS * DAY_MS;

    const keysByProblem = new Map();
    for (const key of Object.keys(all)) {
        const problem = problemOfKey(key);
        if (problem !== null) {
            keysByProblem.set(problem, [...(keysByProblem.get(problem) ?? []), key]);
        }
    }

    if (currentProblem) {
        lastUsed[currentProblem] = now;
    }
    for (const problem of keysByProblem.keys()) {
        lastUsed[problem] ??= now;
    }

    const keysToRemove = [];
    for (const [problem, usedAt] of Object.entries(lastUsed)) {
        if (usedAt < cutoff) {
            keysToRemove.push(...(keysByProblem.get(problem) ?? []));
            delete lastUsed[problem];
        }
    }

    if (keysToRemove.length > 0) {
        await storage.remove(keysToRemove);
    }
    await storage.set({ [LAST_USED_KEY]: lastUsed });
    return keysToRemove;
}
