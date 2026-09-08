// COMPARING A REAL SCREEN WITH A PLAYED ONE.
//
// Two terminal screens are never byte-equal: a timer ticks, a percentage
// moves, a session was saved four minutes ago instead of one. Diffing
// them raw reports every line as changed and says nothing.
//
// So the text is normalised first. THAT IS THE DANGEROUS PART, and the
// reason every rule is listed rather than buried: a normaliser that
// masks enough makes any two screens match, and a comparison that cannot
// fail proves nothing. Each rule below erases something that genuinely
// differs between two runs of the SAME screen — and nothing else.
//
// WIDTHS ARE KEPT ON PURPOSE. A progress bar is masked to `<bar:40>`,
// not to `<bar>`, because a copy that draws ten blocks where the real
// one draws forty is exactly the kind of drift worth catching. Masking
// the number would have hidden the first real difference this found.

export type Rule = { name: string; what: RegExp; to: string | ((m: string) => string) };

export const RULES: Rule[] = [
  // A progress bar: keep how wide it is, drop how full it is.
  {
    name: "progress bar (width kept)",
    what: /[▰▱█░▓▒]{4,}/g,
    to: (m: string) => `<bar:${[...m].length}>`,
  },
  // Elapsed and remaining times, in the shapes these CLIs print them.
  { name: "elapsed seconds", what: /\b\d+(\.\d+)?s\b/g, to: "<Ns>" },
  { name: "elapsed minutes", what: /\b\d+m\d+s\b/g, to: "<NmNs>" },
  { name: "percentages", what: /\b\d{1,3}%/g, to: "<N%>" },
  // "1 minute ago", "2 days ago", "an hour ago".
  {
    name: "relative dates",
    what: /\b(\d+|an?|a few)\s+(second|minute|hour|day|week|month)s?\s+ago\b/gi,
    to: "<ago>",
  },
  // Sizes a session picker prints.
  { name: "sizes", what: /\b\d+(\.\d+)?\s?[KMG]B\b/g, to: "<size>" },
  // Ticket ids and short hashes — real content, but they move every run.
  { name: "ticket ids", what: /#\d+\b/g, to: "#<id>" },
  { name: "short hashes", what: /\b[0-9a-z]{6}\b(?=[\s.,)]|$)/g, to: "<hash>" },
];

export function normalise(text: string, rules: Rule[] = RULES): string[] {
  return text
    .split("\n")
    .map((line) => {
      let out = line.replace(/\s+$/, "");
      for (const r of rules) {
        out = typeof r.to === "string"
          ? out.replace(r.what, r.to)
          : out.replace(r.what, r.to as (m: string) => string);
      }
      return out;
    })
    .filter((line) => line.length > 0);
}

/**
 * HOW ALIKE TWO LINES ARE, 0 to 1, on their words.
 *
 * Without this a screen that drifted by one glyph and a screen that is
 * simply absent score the same — and the first is a polish job while the
 * second is missing work. Telling them apart is most of what makes a
 * comparison worth reading.
 */
export function likeness(a: string, b: string): number {
  // A BAR IS A BAR WHATEVER ITS WIDTH, for the purpose of asking whether
  // two lines are the same line. The width is kept in the TEXT, because
  // forty blocks against ten is exactly the drift worth showing — but
  // letting it break the pairing would file a line that merely changed
  // size as a line that is missing, and fail a build over a polish job.
  const words = (s: string) =>
    s.replace(/<bar:\d+>/g, "<bar>").split(/\s+/).filter(Boolean);
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  for (const w of x) {
    const at = pool.indexOf(w);
    if (at >= 0) {
      pool.splice(at, 1);
      hit++;
    }
  }
  return (2 * hit) / (x.length + y.length);
}

export type Drift = { real: string; played: string; likeness: number };

export type Verdict = {
  /** In the real screen, absent from the played one. The gap. */
  missing: string[];
  /** In the played screen, absent from the real one. The invention. */
  invented: string[];
  /** Present in both. */
  shared: number;
  /** Lines that are plainly the same one, differing. The polish list. */
  drifted: Drift[];
};

/**
 * WHAT ONE SCREEN HAS THAT THE OTHER DOES NOT.
 *
 * By line and not in order: a simulator is allowed to reach a screen by
 * another route, and demanding the same sequence would report drift that
 * nobody would see. What matters is whether the same things are on
 * screen — and, above all, what is MISSING from the copy.
 */
export function compare(real: string, played: string, rules: Rule[] = RULES): Verdict {
  const a = normalise(real, rules);
  const b = normalise(played, rules);
  const inB = new Map<string, number>();
  for (const line of b) inB.set(line, (inB.get(line) ?? 0) + 1);

  const missing: string[] = [];
  let shared = 0;
  for (const line of a) {
    const left = inB.get(line) ?? 0;
    if (left > 0) {
      inB.set(line, left - 1);
      shared++;
    } else {
      missing.push(line);
    }
  }
  let invented: string[] = [];
  for (const [line, count] of inB) for (let i = 0; i < count; i++) invented.push(line);

  // PAIR WHAT IS OBVIOUSLY THE SAME LINE. A missing line and an invented
  // one that share most of their words are one line that moved, not two
  // separate faults, and reporting them apart doubles the apparent
  // damage while hiding what actually changed.
  const drifted: Drift[] = [];
  const stillMissing: string[] = [];
  for (const line of missing) {
    let best = -1;
    let score = 0;
    invented.forEach((cand, i) => {
      const k = likeness(line, cand);
      if (k > score) {
        score = k;
        best = i;
      }
    });
    if (best >= 0 && score >= 0.5) {
      drifted.push({ real: line, played: invented[best]!, likeness: score });
      invented.splice(best, 1);
    } else {
      stillMissing.push(line);
    }
  }
  return { missing: stillMissing, invented, shared, drifted };
}
