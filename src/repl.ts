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
import { takeTerminal } from "./screen.js";
import { mark, typed, type Timing } from "./cast.js";
import { spawnSync } from "node:child_process";
import { chrome, type Chrome } from "./chrome.js";
import { hanger, runDrawn, signOff } from "./play.js";
import { payload, rewritten, type Dialect } from "./dialects.js";
import { burst } from "./lorem.js";
import { type Beat } from "./scenario.js";

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

// A BARE LINE IS A PROMPT, AND EVERY DOOR IS NAMED.
//
// This started the other way round — a bare line ran as a command, and
// only `/fg` and `/bg` were named. The first person to try it reached
// for `/fg` to watch a line detach, `/fg` being the one door that never
// detaches. Naming two of three made the third read as something it was
// not.
//
// Talking is what a bare line SHOULD be in a client that plays an agent,
// so it is that now, and all three doors carry a slash. The answer is
// filler on purpose: see lorem.ts.
const HELP = `  <text>        talk to it — you get filler back, and a pause
  /run <line>   run it the way the agent would. THIS is the one that detaches.
  /say <text>   echo it — the short case, which never detaches
  /cat <file>   read a file, drawn the way a tool result is drawn
  /tool <Name> <arg>   draw a tool call that runs nothing: Read, Update,
                Write, Grep… In a script, the lines indented under it
                are its result; \`+\`/\`-\` lines are drawn as a diff.
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
  /** Beats to play instead of reading a keyboard. Absent = interactive. */
  script?: Beat[];
  /** Seconds between scripted lines, so a recording is watchable. */
  pace: number;
  /** How long the acted thinking phase lasts. */
  think: number;
  /** Print the header above the welcome. */
  splash: boolean;
  /** Stay on the calling terminal instead of taking the screen. */
  inline: boolean;
  /** Write an asciicast here while the session runs. */
  capture: string;
  /** Real wall clock, or human pauses evened out. */
  timing: Timing;
  /** Scripted lines appear at once unless a beat says otherwise. */
  paste: boolean;
  /** Keep the editor's corrections in the recording. */
  keepTypos: boolean;
  /** End a script on an idle prompt instead of leaving. */
  stay: boolean;
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
  // NO HOOK, NO CUT: `--hook none` is a scene that is not about one.
  const none = hook === "none";
  const cfg = none ? undefined : spawnSync(hook, ["after"], { encoding: "utf8" });
  const cut = (cfg?.stdout ?? "").trim().split("\n")[0] || "the configured cut";

  // THE WHOLE SESSION RUNS ON THE ALTERNATE SCREEN — banner at the top,
  // conversation scrolling under it, the calling terminal handed back
  // untouched at the end. `--inline` opts out for anyone piping this
  // somewhere that would rather have plain lines.
  const release = s.inline ? () => {} : takeTerminal();
  // RECORDING STARTS *AFTER* THE SCREEN IS TAKEN, so the alternate-screen
  // escapes fall OUTSIDE the cast. That is deliberate: a player replaying
  // them would take over the viewer's terminal and then wipe the very
  // playback on restore. The cast holds the content; taking the screen is
  // this session's business, not the recording's.
  const stopCast = s.capture ? (await import("./cast.js")).record(s.capture, `simcli — ${d.name}`, s.timing, !s.keepTypos) : undefined;
  try {
  if (s.splash) {
    const { banner } = await import("./banner.js");
    console.log();
    for (const l of banner("simcli — play an agent CLI at a hook")) console.log(l);
  }

  // `--no-banner` IS A CAPTURE ASKING FOR THE SESSION ALONE, and the
  // welcome is as much ours as the header is: a real client prints
  // neither, so a screenshot that keeps them shows a tool, not an agent.
  if (s.splash) {
    console.log();
    console.log(bold(`${c.label}, played.`) + dim("  The turn is acted; the hook and the line are real."));
    console.log(dim("Type anything to talk to it. `/run <line>` runs a command the way the"));
    console.log(dim(none ? "agent does — no hook here, so it runs as it is. /help for the rest."
                         : `agent does — ${cut.replace(/\.?$/, "")}. /help for the rest.`));
  }
  console.log();

  /** One typed line. Returns false when the session should end. */
  async function handle(input: string, beat?: Beat): Promise<boolean> {
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
    if (PLAIN[input] && none) {
      console.log(dim(`  ${input} asks the hook, and there is none here`));
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
    // ONE WORD PER DOOR, PRESENT AND PAST. They do different things and
    // saying so is most of what makes the three legible side by side.
    let now = "Running";
    let then = "Ran";

    if (input.startsWith("/run ")) {
      await agent(input.slice(5).trim(), done, now);
    } else if (input.startsWith("/fg ")) {
      const line = input.slice(4).trim();
      console.log(`● Bash(${line})` + dim("   held on purpose"));
      [now, then] = ["Waiting", "Waited"];
      await runDrawn(c!, none ? { line } : { argv: [hook, "fg", "--", line] }, done, now);
    } else if (input.startsWith("/bg ")) {
      const line = input.slice(4).trim();
      console.log(`● Bash(${line})` + dim("   handed over before it starts"));
      [now, then] = ["Handing over", "Handed over in"];
      await runDrawn(c!, none ? { line } : { argv: [hook, "queue", intentOf(line), "--", line] }, done, now);
    } else if (input.startsWith("/say ") || input.startsWith("/cat ")) {
      // SHORTHANDS FOR THE TWO GESTURES A DEMO KEEPS NEEDING: something
      // that prints and something that reads. Both take the agent path,
      // because what is useful to SEE is a short line handed straight
      // back — the cut only fires on what actually runs long.
      const rest = input.slice(5).trim();
      await agent(input.startsWith("/say ") ? `echo ${shq(rest)}` : `cat ${shq(rest)}`, done, now);
    } else if (input.startsWith("/tool ")) {
      tool(input.slice(6).trim(), beat?.answer ?? []);
      return true;
    } else if (input.startsWith("/")) {
      console.log(dim(`  unknown: ${input.split(" ")[0]} — /help`));
      return true;
    } else {
      // TALKING. Acted end to end, and the only part of the session that
      // is — which is exactly why the filler must not read as prose.
      await say(input, beat);
      return true;
    }
    signOff(c!, took, then);
    console.log();
    return true;
  }

  /**
   * AN ANSWER, STREAMED.
   *
   * A thinking beat, then filler a line at a time. The beat is what
   * makes the rest of the session legible: a reader who has watched a
   * two-second answer knows what the thirty-second one means.
   */
  async function say(prompt: string, beat?: Beat): Promise<void> {
    const started = Date.now();
    const width = Math.min((process.stdout.columns ?? 80) - 4, 92);
    let seed = 0;
    for (const ch of prompt) seed = (seed * 31 + ch.charCodeAt(0)) & 0x7fffffff;

    // WHAT IT HEARD, FIRST — for filler only. Lorem under a prompt
    // that has scrolled away says nothing about what it answers, so the
    // echo ties them together. A WRITTEN answer speaks for itself, and
    // there the echo reads as a bug: no real client repeats the ask.
    if (!beat?.answer) console.log(`● You said ${JSON.stringify(prompt)}.`);
    // A WRITTEN ANSWER REPLACES THE FILLER ENTIRELY — including the
    // opening line. Half-written and half-lorem would read as a glitch,
    // and the whole reason to write one is to be read.
    if (!beat?.answer) {
      for (const l of burst(1, width, seed)) console.log(l);
      console.log();
    }

    // THE PAUSE IS THE POINT. Somebody who has watched a three-second
    // answer knows what the thirty-second one means; without it the
    // detachment later has nothing to be long compared to.
    await spin(beat?.think ?? s.think);

    // GENERATED FILLER ARRIVES ALREADY INDENTED; a written answer does
    // not. Indenting both gave the scripted lines four spaces and the
    // generated ones two — in the same session, one above the other.
    const written = beat?.answer;
    // THE ANSWER OPENS ON THE CLIENT'S BULLET, as a real one does. The
    // echo used to carry it; without the echo the first written line
    // takes it, and the rest keep the two-space indent under it.
    let opened = false;
    for (const l of written ?? burst(2, width, seed + 7)) {
      const lead = written && l && !opened ? "● " : undefined;
      if (lead) opened = true;
      console.log(written ? (lead ? lead + l : wrapped(l, width)) : l);
      await sleep(l ? 45 : 120);
    }
    signOff(c!, (Date.now() - started) / 1000, c!.done?.[0] ?? "Answered");
    console.log();
  }

  /**
   * A TOOL CALL THAT RUNS NOTHING.
   *
   * A scene of an agent that codes is mostly reads and edits, not shell
   * lines — and none of those need to happen for the screen to be true.
   * `/tool Update src/x.rs` draws `● Update(src/x.rs)`; the lines written
   * under it in the script are its result, hung the way a result hangs,
   * with `+` and `-` lines coloured as the client colours a diff.
   */
  function tool(spec: string, body: string[]): void {
    const at = spec.indexOf(" ");
    const [name, arg] = at < 0 ? [spec, ""] : [spec.slice(0, at), spec.slice(at + 1).trim()];
    console.log(`● ${name}${arg ? `(${arg})` : ""}`);
    const under = hanger();
    for (const l of body) {
      const drawn = under(l);
      // A LINE NUMBER MAY COME FIRST — `13 +  …` is how the client
      // numbers a diff — so the sign is looked for after it.
      if (/^\s*(\d+\s+)?\+/.test(l)) console.log(`\x1b[32m${drawn}\x1b[0m`);
      else if (/^\s*(\d+\s+)?-/.test(l)) console.log(`\x1b[31m${drawn}\x1b[0m`);
      else console.log(dim(drawn));
    }
    console.log();
  }

  /**
   * TYPE A SCRIPTED LINE, ONE CHARACTER AT A TIME.
   *
   * A scenario that prints its prompt whole reads as a machine talking
   * to itself; the same line typed reads as somebody using the thing.
   * It costs a second and it is most of what makes a recording watchable.
   *
   * `--pace 0` means "no theatre", so it prints at once there.
   */
  async function type(line: string, paste = false): Promise<void> {
    if (paste || !s.pace) {
      console.log(`❯ ${line}`);
      return;
    }
    mark("human");
    process.stdout.write("❯ ");
    for (const ch of line) {
      process.stdout.write(ch);
      // A HAND IS NOT A METRONOME. A little jitter, and a beat after a
      // space, is the difference between typed and pasted.
      await sleep(38 + (ch === " " ? 60 : 0) + (line.length % 7) * 2);
    }
    process.stdout.write("\n");
    mark("machine");
  }

  /** Indent a written line the way the generated ones are indented. */
  function wrapped(line: string, _width: number): string {
    return line ? `  ${line}` : "";
  }

  /** The thinking phase, counted up on one rewritten line. */
  async function spin(seconds: number): Promise<void> {
    // NO TERMINAL, NO SPINNER. Without `\r` to rewrite it, the line
    // stayed in the output as text — a capture piped through `cat` kept a
    // frozen "Cogitating… (2s)" in every answer. The pause is kept.
    if (!process.stdout.isTTY || seconds <= 0) {
      await sleep(seconds * 1000);
      return;
    }
    const word = c!.gerunds?.[0] ?? "Working";
    const from = Date.now();
    let frame = 0;
    const live = setInterval(() => {
      const e = Math.round((Date.now() - from) / 1000);
      process.stdout.write(`\r\x1b[2K${dim(`  ${c!.spinner[frame++ % c!.spinner.length]} ${word}… (${e}s · esc to interrupt)`)}`);
    }, 120);
    await sleep(seconds * 1000);
    clearInterval(live);
    process.stdout.write("\r\x1b[2K");
  }

  /**
   * THE AGENT PATH, AND THE ONLY ONE THAT GOES THROUGH THE HOOK.
   *
   * The line is sent as this client sends it and the answer is read
   * where this client reads it, so what runs is whatever the hook
   * decided — including nothing, if it was not watching this tool.
   */
  async function agent(line: string, done: (c: number, t: number) => void, word: string): Promise<void> {
    if (none) {
      console.log(`● Bash(${line})`);
      await runDrawn(c!, { line }, done, word);
      return;
    }
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
    await runDrawn(c!, { line: ran }, done, word, ran === line);
  }

  if (s.script) {
    // ECHOED AT THE PROMPT, so a recording shows the line as if typed.
    // A demo where commands appear to run themselves reads as a fake.
    for (const beat of s.script) {
      await type(beat.input, beat.paste ?? s.paste);
      if (!(await handle(beat.input, beat))) break;
      await sleep(s.pace * 1000);
    }
    // A CAPTURE ENDS ON A CLIENT WAITING FOR ITS NEXT LINE, not on one
    // that has left. Held until the input closes (Ctrl-D) or the process
    // is stopped — whoever took the screenshot decides when.
    if (s.stay) {
      mark("human");
      process.stdout.write("❯ ");
      await new Promise<void>((done) => {
        process.stdin.on("end", done).on("close", done).on("error", done).resume();
      });
      process.stdout.write("\n");
    }
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "❯ " });
    // WAITING ON A KEYBOARD IS HUMAN TIME. Marking it is what lets
    // `--time even` cap the pauses without touching a command's.
    mark("human");
    rl.prompt();
    for await (const raw of rl) {
      // WHAT WAS SUBMITTED, not what the editor echoed. Under `--time
      // even` this line is re-typed cleanly in the recording and the
      // backspaces go with the echo.
      typed(raw.trim());
      mark("machine");
      const go = await handle(raw.trim());
      mark("human");
      if (!go) break;
      rl.prompt();
    }
    rl.close();
  }

  } finally {
    stopCast?.();
    release();
  }
  // SAID ON THE CALLING TERMINAL, not on the screen that just vanished.
  console.log(dim(none ? "left the session." : "left the session. Anything detached is still running — `jbx ps`."));
  if (s.capture) {
    const { afterwards } = await import("./cast.js");
    for (const l of afterwards(s.capture)) console.log(dim(l));
  }
  return 0;
}
