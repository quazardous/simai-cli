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
