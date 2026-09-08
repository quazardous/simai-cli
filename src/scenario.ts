// A SCENARIO — the same session, with the answers written for it.
//
// The plain form is a list of the lines a person would type, and that is
// still what it is. Anything INDENTED under a line belongs to that line:
// it replaces the filler the session would have invented, so a recording
// can say something instead of saying lorem ipsum.
//
//     # a scenario is comments, typed lines, and answers under them
//
//     explique le détachement
//         think 5
//         Une commande longue ne doit pas immobiliser l'agent.
//         Elle part au fond, et la session continue.
//
//     /run sleep 60; echo built
//     /wait 2
//
// NO NEW LANGUAGE, AND NO DEPENDENCY. Indentation is the only syntax,
// `think` the only directive, and a line with nothing under it behaves
// exactly as it did before. A demo format that has to be learned is a
// demo format that goes stale — and a YAML parser for this would be
// three hundred lines of dependency to express one nesting level.

export type Beat = {
  /** What gets echoed at the prompt and handled. */
  input: string;
  /** Written answer, replacing the generated filler. */
  answer?: string[];
  /** Seconds of visible thinking, overriding the session default. */
  think?: number;
};

export function parse(text: string): Beat[] {
  const beats: Beat[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // INDENTED MEANS IT BELONGS TO THE LINE ABOVE.
    if (/^\s/.test(line)) {
      const last = beats[beats.length - 1];
      // An indented line with nothing above it is a typo worth naming
      // rather than silently dropping — a scenario that quietly loses a
      // paragraph is the worst kind of demo bug, because it still runs.
      if (!last) {
        console.error(`simcli: indented line with no prompt above it: ${line.trim()}`);
        continue;
      }
      const body = line.trim();
      const think = /^think\s+([\d.]+)$/.exec(body);
      if (think && !last.answer) {
        last.think = Number(think[1]);
        continue;
      }
      (last.answer ??= []).push(body);
      continue;
    }
    beats.push({ input: line.trim() });
  }
  return beats;
}
