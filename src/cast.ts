// RECORDING THE SESSION — asciicast v2, written here rather than
// delegated.
//
// The format is a JSON header line followed by one JSON array per burst
// of output: `[seconds, "o", "text"]`. That is the entire specification
// that matters, which is why this is forty lines and no dependency
// instead of a recorder wrapped around a pty.
//
// A CAST IS NOT A VIDEO, AND THAT IS THE POINT. It is the timed truth of
// what was printed — small, diffable, replayable, and still convertible
// to a GIF or an MP4 afterwards by tools built for it. Producing an MP4
// directly would mean shipping a terminal renderer and a font, and
// freezing at capture time every choice a viewer might want to change.
//
// It works by wrapping `process.stdout.write`, so what is recorded is
// exactly what the terminal received — escape sequences, the alternate
// screen, the spinner rewriting its own line. A recorder that re-derives
// the output from the program's intentions records the intentions.

import { closeSync, openSync, readFileSync, writeSync } from "node:fs";
import { TOOLS, howTo, onPath } from "./tools.js";

export type Stop = () => void;

/**
 * WHOSE SILENCE IT IS.
 *
 * The only thing that makes normalising safe. A gap while a command runs
 * and a gap while a person stares at the prompt look identical in a
 * stream of output, and they must not be treated alike: one IS the
 * demonstration — thirty seconds of a build that gets taken away — and
 * the other is somebody deciding what to type.
 */
export type Phase = "human" | "machine";

export type Timing = "real" | "even";

/** How long a human pause is allowed to last, once normalised. */
const HUMAN_CAP = 0.7;
/** And how fast keystrokes are re-spaced. */
const KEY = 0.055;

// A GAP BELONGS TO THE PHASE IN FORCE *DURING* IT, not to the phase of
// the event that ends it — and getting that backwards is silent. The
// first version stamped each event with the current phase, so the six
// seconds a person spent deciding what to type were credited to the
// machine (the phase had already flipped by the time anything printed)
// and survived normalisation untouched. Transitions are therefore
// recorded as their own entries on the same timeline.
export type Item =
  | { at: number; kind: "out"; text: string }
  | { at: number; kind: "phase"; phase: Phase }
  | { at: number; kind: "typed"; text: string };

let phase: Phase = "machine";
let sink: ((item: Item) => void) | null = null;

/** Called by the session before it blocks on a keyboard, and after. */
export function mark(next: Phase): void {
  if (next === phase) return;
  phase = next;
  sink?.({ at: 0, kind: "phase", phase: next });
}

/**
 * THE LINE THAT WAS ACTUALLY SUBMITTED.
 *
 * This is how backspaces leave the recording, and the reason the answer
 * is "re-type it" rather than "filter them out". A person correcting a
 * typo produces whatever their line editor felt like emitting — a
 * backspace, a space and a backspace, a redraw of the whole line, a
 * cursor jump. Deleting those from a stream is guesswork that breaks on
 * the first editor that does it differently.
 *
 * Knowing what was SUBMITTED costs nothing and needs no guessing: the
 * human stretch is replaced by that line typed cleanly at a steady rate.
 *
 * IT IS ITS OWN FLAG, not a consequence of the timing. Sometimes the
 * correction IS the demo — showing that a wrong command can be taken
 * back — and losing it because the pauses were evened out would be the
 * tool deciding what the recording is about. `--keep-typos` keeps the
 * echo exactly as the editor wrote it, pauses evened out all the same.
 */
export function typed(line: string): void {
  sink?.({ at: 0, kind: "typed", text: line });
}

/**
 * RECORD, WRITING AS IT GOES.
 *
 * Every event is appended the moment it happens. THE FIRST VERSION HELD
 * THE WHOLE TIMELINE IN MEMORY and wrote it on close, which lost the
 * entire recording the first time a session was killed rather than
 * exited — a thirty-second demo, gone, with an empty path where the file
 * should have been. A recorder that only produces a file when everything
 * went well is a recorder that fails exactly when you needed the
 * evidence.
 *
 * So the file on disk is always the raw truth, and `timing` is applied
 * afterwards by re-reading it — the same path `simcli cast` takes. One
 * treatment, one place, and nothing buffered that a signal can take away.
 */
