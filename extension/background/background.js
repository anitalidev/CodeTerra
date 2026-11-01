const DEV_BACKEND_URL = "http://localhost:8000";
// Your Railway address, like "https://codeterra-production.up.railway.app" (no trailing slash).
const PRODUCTION_BACKEND_URL = "https://codeterra-production.up.railway.app";
const KEEP_ALIVE_MS = 20000;
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
    console.log("CodeTerra: calling backend", backendUrl, contestID, index);
    const response = await fetch(`${backendUrl}/problems/${contestID}/${encodeURIComponent(index)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemText: reply.text }),
    });
    console.log("CodeTerra: backend replied", response.status);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : `Backend returned ${response.status}`);
    }
    return (await response.json()).extraTags;
}

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
            sendResponse({ ok: false, error: error.message });
        } finally {
            clearInterval(keepAlive);
        }
    })();
    return true;
});
