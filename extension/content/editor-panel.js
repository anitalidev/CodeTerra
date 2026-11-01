// The CodeTerra code editor, docked beside the problem when the Open Editor button is clicked.
// The editor is a page bundled with the extension (editor/index.html) shown in an iframe:
// Monaco needs web workers, which a content script can't start on codeforces.com, but an
// extension page can.

const EDITOR_WIDTH_VAR = "--codeterra-editor-width";
const DEFAULT_EDITOR_WIDTH = "50vw";
const EDITOR_WIDTH = `var(${EDITOR_WIDTH_VAR}, ${DEFAULT_EDITOR_WIDTH})`;
const EDITOR_WIDTH_STORAGE_KEY = "editorWidth";
const MIN_EDITOR_WIDTH_PX = 320;
const MIN_PAGE_WIDTH_PX = 320;
const HANDLE_WIDTH_PX = 6;
const DIVIDER_WIDTH_PX = 1;  // the editor frame's left border

const SPLIT_CLASS = "codeterra-split";
const DRAGGING_CLASS = "codeterra-dragging";
const SPLIT_STYLE_ID = "codeterra-split-styles";
const EDITOR_PROBLEM_PATTERN = /\/(?:contest\/(\d+)\/problem\/|problemset\/problem\/(\d+)\/)([^/?#]+)/;

function createEditorFrame() {
    const match = EDITOR_PROBLEM_PATTERN.exec(window.location.pathname);
    const problem = match ? `${match[1] ?? match[2]}/${match[3]}` : "";

    const frame = document.createElement("iframe");
    frame.className = "codeterra-editor";
    frame.src = chrome.runtime.getURL(`editor/index.html?problem=${encodeURIComponent(problem)}`);
    frame.title = "CodeTerra Editor";
    // Docked to the right edge of the window, full height, beside the problem.
    Object.assign(frame.style, {
        position: "fixed",
        top: "0",
        right: "0",
        bottom: "0",
        zIndex: "2000",
        boxSizing: "border-box",
        width: EDITOR_WIDTH,
        height: "100%",
        border: "none",
        borderLeft: `${DIVIDER_WIDTH_PX}px solid #b9b9b9`,
        background: "#fff",
    });
    return frame;
}

function clampEditorWidth(widthPx) {
    return Math.min(Math.max(widthPx, MIN_EDITOR_WIDTH_PX), window.innerWidth - MIN_PAGE_WIDTH_PX);
}

function setEditorWidth(widthPx) {
    document.documentElement.style.setProperty(EDITOR_WIDTH_VAR, `${clampEditorWidth(widthPx)}px`);
}

function currentEditorWidth(frame) {
    return frame.getBoundingClientRect().width;
}

// A strip over the divider that can be dragged to resize the editor. Pointer capture keeps the
// drag going while the cursor is over the editor's iframe, which would otherwise swallow it.
function createResizeHandle(frame) {
    const handle = document.createElement("div");
    handle.className = "codeterra-editor-handle";
    handle.title = "Drag to resize (double-click to reset)";
    Object.assign(handle.style, {
        position: "fixed",
        top: "0",
        bottom: "0",
        // Centred on the divider line, so the bar extends the same distance on both sides of it.
        right: `calc(${EDITOR_WIDTH} - ${(HANDLE_WIDTH_PX + DIVIDER_WIDTH_PX) / 2}px)`,
        width: `${HANDLE_WIDTH_PX}px`,
        zIndex: "2001",
        cursor: "col-resize",
    });

    const endDrag = (event) => {
        if (!handle.hasPointerCapture(event.pointerId)) {
            return;
        }
        handle.releasePointerCapture(event.pointerId);
        document.documentElement.classList.remove(DRAGGING_CLASS);
        chrome.storage.local.set({ [EDITOR_WIDTH_STORAGE_KEY]: currentEditorWidth(frame) });
    };

    handle.addEventListener("pointerdown", (event) => {
        handle.setPointerCapture(event.pointerId);
        document.documentElement.classList.add(DRAGGING_CLASS);
        event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
        if (handle.hasPointerCapture(event.pointerId)) {
            setEditorWidth(window.innerWidth - event.clientX);
        }
    });
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("dblclick", () => {
        document.documentElement.style.removeProperty(EDITOR_WIDTH_VAR);
        chrome.storage.local.remove(EDITOR_WIDTH_STORAGE_KEY);
    });
    return handle;
}

// Page layout while the editor is open. The page is squeezed into the left part of the window.
// Codeforces gives its layout a 920px minimum width and a sidebar next to the content, so the
// sidebar's boxes are stacked instead. What we don't need while coding is pushed to the bottom
// (the contest menu bar, the logo and the main menu are hidden). Top to bottom: the problem,
// the Problem tags box, the other boxes, then the footer. (`display: contents` lets the
// boxes be ordered as if they weren't in the sidebar.)
function addLayoutStyles() {
    if (document.getElementById(SPLIT_STYLE_ID)) {
        return;
    }
    const split = `html.${SPLIT_CLASS}`;
    const style = document.createElement("style");
    style.id = SPLIT_STYLE_ID;
    style.textContent = `
        ${split} body { margin: 0 ${EDITOR_WIDTH} 0 0; }
        ${split} #body {
            min-width: 0 !important;
            display: flex !important;
            flex-direction: column;
            padding-top: 0 !important;
        }
        ${split} #body > br { display: none; }  /* spacer line breaks between the page's sections */
        ${split} #header,
        ${split} .menu-box { display: none !important; }  /* logo, login line and main menu */
        ${split} #footer { order: 12; }
        ${split} div:has(> #pageContent) { display: flex !important; flex-direction: column; }
        ${split} #pageContent { order: -1; width: auto !important; margin: 6px 14px 14px !important; padding-top: 0 !important; }
        ${split} #sidebar { display: contents !important; }
        ${split} #sidebar > .sidebox { order: 2; margin: 0 14px 14px !important; width: auto !important; }
        ${split} #sidebar > .sidebox:has(.tag-box) { order: 1; }  /* tags, right under the problem */
        ${split} .second-level-menu { display: none !important; }  /* the contest menu bar */

        .codeterra-editor-handle:hover { background: rgba(59, 89, 152, 0.25); }
        html.${DRAGGING_CLASS} { cursor: col-resize; user-select: none; }
        html.${DRAGGING_CLASS} .codeterra-editor { pointer-events: none; }
    `;
    document.head.append(style);
}

function setPageShrunk(shrunk) {
    addLayoutStyles();
    document.documentElement.classList.toggle(SPLIT_CLASS, shrunk);
}

function openEditorPanel() {
    let frame = document.querySelector(".codeterra-editor");
    if (!frame) {
        frame = createEditorFrame();
        document.body.append(frame, createResizeHandle(frame));
        window.addEventListener("resize", () => setEditorWidth(currentEditorWidth(frame)));
        chrome.storage.local.get(EDITOR_WIDTH_STORAGE_KEY).then((saved) => {
            if (saved[EDITOR_WIDTH_STORAGE_KEY]) {
                setEditorWidth(saved[EDITOR_WIDTH_STORAGE_KEY]);
            }
        });
    }
    frame.style.display = "block";
    document.querySelector(".codeterra-editor-handle").style.display = "block";
    setPageShrunk(true);
}

function closeEditorPanel() {
    document.querySelector(".codeterra-editor").style.display = "none";
    document.querySelector(".codeterra-editor-handle").style.display = "none";
    setPageShrunk(false);
}

// Shows the editor, or hides it if it is showing. Returns true when it is now open.
// The frame is created on first use, so Monaco isn't loaded until someone asks for it, and it
// is only hidden afterwards, so the code and cursor stay where they were.
function toggleEditorPanel() {
    const frame = document.querySelector(".codeterra-editor");
    if (frame && frame.style.display !== "none") {
        closeEditorPanel();
        return false;
    }
    openEditorPanel();
    return true;
}

// The X inside the editor asks to close it. That does exactly what clicking the "Close Editor"
// button does, so the button's label stays in step.
window.addEventListener("message", (event) => {
    const frame = document.querySelector(".codeterra-editor");
    const fromEditor = frame && event.source === frame.contentWindow;
    const data = event.data;
    if (!fromEditor || data?.source !== "codeterra-editor" || data.type !== "close") {
        return;
    }
    if (frame.style.display !== "none") {
        document.querySelector(".codeterra-editor-button")?.click();
    }
});