/**
 * A CAST MUST CARRY `\r\n`, AND A PROGRAM WRITES `\n`.
 *
 * The difference is the tty driver: in cooked mode it translates line
 * feeds to carriage-return-line-feed on the way out, so the terminal
 * receives `\r\n` while the program only ever wrote `\n`. Wrapping
 * `process.stdout.write` records the program's side — before that
 * translation — and a player feeding those bytes to an emulator gets a
 * line feed with no carriage return: each line starts where the last one
 * ended, in a staircase.
 *
 * It is invisible while recording, because the live terminal looks
 * perfect. It only appears on playback, which is the whole point of the
 * file. So the translation is done here, exactly once — `\r\n` already
 * present is left alone.
 */
function crlf(text: string): string {
  return text.replace(/(?<!\r)\n/g, "\r\n");
}

export function record(path: string, label: string, timing: Timing = "real", retype = true): Stop {
  const started = Date.now();
  const fd = openSync(path, "w");
  writeSync(
    fd,
    JSON.stringify({
      version: 2,
      width: process.stdout.columns ?? 80,
      height: process.stdout.rows ?? 24,
      timestamp: Math.floor(started / 1000),
      title: label,
      env: { TERM: process.env.TERM ?? "xterm-256color", SHELL: process.env.SHELL ?? "/bin/sh" },
    }) + "\n",
  );

  const put = (item: Item) => {
    const at = ((Date.now() - started) / 1000).toFixed(6);
    if (item.kind === "out") writeSync(fd, `[${at}, "o", ${JSON.stringify(crlf(item.text))}]\n`);
    else if (item.kind === "phase") writeSync(fd, `[${at}, "m", ${JSON.stringify(item.phase)}]\n`);
    else writeSync(fd, `[${at}, "i", ${JSON.stringify(item.text)}]\n`);
  };
  sink = put;

  const original = process.stdout.write.bind(process.stdout);
  let stopped = false;
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (!stopped && chunk != null) {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
      put({ at: 0, kind: "out", text });
    }
    return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;

  const stop: Stop = () => {
    if (stopped) return;
    stopped = true;
    process.stdout.write = original;
    sink = null;
    closeSync(fd);
    // The convenience of asking for a treatment at record time, done the
    // only safe way: on the file, once it is complete and safe on disk.
    if (timing === "even") {
      const { header, items } = load(path);
      save(path, header, even(items, retype));
    }
  };
  // KILLED IS THE CASE THAT MATTERS. A session ended by Ctrl-C is what a
  // demo does when it has gone wrong, and that is often the take worth
  // keeping. SIGHUP too: closing a terminal, or `tmux kill-session`.
  process.on("exit", stop);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sig, () => {
      stop();
      process.exit(sig === "SIGINT" ? 130 : 143);
    });
  }
  return stop;
}

/**
 * REWRITE THE HUMAN PAUSES, LEAVE THE MACHINE'S ALONE.
 *
 * An interactive session recorded in real time is unwatchable: eleven
 * seconds of nothing while somebody decides on a word, a keystroke burst
 * where they typed fast and a stall where they did not. This caps the
 * pauses and re-spaces the keystrokes so it reads as one steady hand.
 *
 * IT NEVER TOUCHES A MACHINE GAP. Compressing the thirty seconds before
 * a command detaches would make the recording lie about the one thing it
 * was made to show — and it is exactly the gap a naive normaliser
 * flattens first, being the longest one in the file.
 */
