// THE OUTSIDE TOOLS — lazy, but real.
//
// simcli itself has no runtime dependency: it plays a client, calls a
// hook, runs a line, and writes a cast, all with what Node ships. But
// three of its verbs END somewhere else — a pane it did not open, a GIF
// it cannot draw, a video it cannot encode — and pretending otherwise
// makes the program lie about what it can do.
//
// So they are DECLARED here rather than mentioned in a README: one table
// that both the check and the message read, because an install line that
// drifts from the tool it installs is the specific way this kind of help
// goes stale.
//
// AND THE INSTALL LINE IS NOT HARDCODED TO ONE DISTRIBUTION. The first
// version said `sudo dnf install` to everybody, which on a Debian or a
// Mac is a wrong instruction delivered with confidence — worse than no
// instruction, because it gets tried.

import { existsSync } from "node:fs";

export type Tool = {
  bin: string;
  /** What stops working without it. */
  For: string;
  /** Package name per manager, when it is packaged at all. */
  pkg?: Partial<Record<Manager, string>>;
  /** Used when nothing packages it. */
  fallback?: string;
  /** A second way, when the first needs a toolchain. */
  orElse?: string;
};

export type Manager = "dnf" | "apt-get" | "pacman" | "brew" | "zypper";

const INSTALL: Record<Manager, (pkg: string) => string> = {
  dnf: (p) => `sudo dnf install ${p}`,
  "apt-get": (p) => `sudo apt-get install ${p}`,
  pacman: (p) => `sudo pacman -S ${p}`,
  zypper: (p) => `sudo zypper install ${p}`,
  brew: (p) => `brew install ${p}`,
};

export const TOOLS: Tool[] = [
  {
    bin: "tmux",
    For: "simcli capture — reading a real client's pane",
    pkg: { dnf: "tmux", "apt-get": "tmux", pacman: "tmux", zypper: "tmux", brew: "tmux" },
  },
  {
    bin: "agg",
    For: "turning a .cast into a GIF",
    // NAME THE REPOSITORY, NEVER JUST THE CRATE. `cargo install agg`
    // resolves to an unrelated crates.io library at 0.1.0 with no
    // binary in it, and fails with "there is nothing to install" —
    // which reads like a broken toolchain rather than a wrong name.
    // asciinema's agg is 1.9.0 and lives only in its own repository.
    fallback: "cargo install --locked --git https://github.com/asciinema/agg",
    orElse: "or a prebuilt binary: https://github.com/asciinema/agg/releases",
  },
  {
    bin: "asciinema",
    For: "playing or sharing a .cast",
    pkg: {
      dnf: "asciinema",
      "apt-get": "asciinema",
      pacman: "asciinema",
      zypper: "asciinema",
      brew: "asciinema",
    },
  },
  {
    bin: "ffmpeg",
    For: "turning that GIF into an MP4",
    pkg: { dnf: "ffmpeg", "apt-get": "ffmpeg", pacman: "ffmpeg", zypper: "ffmpeg", brew: "ffmpeg" },
  },
];

export function onPath(bin: string): boolean {
  return (process.env.PATH ?? "").split(":").some((dir) => dir && existsSync(`${dir}/${bin}`));
}

/** The package manager this machine actually has, not the one assumed. */
export function manager(): Manager | null {
  for (const m of Object.keys(INSTALL) as Manager[]) if (onPath(m)) return m;
  return null;
}

/** How to get one tool here, or an honest shrug. */
export function howTo(tool: Tool): string {
  const m = manager();
  const pkg = m && tool.pkg?.[m];
  if (pkg) return INSTALL[m!](pkg);
  if (tool.fallback) return tool.fallback;
  return `install ${tool.bin} however this machine installs things`;
}

/**
 * WHAT IS HERE AND WHAT IS NOT.
 *
 * A verb rather than a paragraph, so the answer is about THIS machine
 * and cannot be out of date.
 */
export function doctor(): number {
  const m = manager();
  console.log("simcli needs nothing to run. These are for what it hands off to:\n");
  let missing = 0;
  for (const t of TOOLS) {
    const here = onPath(t.bin);
    if (!here) missing++;
    console.log(`  ${here ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${t.bin.padEnd(10)} ${t.For}`);
    if (!here) {
      console.log(`    \x1b[2m${howTo(t)}\x1b[0m`);
      if (t.orElse) console.log(`    \x1b[2m${t.orElse}\x1b[0m`);
    }
  }
  console.log(
    `\n\x1b[2m${missing ? `${missing} missing` : "all present"}` +
      `${m ? `, ${m} on this machine` : ", no known package manager found"}\x1b[0m`,
  );
  return 0;
}
