// Converts a Codeforces .problem-statement element into Markdown.
// Entry point: problemToMarkdown(statementElement)

// Elements that never belong in the copied text: our own UI, Codeforces' copy buttons and
// tags (they would give away the answer), and the rendered output of MathJax (the TeX source
// is read from its <script type="math/tex"> element instead).
const IGNORED_SELECTOR = [
    ".codeterra-copy-button",
    ".input-output-copier",
    ".tag-box",
    ".MathJax",
    ".MathJax_Preview",
    ".MathJax_Display",
    ".MathJax_SVG",
    ".MathJax_SVG_Display",
    ".MJX_Assistive_MathML",
    "mjx-container",
    "style",
].join(",");

const BLOCK_TAGS = new Set([
    "p", "div", "center", "blockquote", "ul", "ol", "table", "pre", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
]);

const HEADER_PROPERTIES = [
    [".time-limit", "Time limit"],
    [".memory-limit", "Memory limit"],
    [".input-file", "Input"],
    [".output-file", "Output"],
];

function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}

function isList(node) {
    return isElement(node) && (node.tagName === "UL" || node.tagName === "OL");
}

function cleanInline(text) {
    return text.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}

// Wraps text in a Markdown marker, keeping surrounding spaces outside the marker.
function wrap(marker, text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return text;
    }
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return `${lead}${marker}${trimmed}${marker}${trail}`;
}

function texToMarkdown(script) {
    const type = script.type || "";
    if (!type.startsWith("math/tex")) {
        return "";
    }
    const tex = script.textContent
        .trim()
        .replace(/\\lt(?![a-zA-Z])/g, "<")
        .replace(/\\gt(?![a-zA-Z])/g, ">");
    return type.includes("mode=display") ? `$$${tex}$$` : `$${tex}$`;
}

function childrenInlineMd(element) {
    return Array.from(element.childNodes).map(inlineMd).join("");
}

function inlineMd(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        // Codeforces writes unrendered math as $$$...$$$
        return node.textContent.replace(/ /g, " ").replace(/\$\$\$/g, "$").replace(/\s+/g, " ");
    }
    if (!isElement(node) || node.matches(IGNORED_SELECTOR)) {
        return "";
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "script") {
        return texToMarkdown(node);
    }
    if (tag === "br") {
        return "\n";
    }
    if (tag === "img") {
        return `![${node.alt}](${node.src})`;
    }

    const inner = childrenInlineMd(node);
    const classes = node.classList;
    if (tag === "b" || tag === "strong" || classes.contains("tex-font-style-bf")) {
        return wrap("**", inner);
    }
    if (tag === "i" || tag === "em" || classes.contains("tex-font-style-it")) {
        return wrap("*", inner);
    }
    if (tag === "code" || tag === "tt" || classes.contains("tex-font-style-tt")) {
        return wrap("`", inner);
    }
    if (tag === "sup") {
        return `^{${inner.trim()}}`;
    }
    if (tag === "sub") {
        return `_{${inner.trim()}}`;
    }
    if (tag === "a") {
        const text = inner.trim();
        const href = node.href;
        return text && href && !href.startsWith("javascript:") ? `[${text}](${href})` : inner;
    }
    return inner;
}

function preText(pre) {
    // Newer Codeforces samples put each line in its own element.
    const lines = pre.querySelectorAll(".test-example-line");
    if (lines.length) {
        return Array.from(lines).map((line) => line.textContent).join("\n");
    }
    const copy = pre.cloneNode(true);
    copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    return copy.textContent.replace(/ /g, " ").trim();
}

function listMd(list, depth) {
    const ordered = list.tagName === "OL";
    const indent = "  ".repeat(depth);
    const lines = [];
    let number = 0;
    for (const item of list.children) {
        if (item.tagName !== "LI") {
            continue;
        }
        number++;
        const nodes = Array.from(item.childNodes);
        const text = cleanInline(nodes.filter((n) => !isList(n)).map(inlineMd).join(""));
        lines.push(`${indent}${ordered ? `${number}.` : "-"} ${text}`);
        for (const nested of nodes.filter(isList)) {
            lines.push(listMd(nested, depth + 1));
        }
    }
    return lines.join("\n");
}

