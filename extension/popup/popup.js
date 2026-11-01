const devModeSwitch = document.getElementById("dev-mode");

chrome.storage.local.get({ devMode: false }).then(({ devMode }) => {
    devModeSwitch.checked = devMode;
});

devModeSwitch.addEventListener("change", () => {
    chrome.storage.local.set({ devMode: devModeSwitch.checked });
});
