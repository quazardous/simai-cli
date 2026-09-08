// THE SPLASH — it takes the whole terminal, the way vim does, and gives
// it back.
//
// The alternate screen buffer is what makes that possible: everything
// painted there vanishes on exit and the user's scrollback comes back
// untouched. The one rule that matters is that it is ALWAYS given back —
// a program that leaves the alternate buffer up, or the cursor hidden,
// has broken the terminal of somebody who only wanted to look at a
// pacman. So the restore is wired to every way out before the first
// escape is written, not after the animation.
//
// The maze is generated to the terminal's size rather than drawn once,
// because a fixed picture is either cropped on a narrow window or
// stranded in the corner of a wide one.

const W = (s: string) => `\x1b[${s}`;
const ALT_ON = W("?1049h");
const ALT_OFF = W("?1049l");
const HIDE = W("?25l");
const SHOW = W("?25h");
const HOME = W("H") + W("2J");

const blue = (s: string) => `\x1b[38;5;27m${s}\x1b[0m`;
const dot = (s: string) => `\x1b[38;5;223m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[1;93m${s}\x1b[0m`;
const ghost = (s: string, n: number) => `\x1b[1;38;5;${[196, 213, 51, 208][n % 4]}m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/**
 * Tile a pattern out to exactly `width` cells, starting `from` into it.
 *
 * The offset is what stops the two halves being the same picture twice —
 * a maze whose every block lines up reads as wallpaper.
 */
function tile(pattern: string, width: number, from = 0): string {
  const long = pattern.repeat(Math.ceil((width + pattern.length) / pattern.length));
  return long.slice(from, from + width);
}

/** Centre a line of `visible` cells in `width`. */
function pad(width: number, visible: number): string {
  return " ".repeat(Math.max(0, Math.floor((width - visible) / 2)));
}

const WALLS = ["▛▀▀▜ · ", "▙▄▄▟ · "];

/**
 * ONE FRAME OF THE MAZE, with pacman `at` a cell of the corridor.
 *
 * Dots behind him are eaten — a pacman running over an untouched row is
 * the detail that makes it read as a screensaver instead of a game.
 */
function frame(inner: number, at: number, tick: number): string[] {
  const rows: string[] = [];
  rows.push(blue("╔" + "═".repeat(inner) + "╗"));
  rows.push(blue("║") + blue(tile(WALLS[0]!, inner)) + blue("║"));
  rows.push(blue("║") + blue(tile(WALLS[1]!, inner)) + blue("║"));

  const lane: string[] = [];
  for (let i = 0; i < inner; i++) {
    if (i === at) lane.push(yellow(tick % 2 ? "ᗧ" : "○"));
    else if (i === at - 6) lane.push(ghost("ᗣ", tick));
    else if (i === at - 11) lane.push(ghost("ᗣ", tick + 1));
    else if (i < at) lane.push(" ");
    else if (i % 12 === 6) lane.push(dot("●"));
    else if (i % 2 === 0) lane.push(dot("·"));
    else lane.push(" ");
  }
  rows.push(blue("║") + lane.join("") + blue("║"));

  // Offset, not mirrored: the blocks stay closed, the picture does not
  // repeat itself.
  rows.push(blue("║") + blue(tile(WALLS[0]!, inner, 4)) + blue("║"));
  rows.push(blue("║") + blue(tile(WALLS[1]!, inner, 4)) + blue("║"));
  rows.push(blue("╚" + "═".repeat(inner) + "╝"));
  return rows;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * TAKE THE TERMINAL, PLAY, GIVE IT BACK.
 *
 * Without a terminal it prints one static frame inline instead: a
 * scripted run is usually being recorded or piped, and a burst of cursor
 * escapes in a log helps nobody.
 */
export async function splash(label: string): Promise<void> {
  const cols = process.stdout.columns ?? 80;
  const inner = Math.max(24, Math.min(cols - 2, 160)) - 2;

  if (!process.stdout.isTTY) {
    for (const line of frame(inner, Math.floor(inner / 2), 1)) console.log(line);
    console.log(pad(inner, label.length + 4) + dim(`— ${label} —`));
    return;
  }

  // WIRED BEFORE THE FIRST ESCAPE. If anything below throws, or the user
  // interrupts, the terminal is still handed back.
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    process.stdout.write(SHOW + ALT_OFF);
  };
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    process.exit(130);
  });

  try {
    process.stdout.write(ALT_ON + HIDE);
    const rows = process.stdout.rows ?? 24;
    const top = "\n".repeat(Math.max(0, Math.floor((rows - 9) / 2)));
    const left = pad(cols, inner + 2);

    for (let at = 0; at <= inner; at += 2) {
      const body = frame(inner, at, at / 2)
        .map((l) => left + l)
        .join("\n");
      const title = left + pad(inner + 2, label.length + 4) + dim(`— ${label} —`);
      process.stdout.write(HOME + top + body + "\n\n" + title);
      await sleep(28);
    }
    await sleep(260);
  } finally {
    restore();
  }
}