export type Retime = {
  /** `even` caps the pauses a person made; `real` leaves them. */
  time?: Timing;
  /** Replace what the editor echoed with the line that was submitted. */
  retype?: boolean;
  /** And how that replacement arrives on screen. */
  input?: "type" | "paste";
  /** Keep only this window, in seconds of the original. */
  from?: number;
  to?: number;
  /** Multiply what is left. 2 is twice as fast. */
  speed?: number;
};

/**
 * TRIM A RECORDING WITHOUT BREAKING THE SCREEN.
 *
 * A terminal recording is not a video: its frames are not pictures but
 * INSTRUCTIONS, each depending on the ones before. Dropping the first
 * ten seconds of a video loses ten seconds; dropping them here loses the
 * banner, the colours it set, and whatever moved the cursor — and every
 * frame after is drawn on the wrong screen.
 *
 * So nothing is dropped from the head. Everything before `from` is
 * collapsed into ONE instantaneous event: the screen arrives already in
 * the state it was in, and only the time is gone. `to` is the safe
 * direction and simply stops.
 */
export function window(items: Item[], from = 0, to = Infinity): Item[] {
  const before = items.filter((i) => i.at < from && i.kind === "out");
  const kept = items.filter((i) => i.at >= from && i.at <= to);
  const head: Item[] = before.length
    ? [{ at: from, kind: "out", text: before.map((i) => (i as { text: string }).text).join("") }]
    : [];
  // AND IT STARTS AT ZERO. Keeping the original timestamps leaves the
  // window beginning at, say, twelve seconds — a player then shows a
  // blank screen for twelve seconds, and every later treatment is
  // computed over a span that includes time nobody kept. Trimming twelve
  // seconds off a twenty-three second cast gave nineteen, which is how
  // this was noticed.
  const all = [...head, ...kept];
  const first = all[0]?.at ?? 0;
  return all.map((i) => ({ ...i, at: i.at - first }));
}

/** Multiply every interval. Marks ride along; nothing reorders. */
export function scale(items: Item[], by: number): Item[] {
  if (!by || by === 1) return items;
  const first = items[0]?.at ?? 0;
  return items.map((i) => ({ ...i, at: first + (i.at - first) / by }));
}

/**
 * EVERY TREATMENT, IN THE ORDER THAT MAKES THEM COMPOSE.
 *
 * Window first — there is no point evening out a stretch about to be
 * thrown away, and capping before trimming would move the very
 * timestamps the trim is expressed in. Speed last, because it is a
 * multiplier over whatever survived.
 */
export function retime(items: Item[], o: Retime = {}): Item[] {
  let out = window(items, o.from ?? 0, o.to ?? Infinity);
  if (o.time === "even") out = even(out, o.retype ?? true, o.input ?? "type");
  return scale(out, o.speed ?? 1);
}

