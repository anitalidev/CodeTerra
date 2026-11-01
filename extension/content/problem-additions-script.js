console.log("CodeTerra Tagging Activated.");

const COPY_LABEL = "Copy";
const COPIED_LABEL = "Copied!";
const FAILED_LABEL = "Failed";
const LABEL_RESET_MS = 1500;

const OPEN_EDITOR_LABEL = "Open Editor View";
const CLOSE_EDITOR_LABEL = "Close Editor View";
const TOOLBAR_GAP_PX = 6;

function createToolbarButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
        padding: "2px 8px",
        font: "12px sans-serif",
        color: "#666",
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "2px",
        cursor: "pointer",
    });
    return button;
}

function createCopyButton(statement) {
    const button = createToolbarButton(COPY_LABEL);
    button.className = "codeterra-copy-button";

    button.addEventListener("click", async () => {
        try {
            await copyProblemText(statement);
            button.textContent = COPIED_LABEL;
        } catch (error) {
            console.error("CodeTerra: could not copy problem text", error);
            button.textContent = FAILED_LABEL;
        }
        setTimeout(() => (button.textContent = COPY_LABEL), LABEL_RESET_MS);
    });
    return button;
}

function createEditorButton() {
    const button = createToolbarButton(OPEN_EDITOR_LABEL);
    button.className = "codeterra-editor-button";

    button.addEventListener("click", () => {
        const isOpen = toggleEditorPanel();  // from editor-panel.js
        button.textContent = isOpen ? CLOSE_EDITOR_LABEL : OPEN_EDITOR_LABEL;
    });
    return button;
}

// The buttons sit just above the problem, in the page flow, so they can't get squeezed over the
// title. They are placed before the whole problem block, not inside the statement: Codeforces
// watches the statement and shows a "recently changed" notice if anything is added to it.
function addToolbar() {
    const statement = document.querySelector(".problem-statement");
    if (!statement || document.querySelector(".codeterra-toolbar")) {
        return;
    }
    const toolbar = document.createElement("div");
    toolbar.className = "codeterra-toolbar";
    Object.assign(toolbar.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: `${TOOLBAR_GAP_PX}px`,
        margin: "0 0 6px",
    });
    toolbar.append(createEditorButton(), createCopyButton(statement));
    (document.querySelector(".problemindexholder") ?? statement).before(toolbar);
}

addToolbar();
syncEditorWithHash();  // a link ending in #editor-view opens the editor view (editor-panel.js)

// Lets the background script ask for the problem text.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "GET_PROBLEM_TEXT") {
        return;
    }
    try {
        sendResponse({ ok: true, text: getProblemText() });
    } catch (error) {
        sendResponse({ ok: false, error: error.message });
    }
});

// --- Extra tags -----------------------------------------------------------------------

const EXTRA_TAG_BACKGROUND = "#fff6b3";
const EXTRA_TAG_CLASS = "codeterra-extra-tag";

// The <div> that holds Codeforces' own tag boxes (and the "No tag edit access" line).
function findTagList() {
    const tagBox = document.querySelector(".tag-box");
    return tagBox ? tagBox.closest(".roundbox").parentElement : null;
}

// Same markup as a Codeforces tag, with a yellow background instead of grey.
function createExtraTag(name) {
    const wrapper = document.createElement("div");
    wrapper.className = `roundbox borderTopRound borderBottomRound ${EXTRA_TAG_CLASS}`;
    wrapper.style.cssText = `margin:2px; padding:0 3px 2px 3px; background-color:${EXTRA_TAG_BACKGROUND}; float:left;`;

    const label = document.createElement("span");
    label.className = "tag-box";
    label.style.fontSize = "1.2rem";
    label.title = "Suggested by CodeTerra";
    label.textContent = name;

    wrapper.append(label);
    return wrapper;
}

function showExtraTags(tags) {
    const tagList = findTagList();
    if (!tagList) {
        console.warn("CodeTerra: could not find the problem tags box");
        return;
    }
    tagList.querySelectorAll(`.${EXTRA_TAG_CLASS}`).forEach((tag) => tag.remove());

    // Put ours after Codeforces' tags, before the "clear: both" line underneath them.
    const clearLine = Array.from(tagList.children).find((child) => child.style.clear === "both");
    for (const name of tags) {
        tagList.insertBefore(createExtraTag(name), clearLine ?? null);
    }
}

async function addExtraTags() {
    try {
        const response = await chrome.runtime.sendMessage({ type: "LABEL_PROBLEM_EXTRA_TAGS" });
        if (!response?.ok) {
            console.error("CodeTerra: could not get extra tags:", response?.error);
            if (response?.code === "API_KEY_PROBLEM") {
                showExtraTags([response.error]);  // tells the user what to fix, in the tag box
            }
            return;
        }
        showExtraTags(response.tags);
    } catch (error) {
        console.error("CodeTerra: could not get extra tags", error);
    }
}

addExtraTags();
