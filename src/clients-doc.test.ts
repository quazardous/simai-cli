import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clientsDoc } from "./clients-doc.js";

test("CLIENTS.md still matches the table it documents", () => {
  // A page of hand-copied JSON goes stale the first time a field moves,
  // and says nothing: the reader follows it, wires a hook against the
  // old shape, and gets silence — the exact failure this tool exists to
  // catch, committed by its own documentation.
  const onDisk = readFileSync(new URL("../CLIENTS.md", import.meta.url), "utf8");
  assert.equal(onDisk, clientsDoc(), "CLIENTS.md is out of date — run `npm run docs`");
});

test("the page carries no machine-specific path", () => {
  // `payload()` embeds `process.cwd()`, so the generated page used to
  // carry whichever machine last ran `npm run docs` — an author's home
  // directory published in a public repository, and a guard that could
  // only pass on that one machine. CI was red four times for it, unread.
  const page = clientsDoc();
  assert.ok(!page.includes(process.cwd()), "the generating machine's path is in the page");
  assert.ok(page.includes('"cwd": "/home/you/project"'), "the example path is what should be shown");
});
