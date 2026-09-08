// CLIENTS.md, GENERATED FROM THE TABLE THAT SENDS THE PAYLOADS.
//
// A page of hand-copied JSON goes stale the first time a field moves,
// and nothing says so — the reader follows it, wires a hook against the
// old shape, and gets silence. So the examples are produced by the same
// `payload()` the program calls, and a test fails when the file on disk
// no longer matches. `npm run docs` rewrites it.
//
// The prose is here rather than in the markdown for the same reason: two
// places to edit is one place to forget.

import { DIALECTS, payload, type Dialect } from "./dialects.js";
import { chrome } from "./chrome.js";

const NOTES: Record<string, string> = {
  claude:
    "The shape the others are compared against, and the only one with a full screen behind it.",
  gemini:
    "**It merges rather than replaces.** A field left out of the answer survives here and is deleted under Claude — so a hook returning only `command` is correct on Gemini and lossy on Claude. Holding a command is `deny`, not a permission decision.",
  droid:
    "Claude's envelope with a different tool name. That single word is the whole difference, and it is the one a proxy gets wrong.",
  cursor:
    'The rewrite comes back at the **top level**, not under `hookSpecificOutput`. Its other event, `beforeShellExecution`, is the wrong one to use: its own reference says that output *"does not support modifying the command itself"*.',
  copilot:
    "Its own format throughout: camelCase keys, a lowercase tool name, and the rewrite at the top level. Four clients say `tool_name`; this one says `toolName`, and an editor's autocomplete is enough to lose it.",
};

/** The answer a correctly behaving hook gives this client. */
function answerFor(d: Dialect, line: string): unknown {
  return d.answer.reduceRight<unknown>((inner, key) => ({ [key]: inner }), line);
}

export function clientsDoc(): string {
  const head = `# The five clients

\`simcli --as <name>\` sends what that client really sends and reads the
answer where that client really reads it. Each shape below was taken
from the client's own reference, not from another tool's belief about
it — and every example on this page is **generated from the code that
sends it**, with a test that fails when this file drifts from it.

**What every client has, and what only two have.** All five have a
dialect, so \`--check\` works for all five: that is the verb that says
whether a hook is wired, and it is what this tool is for. Only two have
chrome — a screen to play — so \`--play\` and the interactive session are
Claude and Gemini. Dressing Cursor in Claude's screen would make a demo
that looks like proof of a client it never touched, so \`chrome()\`
returns nothing for the other three rather than falling back.

\`\`\`console
$ simcli --as cursor --check -- 'npm run build'
ok  Cursor
    typed   npm run build
    ran     jbx run -- 'npm run build'
\`\`\`

A hook that does not recognise a tool answers **nothing**, and so does a
hook watching the wrong name. Silence means both "not mine" and "I am
misconfigured", and only the caller knows which was expected — which is
why \`--check\` exits non-zero on it.
`;

  const sections = DIALECTS.map((d) => `
## ${d.label} — \`--as ${d.name}\`

| | |
|---|---|
| shell tool | \`${d.tool}\` |
| event | \`${d.event}\` |
| chrome | ${chrome(d.name) ? "yes — `--play` and the interactive session work" : "**none** — `--check` only"} |

${NOTES[d.name]}

**What it sends:**

\`\`\`json
${JSON.stringify(payload(d, "npm run build", "build the project"), null, 2)}
\`\`\`

**What it expects back:**

\`\`\`json
${JSON.stringify(answerFor(d, "jbx run -- 'npm run build'"), null, 2)}
\`\`\`
`);

  const tail = `
## Two that are absent, on purpose

**Meta's Vibe and Muse** have no documented before-tool hook that can
rewrite a command. A row here means a reference was read; adding one on
the strength of a plausible guess would make \`--check\` lie in the one
direction it must never lie — reporting a hook as wired when nothing
ever fires.

## Adding a client

Add a row to \`src/dialects.ts\`, **and** to the hand-written table in
\`src/dialects.test.ts\`. The duplication is deliberate: a test that reads
the table it is testing passes whatever the table says, typos included.
That guard was shipped once, in a sibling project, and pointing Gemini
at \`Bash\` sailed straight through it.

Then \`npm run docs\` rewrites this page.
`;

  return head + sections.join("") + tail;
}
