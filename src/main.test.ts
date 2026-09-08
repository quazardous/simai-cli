// EVERY SUBCOMMAND THE HELP NAMES ACTUALLY DISPATCHES.
//
// `compare` was deleted by accident and nobody noticed for four
// commits: the help still listed it, and typing it printed the general
// usage — which reads like a mistyped flag, not like a missing verb.
// Nothing failed, because no test ran it.
//
// So this walks the help text itself. A verb added to the help and not
// to the dispatch fails here, and so does one silently removed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const MAIN = new URL("./main.js", import.meta.url).pathname;

/** Run simcli and return whatever it said, on either stream. */
function run(args: string[]): string {
  const r = spawnSync(process.execPath, [MAIN, ...args], { encoding: "utf8", input: "" });
  return (r.stdout ?? "") + (r.stderr ?? "");
}

const HELP_MARKER = "simcli — play an agent CLI at a hook";

test("the help names the verbs, and the verbs exist", () => {
  const help = run(["--nope"]);
  assert.ok(help.includes(HELP_MARKER), "the usage text moved");

  // Every `simcli <word>` in the help that is not a flag or a
  // placeholder is a subcommand somebody will type.
  const named = new Set<string>();
  for (const line of help.split("\n")) {
    const m = /^\s*simcli (\w[\w-]*)/.exec(line);
    if (m?.[1] && m[1] !== "as") named.add(m[1]);
  }
  assert.ok(named.size >= 4, `only found ${[...named]} in the help`);

  for (const verb of named) {
    // Called with no arguments, a real verb complains about ITS OWN
    // arguments. A missing one falls through to the general usage, which
    // is exactly what made the deletion invisible.
    const said = run([verb]);
    assert.ok(
      !said.includes(HELP_MARKER),
      `\`simcli ${verb}\` printed the general usage — the verb is named in the help but not dispatched`,
    );
  }
});

test("an unknown verb is not mistaken for one", () => {
  // The other half: the guard above would pass trivially if everything
  // reached a verb. Something that is not a verb must still reach usage.
  assert.ok(run(["definitely-not-a-verb"]).includes(HELP_MARKER));
});
