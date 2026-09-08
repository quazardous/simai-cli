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

import { closeSync, openSync, writeSync } from "node:fs";

export type Stop = () => void;

export function record(path: string, label: string): Stop {
  const fd = openSync(path, "w");
  const header = {
    version: 2,
    width: process.stdout.columns ?? 80,
    height: process.stdout.rows ?? 24,
    timestamp: Math.floor(Date.now() / 1000),
    title: label,
    env: { TERM: process.env.TERM ?? "xterm-256color", SHELL: process.env.SHELL ?? "/bin/sh" },
  };
  writeSync(fd, JSON.stringify(header) + "\n");

  const started = Date.now();
  const original = process.stdout.write.bind(process.stdout);
  let stopped = false;

  // The signature has three overloads in Node; this keeps all of them
  // working by passing everything through untouched.
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (!stopped && chunk != null) {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
      const at = ((Date.now() - started) / 1000).toFixed(6);
      writeSync(fd, `[${at}, "o", ${JSON.stringify(text)}]\n`);
    }
    return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;

  const stop: Stop = () => {
    if (stopped) return;
    stopped = true;
    process.stdout.write = original;
    closeSync(fd);
  };
  // A SESSION ENDED BY CTRL-C IS THE ONE MOST WORTH KEEPING — it is what
  // a demo does when it has gone wrong, and losing the file at exactly
  // that moment is how a recording bug hides.
  process.on("exit", stop);
  return stop;
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
