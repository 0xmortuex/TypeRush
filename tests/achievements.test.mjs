import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserEnv } from "./helpers/browser-env.mjs";

const UNLOCKED_KEY = "typerush_achievements";
const STATS_KEY = "typerush_stats";

function setup(storage = {}) {
  const env = createBrowserEnv({ scripts: ["storage.js", "achievements.js"], storage });
  const problems = [];
  env.get("SaveData").setProblemHandler(message => problems.push(message));
  return { env, ach: env.get("Achievements"), problems };
}

// A result object as the engine produces it.
function result(overrides) {
  return {
    mode: "classic", difficulty: "medium", language: "", wordCount: 0,
    duration: 60, configuredDuration: 60, wpm: 50, rawWpm: 52, accuracy: 96,
    keystrokes: 250, mistakes: 10, consistency: "Good",
    ...overrides
  };
}

// Array.from builds the array in this realm (the list comes from the vm context).
const ids = list => Array.from(list, a => a.id);

test("the first finished test unlocks First Steps and is counted", () => {
  const { env, ach } = setup();
  const unlocked = ach.checkUnlocks(result());
  assert.deepEqual(ids(unlocked), ["first_steps"]);
  assert.deepEqual(env.storage.getJson(UNLOCKED_KEY), ["first_steps"]);
  assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 1, codeTests: 0, classicTests: 1, highAccuracyCount: 0 });
});

test("an achievement is only announced once", () => {
  const { ach } = setup();
  assert.deepEqual(ids(ach.checkUnlocks(result())), ["first_steps"]);
  assert.deepEqual(ids(ach.checkUnlocks(result())), []);
});

test("Marathoner needs a round that really lasted two minutes", () => {
  const { ach } = setup({ [UNLOCKED_KEY]: JSON.stringify(["first_steps"]) });

  // Words and Custom rounds used to report a configured duration of 9999 s
  // and unlocked this after a few seconds of typing.
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "words", duration: 5, configuredDuration: 0 }))), []);
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "custom", duration: 1, configuredDuration: 0 }))), []);
  // A "120s" test that ended early is not a 120-second test either.
  assert.deepEqual(ids(ach.checkUnlocks(result({ duration: 4, configuredDuration: 120 }))), []);

  assert.deepEqual(ids(ach.checkUnlocks(result({ duration: 120, configuredDuration: 120 }))), ["marathoner"]);
});

test("a long untimed round also counts as a marathon", () => {
  const { ach } = setup({ [UNLOCKED_KEY]: JSON.stringify(["first_steps"]) });
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "words", duration: 131, configuredDuration: 0 }))), ["marathoner"]);
});

test("achievements unlocked by the old version stay unlocked", () => {
  const old = ["first_steps", "speed_demon", "perfectionist", "marathoner", "century_club", "consistent"];
  const { env, ach } = setup({
    [UNLOCKED_KEY]: JSON.stringify(old),
    [STATS_KEY]: JSON.stringify({ totalTests: 7, codeTests: 2, classicTests: 3, highAccuracyCount: 4 })
  });

  const all = env.plain(ach.getAll());
  assert.equal(all.length, 10);
  assert.deepEqual(all.filter(a => a.unlocked).map(a => a.id), old);

  // a slow, short, sloppy round takes nothing away and continues the counts
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "words", duration: 3, wpm: 12, accuracy: 70 }))), []);
  assert.deepEqual(env.storage.getJson(UNLOCKED_KEY), old);
  assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 8, codeTests: 2, classicTests: 3, highAccuracyCount: 4 });
});

test("counted achievements unlock when their count is reached", () => {
  const { ach } = setup({
    [UNLOCKED_KEY]: JSON.stringify(["first_steps"]),
    [STATS_KEY]: JSON.stringify({ totalTests: 24, codeTests: 4, classicTests: 9, highAccuracyCount: 4 })
  });
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "code", language: "rust", accuracy: 98 }))), ["code_monkey", "sharpshooter", "dedicated"]);
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "classic", accuracy: 90 }))), ["wordsmith"]);
});

test("speed, accuracy and consistency achievements", () => {
  const { ach } = setup({ [UNLOCKED_KEY]: JSON.stringify(["first_steps"]) });
  assert.deepEqual(ids(ach.checkUnlocks(result({ wpm: 79, accuracy: 97 }))), []);
  assert.deepEqual(ids(ach.checkUnlocks(result({ wpm: 80, accuracy: 97 }))), ["speed_demon"]);
  assert.deepEqual(ids(ach.checkUnlocks(result({ wpm: 100, accuracy: 97 }))), ["century_club"]);
  assert.deepEqual(ids(ach.checkUnlocks(result({ accuracy: 100, mistakes: 0 }))), ["perfectionist"]);
  assert.deepEqual(ids(ach.checkUnlocks(result({ consistency: "Excellent" }))), ["consistent"]);
});

