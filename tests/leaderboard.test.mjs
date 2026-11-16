import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserEnv } from "./helpers/browser-env.mjs";

const KEY = "typerush_leaderboard";

// Exactly what the site wrote to localStorage before November 2026: every
// entry carries difficulty "medium", whatever its mode, and no wordCount.
const OLD_SHAPE = [
  { mode: "custom", difficulty: "medium", language: "", duration: 12, wpm: 80, rawWpm: 80, accuracy: 100, consistency: "N/A", date: "2026-03-01T10:00:00.000Z", textPreview: "e" },
  { mode: "words", difficulty: "medium", language: "", duration: 33, wpm: 72, rawWpm: 75, accuracy: 97, consistency: "Excellent", date: "2026-04-01T10:00:00.000Z", textPreview: "d" },
  { mode: "classic", difficulty: "easy", language: "", duration: 30, wpm: 61, rawWpm: 64, accuracy: 95, consistency: "Good", date: "2026-05-01T10:00:00.000Z", textPreview: "a" },
  { mode: "classic", difficulty: "hard", language: "", duration: 60, wpm: 55, rawWpm: 60, accuracy: 99, consistency: "Good", date: "2026-06-01T10:00:00.000Z", textPreview: "b" },
  { mode: "code", difficulty: "medium", language: "rust", duration: 41, wpm: 38, rawWpm: 45, accuracy: 91, consistency: "Fair", date: "2026-07-01T10:00:00.000Z", textPreview: "c" },
  { mode: "code", difficulty: "medium", language: "python", duration: 50, wpm: 47, rawWpm: 50, accuracy: 93, consistency: "Good", date: "2026-07-02T10:00:00.000Z", textPreview: "f" }
];

function setup(stored) {
  const storage = stored === undefined ? {} : { [KEY]: typeof stored === "string" ? stored : JSON.stringify(stored) };
  const env = createBrowserEnv({ scripts: ["storage.js", "leaderboard.js"], storage });
  const problems = [];
  env.get("SaveData").setProblemHandler(message => problems.push(message));
  return { env, lb: env.get("Leaderboard"), problems };
}

// A result object as the engine produces it today.
function result(overrides) {
  return {
    mode: "classic", difficulty: "medium", language: "", wordCount: 0, duration: 60,
    wpm: 50, rawWpm: 52, accuracy: 96, consistency: "Good",
    date: "2026-11-16T12:00:00.000Z", textPreview: "The quick brown fox",
    ...overrides
  };
}

test("an empty leaderboard loads as an empty list", () => {
  const { env, lb } = setup();
  assert.deepEqual(env.plain(lb.load()), []);
  assert.equal(lb.getTotalTests(), 0);
});

test("entries saved by the old version all still load", () => {
  const { env, lb } = setup(OLD_SHAPE);
  const entries = env.plain(lb.load());
  assert.equal(entries.length, 6);
  assert.deepEqual(entries.map(e => e.wpm), [80, 72, 61, 55, 38, 47]);
  assert.deepEqual(entries.map(e => e.date), OLD_SHAPE.map(e => e.date));
});

test("old entries lose the stray 'medium' difficulty outside Classic", () => {
  const { env, lb } = setup(OLD_SHAPE);
  const entries = env.plain(lb.load());
  const of = mode => entries.filter(e => e.mode === mode);
  assert.deepEqual(of("custom").map(e => e.difficulty), [""]);
  assert.deepEqual(of("words").map(e => e.difficulty), [""]);
  assert.deepEqual(of("code").map(e => e.difficulty), ["", ""]);
  assert.deepEqual(of("classic").map(e => e.difficulty), ["easy", "hard"], "Classic keeps its difficulty");
  assert.deepEqual(of("code").map(e => e.language), ["rust", "python"]);
});

