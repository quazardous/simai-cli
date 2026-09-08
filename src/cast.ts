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
type Item =
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

export function record(path: string, label: string, timing: Timing = "real", retype = true): Stop {
  const started = Date.now();
  const items: Item[] = [];
  sink = (item) => items.push({ ...item, at: (Date.now() - started) / 1000 });
  const original = process.stdout.write.bind(process.stdout);
  let stopped = false;

  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (!stopped && chunk != null) {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
      items.push({ at: (Date.now() - started) / 1000, kind: "out", text });
    }
    return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;

  const stop: Stop = () => {
    if (stopped) return;
    stopped = true;
    process.stdout.write = original;
    sink = null;

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
    // THE MARKS GO IN THE FILE. A cast that records only what was
    // printed can never be normalised afterwards: nothing in it says
    // which silence was a person and which was a build, and that is the
    // whole distinction. `m` and `i` are asciicast event codes players
    // already skip, so the file stays playable as it is.
    for (const e of timing === "even" ? even(items, retype) : items) {
      const at = e.at.toFixed(6);
      if (e.kind === "out") writeSync(fd, `[${at}, "o", ${JSON.stringify(e.text)}]\n`);
      else if (e.kind === "phase") writeSync(fd, `[${at}, "m", ${JSON.stringify(e.phase)}]\n`);
      else writeSync(fd, `[${at}, "i", ${JSON.stringify(e.text)}]\n`);
    }
    closeSync(fd);
  };
  // A SESSION ENDED BY CTRL-C IS THE ONE MOST WORTH KEEPING — it is what
  // a demo does when it has gone wrong, and losing the file at exactly
  // that moment is how a recording bug hides.
  process.on("exit", stop);
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
export function even(items: Item[], retype = true): Item[] {
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
      // The prompt, then the line, one character at a time. Whatever the
      // editor echoed — corrections and all — is dropped with `held`.
      out.push({ at: t, kind: "out", text: "❯ " });
      for (const ch of submitted) {
        t += KEY;
        out.push({ at: t, kind: "out", text: ch });
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
 * WHAT TO RUN NEXT, AND WHAT TO INSTALL IF IT IS MISSING.
 *
 * Printed once, with the file. A capture format nobody can turn into a
 * video is a capture format nobody uses, and leaving the reader to
 * search for the converter is where that happens.
 */
export function afterwards(path: string, has: (bin: string) => boolean): string[] {
  const gif = path.replace(/\.cast$/, "") + ".gif";
  const out: string[] = [`recorded → ${path}`];
  if (has("agg")) out.push(`  agg ${path} ${gif}`);
  else out.push(`  cargo install --locked agg   # then: agg ${path} ${gif}`);
  if (has("asciinema")) out.push(`  asciinema play ${path}`);
  else out.push(`  sudo dnf install asciinema   # then: asciinema play ${path}`);
  if (has("ffmpeg")) out.push(`  ffmpeg -i ${gif} ${gif.replace(/\.gif$/, ".mp4")}`);
  return out;
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