function tableMd(table) {
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
        Array.from(row.children)
            .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
            .map((cell) => cleanInline(childrenInlineMd(cell)).replace(/\|/g, "\\|").replace(/\n/g, " "))
    );
    if (!rows.length) {
        return "";
    }
    const width = Math.max(...rows.map((row) => row.length));
    const format = (row) => `| ${[...row, ...Array(width - row.length).fill("")].join(" | ")} |`;
    return [
        format(rows[0]),
        format(Array(width).fill("---")),
        ...rows.slice(1).map(format),
    ].join("\n");
}

function headerMd(header) {
    const blocks = [];
    const title = header.querySelector(".title");
    if (title) {
        blocks.push(`# ${title.textContent.trim()}`);
    }
    const properties = [];
    for (const [selector, label] of HEADER_PROPERTIES) {
        const property = header.querySelector(selector);
        if (!property) {
            continue;
        }
        const value = Array.from(property.childNodes)
            .filter((node) => !(isElement(node) && node.matches(".property-title")))
            .map((node) => node.textContent)
            .join("")
            .trim();
        if (value) {
            properties.push(`- ${label}: ${value}`);
        }
    }
    if (properties.length) {
        blocks.push(properties.join("\n"));
    }
    return blocks;
}

function sectionMd(section) {
    const title = section.querySelector(":scope > .section-title").textContent.trim();
    const rest = Array.from(section.childNodes).filter(
        (node) => !(isElement(node) && node.matches(".section-title"))
    );
    return [`## ${title}`, ...blocksMd(rest)];
}

function samplesMd(samples) {
    const blocks = ["## Examples"];
    let exampleNumber = 0;
    for (const box of samples.querySelectorAll(".input, .output")) {
        const isInput = box.classList.contains("input");
        if (isInput) {
            exampleNumber++;
            blocks.push(`### Example ${exampleNumber}`);
        }
        const pre = box.querySelector("pre");
        if (pre) {
            blocks.push(`${isInput ? "Input" : "Output"}:\n\`\`\`\n${preText(pre)}\n\`\`\``);
        }
    }
    return blocks;
}

function blockMd(element) {
    const tag = element.tagName.toLowerCase();
    if (element.matches(".header")) {
        return headerMd(element);
    }
    if (element.matches(".sample-tests")) {
        return samplesMd(element);
    }
    if (element.querySelector(":scope > .section-title")) {
        return sectionMd(element);
    }

    if (tag === "p") {
        const text = cleanInline(childrenInlineMd(element));
        return text ? [text] : [];
    }
    if (tag === "ul" || tag === "ol") {
        return [listMd(element, 0)];
    }
    if (tag === "table") {
        return [tableMd(element)];
    }
    if (tag === "pre") {
        return [`\`\`\`\n${preText(element)}\n\`\`\``];
    }
    if (tag === "hr") {
        return ["---"];
    }
    if (/^h[1-6]$/.test(tag)) {
        return [`#### ${cleanInline(childrenInlineMd(element))}`];
    }
    if (tag === "blockquote") {
        const quoted = blocksMd(Array.from(element.childNodes)).join("\n\n");
        return [quoted.split("\n").map((line) => `> ${line}`).join("\n")];
    }
    return blocksMd(Array.from(element.childNodes));  // div, center
}

// Turns a list of sibling nodes into Markdown blocks: runs of inline content become
// paragraphs, block elements are converted on their own.
function blocksMd(nodes) {
    const blocks = [];
    let inlineRun = [];
    const flush = () => {
        const text = cleanInline(inlineRun.map(inlineMd).join(""));
        if (text) {
            blocks.push(text);
        }
        inlineRun = [];
    };

    for (const node of nodes) {
        if (isElement(node) && !node.matches(IGNORED_SELECTOR) && BLOCK_TAGS.has(node.tagName.toLowerCase())) {
            flush();
            blocks.push(...blockMd(node));
        } else {
            inlineRun.push(node);
        }
    }
    flush();
    return blocks;
}

function problemToMarkdown(statement) {
    return blocksMd(Array.from(statement.childNodes)).join("\n\n");
}
