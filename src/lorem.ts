// FILLER — what the agent says back.
//
// A bare line in the session is a PROMPT, not a command: you talk, it
// answers. The answer has to be acted, because the one thing this
// program must never do is put invented reasoning on screen in a shape
// that could be mistaken for a model's. Lorem ipsum cannot be mistaken
// for anything. That is the whole reason it is the right filler here and
// a plausible-sounding English paragraph would be the wrong one.
//
// It streams a line at a time because a burst that lands all at once
// reads as a paste, and the wait is half of what the demo is about.

const POOL = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
  "Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.",
];

/** Wrap to a width the way a terminal client does, on word boundaries. */
function wrap(text: string, width: number, indent: string): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      out.push(indent + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(indent + line);
  return out;
}

/**
 * A BURST, IN LINES READY TO PRINT.
 *
 * `seed` makes a scripted demo reproducible: the same scenario file has
 * to play the same way twice, or a recording cannot be re-shot and a
 * comparison against a capture measures the random number generator.
 */
export function burst(sentences: number, width: number, seed: number): string[] {
  // A tiny deterministic generator — nothing here needs a good one, and
  // a dependency for eight sentences of filler would be absurd.
  let x = seed || 1;
  // THE HIGH BITS, NOT THE LOW ONES: an LCG's bottom bits have a period
  // of a handful, so `next() % 8` is the textbook misuse.
  const next = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff), x >>> 16);
  // AND NO SENTENCE TWICE RUNNING, whatever the generator says. The
  // first burst that was read had the same line twice, which looks
  // broken however good the randomness is — so this is enforced rather
  // than left to chance. Filler exists to be glanced at; a glance is
  // exactly what catches a repeat.
  const lines: string[] = [];
  let last = -1;
  for (let i = 0; i < sentences; i++) {
    let pick = next() % POOL.length;
    if (pick === last) pick = (pick + 1) % POOL.length;
    last = pick;
    if (i) lines.push("");
    lines.push(...wrap(POOL[pick]!, width, "  "));
  }
  return lines;
}
