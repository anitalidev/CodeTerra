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
