// Puts the two kinds of runner side by side: Codeforces (codeforces-runner.js, extension only)
// and the backend's (backend-runners.js, e.g. JDoodle). Everything else asks this file.
import { getBackendRunnerOptions, runOnBackend } from "./backend-runners.js";
import { CODEFORCES_RUNNER, runOnCodeforces } from "./codeforces-runner.js";

// Codeforces is always offered; the backend's runners are added when it answers, or from its last
// good answer. getBackendUrl is the background script's own, so the dev-mode switch is followed.
export async function getRunnerOptions(getBackendUrl) {
    const backend = await getBackendUrl().then(getBackendRunnerOptions, (error) => ({ ok: false, error: error.message }));
    return {
        ok: true,
        options: [CODEFORCES_RUNNER, ...(backend.ok ? backend.options : [])],
        stale: backend.stale,
    };
}

// Runs the editor's code against every test case with the chosen runner. `tab` is the tab the
// request came from, which Codeforces runs need.
export async function runCode(message, tab, getBackendUrl) {
    if (message.runner === CODEFORCES_RUNNER.id) {
        return runOnCodeforces(message, tab);
    }
    return runOnBackend(await getBackendUrl(), message);
}