// ---------------------------------------------------------------------------
// Damaged or unexpected saved data. Before this was handled, a damaged
// achievements list stopped the results screen from appearing, and a damaged
// counter became NaN and never recovered.
// ---------------------------------------------------------------------------

for (const [label, stored] of [
  ["an object instead of a list", "{}"],
  ["the JSON value null", "null"],
  ["text that is not JSON", "[first_steps"]
]) {
  test(`damaged achievements (${label}) are reported and a round can still finish`, () => {
    const { env, ach, problems } = setup({ [UNLOCKED_KEY]: stored });
    assert.equal(env.plain(ach.getAll()).filter(a => a.unlocked).length, 0);
    assert.deepEqual(ids(ach.checkUnlocks(result())), ["first_steps"]);
    assert.deepEqual(env.storage.getJson(UNLOCKED_KEY), ["first_steps"], "a clean list is written by the unlock");
    assert.equal(problems.length, 1);
  });
}

test("entries in the unlocked list that are not ids are ignored", () => {
  const { env, ach } = setup({ [UNLOCKED_KEY]: JSON.stringify([1, "speed_demon", null, { id: "x" }, "first_steps"]) });
  assert.deepEqual(env.plain(ach.getAll()).filter(a => a.unlocked).map(a => a.id), ["first_steps", "speed_demon"]);
});

test("an id the app does not know is kept when the list is saved", () => {
  const { env, ach } = setup({ [UNLOCKED_KEY]: JSON.stringify(["someday_maybe"]) });
  ach.checkUnlocks(result());
  assert.deepEqual(env.storage.getJson(UNLOCKED_KEY), ["someday_maybe", "first_steps"]);
});

test("counts saved as {} start from zero and are written back as numbers", () => {
  // The old code turned this into {"totalTests":null,"highAccuracyCount":null}.
  const { env, ach, problems } = setup({ [STATS_KEY]: "{}" });
  assert.deepEqual(ids(ach.checkUnlocks(result({ accuracy: 99 }))), ["first_steps"]);
  assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 1, codeTests: 0, classicTests: 1, highAccuracyCount: 1 });
  assert.deepEqual(problems, []);
});

test("counts already broken by the old code are repaired and reported", () => {
  const { env, ach, problems } = setup({
    [UNLOCKED_KEY]: JSON.stringify(["first_steps"]),
    [STATS_KEY]: '{"totalTests":null,"codeTests":4,"classicTests":2,"highAccuracyCount":null}'
  });
  assert.deepEqual(ids(ach.checkUnlocks(result({ mode: "code", language: "css" }))), ["code_monkey"]);
  assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 1, codeTests: 5, classicTests: 2, highAccuracyCount: 0 });
  assert.deepEqual(problems, ["Saved test counts were damaged and have been restarted."]);
});

for (const [label, stored, reported] of [
  ["a list", "[]", true],
  ["a string", '"7"', true],
  ["text that is not JSON", "{totalTests:", true],
  ["the JSON value null", "null", false]
]) {
  test(`counts saved as ${label} restart at zero`, () => {
    const { env, ach, problems } = setup({ [STATS_KEY]: stored });
    ach.checkUnlocks(result());
    assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 1, codeTests: 0, classicTests: 1, highAccuracyCount: 0 });
    assert.equal(problems.length, reported ? 1 : 0);
  });
}

test("fractional and negative counts are made whole", () => {
  const { env, ach, problems } = setup({ [STATS_KEY]: JSON.stringify({ totalTests: 3.7, codeTests: -2, classicTests: 1, highAccuracyCount: "4" }) });
  ach.checkUnlocks(result({ mode: "words" }));
  assert.deepEqual(env.storage.getJson(STATS_KEY), { totalTests: 4, codeTests: 0, classicTests: 1, highAccuracyCount: 0 });
  assert.deepEqual(problems, ["Saved test counts were damaged and have been restarted."]);
});

test("when nothing can be written the unlock is still announced and the failure reported", () => {
  const { env, ach, problems } = setup();
  env.storage.failWrites();
  assert.deepEqual(ids(ach.checkUnlocks(result())), ["first_steps"]);
  // one failed write for the counts, one for the unlocked list
  assert.deepEqual(problems, [
    "Could not save: your browser's storage is full or blocked.",
    "Could not save: your browser's storage is full or blocked."
  ]);
});

test("with storage blocked entirely a round can still finish", () => {
  const { env, ach, problems } = setup();
  env.storage.block();
  assert.deepEqual(ids(ach.checkUnlocks(result())), ["first_steps"]);
  assert.equal(env.plain(ach.getAll()).length, 10);
  assert.equal(problems[0], "Your browser is blocking saved data, so scores and achievements cannot be loaded.");
});