test("old Code, Words and Custom scores still count as the score to beat", () => {
  const { lb } = setup(OLD_SHAPE);
  // New results leave difficulty empty outside Classic; the old entries say "medium".
  assert.equal(lb.isPersonalBest(result({ mode: "code", difficulty: "", language: "rust", wpm: 30 })), false);
  assert.equal(lb.isPersonalBest(result({ mode: "code", difficulty: "", language: "rust", wpm: 39 })), true);
  assert.equal(lb.isPersonalBest(result({ mode: "words", difficulty: "", wpm: 72 })), false, "equalling a best is not beating it");
  assert.equal(lb.isPersonalBest(result({ mode: "words", difficulty: "", wpm: 73 })), true);
  assert.equal(lb.isPersonalBest(result({ mode: "custom", difficulty: "", wpm: 79 })), false);
});

test("personal bests are kept per difficulty and per language", () => {
  const { lb } = setup(OLD_SHAPE);
  assert.equal(lb.isPersonalBest(result({ mode: "classic", difficulty: "hard", wpm: 56 })), true);
  assert.equal(lb.isPersonalBest(result({ mode: "classic", difficulty: "easy", wpm: 56 })), false);
  assert.equal(lb.isPersonalBest(result({ mode: "classic", difficulty: "medium", wpm: 1 })), true, "first score in a category");
  assert.equal(lb.isPersonalBest(result({ mode: "code", difficulty: "", language: "python", wpm: 40 })), false);
  assert.equal(lb.isPersonalBest(result({ mode: "code", difficulty: "", language: "css", wpm: 5 })), true);
});

test("best-by-mode separates old Code entries by language", () => {
  const { env, lb } = setup(OLD_SHAPE);
  const best = env.plain(lb.getBestByMode());
  assert.deepEqual(Object.keys(best).sort(), ["classic|easy|", "classic|hard|", "code||python", "code||rust", "custom||", "words||"]);
  assert.equal(best["code||rust"].wpm, 38);
  assert.equal(best["code||python"].wpm, 47);
});

test("adding to an old leaderboard keeps every old entry and writes the new shape", () => {
  const { env, lb } = setup(OLD_SHAPE);
  lb.addEntry(result({ mode: "words", difficulty: "", wordCount: 50, wpm: 66, duration: 45 }));

  const stored = env.storage.getJson(KEY);
  assert.equal(stored.length, 7);
  assert.deepEqual(stored.map(e => e.wpm), [80, 72, 66, 61, 55, 47, 38], "sorted fastest first");

  const added = stored.find(e => e.wpm === 66);
  assert.deepEqual(added, {
    mode: "words", difficulty: "", language: "", wordCount: 50, duration: 45,
    wpm: 66, rawWpm: 52, accuracy: 96, consistency: "Good",
    date: "2026-11-16T12:00:00.000Z", textPreview: "The quick brown fox"
  });
});

test("filtering and sorting", () => {
  const { env, lb } = setup(OLD_SHAPE);
  assert.deepEqual(env.plain(lb.getFiltered("all", "wpm")).map(e => e.wpm), [80, 72, 61, 55, 47, 38]);
  assert.deepEqual(env.plain(lb.getFiltered("classic", "wpm")).map(e => e.wpm), [61, 55]);
  assert.deepEqual(env.plain(lb.getFiltered("all", "accuracy")).map(e => e.accuracy), [100, 99, 97, 95, 93, 91]);
  assert.deepEqual(env.plain(lb.getFiltered("all", "date")).map(e => e.date.slice(0, 10)),
    ["2026-07-02", "2026-07-01", "2026-06-01", "2026-05-01", "2026-04-01", "2026-03-01"]);
  assert.deepEqual(env.plain(lb.getFiltered("code", "date")).map(e => e.language), ["python", "rust"]);
});

test("clear removes the stored leaderboard", () => {
  const { env, lb } = setup(OLD_SHAPE);
  assert.equal(lb.clear(), true);
  assert.equal(env.storage.get(KEY), null);
  assert.deepEqual(env.plain(lb.load()), []);
});

