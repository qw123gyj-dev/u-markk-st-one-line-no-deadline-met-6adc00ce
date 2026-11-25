/**
 * One Line, No Deadline Met — deterministic entry picker.
 *
 * Bounty: make.fun `u-markk-st-one-line-no-deadline-met-6adc00ce`
 * ("One Line, No Deadline Met", $2, deadline 2026-11-27T05:35:00Z).
 *
 * The task: write ONE single-line joke that gives an excuse for missing
 * a deadline, capped at 200 characters, to
 * `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`).
 *
 * The judge is a pairwise comedy editor. Its brief, published in full in
 * the kit's RULES.txt, weighs the entries in this exact order:
 *
 *   1. Is a one-line joke that gives an excuse for a missed deadline
 *      (and loses to any one-line excuse for a missed deadline).
 *   2. Finds the funny: a real joke with a turn or a surprise, not a
 *      plain apology or a list of reasons.
 *   3. Fits the one-line form: a single sentence that reads cleanly
 *      aloud and lands its punch at the end.
 *   4. Sounds like something a person would actually say when cornered,
 *      exaggerated just enough to be funny.
 *   5. Is fresh: an angle not heard a hundred times, not a stock
 *      dog-ate-it retread.
 *
 * Length for its own sake does not count, so this scorer never rewards
 * length. Shorter only matters as the final tie-break, after every
 * criterion has been compared in the brief's own order.
 *
 * How this program works:
 *
 *   1. It holds 16 hand-written candidate one-liners below. Every one
 *      was written for this bounty in this session; none is copied from
 *      another entry, a joke site, or the house's fixed texts.
 *   2. It scores each candidate criterion by criterion, in the brief's
 *      order, using small transparent feature checks (listed in the
 *      scoring functions). No randomness, no network, no model call:
 *      the same input always picks the same winner.
 *   3. It sharpens the scores the way a comedy editor would:
 *        - a line that only NAMES a missed deadline without turning it
 *          into a joke is capped, however polished it reads;
 *        - predictable, stock gags (dog ate it, alarm, traffic, Wi-Fi,
 *          Mercury in retrograde) are docked for predictability;
 *        - the twist must land inside the last six words, or the line
 *          loses its criterion-3 score — a punchline buried mid-line
 *          is a punchline the audience never hears;
 *        - a triple escalation earns a point of its own: two setup
 *          clauses that both go right, then the turn subverting them
 *          (the build passed, the tests passed, and the feature never
 *          showed up) is the rule of three, a joke mechanism, not a
 *          plain list of reasons — and the scorer credits it as one;
 *        - ties break criterion by criterion in the brief's order,
 *          then by shorter length, then by candidate order.
 *   4. It writes the winner to entry.txt, reads the file back, and
 *      verifies it byte-for-byte against every gate in RULES.txt:
 *      1-200 characters, a single line, valid UTF-8, not only
 *      whitespace. If any gate fails, it exits non-zero and writes
 *      nothing valid.
 *
 * Runtime: Node 22, standard library only, no network, no dependencies.
 * Run it with:
 *
 *   MAKEFUN_OUTPUT_DIR=/tmp/nodeadline-out node main.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants: the gates, straight from RULES.txt.
// ---------------------------------------------------------------------------

/** Gate: entry.txt must be UTF-8 text of 1 to 200 characters. */
const MIN_CHARS = 1;
const MAX_CHARS = 200;

/** The twist must land inside this many words from the end of the line. */
const PUNCH_WINDOW_WORDS = 6;

/** Where the program writes entry.txt. Overridden by the environment. */
const OUTPUT_DIR =
  process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const ENTRY_PATH = join(OUTPUT_DIR, "entry.txt");

// ---------------------------------------------------------------------------
// Candidates.
// ---------------------------------------------------------------------------

