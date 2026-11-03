// Codeforces' own Custom Test, run through the open Codeforces tab (see
// content/codeforces-runner.js). It never goes through the CodeTerra backend and needs no
// credentials. The ids match the editor's language ids; the content script finds the matching
// Codeforces compiler when code is run.
export const CODEFORCES_RUNNER = {
    id: "codeforces",
    label: "Codeforces",
    credential_fields: [],
    languages: [
        { id: "C", label: "C (GNU GCC C11)" },
        { id: "CPP_17", label: "C++17 (GNU G++17)" },
        { id: "CPP_20", label: "C++20 (GNU G++20)" },
        { id: "CPP_23", label: "C++23 (GNU G++23)" },
        { id: "CSHARP_NET", label: "C# (.NET)" },
        { id: "D", label: "D" },
        { id: "GO", label: "Go" },
        { id: "HASKELL", label: "Haskell" },
        { id: "JAVA_8", label: "Java 8" },
        { id: "JAVA_21", label: "Java 21" },
        { id: "KOTLIN_2_3", label: "Kotlin" },
        { id: "NODE_JS", label: "JavaScript (Node.js)" },
        { id: "OCAML", label: "OCaml" },
        { id: "FREE_PASCAL", label: "Free Pascal" },
        { id: "PERL", label: "Perl" },
        { id: "PHP", label: "PHP" },
        { id: "PYTHON_3", label: "Python 3" },
        { id: "PYPY_3", label: "PyPy 3" },
        { id: "RUBY", label: "Ruby" },
        { id: "RUST", label: "Rust" },
        { id: "SCALA", label: "Scala" },
    ],
};

// Runs the code against every test case in the Codeforces tab. The editor is an iframe of the
// problem page, so the message's tab is the one that does the work.
export async function runOnCodeforces({ language, submittedCode, testCases }, tab) {
    if (!tab?.id) {
        return { ok: false, error: "Open a Codeforces problem page to run code." };
    }
    try {
        return await chrome.tabs.sendMessage(tab.id, { type: "CF_RUN_TESTS", language, submittedCode, testCases });
    } catch {
        return { ok: false, error: "Reload the Codeforces page and try again." };
    }
}