// ---------------------------------------------------------------------------
// Damaged or unexpected saved data. Before this was handled, any of these
// values made the results screen fail to appear at the end of a round.
// ---------------------------------------------------------------------------

const GOOD = OLD_SHAPE[2]; // classic, easy, 61 WPM

for (const [label, stored, expectedProblem] of [
  ["the JSON value null", "null", "The saved leaderboard was damaged and could not be loaded."],
  ["an object instead of a list", "{}", "The saved leaderboard was damaged and could not be loaded."],
  ["a number", "42", "The saved leaderboard was damaged and could not be loaded."],
  ["text that is not JSON", "{not json", 'Saved data "typerush_leaderboard" could not be read and was ignored.'],
  ["a list holding only null", "[null]", "1 damaged leaderboard entry was skipped."]
]) {
  test(`damaged leaderboard (${label}) loads as empty, is reported, and breaks nothing`, () => {
    const { env, lb, problems } = setup(stored);
    assert.deepEqual(env.plain(lb.load()), []);
    assert.deepEqual(env.plain(lb.getFiltered("all", "wpm")), []);
    assert.deepEqual(env.plain(lb.getBestByMode()), {});
    assert.equal(lb.isPersonalBest(result()), true);
    assert.equal(lb.getTotalTests(), 0);
    assert.deepEqual(problems, [expectedProblem], "reported exactly once across all those reads");
    assert.equal(env.storage.get(KEY), stored, "reading never rewrites what is stored");
  });
}

test("usable entries survive next to damaged ones", () => {
  const { env, lb, problems } = setup([
    null, 42, "a string", [],
    { mode: "bogus", wpm: 50, accuracy: 90 },
    { mode: "classic" },
    { mode: "classic", wpm: "fast", accuracy: 90 },
    { mode: "classic", wpm: 50, accuracy: null },
    GOOD
  ]);
  assert.deepEqual(env.plain(lb.load()), [GOOD]);
  assert.deepEqual(problems, ["8 damaged leaderboard entries were skipped."]);
  assert.equal(lb.isPersonalBest(result({ difficulty: "easy", wpm: 60 })), false);
});

test("an entry with missing details is kept with safe values", () => {
  const { env, lb, problems } = setup([
    { mode: "code", language: 7, difficulty: "medium", wpm: 44, accuracy: 93, date: "not a date" },
    GOOD
  ]);
  const entries = env.plain(lb.load());
  assert.deepEqual(entries[0], { mode: "code", language: "", difficulty: "", wpm: 44, accuracy: 93, date: "", duration: 0, rawWpm: 44 });
  assert.deepEqual(problems, []);
  // no usable date sorts as oldest
  assert.deepEqual(env.plain(lb.getFiltered("all", "date")).map(e => e.wpm), [61, 44]);
});

test("fields the app does not know about are preserved", () => {
  const { env, lb } = setup([{ ...GOOD, note: "kept", extra: { nested: true } }]);
  lb.addEntry(result({ wpm: 70 }));
  const stored = env.storage.getJson(KEY);
  assert.equal(stored.find(e => e.wpm === 61).note, "kept");
  assert.deepEqual(stored.find(e => e.wpm === 61).extra, { nested: true });
});

test("saving over a damaged leaderboard starts a clean one", () => {
  const { env, lb, problems } = setup("{not json");
  assert.deepEqual(env.plain(lb.addEntry(result({ wpm: 70 }))), { saved: true });
  assert.deepEqual(env.storage.getJson(KEY).map(e => e.wpm), [70]);
  assert.equal(problems.length, 1);
});

// ---------------------------------------------------------------------------
// The 50-entry limit, and telling the truth about what was saved.
// ---------------------------------------------------------------------------

