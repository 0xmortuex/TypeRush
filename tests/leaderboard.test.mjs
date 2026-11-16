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
  const env = createBrowserEnv({ scripts: ["leaderboard.js"], storage });
  return { env, lb: env.get("Leaderboard") };
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
  lb.clear();
  assert.equal(env.storage.get(KEY), null);
  assert.deepEqual(env.plain(lb.load()), []);
});
