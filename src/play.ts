// PLAY A TURN — the demo this program exists for.
//
// One scene: the agent reaches for a command, the command turns out to
// be long, and something takes it off the agent's hands. Everything that
// matters there is real — the payload, the hook, the rewritten line, the
// wait, the moment it lets go. Only the sentences around it are acted.
//
// TWO THINGS HAVE TO BE TRUE OR THE SCENE IS EMPTY, and both are facts
// about what an agent CLI is rather than choices made here:
//
//   NO TERMINAL. jbx steps aside the instant it sees a TTY — a human is
//   watching, so it gets out of the way (jobbox src/run.rs). A recording
//   of a bare terminal therefore shows nothing happening: the presence
//   of the terminal is what turns the thing off. A real client never
//   hands a tool a TTY; it reads the output through a pipe. So do we,
//   and the output is re-drawn in the client's own grammar.
//
//   NO INHERITED WRAPPER. Under an agent that already wraps commands,
//   the environment carries a marker saying so, and an inner wrapper
//   correctly stands down rather than claiming a second id for the same
//   work. Demonstrating the outer behaviour means running as the outer
//   one, so the marker is dropped for the child.

import { spawn } from "node:child_process";
import { chrome, type Chrome } from "./chrome.js";

const CSI = "\x1b[";
const dim = (s: string) => `${CSI}2m${s}${CSI}0m`;
const bold = (s: string) => `${CSI}1m${s}${CSI}0m`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** `1m 13s` under a minute stays `13s`, the way these clients write it. */
function span(seconds: number): string {
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * RUN SOMETHING AND DRAW IT AS THE CLIENT WOULD.
 *
 * Shared by the one-shot scene and the interactive mode, on purpose: two
 * renderers drift, and the whole point of this program is that what you
 * watch is what happened.
 *
 * `argv` runs a program directly — no shell, so nothing needs quoting.
 * `line` goes through `/bin/sh -c`, which is what a hook hands back.
 */
export async function runDrawn(
  c: Chrome,
  what: { argv: string[] } | { line: string },
  onDone?: (code: number, took: number) => void,
  // WHAT IT IS DOING, IN ONE WORD. `Cogitating…` is what a client says
  // while it thinks, and it is wrong over a running command: `/fg` in
  // particular is not thinking, it is refusing to let go. A spinner that
  // says the wrong thing is worse than no spinner, because it is read.
  word = "Working",
): Promise<number> {
  const env = { ...process.env };
  // See the header: the scene is about being the OUTER wrapper.
  delete env.JBX_WRAPPED;
  const child =
    "argv" in what
      ? spawn(what.argv[0]!, what.argv.slice(1), { env, stdio: ["ignore", "pipe", "pipe"] })
      : spawn("/bin/sh", ["-c", what.line], { env, stdio: ["ignore", "pipe", "pipe"] });

  const started = Date.now();
  let frame = 0;
  let spinning = true;
  const live = setInterval(() => {
    if (!spinning || !process.stdout.isTTY) return;
    const e = span((Date.now() - started) / 1000);
    process.stdout.write(
      `\r${CSI}2K${dim(`  ${c.spinner[frame++ % c.spinner.length]} ${word}… (${e} · esc to interrupt)`)}`,
    );
  }, 120);

  const show = (chunk: Buffer) => {
    if (process.stdout.isTTY) process.stdout.write(`\r${CSI}2K`);
    for (const l of chunk.toString().replace(/\n$/, "").split("\n")) console.log(dim(`  ⎿  ${l}`));
  };
  child.stdout.on("data", show);
  child.stderr.on("data", show);

  const code: number = await new Promise((r) => child.on("close", (x) => r(x ?? 0)));
  spinning = false;
  clearInterval(live);
  if (process.stdout.isTTY) process.stdout.write(`\r${CSI}2K`);
  const took = (Date.now() - started) / 1000;
  onDone?.(code, took);
  return code;
}

export function signOff(c: Chrome, took: number, past = "Ran"): void {
  console.log(dim(`${c.thinking?.[0] ?? "*"} ${past} for ${span(took)} · done ${clock()}`));
}

export type Scene = {
  client: string;
  /** What the human typed. */
  prompt: string;
  /** The line the agent decided to run. */
  line: string;
  /** The rewritten line, from the hook. Falls back to `line`. */
  ran: string;
  /** Beats per second of acted chrome; 0 plays it instantly. */
  speed: number;
};

/**
 * THE TURN, DRAWN LIVE.
 *
 * The spinner is on its own line and rewritten in place, because that is
 * what the real clients do and because a demo that scrolls a thousand
 * spinner frames is unreadable in a recording.
 */
export async function play(scene: Scene): Promise<number> {
  const c: Chrome | undefined = chrome(scene.client);
  if (!c) {
    console.error(`simcli: no chrome for ${JSON.stringify(scene.client)} — nothing to play.`);
    console.error(dim("  its protocol is known here; its screen is not. `simcli chrome` lists what is."));
    return 2;
  }
  const beat = (n: number) => sleep(scene.speed > 0 ? n / scene.speed : 0);

  console.log();
  console.log(`❯ ${scene.prompt}`);
  console.log();
  await beat(400);

  // The acted preamble: a step or two so the scene is not a bare shell.
  for (const step of c.timeline ?? []) {
    console.log(step.title);
    for (const l of step.lines) console.log(dim(l));
    await beat(step.duration / 3);
  }

  console.log(`● Bash(${scene.line})`);

  // THE COMMAND, FOR REAL — piped, and without the inherited marker.
  let took = 0;
  const code = await runDrawn(c, { line: scene.ran }, (_c, t) => (took = t), "Running");
  signOff(c, took, "Ran");
  if (c.status) {
    console.log();
    for (const l of c.status) console.log(dim(l));
  }
  return code;
}
