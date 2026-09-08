// THE CHROME — what each client puts on screen around the work.
//
// THE AIM IS FLAVOUR, NOT A REPLICA. Nobody needs a second Claude Code;
// what a demo needs is a terminal that reads as the family it claims,
// while the hook call and the command underneath are real. So the thing
// to get right is the GRAMMAR — which glyph carries a tool result, how a
// finished turn signs off, what the footer says — and not the pixel.
//
// Some of it is borrowed from busycode (https://github.com/monk-lee/busycode),
// MIT, Copyright (c) 2026 MonkLabs. See THIRD-PARTY.md. busycode is a
// browser app: it draws these clients in a web page and cannot run a
// command. What it carries, and what was taken, is the observed decor.
//
// Each block says where its shape was seen, because a rendering of a
// screen is not the screen — and the first block checked against a real
// pane came back contradicted. `simcli capture` and `simcli compare` are
// how a `copied` block becomes an `observed` one.
//
// AND THE TWO SETS DO NOT LINE UP. busycode draws Codex and OpenCode,
// which speak no hook dialect here; this program speaks Droid, Cursor
// and Copilot, which busycode never drew. Only Claude and Gemini have
// both. `chrome()` returns undefined for the rest, on purpose — playing
// a client's protocol in another client's clothes would make a demo that
// lies about which one it proved.

export type Shape = "observed" | "copied";

/** One step of an agent turn, as these clients group it on screen. */
export type Step = {
  /** The header line: `Explore(...)`, `Read(src/App.tsx)`, a thought. */
  title: string;
  /** What hangs under it — `└ Read(...)`, `+4 more tool uses …`. */
  lines: string[];
  /** The word next to the spinner while this step runs. */
  status: string;
  /** How long the real client sat on this step, in ms. */
  duration: number;
  /** Extended thinking — drawn differently, and much slower. */
  thinking?: boolean;
};

export type Chrome = {
  label: string;
  shape: Shape;
  /** Where the shape was seen, so a reader can go and check. */
  source: string;
  /** The braille spinner, or whatever this client turns instead. */
  spinner: string[];
  /** A second cycle some clients run for the thinking glyph. */
  thinking?: string[];
  /** The block drawn once at start-up. */
  banner?: string[];
  /** Lines the client offers a new session. */
  tips?: string[];
  /** The bottom row, once running. */
  status?: string[];
  /** What the composer says when empty. */
  placeholder?: string;
  /** Running words, present tense. */
  gerunds?: string[];
  /** The same words once the turn is over, past tense. */
  done?: string[];
  /** A turn worth playing. */
  timeline?: Step[];
};

// ── Claude Code ──────────────────────────────────────────────────────
// THE GRAMMAR IS OBSERVED, THE CONTENT IS WRITTEN — and both halves are
// deliberate. Four live panes on 08/09/2026 settled the shape, and it
// contradicted the rendering this was first copied from: tool results
// hang off `⎿`, not `└`; the line under a finished turn is a past-tense
// `✻ Cogitated for 1m 13s · done 15:52`, not a running `Symbioting…`;
// the `Model: … | Context: [████░░░]` bar does not exist.
//
// What those panes SAID is not reused. They were somebody's real work,
// in a real repository, and transcribing it here would ship real project
// content inside a simulator — meaningless to any other reader and not
// ours to publish. So the sentences below are written, and written about
// the only thing this program exists to demonstrate: a long command
// being taken off the agent's hands.
const claude: Chrome = {
  label: "Claude Code",
  shape: "observed",
  source: "tmux panes %1 %4 %5 %7, four live sessions, 08/09/2026",
  // ✻ IS OBSERVED; THE OTHER THREE ARE NOT. The captures only ever
  // caught the settled frame, so the rest of the cycle stays copied
  // rather than being quietly promoted alongside it.
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  thinking: ["✻", "✳", "✢", "·"],
  // The gerunds are the client's own whimsy and change release to
  // release; these are ones that were seen, not an exhaustive list.
  gerunds: ["Cogitating", "Brewing", "Crunching", "Baking", "Cooking"],
  done: ["Cogitated", "Brewed", "Crunched", "Baked", "Cooked"],
  status: [
    "  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents                          new task? /clear to save 404.6k tokens",
  ],
  timeline: [
    {
      title: "● Reading the test suite before touching it.",
      lines: ["  ⎿  Read(tests/cli.rs)", "     … +2 lines (ctrl+o to expand)"],
      status: "Cogitating",
      duration: 1400,
      thinking: true,
    },
    {
      title: "● The build is the slow part. Running it.",
      lines: [],
      status: "Crunching",
      duration: 900,
    },
  ],
};

