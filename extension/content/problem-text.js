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