/**
 * One hand-written candidate one-liner.
 *
 * `id` is a stable short label used in the scoring report. `text` is the
 * whole entry: a single line, nothing else. `note` records, in the
 * author's own words, what the joke is trying to do; it is never written
 * to entry.txt and never shown to the judge.
 */
interface Candidate {
  id: string;
  text: string;
  note: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "standup-head",
    text: "I missed the deadline because I did the work in my head during standup, and my laptop is still waiting for the first keystroke.",
    note: "The work happened, just never left the author's head; the laptop waiting for a first keystroke is the surprise.",
  },
  {
    id: "calendar-green",
    text: "I missed the deadline because my calendar auto-completed it, my sprint board went green, and only the code refused to agree.",
    note: "Every tracking tool says done; the code itself is the lone dissenter.",
  },
  {
    id: "last-tuesday",
    text: "Sorry I missed the deadline — the deploy went green, the demo went live, and my calendar still thinks it's last Tuesday.",
    note: "Everything shipped except the author's sense of what day it is.",
  },
  {
    id: "invite-to-deploy",
    text: "I missed the deadline because I finished the feature, deployed it to staging, and then waited three days for a calendar invite to the deploy itself.",
    note: "The work is done; the bureaucracy of announcing it is the blocker.",
  },
  {
    id: "only-work-disagreed",
    text: "I missed the deadline because my to-do list marked it done, my calendar marked it shipped, and only the actual work disagreed.",
    note: "A chorus of productivity tools versus one stubborn reality.",
  },
  {
    id: "pr-introducing",
    text: "I missed the deadline because the sprint ended on Friday, the standup moved on, and my pull request is still introducing itself to the reviewer.",
    note: "The pull request as a shy newcomer who never gets past hello.",
  },
  {
    id: "dream-code",
    text: "I missed the deadline because I wrote the whole thing in a dream, woke up, and found my laptop had not been invited.",
    note: "Dream productivity meets a laptop that never got the invite.",
  },
  {
    id: "autosaved-excuses",
    text: "I missed the deadline because the Wi-Fi died, the backup died, and my excuses file was the only thing that autosaved.",
    note: "The one file that survives is the one nobody wanted saved.",
  },
  {
    id: "dog-extension",
    text: "Sorry, my dog ate my homework and then asked for a deadline extension of his own.",
    note: "The stock dog-ate-it gag, with the dog joining the negotiation.",
  },
  {
    id: "mercury-list",
    text: "I missed the deadline because my alarm didn't go off, traffic was terrible, and Mercury was in retrograde.",
    note: "A plain list of stock reasons with no turn at all.",
  },
  {
    id: "plain-apology",
    text: "Apologies for the delay; I was busy and will send it soon.",
    note: "A plain apology. No joke, no turn, no excuse with a pulse.",
  },
  {
    id: "deadline-moved",
    text: "I missed the deadline because the deadline moved, the scope moved, and I stayed exactly where the sprint left me.",
    note: "Everything moved except the author, who was left behind.",
  },
  {
    id: "final-v2",
    text: "I missed the deadline because I renamed the file final_final_v2 and my computer believed me.",
    note: "The filename as a promise the computer took seriously.",
  },
  {
    id: "chatbot-thinking",
    text: "I missed the deadline because I asked the chatbot to do it and it has been thinking since Tuesday.",
    note: "Delegation to an AI that is still, visibly, thinking.",
  },
  {
    id: "feature-no-show",
    text: "I missed the deadline because the build passed, the tests passed, and the feature itself never showed up to work.",
    note: "Every check green, the guest of honour absent.",
  },
  {
    id: "backlog-restraining",
    text: "I missed the deadline because I put it in the sprint, the sprint put it in the backlog, and the backlog filed a restraining order.",
    note: "A chain of hand-offs ending in legal action from the backlog.",
  },
];

// ---------------------------------------------------------------------------
// Small text helpers. All pure, all deterministic.
// ---------------------------------------------------------------------------

