# Recording, and how faithful the copy is

The README shows what this does. This is the part you read when you are
actually making a video, or wondering whether a simulated screen still
resembles the client it copies.

## Making a video


`--capture` writes an **asciicast v2** while the session runs — the same
flag in interactive mode, in a scripted run, or on a one-shot `--play`.

```console
$ simcli --as claude --script demo.txt --capture demo.cast --size default
...
recorded → demo.cast
  cargo install --locked agg   # then: agg demo.cast demo.gif
  sudo dnf install asciinema   # then: asciinema play demo.cast
  ffmpeg -i demo.gif demo.mp4
```

**A cast is not a video, and that is the point.** It is the timed truth
of what was printed: small, diffable, replayable, and convertible
afterwards by tools built for it. Emitting an MP4 directly would mean
shipping a terminal renderer and a font, and freezing at capture time
every choice a viewer might want to change. The format is a JSON header
and one array per burst of output, so it is written here directly — no
dependency, no pty wrapper.

It records by wrapping `process.stdout.write`, so what lands in the file
is what the terminal received: escape sequences, the spinner rewriting
its own line, all of it. A recorder that re-derives the output from the
program's intentions records the intentions.

The alternate-screen escapes are deliberately left **outside** the cast.
A player replaying them would take over the viewer's terminal and then
wipe the playback on restore.

### Treating it afterwards

The recording keeps the truth; the conversion decides how it reads. Both
`m` (whose silence this is) and `i` (the line that was submitted) are in
the file, so the same capture can be treated any number of times without
asking anybody to perform the demo again.

```console
$ simcli cast raw.cast -o demo.cast --time even --from 12 --speed 1.5
raw.cast → demo.cast: 23.1s → 7.4s
```

| | |
|---|---|
| `--time even` | cap the pauses **you** made |
| `--keep-typos` | keep the editor's corrections instead of re-typing |
| `--paste` | the input arrives whole instead of letter by letter |
| `--from` / `--to` | the window, in seconds of the original |
| `--speed <n>` | 2 is twice as fast |

**A command's own time is never rewritten**, whatever else is asked for.
The longest silence in a recording is a build running, and it is the
demonstration — a normaliser that flattens the biggest number it finds
destroys the only thing worth filming.

**Nothing is dropped from the head.** A terminal recording is not a
video: its frames are instructions, each depending on the ones before.
Dropping the first ten seconds of a video loses ten seconds; dropping
them here loses the banner, the colours it set and whatever moved the
cursor, and every frame after is drawn on the wrong screen. So `--from`
collapses everything earlier into one instant — the screen arrives in the
state it was in, and only the time is gone.

asciinema 3 reads these files: `asciinema convert` takes the v2 to v3
with every `m` and `i` intact (measured, 10 and 2 respectively), so there
is no reason to emit v3 here.

### Size

Without `--size` the recording takes the window's own size — a session
in a 212-column terminal produces a 212-column cast. `--size` states it
instead, by name or by numbers:

| | |
|---|---|
| `small` | 80x24 — the terminal everyone's terminal used to be |
| `default` | 100x28 — fits a rendered README's text column |
| `medium` | 120x32 |
| `big` | 160x40 — needs a real screen to be read on |

Asking for more than the window has is a warning, not a refusal:

```
simcli: this window is 100x30, the recording asks for 160x40.
        Short by 60 columns and 10 rows — lines will wrap and the cast will keep the wrap.
        Resize the window, or record smaller: --size small (80x24).
```

The damage is real and invisible until somebody watches the result: long
lines wrap in the terminal, the wrap is captured as output, and the
player wraps it again.

## Recording a demo: `--script`


A scenario is the lines a person would type, echoed at the same prompt
and fed to the same handler. **Anything indented under a line belongs to
that line** — it replaces the filler, so a recording says something.

```
# a scenario is comments, typed lines, and answers under them

pourquoi une commande longue part-elle au fond ?
    think 2
    Parce qu'un agent qui attend soixante secondes ne fait rien d'autre.
    La commande continue, la session repart, et rien n'est perdu.

/fg sleep 3; echo tenu
/run sleep 60; echo build fini
/ps
```

```console
$ simcli --as claude --script demo.txt --pace 0.8
```

Indentation is the only syntax and `think` the only directive; a line
with nothing under it behaves exactly as if typed. **No new language and
no dependency** — a demo format that has to be learned goes stale, and a
YAML parser to express one nesting level would be more code than the
program.

Each door says what it is doing, in its own word: `/run` is `Running…`,
`/fg` is `Waiting…` — it is not thinking, it is refusing to let go — and
a bare prompt is the client's own `Cogitating…`. A spinner that says the
wrong thing is worse than none, because it gets read.

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

