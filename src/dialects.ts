// WHAT EACH AGENT CLI SENDS A HOOK, AND WHERE IT LOOKS FOR THE ANSWER.
//
// This is the same table a hook keeps, read from the other side. A hook
// answers payloads; simcli sends them. Neither can be checked against
// the other by reading — that is the whole reason this exists.
//
// Every shape was read in the client's own reference. It matters more
// than it sounds: a widely used proxy watches for `Bash` on Cursor,
// Droid and Copilot, where their references say `Shell`, `Execute` and
// `bash`. A hook watching the wrong name answers nothing and looks
// perfectly installed, which is the failure this tool exists to catch.

export type Dialect = {
  /** What to type: `simcli --as <name>`. */
  name: string;
  /** A human name, for the chrome. */
  label: string;
  /** What this client calls the tool that runs a shell line. */
  tool: string;
  /** The event name it sends for "before a tool runs". */
  event: string;
  /** The two keys it puts the tool name and arguments under. */
  keys: { tool: string; input: string };
  /** Where the rewritten command comes back, as a path. */
  answer: string[];
};

export const DIALECTS: Dialect[] = [
  {
    name: "claude",
    label: "Claude Code",
    tool: "Bash",
    event: "PreToolUse",
    keys: { tool: "tool_name", input: "tool_input" },
    answer: ["hookSpecificOutput", "updatedInput", "command"],
  },
  {
    name: "gemini",
    label: "Gemini CLI",
    // NOT `Bash`. And its answer merges into the model's arguments
    // rather than replacing them, so a field left out survives here and
    // is deleted under Claude.
    tool: "run_shell_command",
    event: "BeforeTool",
    keys: { tool: "tool_name", input: "tool_input" },
    answer: ["hookSpecificOutput", "tool_input", "command"],
  },
  {
    name: "droid",
    label: "Factory Droid",
    tool: "Execute",
    event: "PreToolUse",
    keys: { tool: "tool_name", input: "tool_input" },
    answer: ["hookSpecificOutput", "updatedInput", "command"],
  },
  {
    name: "cursor",
    label: "Cursor",
    // `preToolUse`, not `beforeShellExecution` — that one's reference
    // says its output "does not support modifying the command itself".
    tool: "Shell",
    event: "preToolUse",
    keys: { tool: "tool_name", input: "tool_input" },
    answer: ["updated_input", "command"],
  },
  {
    name: "copilot",
    label: "GitHub Copilot CLI",
    // Its own format, not the Claude-compatible one: camelCase keys, a
    // lowercase tool, and the rewrite at the top level.
    tool: "bash",
    event: "preToolUse",
    keys: { tool: "toolName", input: "toolArgs" },
    answer: ["modifiedArgs", "command"],
  },
];

export function dialect(name: string): Dialect | undefined {
  return DIALECTS.find((d) => d.name === name);
}

/** The payload this client would really send for one shell line. */
export function payload(d: Dialect, line: string, why: string, cwd = process.cwd()): unknown {
  return {
    hook_event_name: d.event,
    session_id: "simcli",
    // OVERRIDABLE BECAUSE THE DOCUMENTATION EMBEDS IT. Left to
    // `process.cwd()`, the generated CLIENTS.md carried whichever
    // machine last ran `npm run docs` — which put an author's home
    // directory in a public repository, and made the test that guards
    // that page fail on every machine but that one. CI was red four
    // times for it.
    cwd,
    [d.keys.tool]: d.tool,
    [d.keys.input]: { command: line, description: why, timeout: 600000 },
  };
}

/**
 * The rewritten line, or undefined.
 *
 * UNDEFINED IS NOT AN ERROR AND THAT IS THE PROBLEM. A hook that does not
 * recognise a tool answers nothing, and so does a hook watching the wrong
 * name — silence means both "not for me" and "I am misconfigured". Only
 * the caller knows which it expected, which is why `--check` exists.
 */
export function rewritten(d: Dialect, answer: unknown): string | undefined {
  let at: unknown = answer;
  for (const key of d.answer) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return typeof at === "string" ? at : undefined;
}
