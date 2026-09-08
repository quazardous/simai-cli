// THE HEADER — a big yellow pacman with a few quiet blue lines behind
// him, printed once above the welcome.
//
// IT IS NOT A SPLASH, and the difference decides the whole design. A
// splash takes the alternate screen, plays, and is gone; this is the top
// of the session, so it stays in the scrollback and rides up as the
// conversation grows — which is also the only version that survives
// being recorded, since anything painted on the alternate screen is
// wiped the moment it is handed back.
//
// So: no alternate screen, no animation, no cursor to restore, nothing
// to undo if the process dies. It prints, and that is all it does.

const CSI = "\x1b[";
const yellow = (s: string) => `${CSI}1;38;5;226m${s}${CSI}0m`;
// DISCREET MEANS DIM. A background at full strength stops being a
// background and starts competing with the thing it sits behind.
const faint = (s: string) => `${CSI}38;5;24m${s}${CSI}0m`;
const pellet = (s: string) => `${CSI}38;5;39m${s}${CSI}0m`;
const dim = (s: string) => `${CSI}2m${s}${CSI}0m`;

/** Drawn, not generated: a big one has to be shaped by hand. */
const PACMAN = [
  "    ▄▄████▄▄    ",
  "  ▄██████████▄  ",
  " ████████▀▀     ",
  "███████▀        ",
  "███████▄        ",
  " ████████▄▄     ",
  "  ▀██████████▀  ",
  "    ▀▀████▀▀    ",
];

const HEIGHT = PACMAN.length;
const SPRITE = PACMAN[0]!.length;

/** A few quiet lines, and the pellets he is heading for. */
function behind(x: number, y: number): string {
  if (y === 3) return x % 8 === 0 ? pellet("●") : " ";
  if (y === 4) return x % 8 === 0 ? pellet("·") : " ";
  if (y === 1 || y === 6) return faint(x % 4 === 0 ? "·" : " ");
  if (y === 0 || y === 7) return faint("─");
  return " ";
}

/**
 * THE HEADER, AS LINES.
 *
 * Returned rather than printed so the caller decides where it goes — and
 * so it can be compared against a capture like any other screen.
 */
export function banner(label: string, columns?: number): string[] {
  // NARROW ON PURPOSE. This is a header, not a poster: on a very wide
  // terminal a full-width band of dots reads as noise rather than
  // decoration, and the eye stops finding the pacman in it.
  const cols = Math.max(40, Math.min(columns ?? process.stdout.columns ?? 80, 76));
  const x0 = 2;
  const out: string[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    const cells: string[] = [];
    for (let x = 0; x < cols; x++) {
      // THE SPRITE'S BOUNDING BOX WINS, blanks included — otherwise the
      // background shows through the gap the mouth opens and the pacman
      // reads as a stencil.
      const sx = x - x0;
      if (sx >= 0 && sx < SPRITE) {
        const ch = PACMAN[y]![sx]!;
        cells.push(ch === " " ? " " : yellow(ch));
        continue;
      }
      cells.push(behind(x, y));
    }
    out.push(cells.join("").replace(/\s+$/, ""));
  }
  out.push("");
  out.push(dim(`  ${label}`));
  return out;
}
