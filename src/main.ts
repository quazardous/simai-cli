#!/usr/bin/env node
// SIMAI-CLI — plays an agent CLI so a hook can be exercised without one.
//
// A hook that rewrites shell commands has a problem: proving it works
// means installing five different agents. This sends what each of them
// really sends, reads what comes back, and runs it.
//
// THE CHROME IS ACTED. THE PROTOCOL IS NOT. The prompt, the pacing and
// the banner are theatre; the payload, the hook call, the rewritten line
// and its output are real. That split is what stops a recording of this
// from drifting away from the thing it demonstrates — and it is said on
// screen, because a fabricated agent turn presented as a real session
// would be a lie that does not survive being asked.

import { spawnSync } from "node:child_process";
import { DIALECTS, dialect, payload, rewritten, type Dialect } from "./dialects.js";
import { capture, compareFiles, playChrome } from "./commands.js";

type Options = {
  as: string;
  hook: string;
  line: string;
  why: string;
  check: boolean;
  quiet: boolean;
  play: boolean;
  speed: number;
  script: string;
  pace: number;
  think: number;
};

function usage(): never {
  const names = DIALECTS.map((d) => d.name).join(", ");
  console.error(`simcli — play an agent CLI at a hook

  simcli --as <client> [--hook <path>]            interactive
  simcli --as <client> --script <file>            play a scenario, then exit
  simcli --as <client> [--check] -- '<shell line>'  one line, then exit
  simcli capture [--pane <target>] [-o <file>]
  simcli compare <real> <played> [--verbose]
  simcli chrome <client>

  --as <client>   ${names}
  --hook <path>   the hook to call (default: jbx)
  --why <text>    the description the client would have asked the model for
  --check         say whether the line was rewritten, and exit 1 if not
  --quiet         no chrome, just the protocol
  --play          draw the whole turn: prompt, spinner, output, sign-off
  --speed <n>     how fast the acted parts play (default 1)
  --script <file> lines to play, exactly as a person would type them
  --pace <secs>   pause between scripted lines (default 0.6)
  --think <secs>  how long the acted thinking phase lasts (default 3)
`);
  process.exit(2);
}

function parse(argv: string[]): Options {
  const o: Options = { as: "claude", hook: "jbx", line: "", why: "", check: false, quiet: false, play: false, speed: 1, script: "", pace: 0.6, think: 3 };
  const rest = [...argv];
  while (rest.length) {
    const arg = rest.shift()!;
    if (arg === "--") {
      o.line = rest.join(" ");
      break;
    }
    switch (arg) {
      case "--as": o.as = rest.shift() ?? usage(); break;
      case "--hook": o.hook = rest.shift() ?? usage(); break;
      case "--why": o.why = rest.shift() ?? usage(); break;
      case "--check": o.check = true; break;
      case "--quiet": o.quiet = true; break;
      case "--play": o.play = true; break;
      case "--speed": o.speed = Number(rest.shift()) || 1; break;
      case "--script": o.script = rest.shift() ?? usage(); break;
      case "--pace": o.pace = Number(rest.shift()) || 0; break;
      case "--think": o.think = Number(rest.shift()) || 0; break;
      default: usage();
    }
  }
  // NO LINE MEANS INTERACTIVE. That is how every other REPL decides it,
  // and a separate `--interactive` flag would be a second way of saying
  // what `--` already says.
  return o;
}

