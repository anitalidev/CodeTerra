import { loadState } from "./storage";

const OPTIONS_KEY = "runnerOptions";
export const RUNNER_KEY = "runner";

// The runners the backend offers, e.g. [{ id, label, credential_fields, languages: [{ id, label }] }].
// The background script fetches them and keeps the last good answer in storage.
export async function loadRunnerOptions() {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
            const reply = await chrome.runtime.sendMessage({ type: "GET_RUNNER_OPTIONS" });
            if (reply?.ok) {
                return reply.options;
            }
        } catch {
            // fall through to whatever is remembered
        }
    }
    return (await loadState(OPTIONS_KEY)) ?? [];
}

const ACRONYMS = new Set(["id", "url", "api"]);

// "client_id" -> "Client ID"
function credentialLabel(field) {
    return field
        .split("_")
        .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");
}

// The credentials this runner needs that the user hasn't entered in the popup yet, as readable names.
export async function missingCredentials(runner) {
    const saved = ((await loadState("runnerCredentials")) ?? {})[runner.id] ?? {};
    return runner.credential_fields.filter((field) => !saved[field]).map(credentialLabel);
}

// Runs the code against each test case ({ input, expectedOutput }) through the background script.
// Resolves to { ok: true, testCases: [{ input, output, expectedOutput }] } or { ok: false, error }.
export async function runCode({ runner, language, submittedCode, testCases }) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        return { ok: false, error: "Running code only works inside the CodeTerra extension." };
    }
    try {
        return await chrome.runtime.sendMessage({ type: "RUN_CODE", runner, language, submittedCode, testCases });
    } catch (error) {
        return { ok: false, error: `Could not run the code (${error.message}).` };
    }
}
