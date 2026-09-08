// TAKING THE TERMINAL, THE WAY VIM DOES.
//
// The whole session runs on the alternate screen buffer: the banner sits
// at the top, the conversation scrolls under it, and when it ends the
// calling terminal comes back exactly as it was — no eight-screen
// pacman left in somebody's scrollback.
//
// THE RELEASE IS WIRED BEFORE THE FIRST ESCAPE IS WRITTEN, and to every
// way out rather than to the happy one. A program that exits leaving the
// alternate buffer up, or the cursor hidden, has broken the terminal of
// somebody who only wanted to look at a demo — and they will not know
// what did it. `reset` is a fix nobody should have to know.

const CSI = "\x1b[";

export type Release = () => void;

/**
 * Enter the alternate screen; the returned call leaves it.
 *
 * Without a terminal this does nothing at all and says so by returning a
 * no-op: a piped or recorded run wants plain lines, and cursor motion in
 * a log helps nobody read it.
 */
export function takeTerminal(): Release {
  if (!process.stdout.isTTY) return () => {};

  let released = false;
  const release: Release = () => {
    if (released) return;
    released = true;
    process.stdout.write(`${CSI}?25h${CSI}?1049l`);
  };

  process.on("exit", release);
  // SIGINT and SIGTERM BOTH. Ctrl-C is the expected way out of a demo,
  // and the one most likely to be taken.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      release();
      process.exit(sig === "SIGINT" ? 130 : 143);
    });
  }

  process.stdout.write(`${CSI}?1049h${CSI}H${CSI}2J`);
  return release;
}
