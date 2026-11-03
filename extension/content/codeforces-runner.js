// Runs code through Codeforces' own Custom Test, using the user's logged-in session. This runs
// inside the codeforces.com page so the requests are same-origin and carry its cookies.
// The endpoint is internal to the website (not the public API), so its fields may change; when a
// reply isn't what we expect, the error includes the start of it to make that easy to spot.
const CUSTOM_TEST_PAGE = "/problemset/customtest";
const CUSTOM_TEST_ENDPOINT = "/data/customtest";
const POLL_INTERVAL_MS = 1000;
const POLL_LIMIT = 40;
const RUNNING_PATTERN = /running|queue|waiting|compiling|testing|in progress/i;
const FAILURE_PATTERN = /compilation error|runtime error|time limit|memory limit|idleness|crashed|failed|denied|skipped/i;

// Which Codeforces compiler to use for each editor language: the first option on the Custom Test
// page whose name matches. Ids are looked up live because Codeforces renumbers them over time.
// Where several match (e.g. Kotlin versions), the last listed is used, as newer ones come later.
const LANGUAGE_PATTERNS = {
    C: /GNU GCC C11/i,
    CPP_17: /G\+\+17/i,
    CPP_20: /G\+\+20/i,
    CPP_23: /G\+\+23/i,
    CSHARP_NET: /C#.*\.NET/i,
    CSHARP_MONO: /C#.*Mono/i,
    D: /^D /i,
    GO: /^Go /i,
    HASKELL: /Haskell/i,
    OCAML: /OCaml/i,
    RUST: /Rust/i,
    JAVA_8: /Java 8/i,
    JAVA_21: /Java 21/i,
    KOTLIN: /Kotlin/i,
    SCALA: /Scala/i,
    FREE_PASCAL: /Free Pascal/i,
    PERL: /Perl/i,
    PHP: /PHP/i,
    PYTHON_3: /^Python 3/i,
    PYPY_3: /PyPy 3/i,
    RUBY: /Ruby/i,
    NODE_JS: /Node\.js/i,
};

class RunFailure extends Error {}

// What went wrong, read from the text Codeforces gives, for example
// "Invocation failed [COMPILATION_ERROR]\nCan't compile file: ..." or
// "Runtime error: exit code is -1073740940". One of compileErr, runtimeErr, timeErr or memoryErr;
// null when the text isn't a failure message. Output is only matched at its very start, so a
// program that prints these words later on isn't mistaken for a failure.
const KIND_BY_CODE = {
    COMPILATION_ERROR: "compileErr",
    RUNTIME_ERROR: "runtimeErr",
    TIME_LIMIT_EXCEEDED: "timeErr",
    IDLENESS_LIMIT_EXCEEDED: "timeErr",
    MEMORY_LIMIT_EXCEEDED: "memoryErr",
};

