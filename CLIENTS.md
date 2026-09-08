# The five clients

`simcli --as <name>` sends what that client really sends and reads the
answer where that client really reads it. Each shape below was taken
from the client's own reference, not from another tool's belief about
it — and every example on this page is **generated from the code that
sends it**, with a test that fails when this file drifts from it.

**What every client has, and what only two have.** All five have a
dialect, so `--check` works for all five: that is the verb that says
whether a hook is wired, and it is what this tool is for. Only two have
chrome — a screen to play — so `--play` and the interactive session are
Claude and Gemini. Dressing Cursor in Claude's screen would make a demo
that looks like proof of a client it never touched, so `chrome()`
returns nothing for the other three rather than falling back.

```console
$ simcli --as cursor --check -- 'npm run build'
ok  Cursor
    typed   npm run build
    ran     jbx run -- 'npm run build'
```

A hook that does not recognise a tool answers **nothing**, and so does a
hook watching the wrong name. Silence means both "not mine" and "I am
misconfigured", and only the caller knows which was expected — which is
why `--check` exits non-zero on it.

## Claude Code — `--as claude`

| | |
|---|---|
| shell tool | `Bash` |
| event | `PreToolUse` |
| chrome | yes — `--play` and the interactive session work |

The shape the others are compared against, and the only one with a full screen behind it.

**What it sends:**

```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "simcli",
  "cwd": "/home/you/project",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm run build",
    "description": "build the project",
    "timeout": 600000
  }
}
```

**What it expects back:**

```json
{
  "hookSpecificOutput": {
    "updatedInput": {
      "command": "jbx run -- 'npm run build'"
    }
  }
}
```

## Gemini CLI — `--as gemini`

| | |
|---|---|
| shell tool | `run_shell_command` |
| event | `BeforeTool` |
| chrome | yes — `--play` and the interactive session work |

**It merges rather than replaces.** A field left out of the answer survives here and is deleted under Claude — so a hook returning only `command` is correct on Gemini and lossy on Claude. Holding a command is `deny`, not a permission decision.

**What it sends:**

```json
{
  "hook_event_name": "BeforeTool",
  "session_id": "simcli",
  "cwd": "/home/you/project",
  "tool_name": "run_shell_command",
  "tool_input": {
    "command": "npm run build",
    "description": "build the project",
    "timeout": 600000
  }
}
```

**What it expects back:**

```json
{
  "hookSpecificOutput": {
    "tool_input": {
      "command": "jbx run -- 'npm run build'"
    }
  }
}
```

## Factory Droid — `--as droid`

| | |
|---|---|
| shell tool | `Execute` |
| event | `PreToolUse` |
| chrome | **none** — `--check` only |

Claude's envelope with a different tool name. That single word is the whole difference, and it is the one a proxy gets wrong.

**What it sends:**

```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "simcli",
  "cwd": "/home/you/project",
  "tool_name": "Execute",
  "tool_input": {
    "command": "npm run build",
    "description": "build the project",
    "timeout": 600000
  }
}
```

**What it expects back:**

```json
{
  "hookSpecificOutput": {
    "updatedInput": {
      "command": "jbx run -- 'npm run build'"
    }
  }
}
```

## Cursor — `--as cursor`

| | |
|---|---|
| shell tool | `Shell` |
| event | `preToolUse` |
| chrome | **none** — `--check` only |

The rewrite comes back at the **top level**, not under `hookSpecificOutput`. Its other event, `beforeShellExecution`, is the wrong one to use: its own reference says that output *"does not support modifying the command itself"*.

**What it sends:**

```json
{
  "hook_event_name": "preToolUse",
  "session_id": "simcli",
  "cwd": "/home/you/project",
  "tool_name": "Shell",
  "tool_input": {
    "command": "npm run build",
    "description": "build the project",
    "timeout": 600000
  }
}
```

**What it expects back:**

```json
{
  "updated_input": {
    "command": "jbx run -- 'npm run build'"
  }
}
```

## GitHub Copilot CLI — `--as copilot`

| | |
|---|---|
| shell tool | `bash` |
| event | `preToolUse` |
| chrome | **none** — `--check` only |

Its own format throughout: camelCase keys, a lowercase tool name, and the rewrite at the top level. Four clients say `tool_name`; this one says `toolName`, and an editor's autocomplete is enough to lose it.

**What it sends:**

```json
{
  "hook_event_name": "preToolUse",
  "session_id": "simcli",
  "cwd": "/home/you/project",
  "toolName": "bash",
  "toolArgs": {
    "command": "npm run build",
    "description": "build the project",
    "timeout": 600000
  }
}
```

**What it expects back:**

```json
{
  "modifiedArgs": {
    "command": "jbx run -- 'npm run build'"
  }
}
```

## Two that are absent, on purpose

**Meta's Vibe and Muse** have no documented before-tool hook that can
rewrite a command. A row here means a reference was read; adding one on
the strength of a plausible guess would make `--check` lie in the one
direction it must never lie — reporting a hook as wired when nothing
ever fires.

## Adding a client

Add a row to `src/dialects.ts`, **and** to the hand-written table in
`src/dialects.test.ts`. The duplication is deliberate: a test that reads
the table it is testing passes whatever the table says, typos included.
That guard was shipped once, in a sibling project, and pointing Gemini
at `Bash` sailed straight through it.

Then `npm run docs` rewrites this page.
