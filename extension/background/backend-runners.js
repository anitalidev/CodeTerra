// Code runners that live on the CodeTerra backend (JDoodle, ...). The backend says which runners
// exist and which languages and credentials each needs; running code is sent to it.

// The code runners the backend offers, each with its languages and the credentials it needs. The
// last good answer is kept in storage so the popup and editor still work offline.
export async function getBackendRunnerOptions(backendUrl) {
    try {
        const response = await fetch(`${backendUrl}/runners/options`);
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

// Runs the editor's code against every test case. The credentials for the chosen runner come
// from storage here, so the editor page never has to pass them around.
export async function runOnBackend(backendUrl, { runner, language, submittedCode, testCases }) {
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    try {
        const response = await fetch(`${backendUrl}/runners/run`, {
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
    } catch (error) {
        return { ok: false, error: `Could not reach the CodeTerra backend (${error.message}).` };
    }
}
