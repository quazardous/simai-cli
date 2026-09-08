// THE CHROME — what each client puts on screen around the work.
//
// Borrowed from busycode (https://github.com/monk-lee/busycode), MIT,
// Copyright (c) 2026 MonkLabs. See THIRD-PARTY.md. busycode is a browser
// app: it draws these clients in a web page and cannot run a command.
// What it does carry is a couple of hundred lines of *observed decor* —
// the frames, the banners, the grammar of a tool call — and that is the
// slow part to gather.
//
// BORROWED IS NOT MEASURED, AND THE DIFFERENCE IS THE POINT. Every
// dialect in `dialects.ts` was read in its client's own reference. None
// of what follows was: it is one developer's rendering of a screen,
// second-hand. So each block carries `provenance`, and the honest way to
// promote a block from `borrowed` to `measured` is `simcli capture` on
// the real client and `simcli compare` against what this plays — not a
// closer reading of the constant.
//
// AND THE TWO SETS DO NOT LINE UP. busycode draws Codex and OpenCode,
// which speak no hook dialect here; this program speaks Droid, Cursor
// and Copilot, which busycode never drew. Only Claude and Gemini have
// both. `chrome()` returns undefined for the rest, on purpose — playing
// a client's protocol in another client's clothes would make a demo that
// lies about which one it proved.

export type Provenance = "borrowed" | "measured";

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
  provenance: Provenance;
  /** Where it came from, so a reader can go and check. */
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
  /** A turn worth playing. */
  timeline?: Step[];
};

// ── Claude Code ──────────────────────────────────────────────────────
// MEASURED, AND IT DID NOT AGREE. This block began as busycode's, and
// `simcli capture` against four independent real panes on 08/09/2026
// contradicted most of it: busycode hangs tool results off `└`, where
// Claude Code prints `⎿`; it shows a present-tense `Symbioting…` where
// the real screen shows a finished `✻ Cogitated for 1m 13s · done
// 15:52`; it draws a `Model: … | Context: [████░░░]` status bar that
// never appears at all. What follows is the four panes, not the copy.
//
// That is what `borrowed` was there to warn about — a rendering of a
// screen is not the screen, and only a capture can tell them apart.
const claude: Chrome = {
  label: "Claude Code",
  provenance: "measured",
  source: "tmux panes %1 %4 %5 %7, four live sessions, 08/09/2026",
  // ✻ IS REAL AND THE OTHER THREE ARE NOT VERIFIED. The captures only
  // ever caught the settled frame; the cycle is busycode's and stays
  // marked as such rather than being quietly promoted alongside it.
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  thinking: ["✻", "✳", "✢", "·"],
  status: [
    "  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents                          new task? /clear to save 404.6k tokens",
  ],
  timeline: [
    {
      title: "● Poussé sur les deux dépôts. Je clos le ticket.",
      lines: ["  Called aiball (ctrl+o to expand)"],
      status: "✻ Baked for 2m 19s · done 13:30",
      duration: 139000,
    },
    {
      title: "● Le bloqueur est #1793. Je vais voir là plutôt que de reposer sur #1795.",
      lines: ["  Called aiball 2 times (ctrl+o to expand)"],
      status: "✻ Cogitated for 1m 13s · done 15:52",
      duration: 73000,
      thinking: true,
    },
    {
      title: "● Vérifié plutôt que concédé, et le contrôle a sorti plus que la question posée.",
      lines: [
        "  ⎿  482feb9 Le mot « annonces » de l'en-tête mentait — 8,4 points d'unité",
        "  ⎿  Allowed by auto mode classifier",
        "     … +6 lines (ctrl+o to expand)",
      ],
      status: "✻ Crunched for 14m 3s · done 11:05",
      duration: 843000,
    },
  ],
};

// ── Gemini CLI ───────────────────────────────────────────────────────
const gemini: Chrome = {
  label: "Gemini CLI",
  provenance: "borrowed",
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
  provenance: "borrowed",
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
      status: "⠋ Working",
      duration: 850,
    },
    {
      title: "• Ran sed -n 1,220p src/App.tsx",
      lines: ["Reading React state machine and keyboard event routing", "  … +41 lines", "  ✓ • 1.4s"],
      status: "⠋ Working",
      duration: 1600,
    },
    {
      title: "• Ultra Thinking",
      lines: [
        "Reconciling fake productivity, real TUI constraints, and suspiciously urgent vibes",
        "  Considering whether the composer should move or the viewport should follow it",
        "  Holding context open while pretending this is computationally expensive",
      ],
      status: "⠋ Ultra Thinking",
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
  provenance: "borrowed",
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
