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