// THE HOOK IS CALLED THE WAY A CLIENT CALLS IT: one process, the payload
// on stdin, the answer on stdout. Nothing else is a hook.
function ask(hook: string, client: string, sent: unknown): string {
  const run = spawnSync(hook, ["hook", client], {
    input: JSON.stringify(sent),
    encoding: "utf8",
    env: { ...process.env, JBX_WRAPPED: "1" },
  });
  if (run.error) {
    console.error(`simcli: cannot run ${hook}: ${run.error.message}`);
    process.exit(2);
  }
  return (run.stdout ?? "").trim();
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main(): Promise<void> {
  // TWO GESTURES BEFORE THE PLAYING ONE. Reproducing a screen is
  // guesswork until the real one and the copy are put side by side, so
  // capturing and comparing are verbs here rather than a note in a
  // README telling somebody to pipe tmux into diff.
  const argv = process.argv.slice(2);
  if (argv[0] === "capture") {
    const t = argv.indexOf("--pane");
    const o = argv.indexOf("-o");
    process.exit(capture(t >= 0 ? argv[t + 1] : undefined, o >= 0 ? argv[o + 1] : undefined));
  }
  if (argv[0] === "chrome") process.exit(playChrome(argv[1]));
  if (argv[0] === "compare") {
    const files = argv.slice(1).filter((a) => !a.startsWith("-"));
    if (files.length !== 2) {
      console.error("simcli compare <real> <played> [--verbose]");
      process.exit(2);
    }
    process.exit(compareFiles(files[0]!, files[1]!, argv.includes("--verbose")));
  }

  const o = parse(argv);
  const d: Dialect | undefined = dialect(o.as);
  if (!d) {
    const known = DIALECTS.map((x) => x.name).join(", ");
    console.error(`simcli: no dialect for ${JSON.stringify(o.as)} — known: ${known}`);
    process.exit(2);
  }

  // INTERACTIVE OR SCRIPTED — same session, same vocabulary, one driven
  // by a keyboard and the other by a file.
  if (!o.line || o.script) {
    const { repl } = await import("./repl.js");
    const script = o.script
      ? (await import("node:fs")).readFileSync(o.script, "utf8").split("\n")
      : undefined;
    process.exit(await repl({ d, hook: o.hook, script, pace: o.pace, think: o.think }));
  }

  const raw = ask(o.hook, d.name, payload(d, o.line, o.why || o.line));
  let answer: unknown;
  if (raw) {
    try {
      answer = JSON.parse(raw);
    } catch {
      console.error(`simcli: ${o.hook} answered something that is not JSON:\n${raw}`);
      process.exit(1);
    }
  }
  const line = answer === undefined ? undefined : rewritten(d, answer);

  if (o.check) {
    // A HOOK THAT SAYS NOTHING LOOKS EXACTLY LIKE ONE THAT IS NOT
    // WATCHING THIS TOOL. Only the caller knows which was expected, so
    // `--check` is where that expectation gets written down — and it is
    // the whole reason this program is worth more than a demo.
    if (!line) {
      console.error(`simcli: ${o.hook} did not rewrite a ${d.label} ${d.tool} call.`);
      console.error(`  sent   ${d.keys.tool}=${d.tool}, event ${d.event}`);
      console.error(`  looked ${d.answer.join(".")}`);
      console.error(`  read   ${raw || "<nothing>"}`);
      process.exit(1);
    }
    console.log(`ok  ${d.label}\n    typed   ${o.line}\n    ran     ${line}`);
    return;
  }

  if (o.play) {
    // THE SCENE, NOT THE BARE PROTOCOL. Same hook call, same rewritten
    // line — dressed, and run the way a client runs it.
    const { play } = await import("./play.js");
    process.exit(await play({ client: d.name, prompt: o.why || o.line, line: o.line, ran: line ?? o.line, speed: o.speed }));
  }

  if (!o.quiet) {
    console.log(dim(`— ${d.label}, played. The turn is acted; the hook and the line are real.`));
    console.log(bold(`> ${o.why || o.line}`));
    console.log(dim(`  ${o.line}`));
    if (!line) console.log(dim("  (the hook did not rewrite this one)"));
  }

  // AND THE LINE THE HOOK WROTE IS THE LINE THAT RUNS — not the one that
  // was typed. That substitution is the thing being demonstrated.
  const out = spawnSync("/bin/sh", ["-c", line ?? o.line], { stdio: "inherit" });
  process.exit(out.status ?? 0);
}

main();