function outputKind(text) {
    const coded = /^\s*Invocation failed \[([A-Z_]+)\]/.exec(text);
    if (coded) {
        return KIND_BY_CODE[coded[1]] ?? "runtimeErr";
    }
    if (/^\s*Runtime error/i.test(text)) {
        return "runtimeErr";
    }
    if (/^\s*(Compilation error|Can't compile)/i.test(text)) {
        return "compileErr";
    }
    if (/^\s*Time limit exceeded/i.test(text)) {
        return "timeErr";
    }
    if (/^\s*Memory limit exceeded/i.test(text)) {
        return "memoryErr";
    }
    return null;
}

function statusKind(status) {
    if (KIND_BY_CODE[status.trim()]) {
        return KIND_BY_CODE[status.trim()];
    }
    if (/compilation error/i.test(status)) {
        return "compileErr";
    }
    if (/runtime error/i.test(status)) {
        return "runtimeErr";
    }
    if (/time limit|idleness/i.test(status)) {
        return "timeErr";
    }
    if (/memory limit/i.test(status)) {
        return "memoryErr";
    }
    return FAILURE_PATTERN.test(status) ? "runtimeErr" : null;
}

// Time and memory may arrive as numbers (taken as milliseconds and bytes, like the public API's
// submissions) or as text with a unit such as "15 ms" or "300 KB". Anything else gives null.
function toSeconds(value) {
    if (value == null || value === "") {
        return null;
    }
    const match = /^\s*([\d.]+)\s*(ms|s)?/i.exec(String(value));
    if (!match) {
        return null;
    }
    return match[2]?.toLowerCase() === "s" ? Number(match[1]) : Number(match[1]) / 1000;
}

function toKilobytes(value) {
    if (value == null || value === "") {
        return null;
    }
    const match = /^\s*([\d.]+)\s*(kb|mb|b)?/i.exec(String(value));
    if (!match) {
        return null;
    }
    const unit = match[2]?.toLowerCase() ?? "b";
    return Math.round(Number(match[1]) * { b: 1 / 1024, kb: 1, mb: 1024 }[unit]);
}

function usage(reply) {
    return {
        timeSeconds: toSeconds(reply.timeConsumedMillis ?? reply.timeConsumed ?? reply.time),
        memoryKb: toKilobytes(reply.memoryConsumedBytes ?? reply.memoryConsumed ?? reply.memory),
    };
}

function csrfToken() {
    const token = document.querySelector('meta[name="X-Csrf-Token"]')?.content;
    if (!token) {
        throw new RunFailure("Could not find the Codeforces security token. Reload the page and try again.");
    }
    return token;
}

function snippet(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

// The compilers Codeforces offers right now, as [{ value, text }], read from the Custom Test page.
async function loadCompilers() {
    const response = await fetch(CUSTOM_TEST_PAGE, { credentials: "same-origin" });
    if (response.redirected && /\/enter/.test(response.url)) {
        throw new RunFailure("Log in to Codeforces to run code.");
    }
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const options = [...page.querySelectorAll('select[name="programTypeId"] option')];
    if (options.length === 0) {
        throw new RunFailure("Could not read Codeforces' language list. Are you logged in?");
    }
    return options.map((option) => ({ value: option.value, text: option.textContent.trim() }));
}

function pickCompiler(compilers, languageId) {
    const pattern = LANGUAGE_PATTERNS[languageId] ?? LANGUAGE_PATTERNS[languageId.replace(/_[\d_]+$/, "")];
    const matches = pattern ? compilers.filter((compiler) => pattern.test(compiler.text)) : [];
    if (matches.length === 0) {
        throw new RunFailure(`Codeforces doesn't offer a compiler for ${languageId} right now.`);
    }
    return matches[matches.length - 1];
}

async function post(fields, token) {
    const response = await fetch(CUSTOM_TEST_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Csrf-Token": token,
            "X-Requested-With": "XMLHttpRequest",
        },
        body: new URLSearchParams({ csrf_token: token, ...fields }),
    });
    if (response.status === 429) {
        throw new RunFailure("Codeforces is rate limiting runs. Wait a moment and try again.");
    }
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new RunFailure(`Unexpected reply from Codeforces (${response.status}): ${snippet(text)}`);
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOne({ compiler, code, input, token }) {
    // Both names are sent because the form's field name for the code has varied.
    const submitted = await post(
        {
            action: "submitSourceCode",
            source: code,
            sourceCode: code,
            programTypeId: compiler.value,
            input,
            communityCode: "",
        },
        token
    );
    const id = submitted.customTestSubmitId;
    if (!id) {
        throw new RunFailure(`Codeforces didn't accept the run: ${snippet(submitted)}`);
    }

    for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
        await sleep(POLL_INTERVAL_MS);
        const reply = await post({ action: "getVerdict", customTestSubmitId: id }, token);
        const status = String(reply.stat ?? reply.verdict ?? reply.status ?? "");
        if (!status && reply.output === undefined && reply.stdout === undefined) {
            continue;
        }
        if (RUNNING_PATTERN.test(status) && !statusKind(status)) {
            continue;
        }
        const output = String(reply.output ?? reply.stdout ?? "");
        const failure = outputKind(output) ?? statusKind(status);
        if (failure) {
            return {
                output: output || String(reply.compilerOutput ?? reply.checkerLog ?? "") || status,
                status: failure,
                ...usage(reply),
            };
        }
        return { output, status: "ok", ...usage(reply) };
    }
    throw new RunFailure("Codeforces took too long to answer.");
}

// One at a time: runs are queued on Codeforces' side and bursts get rate limited.
async function runAll({ language, submittedCode, testCases }) {
    const compilers = await loadCompilers();
    const compiler = pickCompiler(compilers, language);
    const token = csrfToken();
    const results = [];
    for (const testCase of testCases) {
        results.push(await runOne({ compiler, code: submittedCode, input: testCase.input, token }));
    }
    return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "CF_RUN_TESTS") {
        return;
    }
    runAll(message)
        .then((testCases) => sendResponse({ ok: true, testCases }))
        .catch((error) =>
            sendResponse({
                ok: false,
                error: error instanceof RunFailure ? error.message : `Could not run the code (${error.message}).`,
            })
        );
    return true;
});
