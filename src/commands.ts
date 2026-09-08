// CAPTURE AND COMPARE — the two gestures a faithful simulator needs.
//
// Reproducing a client's screen is guesswork until somebody puts the
// real one and the copy side by side. These make that cheap enough to do
// every time, instead of once when the doubt gets loud.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { RULES, compare, normalise } from "./pane.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

/**
 * A REAL SCREEN, FROM A REAL PANE.
 *
 * `tmux capture-pane` is what the clients themselves are watched with,
 * so it is what a copy has to stand next to. Without a target it takes
 * the pane it is run in — which is almost never the one you want, so it
 * says so rather than silently capturing itself.
 */
export function capture(target: string | undefined, out: string | undefined): number {
  const args = ["capture-pane", "-p"];
  if (target) args.push("-t", target);
  const run = spawnSync("tmux", args, { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    console.error(`simcli: tmux capture-pane failed: ${run.stderr?.trim() || run.error?.message}`);
    console.error("  is tmux running, and is the target right? `tmux list-panes -a`");
    return 2;
  }
  const text = run.stdout.replace(/\s+$/, "") + "\n";
  if (out) {
    writeFileSync(out, text);
    console.error(dim(`captured ${text.split("\n").length - 1} lines${target ? ` from ${target}` : " from this pane"} → ${out}`));
  } else {
    process.stdout.write(text);
  }
  return 0;
}

/**
 * THE REAL ONE AGAINST THE COPY.
 *
 * `missing` is the answer: what the real screen has that the copy does
 * not. `invented` is the other half and matters less — a copy may carry
 * chrome the capture cropped away.
 *
 * THE RULES ARE PRINTED. A normaliser that masks enough makes any two
 * screens match, so the only honest version of this shows what it erased
 * before showing what survived.
 */
export function compareFiles(realPath: string, playedPath: string, verbose: boolean): number {
  let real: string, played: string;
  try {
    real = readFileSync(realPath, "utf8");
    played = readFileSync(playedPath, "utf8");
  } catch (e) {
    console.error(`simcli: ${(e as Error).message}`);
    return 2;
  }

  console.log(dim("masked before comparing — anything else counts as drift:"));
  for (const r of RULES) console.log(dim(`  ${r.name}`));
  console.log();

  const v = compare(real, played);
  const total = v.shared + v.missing.length;

  if (v.drifted.length) {
    console.log(`${v.drifted.length} line(s) reached but not right:`);
    for (const d of v.drifted) {
      console.log(`  real   ${d.real}`);
      console.log(`  played ${d.played}`);
      console.log(dim(`         ${Math.round(d.likeness * 100)}% of the words in common`));
    }
    console.log();
  }
  if (v.missing.length) {
    console.log(red(`${v.missing.length} line(s) the real screen has and the copy does not:`));
    for (const line of v.missing) console.log(`  ${line}`);
    console.log();
  }
  if (v.invented.length) {
    console.log(dim(`${v.invented.length} line(s) only the copy has — chrome, or a crop in the capture:`));
    for (const line of v.invented) console.log(dim(`  ${line}`));
    console.log();
  }

  // EXACT AND DRIFTED ARE COUNTED APART. Lumping them says "0%" for a
  // screen that is recognisably the same one, which reads as "absent"
  // and sends somebody to rebuild what only needed adjusting.
  const share = total ? Math.round((v.shared / total) * 100) : 0;
  console.log(
    `${v.shared} of ${total} real lines exact (${share}%)` +
      (v.drifted.length ? `, ${v.drifted.length} drifted` : "") +
      (v.missing.length ? `, ${v.missing.length} absent` : ""),
  );
  if (!v.missing.length && !v.drifted.length) console.log(green("faithful"));

  if (verbose) {
    console.log(dim("\nnormalised, real:"));
    for (const l of normalise(real)) console.log(dim(`  ${l}`));
    console.log(dim("\nnormalised, played:"));
    for (const l of normalise(played)) console.log(dim(`  ${l}`));
  }

  // NON-ZERO WHEN SOMETHING IS MISSING, so this can gate a build. A
  // comparison nobody can fail is a comparison nobody reads.
  // ABSENT FAILS; DRIFTED WARNS. A build should stop when the copy is
  // missing a screen, not when a bar is ten blocks wide — one is work
  // undone, the other is work to finish.
  return v.missing.length === 0 ? 0 : 1;
}
