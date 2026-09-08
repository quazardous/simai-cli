// THE FIVE SHAPES, HELD INDEPENDENTLY OF THE TABLE THAT DECLARES THEM.
//
// A test that reads `DIALECTS` and asserts what it read passes whatever
// the table says, including a typo. That is not a hypothetical: the
// sibling project shipped exactly that guard, and pointing gemini at
// `Bash` sailed through it.
//
// So the shapes below are written out AGAIN, by hand, from each client's
// own reference. The duplication is the point — it is the only thing
// standing between a one-character change and a hook that answers
// nothing while looking perfectly installed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DIALECTS, dialect, payload, rewritten, type Dialect } from "./dialects.js";

/** Read from each client's reference, not from the module under test. */
const REFERENCE = [
  { name: "claude", tool: "Bash", event: "PreToolUse", toolKey: "tool_name", inputKey: "tool_input", answer: "hookSpecificOutput.updatedInput.command" },
  { name: "gemini", tool: "run_shell_command", event: "BeforeTool", toolKey: "tool_name", inputKey: "tool_input", answer: "hookSpecificOutput.tool_input.command" },
  { name: "droid", tool: "Execute", event: "PreToolUse", toolKey: "tool_name", inputKey: "tool_input", answer: "hookSpecificOutput.updatedInput.command" },
  { name: "cursor", tool: "Shell", event: "preToolUse", toolKey: "tool_name", inputKey: "tool_input", answer: "updated_input.command" },
  { name: "copilot", tool: "bash", event: "preToolUse", toolKey: "toolName", inputKey: "toolArgs", answer: "modifiedArgs.command" },
] as const;

test("the table says what the references say, and nothing has drifted", () => {
  assert.equal(DIALECTS.length, REFERENCE.length, "a client was added or removed without touching this test");
  for (const want of REFERENCE) {
    const d = dialect(want.name);
    assert.ok(d, `no dialect named ${want.name}`);
    assert.equal(d!.tool, want.tool, `${want.name}: wrong shell tool`);
    assert.equal(d!.event, want.event, `${want.name}: wrong event`);
    assert.equal(d!.keys.tool, want.toolKey, `${want.name}: wrong tool-name key`);
    assert.equal(d!.keys.input, want.inputKey, `${want.name}: wrong tool-input key`);
    assert.equal(d!.answer.join("."), want.answer, `${want.name}: wrong path to the rewrite`);
  }
});

test("no two clients are the same shape by accident", () => {
  // Claude and Droid genuinely share an envelope; the point is that
  // nobody else quietly collapses onto it after an edit.
  const shapes = DIALECTS.map((d) => `${d.tool}|${d.event}|${d.keys.tool}|${d.answer.join(".")}`);
  const same = shapes.filter((s, i) => shapes.indexOf(s) !== i);
  assert.deepEqual(same, [], `these clients now send identical payloads: ${same.join(", ")}`);
});

test("a payload carries the tool name under that client's own key", () => {
  for (const d of DIALECTS) {
    const sent = payload(d, "ls", "list") as Record<string, unknown>;
    assert.equal(sent[d.keys.tool], d.tool, `${d.name}: the tool name is not where it looks for it`);
    const args = sent[d.keys.input] as Record<string, unknown>;
    assert.equal(args.command, "ls");
    assert.equal(sent.hook_event_name, d.event);
  }
});

test("Copilot's keys are camelCase and nobody else's are", () => {
  // THE ONE MOST LIKELY TO BE COPIED WRONG. Four clients agree on
  // snake_case and the fifth does not; an editor's autocomplete is
  // enough to lose it, and the result is silence.
  const copilot = payload(dialect("copilot")!, "ls", "list") as Record<string, unknown>;
  assert.ok("toolName" in copilot && "toolArgs" in copilot);
  assert.ok(!("tool_name" in copilot), "snake_case leaked into the Copilot payload");
});

/** Build the answer a correctly behaving hook would give this client. */
const answerFor = (d: Dialect, line: string) =>
  d.answer.reduceRight<unknown>((inner, key) => ({ [key]: inner }), line);

test("each client finds its own rewrite", () => {
  for (const d of DIALECTS) {
    assert.equal(rewritten(d, answerFor(d, "jbx run -- ls")), "jbx run -- ls", d.name);
  }
});

test("a client does NOT find another's rewrite", () => {
  // THE DEFECT THIS WHOLE PROGRAM EXISTS FOR, from the other side. A
  // hook that answers in Claude's envelope to a Cursor call has done
  // nothing, and looks like it worked — silence and success are the same
  // shape. If this test ever passes leniently, `--check` stops meaning
  // anything.
  const claude = dialect("claude")!;
  const claudeSays = answerFor(claude, "jbx run -- ls");
  for (const d of DIALECTS) {
    if (d.answer.join(".") === claude.answer.join(".")) continue; // droid shares it, on purpose
    assert.equal(rewritten(d, claudeSays), undefined, `${d.name} accepted Claude's envelope`);
  }
});

test("nothing, or nonsense, is undefined and not a crash", () => {
  // A hook may answer nothing at all, or something that is not JSON of
  // the expected shape. Both mean "no rewrite" and neither may throw:
  // this runs inside a session somebody is watching.
  const d = dialect("claude")!;
  for (const junk of [undefined, null, "", 42, [], {}, { hookSpecificOutput: null }, { hookSpecificOutput: { updatedInput: {} } }]) {
    assert.equal(rewritten(d, junk), undefined, `threw or accepted ${JSON.stringify(junk)}`);
  }
});

test("an unknown client is undefined, not a default", () => {
  // Falling back to Claude would send Claude's payload under another
  // client's name and report success — the exact lie this tool is for.
  assert.equal(dialect("codex"), undefined);
  assert.equal(dialect(""), undefined);
  assert.equal(dialect("CLAUDE"), undefined, "names are exact; a near-miss must not resolve");
});