// 50 Classic runs from 60 to 109 WPM.
const FIFTY_CLASSIC = Array.from({ length: 50 }, (_, i) => ({
  mode: "classic", difficulty: "easy", language: "", duration: 30, wpm: 60 + i, rawWpm: 62 + i,
  accuracy: 95, consistency: "Good", date: new Date(Date.UTC(2026, 5, 1 + (i % 28))).toISOString(), textPreview: "x"
}));

test("a slower run in another mode is still saved when 50 faster runs exist", () => {
  const { env, lb } = setup(FIFTY_CLASSIC);
  // This used to answer "Score saved!" and then drop the entry.
  assert.deepEqual(env.plain(lb.addEntry(result({ mode: "custom", difficulty: "", wpm: 49 }))), { saved: true });
  const stored = env.storage.getJson(KEY);
  assert.equal(stored.length, 51);
  assert.equal(stored.filter(e => e.mode === "custom").length, 1);
  assert.equal(stored.filter(e => e.mode === "classic").length, 50);
});

test("a run slower than the 50 kept for its mode is refused, and says so", () => {
  const { env, lb } = setup(FIFTY_CLASSIC);
  const before = env.storage.get(KEY);
  assert.deepEqual(env.plain(lb.addEntry(result({ difficulty: "hard", wpm: 59 }))), { saved: false, reason: "not-fast-enough" });
  assert.equal(env.storage.get(KEY), before, "nothing was written");
});

test("equalling the slowest kept run does not replace it", () => {
  const { env, lb } = setup(FIFTY_CLASSIC);
  assert.deepEqual(env.plain(lb.addEntry(result({ wpm: 60 }))), { saved: false, reason: "not-fast-enough" });
});

test("a faster run pushes out the slowest of its mode only", () => {
  const custom = { mode: "custom", difficulty: "", language: "", duration: 9, wpm: 20, rawWpm: 20, accuracy: 90, consistency: "N/A", date: "2026-01-01T00:00:00.000Z", textPreview: "c" };
  const { env, lb } = setup([...FIFTY_CLASSIC, custom]);
  assert.deepEqual(env.plain(lb.addEntry(result({ wpm: 75 }))), { saved: true });
  const stored = env.storage.getJson(KEY);
  const classic = stored.filter(e => e.mode === "classic");
  assert.equal(classic.length, 50);
  assert.equal(Math.min(...classic.map(e => e.wpm)), 61, "the 60 WPM run was dropped");
  assert.equal(classic.filter(e => e.wpm === 75).length, 2, "the new 75 sits beside the old one");
  assert.equal(stored.filter(e => e.mode === "custom").length, 1, "the slow Custom run is untouched");
  assert.equal(lb.MAX_ENTRIES, 50);
});

test("a full or blocked browser storage is reported, not hidden", () => {
  const { env, lb, problems } = setup(OLD_SHAPE);
  env.storage.failWrites();
  assert.deepEqual(env.plain(lb.addEntry(result({ wpm: 70 }))), { saved: false, reason: "storage" });
  assert.deepEqual(problems, ["Could not save: your browser's storage is full or blocked."]);
  assert.equal(env.storage.getJson(KEY).length, 6, "the old leaderboard is intact");
});

test("with storage blocked entirely the leaderboard is empty and says why", () => {
  const { env, lb, problems } = setup(OLD_SHAPE);
  env.storage.block();
  assert.deepEqual(env.plain(lb.load()), []);
  assert.equal(lb.isPersonalBest(result()), true);
  assert.equal(lb.clear(), false);
  assert.deepEqual(problems, [
    "Your browser is blocking saved data, so scores and achievements cannot be loaded.",
    "Could not clear saved data: your browser's storage is blocked."
  ]);
});

test("addEntry rejects something that is not a score", () => {
  const { lb } = setup();
  assert.throws(() => lb.addEntry(result({ wpm: NaN })), /not a valid score/);
  assert.throws(() => lb.addEntry(result({ mode: "bogus" })), /not a valid score/);
});
