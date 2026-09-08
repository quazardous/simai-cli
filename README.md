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

## Is the copy faithful? Measure it

The aim is a client that reads as the family, not a replica of one — so
this measures whether a copy still looks like its client, not whether it
matches byte for byte. Reproducing a client's screen is guesswork until the real one and the
copy are put side by side. Two verbs make that cheap enough to do every
time, instead of once when the doubt gets loud.

```console
$ simcli capture --pane %3 -o real.txt      # tmux capture-pane
$ your-simulator > played.txt
$ simcli compare real.txt played.txt
```

It normalises first — a timer ticks, a percentage moves, a session was
saved four minutes ago instead of one — and **prints every rule it
applied before showing what survived**. A normaliser that masks enough
makes any two screens match, so a comparison that hides its own masking
proves nothing.

**Widths are kept on purpose.** A progress bar becomes `<bar:40>`, never
`<bar>`. That single choice is what caught the first real drift this was
pointed at: a copy drawing ten blocks where the real screen draws forty.

Lines are sorted into three piles, and the difference matters:

| | |
|---|---|
| **exact** | identical once the volatile parts are masked |
| **drifted** | plainly the same line, not right yet — a polish job |
| **absent** | the real screen has it and the copy does not — work undone |

Only **absent** exits non-zero. A build should stop when a screen is
missing, not when a bar is the wrong width.

```
2 line(s) reached but not right:
  real    Compacting conversation… (<Ns>)
  played ✶ Compacting conversation…
         67% of the words in common
  real     <bar:40> <N%>
  played <bar:10> <N%>   esc to interrupt
         57% of the words in common
```

## Try it by hand

With no line to run, it stays in the session. **A bare line is a prompt**
— you talk to it, it thinks for a beat and answers. Commands go through
a named door:

```console
$ simcli --as claude

❯ explique le détachement
● You said "explique le détachement".
  Lorem ipsum dolor sit amet, consectetur adipiscing elit…

  ✻ Cogitating… (3s)
  Sed ut perspiciatis unde omnis iste natus error sit voluptatem…
✻ Cogitated for 3s · done 17:33

❯ /run sleep 60; echo built     # wrapped — let go of if it outlasts the cut
❯ /fg sleep 60; echo built      # held to the end, however long
❯ /bg sleep 60; echo built      # handed over before it starts
❯ /say hello    /cat README.md  # a short command, and a file read
❯ /ps  /list  /gain  /exit
```

Typing the same `sleep 60` three ways is the whole lesson, and the
three-second answer above is what makes it legible: it is what the
thirty-second one is long *compared to*.

**The answer is filler on purpose.** Inventing plausible reasoning and
printing it in a real client's shape is the one thing this must not do.
Lorem ipsum cannot be mistaken for a model's output; a well-written
English paragraph can.

**There is no `--interactive` flag**, and there should not be: a line
after `--` already says the run is one-shot, the way every other REPL
decides it.

## Recording a demo: `--script`

A scenario file holds exactly the lines a person would type, echoed at
the same prompt and fed to the same handler.

```console
$ cat demo.txt
# a short one — handed straight back
/say hello world
# and a long one — the cut takes it away
sleep 60; echo built
/ps

$ simcli --as claude --script demo.txt --pace 0.8
```

It is deliberately **not a second language**. A screencast drifts away
from the tool it demonstrates the moment the two are written separately;
here the recording runs the same code path a person does, so it cannot.

## The demo: a command that gets taken off your hands

```console
$ simcli --as claude --play --why 'build the release' -- 'sleep 60; echo built'

❯ build the release

● The build is the slow part. Running it.
● Bash(sleep 60; echo built)
  ⎿  jbx: this passed 30s, so it is in the BACKGROUND as j09cb0fd — nothing lost.
  ⎿  DO NOT WAIT FOR IT, DO SOMETHING ELSE.
✻ Cogitated for 30s · done 16:24
```

Everything after `● Bash(` is real: the payload, the hook, the rewritten
line, the wait, the moment it lets go. The sentences around it are acted.

### Two conditions, or the scene is empty

Both are facts about what an agent CLI *is*, not choices made here — and
both bite anyone who tries to film this in a plain terminal.

**No TTY.** jbx steps aside the instant it sees one: a human is watching,
so it gets out of the way. Recording a bare terminal therefore shows
nothing happening — *the presence of the terminal is what turns the thing
off*. A real client never hands a tool a TTY; it reads through a pipe. So
`--play` pipes, and re-draws the output in the client's own grammar.

**No inherited wrapper.** Run this underneath an agent that already wraps
commands and the environment carries a marker saying so; the inner
wrapper then correctly stands down rather than claiming a second id for
the same work. `--play` drops the marker for the child, because the
scene is about being the outer one.

## The chrome, and what it is worth

`src/chrome.ts` holds each client's decor — frames, banners, tips,
status rows, and the grammar of a tool call. `simcli chrome <client>`
prints it, so it can be fed straight to `compare`.

Every block says where it came from, because **that is the only thing
separating a screen somebody checked from a screen somebody drew**:

| | |
|---|---|
| `measured` | `capture` and `compare` against the real client said so |
| `borrowed` | copied from another rendering, never checked |

Most of it arrived borrowed, from [busycode](https://github.com/monk-lee/busycode)
(MIT, see `THIRD-PARTY.md`) — a browser app that draws these clients and
runs no command. **The first client measured contradicted it**: busycode
hangs tool results off `└` where Claude Code prints `⎿`, shows a
present-tense `Symbioting…` where the real screen shows a finished
`✻ Cogitated for 1m 13s · done 15:52`, and draws a
`Model: … | Context: [████░░░]` bar that never appears. Claude is
`measured` now; Gemini, Codex and OpenCode are not.

Droid, Cursor and Copilot have a dialect and **no chrome at all**, and
`chrome()` returns nothing for them rather than dressing them in
Claude's. A demo in the wrong clothes looks like proof of a client it
never touched.

### What this comparison cannot tell you

`compare` weighs a chrome dump against a whole captured pane, so the
conversation in that pane — the part no simulator should reproduce —
counts as absent every time. The verdict to read is **drifted**, and the
`invented` list when the copy carries chrome the capture cropped. A
comparison against the pane the lines were copied from proves
transcription and nothing else.

## Usage

```console
simcli --as <client> [--hook <path>] [--check] [--quiet] -- '<shell line>'

  --as <client>   claude, gemini, droid, cursor, copilot
  --hook <path>   the hook to call (default: jbx)
  --why <text>    the description the client would have asked the model for
  --check         say whether the line was rewritten, and exit 1 if not
  --quiet         no chrome, just the protocol
  --play          draw the whole turn: prompt, spinner, output, sign-off
  --speed <n>     how fast the acted parts play (default 1)

simcli capture [--pane <target>] [-o <file>]
simcli compare <real> <played> [--verbose]
simcli chrome <client>            # print the decor, to compare it
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

MIT. Third-party material in `THIRD-PARTY.md`.
