// INTERACTIVE, AND SCRIPTED — the same session, driven by two hands.
//
// The one-shot scene proves a point; this is for a human who wants to
// feel the difference. jbx has three ways a line can go, and they are
// only meaningful next to each other:
//
//   a bare line   wrapped — held, and let go of if it outlasts the cut
//   /fg <line>    held to the end on purpose, however long it takes
//   /bg <line>    handed over before it starts, never held at all
//
// Typing the same `sleep 60` three ways is the whole lesson, and no
// amount of prose replaces having watched it.
//
// A SCRIPT IS THE SAME SESSION WITH THE TYPING DONE FOR YOU. It is not a
// second language: a scenario file holds exactly the lines a person
// would type, fed to the same handler, echoed at the same prompt. That
// is what makes a recorded demo reproducible — and what stops the
// recording from drifting away from what the tool actually does, which
// is the failure mode of every screencast.
//
// THE TWO CONDITIONS FROM play.ts HOLD HERE TOO, and one is
// counter-intuitive enough to say twice: this shell is a TTY, and jbx
// steps aside in front of a TTY. Children are therefore given pipes, not
// this terminal — which is also what a real client does, so what is on
// show is the real behaviour rather than an arrangement.

import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
import { chrome, type Chrome } from "./chrome.js";
import { runDrawn, signOff } from "./play.js";
import { payload, rewritten, type Dialect } from "./dialects.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A NAME FOR A QUEUED LINE, from its first words.
 *
 * `jbx queue` insists on one, and it is right to: ten jobs all called
 * `sleep`, three hours later, is a list of nothing.
 */
function intentOf(line: string): string {
  return line.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 60) || "job";
}

/**
 * SINGLE-QUOTE FOR THE SHELL.
 *
 * `/say` takes free text, and free text contains apostrophes. Pasting it
 * raw into a shell line is how a demo of a wrapper becomes a demo of a
 * quoting bug.
 */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// THE THREE DOORS ARE NAMED, INCLUDING THE DEFAULT ONE.
//
// `/fg` and `/bg` existed first, and their existence made the bare line
// read as something else — an inert prompt rather than the door that
// matters. The first person to try it reached for `/fg` to see a line
// detach, which is the one door that never detaches. So the default has
// a name too: two ways to say it, but symmetry that stops the list from
// implying the wrong thing.
const HELP = `  <line>        run it the way the agent would — wrapped, and let go
  /run <line>   of if it outlasts the cut. THIS is the one that detaches.
  /say <text>   echo it — the short case, which never detaches
  /cat <file>   read a file, drawn the way a tool result is drawn
  /fg <line>    hold it to the end, however long it takes
  /bg <line>    hand it over before it starts
  /ps           what is running right now
  /list         and what has finished
  /gain         what the wrapping bought
  /wait <secs>  pause the script here — pacing, for a recording
  /help         this
  /exit         leave (or Ctrl-D)`;

/** Read-only verbs printed as-is: hanging a table off `⎿` breaks it. */
const PLAIN: Record<string, string[]> = { "/ps": ["ps"], "/list": ["list"], "/gain": ["gain"] };

export type Session = {
  d: Dialect;
  hook: string;
  /** Lines to play instead of reading a keyboard. Absent = interactive. */
  script?: string[];
  /** Seconds between scripted lines, so a recording is watchable. */
  pace: number;
};

