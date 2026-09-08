// WHAT THE TIMELINE REWRITER MUST NOT GET WRONG.
//
// `even()` carries two subtleties that have already turned on me once
// each, and both failed SILENTLY — the output looked plausible and was
// wrong. That is exactly what a test is for, and why these are built
// from synthetic timelines rather than from a recorded session: a
// session has to be performed again to be re-checked, and it cannot be
// made to contain the awkward case on purpose.

import { test } from "node:test";
import assert from "node:assert/strict";
import { even, window as windowOf, scale, retime, type Item } from "./cast.js";

const out = (at: number, text: string): Item => ({ at, kind: "out", text });
const phase = (at: number, p: "human" | "machine"): Item => ({ at, kind: "phase", phase: p });
const typed = (at: number, text: string): Item => ({ at, kind: "typed", text });

/** The time of the last thing printed. */
const ends = (items: Item[]) => items.filter((i) => i.kind === "out").at(-1)!.at;
const text = (items: Item[]) =>
  items.filter((i): i is Extract<Item, { kind: "out" }> => i.kind === "out").map((i) => i.text).join("");

test("a machine gap is never rewritten, however long", () => {
  // The longest silence in a real recording is a command running, and it
  // IS the demonstration. A normaliser that flattens the biggest number
  // it finds destroys the only thing worth filming.
  const items: Item[] = [out(0, "start"), phase(0.1, "machine"), out(30.1, "detached")];
  const done = even(items);
  assert.equal(ends(done), 30.1, "the 30s a command took must survive untouched");
});

test("a human gap is capped", () => {
  const items: Item[] = [out(0, "❯ "), phase(0.01, "human"), out(11, "x"), phase(11.01, "machine")];
  const done = even(items);
  assert.ok(ends(done) < 1, `eleven seconds of deciding should not survive, got ${ends(done)}`);
});

test("a gap belongs to the phase DURING it, not to the event that ends it", () => {
  // Six seconds of a person deciding, then a command. The silence is
  // human even though the next thing printed happens under the machine.
  //
  // NOTE, HONESTLY: this does not guard the bug that actually happened.
  // That one lived in the RECORDER — it stamped each event with the
  // phase current at write time, and by then the session had flipped
  // back — so `even()` never saw the human stretch at all. Sabotaging
  // the attribution here leaves every test green, which is how that was
  // found out. The recorder-level test below is the one that holds it.
  const items: Item[] = [
    phase(0, "human"),
    typed(6, "/run build"), // submitted after six seconds of silence
    phase(6.01, "machine"),
    out(6.02, "● Bash(build)"),
  ];
  const done = even(items, false);
  assert.ok(ends(done) < 1.5, `the six seconds before the command are human, got ${ends(done)}`);
});

test("both kinds of gap in one timeline, and only one is touched", () => {
  const items: Item[] = [
    phase(0, "human"),
    typed(8, "/run sleep 60"),
    phase(8.01, "machine"),
    out(8.02, "● Bash"),
    out(38.02, "detached"), // thirty seconds of command
  ];
  const done = even(items, false);
  const printed = done.filter((i) => i.kind === "out");
  const machineGap = printed[1]!.at - printed[0]!.at;
  assert.ok(Math.abs(machineGap - 30) < 0.01, `the command's 30s must be intact, got ${machineGap}`);
  assert.ok(ends(done) < 32, "and the human wait must not be");
});

test("retyping replaces whatever the editor echoed", () => {
  // A line editor emits a backspace, or a space and a backspace, or a
  // redraw. Filtering that out of a stream is guesswork; knowing what
  // was submitted is not.
  const items: Item[] = [
    phase(0, "human"),
    out(0.1, "/run sleepp"),
    out(0.5, "\b"),
    out(0.6, " 20"),
    typed(0.7, "/run sleep 20"),
    phase(0.71, "machine"),
    out(0.72, "● Bash"),
  ];
  assert.ok(text(even(items, true)).includes("❯ /run sleep 20"), "the submitted line is re-typed");
  assert.ok(!text(even(items, true)).includes("\b"), "and the backspace is gone");
});

test("--keep-typos keeps the echo exactly as it was written", () => {
  // Sometimes the correction IS the demo: showing that a wrong command
  // can be taken back. Losing it because the pauses were evened out
  // would be the tool deciding what the recording is about.
  const items: Item[] = [
    phase(0, "human"),
    out(0.1, "sleepp"),
    out(0.5, "\b"),
    typed(0.7, "sleep"),
    phase(0.71, "machine"),
  ];
  assert.ok(text(even(items, false)).includes("\b"), "the backspace stays");
});

