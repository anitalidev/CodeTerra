const devModeSwitch = document.getElementById("dev-mode");

chrome.storage.local.get({ devMode: false }).then(({ devMode }) => {
    devModeSwitch.checked = devMode;
});

devModeSwitch.addEventListener("change", () => {
    chrome.storage.local.set({ devMode: devModeSwitch.checked });
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
