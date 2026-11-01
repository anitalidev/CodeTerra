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

// --- Code runner and its credentials ----------------------------------------------------
// The backend says which runners exist and which credentials each needs (GET /runners/options),
// so this section has no runner-specific code.

const runnerSelect = document.getElementById("runner");
const credentialsBox = document.getElementById("runner-credentials");
const runnerStatus = document.getElementById("runner-status");
const RUNNER_HINT = "Credentials are stored only in this browser and sent to the CodeTerra backend when you run code.";

let runnerOptions = [];

// "client_id" -> "Client ID"
function credentialLabel(field) {
    return field
        .split("_")
        .map((word) => (word === "id" ? "ID" : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");
}

function showRunnerStatus(text, resetAfterMs) {
    runnerStatus.textContent = text;
    if (resetAfterMs) {
        setTimeout(() => (runnerStatus.textContent = RUNNER_HINT), resetAfterMs);
    }
}

function selectedRunner() {
    return runnerOptions.find((runner) => runner.id === runnerSelect.value);
}

async function renderCredentials() {
    credentialsBox.replaceChildren();
    const runner = selectedRunner();
    if (!runner) {
        return;
    }
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    const saved = runnerCredentials[runner.id] ?? {};

    for (const field of runner.credential_fields) {
        const label = document.createElement("label");
        label.className = "field";

        const name = document.createElement("span");
        name.className = "setting-label";
        name.textContent = `${runner.label} ${credentialLabel(field)}`;

        const input = document.createElement("input");
        input.type = "password";
        input.className = "text-input";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.dataset.field = field;
        input.value = saved[field] ?? "";

        label.append(name, input);
        credentialsBox.append(label);
    }
}

async function saveCredentials() {
    const runner = selectedRunner();
    const values = {};
    for (const input of credentialsBox.querySelectorAll("input")) {
        values[input.dataset.field] = input.value.trim();
    }
    const { runnerCredentials } = await chrome.storage.local.get({ runnerCredentials: {} });
    await chrome.storage.local.set({ runnerCredentials: { ...runnerCredentials, [runner.id]: values } });
    showRunnerStatus("Saved.", 2000);
}

async function loadRunners() {
    showRunnerStatus("Loading runners...");
    const reply = await chrome.runtime.sendMessage({ type: "GET_RUNNER_OPTIONS" });

    if (!reply?.ok) {
        runnerOptions = [];
        runnerSelect.replaceChildren();
        runnerSelect.disabled = true;
        credentialsBox.replaceChildren();
        showRunnerStatus(`Could not load the code runners (${reply?.error ?? "no reply"}). Is the backend running?`);
        return;
    }

    runnerOptions = reply.options;
    runnerSelect.disabled = false;
    runnerSelect.replaceChildren(
        ...runnerOptions.map((runner) => new Option(runner.label, runner.id))
    );
    const { runner: chosen } = await chrome.storage.local.get({ runner: "" });
    runnerSelect.value = runnerOptions.some((runner) => runner.id === chosen) ? chosen : runnerOptions[0]?.id ?? "";

    await renderCredentials();
    showRunnerStatus(reply.stale ? "Backend unreachable; showing the last known runners." : RUNNER_HINT);
}

runnerSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ runner: runnerSelect.value });  // an open editor updates at once
    renderCredentials();
});

credentialsBox.addEventListener("change", saveCredentials);

loadRunners();
