// Monaco's built-in themes. The ids must match the options in extension/popup/popup.html.
export const THEMES = [
    { id: "vs", label: "Light", dark: false },
    { id: "vs-dark", label: "Dark", dark: true },
    { id: "hc-light", label: "High contrast light", dark: false },
    { id: "hc-black", label: "High contrast dark", dark: true },
];

export const DEFAULT_THEME = "vs";
export const THEME_STORAGE_KEY = "editorTheme";
