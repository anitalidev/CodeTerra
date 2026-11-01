// Used until the backend has told us (or the cache remembers) which languages the runner offers.
export const FALLBACK_LANGUAGES = [
    { id: "CPP_17", label: "C++17" },
    { id: "PYTHON_3", label: "Python 3" },
    { id: "JAVA_21", label: "Java 21" },
    { id: "NODE_JS", label: "JavaScript (Node.js)" },
    { id: "RUST", label: "Rust" },
    { id: "GO", label: "Go" },
    { id: "KOTLIN_2_3", label: "Kotlin" },
];

// The editor used these ids before languages came from the runner; saved code is moved over.
export const LEGACY_LANGUAGE_IDS = {
    cpp: "CPP_17",
    python: "PYTHON_3",
    java: "JAVA_21",
    javascript: "NODE_JS",
    rust: "RUST",
    go: "GO",
    kotlin: "KOTLIN_2_3",
};

// Runner language ids look like CPP_17 or PYTHON_3; the part before the first "_" says which
// Monaco language highlights it. Anything missing here is shown as plain text.
const MONACO_BY_ROOT = {
    C: "cpp", CPP: "cpp",
    CSHARP: "csharp", FSHARP: "fsharp",
    GO: "go", RUST: "rust",
    JAVA: "java", KOTLIN: "kotlin", SCALA: "scala",
    FREE: "pascal",
    PERL: "perl", PHP: "php", RUBY: "ruby",
    PYTHON: "python", PYPY: "python",
    NODE: "javascript",
};

export function monacoLanguage(id) {
    return MONACO_BY_ROOT[id.split("_")[0]] ?? "plaintext";
}

const STARTER_BY_MONACO_LANGUAGE = {
    cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
    python: `import sys
input = sys.stdin.readline


def main():
    pass


main()
`,
    java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    }
}
`,
    javascript: `const lines = require("fs").readFileSync(0, "utf8").split("\\n");
`,
    rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
}
`,
    go: `package main

import (
    "bufio"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    _ = in
}
`,
    kotlin: `import java.io.*

fun main() {
    val br = BufferedReader(InputStreamReader(System.\`in\`))
}
`,
};

const C_STARTER = `#include <stdio.h>

int main(void) {
    return 0;
}
`;

export function starterCode(id) {
    return id === "C" ? C_STARTER : STARTER_BY_MONACO_LANGUAGE[monacoLanguage(id)] ?? "";
}
