console.log("CodeTerra Tagging Activated.");

const COPY_LABEL = "Copy";
const COPIED_LABEL = "Copied!";
const FAILED_LABEL = "Failed";
const LABEL_RESET_MS = 1500;
const BUTTON_INSET_PX = 4;

function createCopyButton(statement) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = COPY_LABEL;
    button.className = "codeterra-copy-button";
    Object.assign(button.style, {
        position: "absolute",
        zIndex: "1000",
        padding: "2px 8px",
        font: "12px sans-serif",
        color: "#666",
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "2px",
        cursor: "pointer",
    });

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

// The button lives on <body>, not inside the statement: Codeforces watches the statement
// and shows a "recently changed" notice if anything is added to it.
function positionButton(button, statement) {
    const rect = statement.getBoundingClientRect();
    button.style.top = `${rect.top + window.scrollY + BUTTON_INSET_PX}px`;
    button.style.right = `${document.documentElement.clientWidth - rect.right - window.scrollX + BUTTON_INSET_PX}px`;
}

function addCopyButton() {
    const statement = document.querySelector(".problem-statement");
    if (!statement || document.querySelector(".codeterra-copy-button")) {
        return;
    }
    const button = createCopyButton(statement);
    document.body.append(button);

    const reposition = () => positionButton(button, statement);
    reposition();
    window.addEventListener("resize", reposition);
    new ResizeObserver(reposition).observe(statement);  // layout shifts, e.g. math finishing rendering
}

addCopyButton();

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
