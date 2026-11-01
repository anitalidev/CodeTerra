// Saves in chrome.storage.local inside the extension; falls back to localStorage so the page
// can also be opened on its own while developing.
const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage?.local;

export async function loadState(key) {
    if (hasChromeStorage) {
        return (await chrome.storage.local.get(key))[key];
    }
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return undefined;
    }
}

export async function saveState(key, value) {
    if (hasChromeStorage) {
        await chrome.storage.local.set({ [key]: value });
        return;
    }
    localStorage.setItem(key, JSON.stringify(value));
}

// Calls onChange(newValue) whenever `key` changes, e.g. when the popup picks a new theme.
export function watchState(key, onChange) {
    if (!hasChromeStorage) {
        return () => {};
    }
    const listener = (changes, area) => {
        if (area === "local" && changes[key]) {
            onChange(changes[key].newValue);
        }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
