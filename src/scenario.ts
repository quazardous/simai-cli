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
//         paste                 (or `type`, the default — see below)
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
  /** Appear at once instead of being typed out. */
  paste?: boolean;
};

export function parse(text: string): Beat[] {
  const beats: Beat[] = [];
  let pending = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().startsWith("#")) continue;
    // A BLANK LINE INSIDE AN ANSWER IS A PARAGRAPH BREAK, and dropping
    // it turns two written paragraphs into one wall. It cannot be
    // recognised by indentation — a blank line has none — so it is held
    // until the next line says whether it belonged to an answer.
    if (!line.trim()) {
      pending = beats.length > 0 && beats[beats.length - 1]!.answer !== undefined;
      continue;
    }

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
      // DIRECTIVES ONLY BEFORE THE ANSWER STARTS, so a written answer
      // can contain the word "paste" without becoming one.
      if (!last.answer) {
        const think = /^think\s+([\d.]+)$/.exec(body);
        if (think) {
          last.think = Number(think[1]);
          continue;
        }
        // HOW THE LINE ARRIVES. A command pasted from somewhere reads
        // differently from one somebody typed, and a demo that types a
        // sixty-character path is a demo nobody watches to the end.
        if (body === "paste" || body === "type") {
          last.paste = body === "paste";
          continue;
        }
      }
      last.answer ??= [];
      if (pending) last.answer.push("");
      pending = false;
      last.answer.push(body);
      continue;
    }
    pending = false;
    beats.push({ input: line.trim() });
  }
  return beats;
}