export function even(items: Item[], retype = true, input: "type" | "paste" = "type"): Item[] {
  const out: Item[] = [];
  // AN OUTPUT CLOCK, NOT A RUNNING OFFSET. A human stretch is not
  // shortened but REPLACED — by a clean typing of the line that was
  // submitted — so its new length has nothing to do with its old one,
  // and bookkeeping by subtraction cannot express that.
  let t = 0;
  let previous = 0;
  let during: Phase = "machine";
  // Held output carries the gap it would have kept, had it survived.
  let held: { text: string; kept: number }[] = [];
  let submitted: string | null = null;

  const flush = () => {
    if (submitted !== null) out.push({ at: t, kind: "typed", text: submitted });
    if (submitted !== null && retype) {
      // The prompt, then the line. Typed one character at a time, or
      // arriving whole — WHICH IS A CONVERSION CHOICE, not something the
      // session had to decide while it was being recorded. A command
      // pasted from somewhere reads differently from one somebody typed,
      // and which of the two a demo wants is known afterwards.
      out.push({ at: t, kind: "out", text: "❯ " });
      if (input === "paste") {
        t += KEY;
        out.push({ at: t, kind: "out", text: submitted });
      } else {
        for (const ch of submitted) {
          t += KEY;
          out.push({ at: t, kind: "out", text: ch });
        }
      }
      t += KEY;
      out.push({ at: t, kind: "out", text: "\n" });
    } else {
      // Nothing was submitted here — a scripted run, or a stretch that
      // ended some other way. Keep what was printed, capped.
      for (const item of held) {
        t += item.kept;
        out.push({ at: t, kind: "out", text: item.text });
      }
    }
    held = [];
    submitted = null;
  };

  for (const item of items) {
    const gap = item.at - previous;
    previous = item.at;

    if (during === "human") {
      if (item.kind === "typed") {
        submitted = item.text;
        continue;
      }
      if (item.kind === "out") {
        const keystroke = item.text.length <= 2;
        held.push({ text: item.text, kept: Math.min(gap, keystroke ? KEY : HUMAN_CAP) });
        continue;
      }
      // A phase change ends the stretch.
      flush();
      during = item.phase;
      out.push({ at: t, kind: "phase", phase: item.phase });
      continue;
    }

    // MACHINE TIME IS NEVER REWRITTEN. Compressing the thirty seconds
    // before a command detaches would make the recording lie about the
    // one thing it was made to show — and it is the longest gap in the
    // file, so a naive normaliser flattens it first.
    t += gap;
    if (item.kind === "phase") {
      during = item.phase;
      out.push({ at: t, kind: "phase", phase: item.phase });
      continue;
    }
    if (item.kind === "typed") continue;
    if (item.kind === "out") out.push({ at: t, kind: "out", text: item.text });
  }
  flush();
  return out;
}

/**
 * WHAT TO RUN NEXT, AND HOW TO GET IT IF IT IS NOT HERE.
 *
 * Reads `tools.ts` rather than carrying its own install lines: a message
 * that names a package manager the machine does not have is a wrong
 * instruction delivered with confidence, and it gets tried.
 */
export function afterwards(path: string): string[] {
  const gif = path.replace(/\.cast$/, "") + ".gif";
  const mp4 = gif.replace(/\.gif$/, ".mp4");
  const line = (bin: string, cmd: string) => {
    const tool = TOOLS.find((t) => t.bin === bin)!;
    return onPath(bin) ? `  ${cmd}` : `  ${cmd}   ← needs ${bin}: ${howTo(tool)}`;
  };
  return [
    `recorded → ${path}`,
    line("agg", `agg ${path} ${gif}`),
    line("ffmpeg", `ffmpeg -i ${gif} ${mp4}`),
    line("asciinema", `asciinema play ${path}`),
  ];
}

/**
 * READ A CAST BACK, MARKS INCLUDED.
 *
 * This is what makes the treatment a CONVERSION rather than a recording
 * option. A session is recorded once, honestly, and how it should read —
 * pauses capped, corrections kept or dropped — is decided afterwards,
 * as many times as it takes, without asking anybody to perform the demo
 * again.
 */
export function load(path: string): { header: string; items: Item[] } {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const header = lines[0]!;
  const items: Item[] = [];
  for (const line of lines.slice(1)) {
    const [at, code, text] = JSON.parse(line) as [number, string, string];
    if (code === "o") items.push({ at, kind: "out", text });
    else if (code === "m") items.push({ at, kind: "phase", phase: text as Phase });
    else if (code === "i") items.push({ at, kind: "typed", text });
  }
  return { header, items };
}

export function save(path: string, header: string, items: Item[]): void {
  const fd = openSync(path, "w");
  writeSync(fd, header + "\n");
  for (const e of items) {
    const at = e.at.toFixed(6);
    if (e.kind === "out") writeSync(fd, `[${at}, "o", ${JSON.stringify(e.text)}]\n`);
    else if (e.kind === "phase") writeSync(fd, `[${at}, "m", ${JSON.stringify(e.phase)}]\n`);
    else writeSync(fd, `[${at}, "i", ${JSON.stringify(e.text)}]\n`);
  }
  closeSync(fd);
}
