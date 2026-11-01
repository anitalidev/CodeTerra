export const LANGUAGES = [
    { id: "cpp", label: "C++", monaco: "cpp" },
    { id: "python", label: "Python", monaco: "python" },
    { id: "java", label: "Java", monaco: "java" },
    { id: "javascript", label: "JavaScript", monaco: "javascript" },
    { id: "rust", label: "Rust", monaco: "rust" },
    { id: "go", label: "Go", monaco: "go" },
    { id: "kotlin", label: "Kotlin", monaco: "kotlin" },
];

export const STARTER_CODE = {
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