/** Split a line into lower-cased words, stripping punctuation. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'’\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** The last `n` words of a line, lower-cased. */
function lastWords(text: string, n: number): string[] {
  const words = wordsOf(text);
  return words.slice(Math.max(0, words.length - n));
}

/** True when the line contains `phrase` (case-insensitive). */
function contains(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

/** Count how many of the given phrases appear in the line. */
function countPhrases(text: string, phrases: string[]): number {
  let count = 0;
  for (const phrase of phrases) {
    if (contains(text, phrase)) count += 1;
  }
  return count;
}

/** Character count the way the gate counts it: Unicode code points. */
function charCount(text: string): number {
  return [...text].length;
}

/**
 * True when the line is a single sentence: exactly one terminal
 * full stop, no newline, no second sentence hiding after a period.
 * A trailing period is the sentence's own; any other period, question
 * mark or exclamation mark means the line is not one clean sentence.
 */
function isSingleSentence(text: string): boolean {
  if (text.includes("\n") || text.includes("\r")) return false;
  const trimmed = text.trim();
  if (!trimmed.endsWith(".")) return false;
  const body = trimmed.slice(0, -1);
  return !/[.?!]/.test(body);
}

// ---------------------------------------------------------------------------
// Feature tables. These are the scorer's judgement, written out in the
// open so any reader can see exactly why a line scores what it scores.
// ---------------------------------------------------------------------------

/**
 * Surprise-turn phrases and how hard each one lands. A turn is the
 * moment the excuse stops being a report and becomes a joke: the
 * inanimate thing that disagrees, waits, believes, files paperwork,
 * or never shows up. The strongest turns are specific, visual, and
 * arrive as the last thing the reader hears.
 */
const TURN_PHRASES: Array<{ phrase: string; strength: number }> = [
  { phrase: "still waiting for the first keystroke", strength: 5 },
  { phrase: "filed a restraining order", strength: 4 },
  { phrase: "refused to agree", strength: 4 },
  { phrase: "my computer believed me", strength: 4 },
  { phrase: "never showed up to work", strength: 4 },
  { phrase: "only the actual work disagreed", strength: 4 },
  { phrase: "still introducing itself", strength: 3 },
  { phrase: "had not been invited", strength: 3 },
  { phrase: "has been thinking since tuesday", strength: 3 },
  { phrase: "still thinks it's last tuesday", strength: 3 },
  { phrase: "only thing that autosaved", strength: 3 },
  { phrase: "asked for a deadline extension", strength: 3 },
  { phrase: "waited three days for a calendar invite", strength: 2 },
  { phrase: "stayed exactly where the sprint left me", strength: 2 },
];

/**
 * Stock gags the judge has heard a hundred times. Each one present
 * docks the line: it is the opposite of fresh, and a line built on
 * one is a line the judge has already ranked against a hundred twins.
 */
const STOCK_GAGS: string[] = [
  "dog ate",
  "alarm didn't go off",
  "traffic was terrible",
  "mercury was in retrograde",
  "wi-fi died",
  "the wifi died",
  "my homework",
];

/**
 * Concrete work details that make an excuse specific instead of
 * generic: calendar, sprint, standup, deploy, pull request, backlog,
 * build, tests, feature. A line naming two or more reads as a real week at a
 * real job, not a joke Mad-Libbed onto the word "deadline".
 */
const WORK_DETAILS: string[] = [
  "calendar",
  "sprint",
  "standup",
  "deploy",
  "pull request",
  "backlog",
  "build",
  "tests",
  "feature",
  "laptop",
  "keystroke",
  "to-do list",
  "staging",
  "reviewer",
  "chatbot",
];

/**
 * Spoken-register markers: first-person confession and the small
 * conversational gears ("sorry", "because", "and") that make a line
 * sound like something said aloud to a manager, not written for a
 * greeting card. Absurdist triple-chains (three parallel clauses
 * escalating into legal action) read written, not spoken, and score
 * lower here even when they are funny.
 */
const SPOKEN_MARKERS: string[] = ["i ", "my ", "sorry", "because"];

// ---------------------------------------------------------------------------
// Scoring, criterion by criterion, in the brief's own order.
// Scores are 0-5 per criterion unless noted. The comparison is
// lexicographic over the five criteria, so criterion 1 always outranks
// criterion 2, and so on — exactly as the judge's brief instructs.
// ---------------------------------------------------------------------------

interface Breakdown {
  /** 1. A real excuse for a missed deadline. */
  excuse: number;
  /** 2. A real joke with a turn or a surprise. */
  funny: number;
  /** 3. One clean sentence, punch at the end. */
  form: number;
  /** 4. Sounds like a person cornered, saying it aloud. */
  spoken: number;
  /** 5. A fresh angle, not a stock retread. */
  fresh: number;
  /** Total, for display only; ranking never uses the total. */
  total: number;
  /** True when the line was capped for naming the deadline only. */
  capped: boolean;
  /** Points docked for predictable stock gags. */
  docked: number;
  /** Strongest surprise turn found, 0 when there is none. */
  turnStrength: number;
}

/**
 * The strongest surprise turn in the line, as its table entry, or null
 * when the line has no turn at all: it reports a delay without ever
 * becoming a joke. The entry (not just the strength) is returned so
 * callers can also tell WHERE the turn sits in the line — a turn
 * preceded by setup clauses is an escalation, not a one-off gag.
 */
function strongestTurnOf(text: string): {
  phrase: string;
  strength: number;
} | null {
  let best: { phrase: string; strength: number } | null = null;
  for (const turn of TURN_PHRASES) {
    if (
      contains(text, turn.phrase) &&
      (best === null || turn.strength > best.strength)
    ) {
      best = turn;
    }
  }
  return best;
}

/**
 * Strongest surprise turn in the line, by the TURN_PHRASES table.
 * Returns 0 when the line has no turn at all.
 */
function turnStrengthOf(text: string): number {
  return strongestTurnOf(text)?.strength ?? 0;
}

/**
 * Criterion 1 — excuse for a missed deadline (0-5).
 *
 * A line must name the miss and give a reason for it. Saying
 * "I missed the deadline because ..." is the full mark: the miss is
 * named and a cause follows. A bare apology names neither a deadline
 * nor a cause and scores at the bottom. The judge's brief is blunt
 * here: a line that is not an excuse loses to any line that is one,
 * whatever else it has going for it.
 */
function scoreExcuse(text: string): number {
  let score = 0;
  if (contains(text, "missed the deadline")) score += 3;
  else if (contains(text, "deadline")) score += 1;
  if (contains(text, "because")) score += 1;
  if (contains(text, "sorry") || contains(text, "apologies")) score += 1;
  return Math.min(5, score);
}

/**
 * Criterion 2 — finds the funny (0-5, before caps and docks).
 *
 * The turn is the joke. A line with a strong turn scores high; a line
 * with a weak turn scores low; a line with no turn at all scores 0
 * and is capped outright (see scoreCandidate). A plain list of reasons
 * — alarm, traffic, Mercury — has no turn, however many reasons it
 * stacks: three flat reasons do not add up to one joke.
 *
 * But a triple escalation is not a plain list: two setup clauses that
 * both go right, then the turn subverting them (the build passed, the
 * tests passed, and the feature never showed up), is the rule of three
 * — a joke mechanism in its own right, not three reasons in a row.
 * A turn preceded by at least two comma-separated setup clauses earns
 * a point for it. A two-beat line (setup, then turn) earns none.
 */
function scoreFunny(text: string, turnStrength: number): number {
  if (turnStrength === 0) return 0;
  // A turn of strength 5 is a 5; weaker turns scale down, and a line
  // whose turn is not the last thing said loses a point for burying it.
  let score = turnStrength;
  const tail = lastWords(text, PUNCH_WINDOW_WORDS).join(" ");
  const turnInTail = TURN_PHRASES.some(
    (turn) =>
      turn.strength === turnStrength &&
      tail.includes(turn.phrase.split(" ").slice(-3).join(" ")),
  );
  if (!turnInTail) score -= 1;
  // Triple escalation: the strongest turn is preceded by at least two
  // comma-separated setup clauses, so the third beat subverts the
  // first two instead of merely following them.
  const turn = strongestTurnOf(text);
  if (turn !== null) {
    const beforeTurn = text.slice(
      0,
      text.toLowerCase().indexOf(turn.phrase),
    );
    const setupCommas = (beforeTurn.match(/,/g) ?? []).length;
    if (setupCommas >= 2) score += 1;
  }
  return Math.max(0, Math.min(5, score));
}

/**
 * Criterion 3 — fits the one-line form (0-5).
 *
 * One clean sentence, readable aloud, punch at the end. The punch
 * must sit inside the last six words: that is where the ear waits
 * for it. A line that is one sentence but spends its ending on
 * filler ("and will send it soon") fails the form even if it is
 * short. A line that is not a single sentence at all fails hardest.
 */
function scoreForm(text: string, turnStrength: number): number {
  if (!isSingleSentence(text)) return 1;
  let score = 3;
  if (turnStrength > 0) {
    const tail = lastWords(text, PUNCH_WINDOW_WORDS).join(" ");
    const turnInTail = TURN_PHRASES.some(
      (turn) =>
        turn.strength === turnStrength &&
        tail.includes(turn.phrase.split(" ").slice(-3).join(" ")),
    );
    if (turnInTail) score += 2;
    else score += 0;
  }
  // A short, tight line reads cleaner aloud than a rambling one.
  if (charCount(text) <= 140) score += 0;
  return Math.min(5, score);
}

/**
 * Criterion 4 — sounds like a person actually saying it (0-5).
 *
 * First-person confession in conversational words is the register of
 * someone cornered at standup. Two things cost points: a line with
 * no first-person voice at all (it reads like a caption, not a
 * confession), and a triple parallel chain that escalates into
 * absurdity — "I put it in the sprint, the sprint put it in the
 * backlog, and the backlog filed..." — which is a written joke
 * structure, clever on the page, not something anyone says aloud
 * while a manager waits. Exaggeration is welcome; a rehearsed
 * three-beat routine is not the same as being cornered.
 */
function scoreSpoken(text: string): number {
  let score = 2;
  score += Math.min(2, countPhrases(text, SPOKEN_MARKERS));
  if (contains(text, "i missed the deadline") || contains(text, "sorry i")) {
    score += 1;
  }
  // Triple parallel chain: three commas or "and" clauses building a
  // routine. Written, not spoken.
  const commas = (text.match(/,/g) ?? []).length;
  const ands = wordsOf(text).filter((w) => w === "and").length;
  if (commas >= 2 && ands >= 2) score -= 1;
  return Math.max(0, Math.min(5, score));
}

/**
 * Criterion 5 — fresh angle (0-5).
 *
 * Freshness is specificity plus the absence of stock. Each concrete
 * work detail (standup, sprint board, keystroke) is evidence the
 * angle was built from a real week, not lifted from a joke book.
 * Each stock gag present docks a point, and a line built entirely on
 * a stock gag cannot score above 1 here no matter what else it does.
 */
function scoreFresh(text: string): number {
  let score = 1;
  const details = countPhrases(text, WORK_DETAILS);
  score += Math.min(3, details);
  const stock = countPhrases(text, STOCK_GAGS);
  score -= stock;
  if (stock > 0 && contains(text, "dog ate")) score = Math.min(score, 1);
  return Math.max(0, Math.min(5, score));
}

/**
 * Score one candidate, applying the sharp edges:
 *
 *   - CAP: a line with no surprise turn only names a missed deadline
 *     without turning it into a joke. Its funny score is 0 and its
 *     total is capped at 6 — below every line that actually jokes —
 *     however polished its form or freshness.
 *   - DOCK: each stock gag present subtracts 1 from the funny score,
 *     because a predictable gag is a joke the judge has already heard.
 *
 * Returns the breakdown; `total` is display-only and never decides
 * the ranking.
 */
function scoreCandidate(candidate: Candidate): Breakdown {
  const text = candidate.text;
  const turnStrength = turnStrengthOf(text);
  const stockCount = countPhrases(text, STOCK_GAGS);

  const excuse = scoreExcuse(text);
  let funny = scoreFunny(text, turnStrength);
  const form = scoreForm(text, turnStrength);
  const spoken = scoreSpoken(text);
  const fresh = scoreFresh(text);

  // Dock predictable gags from the funny score.
  const docked = stockCount;
  funny = Math.max(0, funny - docked);

  // Cap lines that only name a missed deadline without joking.
  const capped = turnStrength === 0;
  let total = excuse + funny + form + spoken + fresh;
  if (capped) total = Math.min(total, 6);

  return { excuse, funny, form, spoken, fresh, total, capped, docked, turnStrength };
}

/**
 * Compare two scored candidates the way the judge's brief says to:
 * go through the criteria in order, find the first one where they
 * differ, and let that decide. Only when all five criteria tie does
 * the shorter line win — and length for its own sake never counts
 * before that. Candidate order is the last resort, so the result is
 * fully deterministic.
 */
function compareScored(
  a: { candidate: Candidate; breakdown: Breakdown },
  b: { candidate: Candidate; breakdown: Breakdown },
): number {
  const criteria: Array<keyof Breakdown> = [
    "excuse",
    "funny",
    "form",
    "spoken",
    "fresh",
  ];
  for (const key of criteria) {
    const diff =
      (b.breakdown[key] as number) - (a.breakdown[key] as number);
    if (diff !== 0) return diff;
  }
  // Every criterion tied: shorter wins (fewer characters, then bytes).
  const lenDiff = charCount(a.candidate.text) - charCount(b.candidate.text);
  if (lenDiff !== 0) return lenDiff;
  const byteDiff =
    Buffer.byteLength(a.candidate.text, "utf8") -
    Buffer.byteLength(b.candidate.text, "utf8");
  if (byteDiff !== 0) return byteDiff;
  return 0;
}

// ---------------------------------------------------------------------------
// Gate verification: every rule in RULES.txt, checked byte-for-byte.
// ---------------------------------------------------------------------------

interface GateResult {
  ok: boolean;
  checks: string[];
}

/**
 * Verify a written entry against the gate, exactly as the sealed
 * scorer states it: UTF-8 text of 1 to 200 characters, not only
 * white space. A single line is required by the task itself ("An
 * entry is that line and nothing else: no picture, no link, no
 * second line"), so a newline anywhere fails the gate too.
 * Returns every check as a human-readable line for the report.
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const checks: string[] = [];
  let ok = true;

  const raw = readFileSync(filePath);
  const decoded = raw.toString("utf8");

  // Valid UTF-8: re-encoding must reproduce the exact bytes.
  const roundTrips = Buffer.from(decoded, "utf8").equals(raw);
  checks.push(`valid UTF-8 (re-encode matches bytes): ${roundTrips ? "PASS" : "FAIL"}`);
  if (!roundTrips) ok = false;

  // Byte-for-byte identical to the text the scorer chose.
  const identical = decoded === expectedText;
  checks.push(`written text matches chosen line byte-for-byte: ${identical ? "PASS" : "FAIL"}`);
  if (!identical) ok = false;

  // Character count: 1 to 200 characters (code points, not bytes).
  const chars = charCount(decoded);
  const inRange = chars >= MIN_CHARS && chars <= MAX_CHARS;
  checks.push(
    `character count ${chars} within ${MIN_CHARS}-${MAX_CHARS}: ${inRange ? "PASS" : "FAIL"}`,
  );
  if (!inRange) ok = false;

  // Not only whitespace.
  const nonWhitespace = decoded.trim().length > 0;
  checks.push(`not only whitespace: ${nonWhitespace ? "PASS" : "FAIL"}`);
  if (!nonWhitespace) ok = false;

  // Single line: no newline, no carriage return, no second line.
  const singleLine = !decoded.includes("\n") && !decoded.includes("\r");
  checks.push(`single line (no newline characters): ${singleLine ? "PASS" : "FAIL"}`);
  if (!singleLine) ok = false;

  // Single sentence, punch at the end (the brief's criterion 3).
  const singleSentence = isSingleSentence(decoded);
  checks.push(`single sentence: ${singleSentence ? "PASS" : "FAIL"}`);
  if (!singleSentence) ok = false;

  // No trailing newline: the file is the line and nothing else.
  const noTrailingNewline = !decoded.endsWith("\n");
  checks.push(`no trailing newline (file is the line only): ${noTrailingNewline ? "PASS" : "FAIL"}`);
  if (!noTrailingNewline) ok = false;

  return { ok, checks };
}

// ---------------------------------------------------------------------------
// Main: score, pick, write, read back, verify, report.
// ---------------------------------------------------------------------------

function main(): void {
  // Score every candidate.
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    breakdown: scoreCandidate(candidate),
  }));

  // Rank: best first, by the brief's criterion order, then length.
  const ranked = [...scored].sort(compareScored);
  const winner = ranked[0];

  // Report the full table so the choice is auditable, not asserted.
  console.log("One Line, No Deadline Met — candidate ranking");
  console.log("Criteria in the judge's order: excuse / funny / form / spoken / fresh");
  console.log("---------------------------------------------------------------");
  for (const entry of ranked) {
    const b = entry.breakdown;
    const flags: string[] = [];
    if (b.capped) flags.push("CAPPED: names the deadline, no joke");
    if (b.docked > 0) flags.push(`DOCKED -${b.docked} stock gag`);
    console.log(
      `${entry.candidate.id.padEnd(20)} ` +
        `[${b.excuse} ${b.funny} ${b.form} ${b.spoken} ${b.fresh}] ` +
        `total=${String(b.total).padStart(2)} ` +
        `${charCount(entry.candidate.text)} chars` +
        (flags.length > 0 ? ` (${flags.join("; ")})` : ""),
    );
  }
  console.log("---------------------------------------------------------------");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Why it wins: ${winner.candidate.note} ` +
      `It names the miss and the cause (criterion 1), turns on a surprise ` +
      `that lands in its final words (criteria 2-3), reads like a confession ` +
      `from someone cornered (criterion 4), and is built from a specific ` +
      `week at work rather than a stock excuse (criterion 5). ` +
      `Breakdown [excuse funny form spoken fresh]: ` +
      `[${winner.breakdown.excuse} ${winner.breakdown.funny} ` +
      `${winner.breakdown.form} ${winner.breakdown.spoken} ` +
      `${winner.breakdown.fresh}] — see the table above.`,
  );

  // Write the winner, then read it back and verify every gate.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(ENTRY_PATH, winner.candidate.text, "utf8");
  console.log(`Wrote ${ENTRY_PATH}`);

  const gate = verifyGate(ENTRY_PATH, winner.candidate.text);
  console.log("Gate verification:");
  for (const check of gate.checks) {
    console.log(`  ${check}`);
  }

  if (!gate.ok) {
    console.error("GATE FAILED: entry.txt does not satisfy RULES.txt.");
    process.exit(1);
  }
  console.log("All gates PASS. Entry is valid.");
}

main();
