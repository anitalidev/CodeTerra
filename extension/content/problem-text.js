// Reading and copying the problem text. Needs the page DOM, so use it from content scripts only.
// Depends on problemToMarkdown from problem-to-markdown.js.

function getProblemText(statement = document.querySelector(".problem-statement")) {
    if (!statement) {
        throw new Error("No problem statement on this page");
    }
    return problemToMarkdown(statement);
}

async function copyProblemText(statement) {
    await navigator.clipboard.writeText(getProblemText(statement));
}

// Statements say things like "You can output the answer in any case (upper or lower)" when the
// checker ignores letter case. "test case" and "lowercase letters" must not count, so this looks
// for the specific wordings. (Checked on a sample of real problems: 4 of 15 said it, no false hits.)
const ANY_CASE_PATTERN =
    /\b(?:any|either|every)\s+(?:letter\s+)?case\b|case[-\s]insensitive|regardless\s+of\s+(?:the\s+)?case|case\s+(?:does\s+not|doesn't)\s+matter|upper\s+or\s+lower\s*case|uppercase\s+or\s+lowercase/i;

function allowsAnyCase(statement = document.querySelector(".problem-statement")) {
    return ANY_CASE_PATTERN.test(statement?.innerText ?? "");
}

// The example inputs and outputs of the problem: [{ input, output }, ...].
function extractExamples(statement = document.querySelector(".problem-statement")) {
    const examples = [];
    let current = null;
    for (const box of statement?.querySelectorAll(".sample-tests .input, .sample-tests .output") ?? []) {
        const pre = box.querySelector("pre");
        if (!pre) {
            continue;
        }
        // Codeforces keeps the exact text in data-content; otherwise rebuild it from the page.
        const text = (pre.getAttribute("data-content") ?? preText(pre)).replace(/\s+$/, "");  // preText: problem-to-markdown.js
        if (box.classList.contains("input")) {
            current = { input: text, output: "" };
            examples.push(current);
        } else if (current) {
            current.output = text;
        }
    }
    return examples;
}