// ── Gemini CLI ───────────────────────────────────────────────────────
const gemini: Chrome = {
  label: "Gemini CLI",
  shape: "copied",
  source: "busycode src/App.tsx — geminiHeaderIcon, geminiTips",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  banner: ["▝▜▄  ", "  ▝▜▄", " ▗▟▀ ", "▝▀    "],
  tips: [
    "1. /help for more information",
    "2. Ask coding questions, edit code or run commands",
    "3. Be specific for the best results",
  ],
  status: ["Shift+Tab to accept edits                    ? for shortcuts", "1 AGENTS.md file • 3 MCP servers • 2 skills"],
};

// ── Codex ────────────────────────────────────────────────────────────
// No dialect here — busycode drew it, nothing in this program speaks to
// it. Kept because the decor is the expensive half, and a Codex dialect
// would otherwise arrive with a blank screen.
const codex: Chrome = {
  label: "Codex",
  shape: "copied",
  // The glyphs come from busycode's JSX, not from a capture: it drew
  // them around these constants rather than inside them.
  source: "busycode src/App.tsx — codexTimeline",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  status: ["Working"],
  timeline: [
    {
      title: "• Explored workspace",
      lines: [
        "src/App.tsx, src/App.css, wrangler.jsonc",
        '  Search "useEffect|setInterval" in src',
        "  Read src/App.tsx, src/App.css",
      ],
      status: "Working",
      duration: 850,
    },
    {
      title: "• Ran sed -n 1,220p src/App.tsx",
      lines: ["Reading React state machine and keyboard event routing", "  … +41 lines", "  ✓ • 1.4s"],
      status: "Working",
      duration: 1600,
    },
    {
      title: "• Ultra Thinking",
      lines: [
        "Reconciling fake productivity, real TUI constraints, and suspiciously urgent vibes",
        "  Considering whether the composer should move or the viewport should follow it",
        "  Holding context open while pretending this is computationally expensive",
      ],
      status: "Ultra Thinking",
      duration: 14500,
      thinking: true,
    },
  ],
};

// ── OpenCode ─────────────────────────────────────────────────────────
// Same footing as Codex: decor without a dialect. busycode writes the
// logo with `^` and `~` for `▀` and `_` for a space, and expands it at
// draw time; expanded here instead, so the constant is the screen.
const opencode: Chrome = {
  label: "OpenCode",
  shape: "copied",
  source: "busycode src/App.tsx — openCodeLogo, openCodePlaceholder",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  banner: [
    "                                     ▄     ",
    "█▀▀█ █▀▀█ █▀▀█ █▀▀▄  █▀▀▀ █▀▀█ █▀▀█ █▀▀█",
    "█  █ █  █ █▀▀▀ █  █  █    █  █ █  █ █▀▀▀",
    "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀  ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀",
  ],
  placeholder: "Type a task, @file, or !command",
  status: ["connected  permissions  LSP 3  MCP 3  /status"],
};

export const CHROME: Record<string, Chrome> = { claude, gemini, codex, opencode };

/**
 * THE DECOR FOR A CLIENT, OR NOTHING.
 *
 * Undefined is the right answer for Droid, Cursor and Copilot: their
 * protocol is known here and their screen is not. Falling back to
 * Claude's chrome would produce a demo that looks like proof of a client
 * it never touched.
 */
export function chrome(name: string): Chrome | undefined {
  return CHROME[name.toLowerCase()];
}
