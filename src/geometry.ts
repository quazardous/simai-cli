// THE SIZE THE RECORDING IS MADE AT.
//
// A capture inherits the window it was taken in, and a demo filmed in a
// 212-column terminal makes a GIF nobody can read. So the geometry is
// something the user states rather than something the session happens
// to have — and stating it once here means the banner, the wrapping and
// the cast header all agree, instead of each asking the terminal.
//
// FORCING A SIZE LARGER THAN THE REAL WINDOW CORRUPTS THE RECORDING:
// every line long enough wraps in the real terminal, and the wrap is
// captured as output the player will wrap again. That is worth a warning
// rather than a silent bad file, because the damage is invisible until
// somebody watches the result.

/**
 * NAMED SIZES, BECAUSE NOBODY REMEMBERS THE NUMBERS.
 *
 * By magnitude rather than by destination: `small` is guessable and
 * `social` is a thing you have to be told. `default` is not decoration —
 * a recording made with no size stated uses it, so the name is true.
 */
export const PRESETS: Record<string, [number, number]> = {
  // The terminal everyone's terminal used to be. Safe anywhere.
  small: [80, 24],
  // Fits the text column of a rendered README without being downscaled.
  default: [100, 28],
  medium: [120, 32],
  // Room for a wide transcript; needs a real screen to be read on.
  big: [160, 40],
};

export function force(spec: string): { cols: number; rows: number } | null {
  const named = PRESETS[spec.trim().toLowerCase()];
  const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(spec.trim());
  if (!named && !m) return null;
  const [cols, rows] = named ?? [Number(m![1]), Number(m![2])];

  // IT HAS TO COMPLAIN WHEN THE WINDOW IS TOO SMALL, and complain about
  // BOTH axes. Too few columns and every long line wraps in the real
  // terminal — the wrap is then captured as output and the player wraps
  // it again, so the recording is damaged in a way nobody sees until
  // they watch it. Too few rows and the session scrolls where the
  // recording says it should not have.
  //
  // A WARNING, NOT A REFUSAL: the recording is still usable, sometimes
  // deliberately, and a demo tool that will not run in the window you
  // have is worse than one that tells you what it will cost.
  // WITHOUT A TERMINAL THE REAL SIZE IS UNKNOWN, and falling back to the
  // requested one makes the comparison a no-op rather than a false alarm.
  const realCols = process.stdout.columns ?? cols;
  const realRows = process.stdout.rows ?? rows;
  if (cols > realCols || rows > realRows) {
    const short = [
      cols > realCols ? `${cols - realCols} columns` : "",
      rows > realRows ? `${rows - realRows} rows` : "",
    ].filter(Boolean).join(" and ");
    console.error(
      `simcli: this window is ${realCols}x${realRows}, the recording asks for ${cols}x${rows}.\n` +
        `        Short by ${short} — lines will wrap and the cast will keep the wrap.\n` +
        `        Resize the window, or record smaller: --size small (80x24).`,
    );
  }

  // ONE PLACE, NOT EVERY CALL SITE. Everything downstream already reads
  // process.stdout.columns; redefining it here means the banner, the
  // text wrapping and the cast header cannot disagree about the size.
  for (const [key, value] of [["columns", cols], ["rows", rows]] as const) {
    Object.defineProperty(process.stdout, key, { value, configurable: true, writable: true });
  }
  return { cols, rows };
}
