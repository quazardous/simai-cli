// A SCENE CAPTURED FOR SOMEBODY ELSE'S README.
//
// tvty films seven played agents for its README, piped and without jbx,
// and had to `grep -v` the output and fake a prompt by hand. Each test
// here is one of the frictions it reported, checked the way tvty meets
// it: through the command, piped, with `--hook none`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAIN = new URL("./main.js", import.meta.url).pathname;

/** Play a scene the way tvty does, and return the screen without colour. */
function film(scene: string, extra: string[] = []): string {
  const file = join(mkdtempSync(join(tmpdir(), "simcli-")), "scene.txt");
  writeFileSync(file, scene);
  const r = spawnSync(
    process.execPath,
    [MAIN, "--as", "claude", "--script", file, "--pace", "0", "--think", "0",
     "--inline", "--no-banner", "--hook", "none", ...extra],
    { encoding: "utf8", input: "" },
  );
  return ((r.stdout ?? "") + (r.stderr ?? "")).replace(/\x1b\[[0-9;]*m/g, "");
}

test("--no-banner leaves the session alone, without the welcome", () => {
  const out = film("/run true\n");
  assert.ok(!out.includes("played."), out);
  assert.ok(!out.includes("Type anything"), out);
});

test("a written answer is not echoed, and opens on the bullet", () => {
  const out = film("why?\n    Because.\n");
  assert.ok(!out.includes("You said"), out);
  assert.match(out, /^● Because\.$/m);
});

test("no frozen spinner line when nothing can rewrite it", () => {
  const out = film("why?\n    think 1\n    Because.\n");
  assert.ok(!/…\s*\(\d+s/.test(out), `a spinner frame was printed as text:\n${out}`);
});

test("the result marker hangs on the first line only", () => {
  const out = film("/run printf 'a\\nb\\n'\n");
  assert.match(out, /^ {2}⎿ {2}a$/m);
  assert.match(out, /^ {5}b$/m);
});

test("a tool that runs nothing is drawn, its diff kept indented", () => {
  const out = film("/tool Update src/x.rs\n    Updated src/x.rs\n      1 - old\n      1 + new\n");
  assert.match(out, /^● Update\(src\/x\.rs\)$/m);
  assert.match(out, /^ {2}⎿ {2}Updated src\/x\.rs$/m);
  assert.match(out, /^ {7}1 \+ new$/m, `the diff lost its indentation:\n${out}`);
});

test("--hook none runs the line as it is, and never names jbx", () => {
  const out = film("/run echo ran\n");
  assert.match(out, /ran/);
  assert.ok(!out.includes("jbx"), out);
  assert.ok(!out.includes("did not rewrite"), out);
});

test("--stay ends on an idle prompt, held until the input closes", () => {
  const out = film("/run true\n", ["--stay"]);
  assert.ok(/❯ \s*\nleft the session\./.test(out), `no idle prompt before leaving:\n${out}`);
});
