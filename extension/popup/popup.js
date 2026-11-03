const devModeSwitch = document.getElementById("dev-mode");

chrome.storage.local.get({ devMode: false }).then(({ devMode }) => {
    devModeSwitch.checked = devMode;
});

devModeSwitch.addEventListener("change", async () => {
    await chrome.storage.local.set({ devMode: devModeSwitch.checked });
    loadRunners();  // the other backend may offer different runners
});

const keyInput = document.getElementById("openai-key");
const keyStatus = document.getElementById("key-status");
const KEY_HINT = keyStatus.textContent;

chrome.storage.local.get({ openaiKey: "" }).then(({ openaiKey }) => {
    keyInput.value = openaiKey;
});

keyInput.addEventListener("change", async () => {
    await chrome.storage.local.set({ openaiKey: keyInput.value.trim() });
    keyStatus.textContent = keyInput.value.trim() ? "Saved." : "Key removed.";
    setTimeout(() => (keyStatus.textContent = KEY_HINT), 2000);
});

const themeSelect = document.getElementById("editor-theme");

chrome.storage.local.get({ editorTheme: "vs" }).then(({ editorTheme }) => {
    themeSelect.value = editorTheme;
});

themeSelect.addEventListener("change", () => {
    chrome.storage.local.set({ editorTheme: themeSelect.value });  // an open editor updates at once
});

// --- Code runner credentials -------------------------------------------------------------
// One group of boxes per runner, so a user can keep credentials for all of them. Which runner is
// used is chosen in the editor. The backend says which runners exist and which credentials each
// needs (GET /runners/options), so this section has no runner-specific code.

const credentialsBox = document.getElementById("runner-credentials");
const runnerStatus = document.getElementById("runner-status");
const RUNNER_HINT = "Credentials are stored only in this browser and sent to the CodeTerra backend when you run code. Pick the runner in the editor.";

const ACRONYMS = new Set(["id", "url", "api"]);

// "client_id" -> "Client ID", "api_key" -> "API Key"
function credentialLabel(field) {
    return field
        .split("_")
        .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");
}

function showRunnerStatus(text, resetAfterMs) {
    runnerStatus.textContent = text;
    if (resetAfterMs) {
        setTimeout(() => (runnerStatus.textContent = RUNNER_HINT), resetAfterMs);
    }
}

function renderRunnerCredentials(runners, savedByRunner) {
    credentialsBox.replaceChildren();
    for (const runner of runners) {
        if (runner.credential_fields.length === 0) {
            continue;  // nothing to enter, e.g. Codeforces
        }
        const group = document.createElement("section");
        group.className = "runner-group";
        group.dataset.runner = runner.id;

        const title = document.createElement("div");
        title.className = "runner-title";
        title.textContent = `${runner.label} credentials`;
        group.append(title);

        const saved = savedByRunner[runner.id] ?? {};
        for (const field of runner.credential_fields) {
            const label = document.createElement("label");
            label.className = "field";

            const name = document.createElement("span");
            name.className = "setting-label";
            name.textContent = credentialLabel(field);

            const input = document.createElement("input");
            input.type = "password";
            input.className = "text-input";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.dataset.field = field;
            input.value = saved[field] ?? "";

            label.append(name, input);
            group.append(label);
        }
        credentialsBox.append(group);
    }
}

async function loadRunners() {
    showRunnerStatus("Loading runners...");
    const reply = await chrome.runtime.sendMessage({ type: "GET_RUNNER_OPTIONS" });

    if (!reply?.ok) {
        credentialsBox.replaceChildren();
        showRunnerStatus(`Could not load the code runners (${reply?.error ?? "no reply"}). Is the backend running?`);
        return;
    }
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    renderRunnerCredentials(reply.options, runnerCredentials);
    showRunnerStatus(reply.stale ? "Backend unreachable; showing the last known runners." : RUNNER_HINT);
}

credentialsBox.addEventListener("change", async (event) => {
    const group = event.target.closest(".runner-group");
    const values = {};
    for (const input of group.querySelectorAll("input")) {
        values[input.dataset.field] = input.value.trim();
    }
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    await chrome.storage.local.set({ runnerCredentials: { ...runnerCredentials, [group.dataset.runner]: values } });
    showRunnerStatus("Saved.", 2000);
});

loadRunners();
