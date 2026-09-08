# simai-cli

**Play an agent CLI at a hook.**

Claude Code, Gemini CLI, Cursor, Factory Droid and GitHub Copilot CLI all
let a hook see a shell command before it runs, and rewrite it. They agree
on almost nothing about how — not the name of the shell tool, not the
event, not the shape of the answer.

So a hook that means to serve all five has a problem: proving it works
means installing all five. `simcli` sends what each of them really sends,
reads what comes back, and runs it.

```console
$ simcli --as cursor --check -- 'cargo test'
ok  Cursor
    typed   cargo test
    ran     /home/you/.local/bin/jbx run -- 'cargo test'
```

## Why `--check` is the point

A hook that does not recognise a tool answers **nothing**. So does a hook
watching for the wrong tool name. Silence means both "not mine" and "I am
misconfigured", and only the caller knows which it expected.

That is not hypothetical. A widely used command proxy watches for `Bash`
on Cursor, Droid and Copilot, where those clients' own references say
`Shell`, `Execute` and `bash` — three hooks that never fire and look
perfectly installed.

`--check` is where the expectation gets written down. It exits non-zero
when the line came back unchanged, so a wrong dialect fails a build
instead of somebody's afternoon.

## What is real and what is acted

| | |
|---|---|
| **acted** | the prompt, the pacing, the banner — the agent's turn |
| **real** | the payload, the hook call, the rewritten line, its output, its exit code |

That split is deliberate. A screen recording of a genuine session drifts
away from the tool it demonstrates without anyone noticing; this cannot,
because the only thing it fakes is the part not being demonstrated — and
it says so on screen. **A fabricated agent turn presented as a recorded
session would be a lie, and one that does not survive being asked.**

## The five

| `--as` | shell tool | event | the rewrite comes back at |
|---|---|---|---|
| `claude` | `Bash` | `PreToolUse` | `hookSpecificOutput.updatedInput.command` |
| `gemini` | `run_shell_command` | `BeforeTool` | `hookSpecificOutput.tool_input.command` |
| `droid` | `Execute` | `PreToolUse` | `hookSpecificOutput.updatedInput.command` |
| `cursor` | `Shell` | `preToolUse` | `updated_input.command` |
| `copilot` | `bash` | `preToolUse` | `modifiedArgs.command` |

Copilot also renames the two fields it sends: `toolName` and `toolArgs`
where the others say `tool_name` and `tool_input`.

Each shape was read in that client's own reference. A row is added when
its reference has been read — not from another tool's belief about it.

## Usage

```console
simcli --as <client> [--hook <path>] [--check] [--quiet] -- '<shell line>'

  --as <client>   claude, gemini, droid, cursor, copilot
  --hook <path>   the hook to call (default: jbx)
  --why <text>    the description the client would have asked the model for
  --check         say whether the line was rewritten, and exit 1 if not
  --quiet         no chrome, just the protocol
```

It does not assume any particular hook. `--hook` takes a path, and the
contract it expects is the one every client above already uses: one
process, the payload on stdin, the answer on stdout.

## Build

```console
npm install
npm run build
```

TypeScript to build, **nothing at runtime**.

## Written for

[jbx](https://github.com/quazardous/jobbox), which wraps every command an
agent runs and detaches the ones that turn out to be long. It is not
required — the hook contract is the client's, not jbx's.

MIT.
