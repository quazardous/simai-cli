// WHAT COUNTS AS A DIRECTIVE, AND WHAT IS JUST TEXT.
//
// The format has one rule and it is decided silently: indentation binds
// a line to the one above, and `think` / `paste` / `type` are directives
// ONLY before any answer text has started. A scenario that quietly loses
// a paragraph — or quietly eats a sentence that happened to begin with
// "paste" — still runs, which is the worst way for a demo to break.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "./scenario.js";

test("a plain list of lines is a plain list of beats", () => {
  const beats = parse("first\n/run ls\n/exit\n");
  assert.deepEqual(beats.map((b) => b.input), ["first", "/run ls", "/exit"]);
  assert.ok(beats.every((b) => b.answer === undefined));
});

test("comments and blank lines are not beats", () => {
  const beats = parse("# a note\n\n  \nreal line\n");
  assert.deepEqual(beats.map((b) => b.input), ["real line"]);
});

test("indented lines belong to the line above", () => {
  const beats = parse("why?\n    because.\n    and also this.\n");
  assert.equal(beats.length, 1);
  assert.deepEqual(beats[0]!.answer, ["because.", "and also this."]);
});

test("`think` sets the pause and does not become an answer line", () => {
  const beats = parse("why?\n    think 5\n    because.\n");
  assert.equal(beats[0]!.think, 5);
  assert.deepEqual(beats[0]!.answer, ["because."]);
});

test("`paste` and `type` decide how the line arrives", () => {
  assert.equal(parse("/run ls\n    paste\n")[0]!.paste, true);
  assert.equal(parse("/run ls\n    type\n")[0]!.paste, false);
  assert.equal(parse("/run ls\n")[0]!.paste, undefined, "unsaid stays unsaid, so the session decides");
});

test("a directive AFTER the answer starts is answer text", () => {
  // THE RULE THAT IS ONLY IN THE CODE. An answer is prose, and prose
  // contains the words `paste` and `think`. Reading them as directives
  // wherever they appear would delete a sentence from a demo and leave
  // it running, with nothing to say what happened.
  const beats = parse("why?\n    Because it waits.\n    paste\n    think 5\n");
  assert.deepEqual(beats[0]!.answer, ["Because it waits.", "paste", "think 5"]);
  assert.equal(beats[0]!.paste, undefined);
  assert.equal(beats[0]!.think, undefined);
});

test("`think` wants a number, and anything else is text", () => {
  const beats = parse("why?\n    think about it\n");
  assert.deepEqual(beats[0]!.answer, ["think about it"]);
  assert.equal(beats[0]!.think, undefined);
});

test("an indented line with nothing above it is dropped, loudly", () => {
  // Silently swallowing it is how a scenario loses its first paragraph
  // and still plays.
  const said: string[] = [];
  const error = console.error;
  console.error = (m: unknown) => said.push(String(m));
  try {
    assert.deepEqual(parse("    orphan\nreal\n").map((b) => b.input), ["real"]);
  } finally {
    console.error = error;
  }
  assert.ok(said.some((m) => m.includes("orphan")), "the dropped line is named");
});

test("indentation is the syntax, so a typed line cannot be indented", () => {
  // Written the other way round first, expecting `  spaced out  ` to be
  // a beat. It is not, and the code was right: leading whitespace means
  // "belongs to the line above", with no exception for the case where
  // there is no line above. Trailing whitespace is trimmed either way.
  const said: string[] = [];
  const error = console.error;
  console.error = (m: unknown) => said.push(String(m));
  try {
    assert.deepEqual(parse("  spaced out  \n"), [], "an indented first line is not a beat");
  } finally {
    console.error = error;
  }
  assert.deepEqual(parse("spaced out  \n").map((b) => b.input), ["spaced out"]);
});

test("a blank line inside an answer is a paragraph break", () => {
  // Dropping it turns two written paragraphs into one wall of text. It
  // cannot be spotted by indentation — a blank line has none — so it is
  // held until the next line says whether it belonged to an answer.
  const beats = parse("why?\n    first thought.\n\n    second one.\n");
  assert.deepEqual(beats[0]!.answer, ["first thought.", "", "second one."]);
});

test("a blank line BETWEEN beats is not a paragraph break", () => {
  // The same character sequence, meaning the opposite thing. Scenarios
  // are written with blank lines between beats for readability, and
  // carrying those into the next answer would open every one with a gap.
  const beats = parse("first\n    an answer.\n\nsecond\n    another.\n");
  assert.deepEqual(beats[1]!.answer, ["another."]);
});