test("the marks survive a pass, so a cast can be treated twice", () => {
  // Normalising a file that has already lost its marks is impossible:
  // nothing left in it says which silence was a person's.
  const items: Item[] = [phase(0, "human"), typed(3, "hi"), phase(3.1, "machine"), out(3.2, "x")];
  const once = even(items);
  assert.ok(once.some((i) => i.kind === "phase"), "phase marks are carried through");
  assert.ok(once.some((i) => i.kind === "typed"), "and so is the submitted line");
  // And a second pass changes nothing more — it is already even.
  assert.equal(ends(even(once)), ends(once));
});

test("timestamps never go backwards", () => {
  // A player reads them in order; one that steps back is a corrupt file,
  // and the arithmetic here is the kind that can produce one.
  const items: Item[] = [
    phase(0, "human"),
    out(0.1, "a"),
    out(9, "bb"),
    typed(9.1, "hello world"),
    phase(9.2, "machine"),
    out(9.3, "x"),
    out(12, "y"),
  ];
  let last = -1;
  for (const i of even(items)) {
    assert.ok(i.at >= last, `time went backwards at ${i.at} after ${last}`);
    last = i.at;
  }
});

// ── The recorder ─────────────────────────────────────────────────────

test("the recorder puts phase changes on the timeline, not on the events", async () => {
  // THE BUG THAT ACTUALLY HAPPENED, and the level it happened at. If a
  // transition is not its own entry, the interval it governs cannot be
  // recovered afterwards: `even()` gets a stream of events each claiming
  // a phase, and the six seconds before the first of them belong to
  // whatever that first event says — which is the wrong answer whenever
  // the phase changed during the silence, i.e. every single time.
  const { record, mark, typed } = await import("./cast.js");
  const { mkdtempSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const path = join(mkdtempSync(join(tmpdir(), "simcli-")), "t.cast");
  const stop = record(path, "test");
  mark("human");
  typed("hello");
  mark("machine");
  process.stdout.write("out");
  stop();

  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).slice(1);
  const codes = lines.map((l) => (JSON.parse(l) as [number, string, string])[1]);
  assert.ok(codes.includes("m"), "phase transitions are recorded as their own events");
  assert.ok(codes.includes("i"), "and so is the line that was submitted");
  // Two transitions were marked; both must be there, in order.
  assert.equal(codes.filter((c) => c === "m").length, 2, "each transition, not just the last");
});

// ── Trimming and pacing ──────────────────────────────────────────────

test("a window starts at zero", () => {
  // Keeping the original timestamps leaves a player staring at a blank
  // screen for as long as was trimmed, and every later treatment is
  // computed over time nobody kept: trimming 12s off a 23s cast gave 19.
  const items: Item[] = [out(0, "a"), out(12, "b"), out(23, "c")];
  const done = windowOf(items, 12);
  assert.equal(done[0]!.at, 0);
  assert.equal(ends(done), 11);
});

test("what happened before the window is kept, collapsed", () => {
  // A terminal recording is instructions, not pictures. Dropping the
  // head loses the banner, the colours it set, and whatever moved the
  // cursor — and every frame after is drawn on the wrong screen.
  const items: Item[] = [out(0, "\x1b[32m"), out(1, "banner"), out(12, "later")];
  const done = windowOf(items, 12);
  assert.ok(text(done).startsWith("\x1b[32mbanner"), "the earlier output is still there");
  assert.equal(done.filter((i) => i.kind === "out").length, 2, "but in one instant, not two");
});

test("speed multiplies what is left, and only that", () => {
  const items: Item[] = [out(0, "a"), out(10, "b")];
  assert.equal(ends(scale(items, 2)), 5);
  assert.equal(ends(scale(items, 1)), 10, "1 changes nothing");
  assert.equal(ends(scale(items, 0)), 10, "and neither does 0, rather than dividing by it");
});

test("trimming then speeding composes the way it reads", () => {
  // Window first: there is no point evening out a stretch about to be
  // thrown away, and capping first would move the timestamps the trim is
  // expressed in.
  const items: Item[] = [out(0, "a"), out(12, "b"), out(24, "c")];
  assert.equal(ends(retime(items, { from: 12, speed: 2 })), 6);
});

test("input can be re-typed or pasted, decided at conversion", () => {
  const items: Item[] = [
    phase(0, "human"),
    out(0.1, "junk"),
    typed(0.5, "ls -la"),
    phase(0.6, "machine"),
    out(0.7, "x"),
  ];
  const asTyped = even(items, true, "type");
  const asPasted = even(items, true, "paste");
  assert.ok(text(asTyped).includes("❯ ls -la"));
  assert.ok(text(asPasted).includes("❯ ls -la"));
  // Same words, different number of events: typed arrives letter by
  // letter, pasted in one.
  assert.ok(
    asTyped.filter((i) => i.kind === "out").length > asPasted.filter((i) => i.kind === "out").length,
    "typing costs one event per character; pasting costs one",
  );
});
