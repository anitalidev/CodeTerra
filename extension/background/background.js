const DEV_BACKEND_URL = "http://localhost:8000";
// Your Railway address, like "https://codeterra-production.up.railway.app" (no trailing slash).
const PRODUCTION_BACKEND_URL = "https://codeterra-production.up.railway.app";
const KEEP_ALIVE_MS = 20000;
const API_KEY_PROBLEM = "API_KEY_PROBLEM";
// /contest/2104/problem/A  or  /problemset/problem/380/C
const PROBLEM_URL_PATTERN = /\/(?:contest\/(\d+)\/problem\/|problemset\/problem\/(\d+)\/)([^/?#]+)/;

// The popup's "Dev mode" switch picks the local backend; otherwise the deployed one is used.
async function getBackendUrl() {
    const { devMode } = await chrome.storage.local.get({ devMode: false });
    if (devMode) {
        return DEV_BACKEND_URL;
    }
    if (!PRODUCTION_BACKEND_URL) {
        throw new Error("No production backend URL is set. Turn on Dev mode, or set PRODUCTION_BACKEND_URL in background.js");
    }
    return PRODUCTION_BACKEND_URL;
}

async function labelProblem(tab) {
    console.log("CodeTerra: asking tab for problem text", tab.id, tab.url);
    const reply = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROBLEM_TEXT" });
    console.log("CodeTerra: got problem text reply", reply?.ok, reply?.text?.length);
    if (!reply.ok) {
        throw new Error(reply.error);
    }

    const match = PROBLEM_URL_PATTERN.exec(tab.url);
    if (!match) {
        throw new Error("This tab is not a Codeforces problem page");
    }
    const contestID = match[1] ?? match[2];
    const index = match[3];

    const backendUrl = await getBackendUrl();
    const { openaiKey } = await chrome.storage.local.get({ openaiKey: "" });
    const headers = { "Content-Type": "application/json" };
    if (openaiKey) {
        headers["X-OpenAI-Key"] = openaiKey;
    }
    console.log("CodeTerra: calling backend", backendUrl, contestID, index);
    const response = await fetch(`${backendUrl}/problems/${contestID}/${encodeURIComponent(index)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ problemText: reply.text }),
    });
    console.log("CodeTerra: backend replied", response.status);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const error = new Error(typeof body?.detail === "string" ? body.detail : `Backend returned ${response.status}`);
        if (response.status === 401) {
            error.code = API_KEY_PROBLEM;  // missing or rejected OpenAI key
        }
        throw error;
    }
    return (await response.json()).extraTags;
}

// The code runners (JDoodle, ...) the backend offers, each with its languages and the credentials
// it needs. The last good answer is kept in storage so the popup and editor still work offline.
async function getRunnerOptions() {
    try {
        const response = await fetch(`${await getBackendUrl()}/runners/options`);
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }
        const options = await response.json();
        await chrome.storage.local.set({ runnerOptions: options });
        return { ok: true, options };
    } catch (error) {
        console.error("CodeTerra: could not load runner options", error);
        const { runnerOptions } = await chrome.storage.local.get({ runnerOptions: null });
        if (runnerOptions) {
            return { ok: true, options: runnerOptions, stale: true };
        }
        return { ok: false, error: error.message };
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "GET_RUNNER_OPTIONS") {
        return;
    }
    getRunnerOptions().then(sendResponse);
    return true;
});

// Runs the editor's code against every test case. The credentials for the chosen runner come
// from storage here, so the editor page never has to pass them around.
async function runCode({ runner, language, submittedCode, testCases }) {
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    const response = await fetch(`${await getBackendUrl()}/runners/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            runner,
            language,
            submittedCode,
            testCases,
            credentials: runnerCredentials[runner] ?? {},
        }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: typeof body?.detail === "string" ? body.detail : `Backend returned ${response.status}`,
        };
    }
    return { ok: true, testCases: body.testCases };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "RUN_CODE") {
        return;
    }
    // Several runs in a row can outlast the idle timeout, same as labeling (see below).
    const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), KEEP_ALIVE_MS);
    runCode(message)
        .catch((error) => ({ ok: false, error: `Could not reach the CodeTerra backend (${error.message}).` }))
        .then(sendResponse)
        .finally(() => clearInterval(keepAlive));
    return true;
});

// Not async: Chrome ignores a Promise returned from this listener, so the async work runs
// inside and the listener returns true to keep the channel open for sendResponse.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "LABEL_PROBLEM_EXTRA_TAGS") {
        return;
    }
    (async () => {
        // Chrome stops an idle service worker, and a slow backend reply (the first label for a
        // problem calls OpenAI) doesn't count as activity. Any extension API call resets the timer.
        const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), KEEP_ALIVE_MS);
        try {
            console.log("CodeTerra: label request received");
            const tab = sender.tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
            sendResponse({ ok: true, tags: await labelProblem(tab) });
        } catch (error) {
            console.error("CodeTerra: labeling failed", error);
            sendResponse({ ok: false, error: error.message, code: error.code });
        } finally {
            clearInterval(keepAlive);
        }
    })();
    return true;
});