export async function repl(s: Session): Promise<number> {
  const { d, hook } = s;
  const c: Chrome | undefined = chrome(d.name);
  if (!c) {
    console.error(`simcli: no chrome for ${d.name} — nothing to play.`);
    console.error(dim("  its protocol is known here; its screen is not. `simcli chrome` lists what is."));
    return 2;
  }

  // THE CUT IS JBX'S TO STATE. Asking it means this banner cannot drift
  // from the setting actually in force — which a hardcoded "30s" would,
  // silently, the first time somebody changed it.
  const cfg = spawnSync(hook, ["after"], { encoding: "utf8" });
  const cut = (cfg.stdout ?? "").trim().split("\n")[0] || "the configured cut";

  console.log();
  console.log(bold(`${c.label}, played.`) + dim("  The turn is acted; the hook and the line are real."));
  console.log(dim(`Type a command to run it the way the agent does — ${cut.replace(/\.?$/, "")}.`));
  console.log(dim("`/fg` holds it instead, `/bg` hands it over. /help for the rest."));
  console.log();

  /** One typed line. Returns false when the session should end. */
  async function handle(input: string): Promise<boolean> {
    if (!input) return true;
    if (input === "/exit" || input === "/quit") return false;
    if (input === "/help") {
      console.log(HELP);
      return true;
    }
    if (input.startsWith("/wait ")) {
      await sleep(Number(input.slice(6).trim()) * 1000 || 0);
      return true;
    }
    if (PLAIN[input]) {
      const env = { ...process.env };
      delete env.JBX_WRAPPED;
      const r = spawnSync(hook, PLAIN[input]!, { encoding: "utf8", env });
      process.stdout.write(r.stdout ?? "");
      process.stderr.write(r.stderr ?? "");
      return true;
    }

    let took = 0;
    const done = (_code: number, t: number) => (took = t);

    if (input.startsWith("/run ")) {
      await agent(input.slice(5).trim(), done);
    } else if (input.startsWith("/fg ")) {
      const line = input.slice(4).trim();
      console.log(`● Bash(${line})` + dim("   held on purpose"));
      await runDrawn(c!, { argv: [hook, "fg", "--", line] }, done);
    } else if (input.startsWith("/bg ")) {
      const line = input.slice(4).trim();
      console.log(`● Bash(${line})` + dim("   handed over before it starts"));
      await runDrawn(c!, { argv: [hook, "queue", intentOf(line), "--", line] }, done);
    } else if (input.startsWith("/say ") || input.startsWith("/cat ")) {
      // SHORTHANDS FOR THE TWO GESTURES A DEMO KEEPS NEEDING: something
      // that prints and something that reads. Both take the agent path,
      // because what is useful to SEE is a short line handed straight
      // back — the cut only fires on what actually runs long.
      const rest = input.slice(5).trim();
      await agent(input.startsWith("/say ") ? `echo ${shq(rest)}` : `cat ${shq(rest)}`, done);
    } else if (input.startsWith("/")) {
      console.log(dim(`  unknown: ${input.split(" ")[0]} — /help`));
      return true;
    } else {
      await agent(input, done);
    }
    signOff(c!, took);
    console.log();
    return true;
  }

  /**
   * THE AGENT PATH, AND THE ONLY ONE THAT GOES THROUGH THE HOOK.
   *
   * The line is sent as this client sends it and the answer is read
   * where this client reads it, so what runs is whatever the hook
   * decided — including nothing, if it was not watching this tool.
   */
  async function agent(line: string, done: (c: number, t: number) => void): Promise<void> {
    const r = spawnSync(hook, ["hook", d.name], {
      input: JSON.stringify(payload(d, line, line)),
      encoding: "utf8",
      env: { ...process.env, JBX_WRAPPED: "1" },
    });
    let ran = line;
    const out = (r.stdout ?? "").trim();
    if (out) {
      try {
        ran = rewritten(d, JSON.parse(out)) ?? line;
      } catch {
        console.log(dim(`  the hook answered something that is not JSON: ${out}`));
      }
    }
    console.log(`● Bash(${line})`);
    if (ran === line) console.log(dim("  ⎿  the hook did not rewrite this one"));
    await runDrawn(c!, { line: ran }, done);
  }

  if (s.script) {
    // ECHOED AT THE PROMPT, so a recording shows the line as if typed.
    // A demo where commands appear to run themselves reads as a fake.
    for (const line of s.script) {
      const input = line.trim();
      if (!input || input.startsWith("#")) continue;
      console.log(`❯ ${input}`);
      if (!(await handle(input))) break;
      await sleep(s.pace * 1000);
    }
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "❯ " });
    rl.prompt();
    for await (const raw of rl) {
      if (!(await handle(raw.trim()))) break;
      rl.prompt();
    }
    rl.close();
  }

  console.log(dim("\nleft the session. Anything detached is still running — `jbx ps`."));
  return 0;
}
