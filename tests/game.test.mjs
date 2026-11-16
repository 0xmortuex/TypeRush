import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserEnv, typeText } from "./helpers/browser-env.mjs";

function setup() {
  const env = createBrowserEnv({ scripts: ["game.js"] });
  return { env, engine: env.get("GameEngine") };
}

// Runs a round and returns the results object handed to the end callback.
function collectResults(engine) {
  const box = { results: null, updates: 0 };
  engine.setCallbacks(() => { box.updates++; }, r => { box.results = r; });
  return box;
}

test("computeStats: 250 correct characters in one minute is 50 WPM", () => {
  const { engine } = setup();
  const stats = engine.computeStats({ correctCount: 250, totalTyped: 260, keystrokes: 260, mistakes: 10, elapsed: 60 });
  assert.equal(stats.wpm, 50);
  assert.equal(stats.rawWpm, 52);
  assert.equal(stats.accuracy, 96);
});

test("computeStats: no time elapsed gives 0 WPM instead of dividing by zero", () => {
  const { engine } = setup();
  const stats = engine.computeStats({ correctCount: 19, totalTyped: 19, keystrokes: 19, mistakes: 0, elapsed: 0 });
  assert.equal(stats.wpm, 0);
  assert.equal(stats.rawWpm, 0);
  assert.equal(stats.accuracy, 100);
});

test("computeAccuracy: share of keystrokes that were right", () => {
  const { engine } = setup();
  assert.equal(engine.computeAccuracy(0, 0), 100, "nothing typed yet");
  assert.equal(engine.computeAccuracy(16, 0), 100);
  assert.equal(engine.computeAccuracy(16, 1), 94);
  assert.equal(engine.computeAccuracy(16, 2), 88);
  assert.equal(engine.computeAccuracy(3, 3), 0);
});

test("computeAccuracy: 100% is reserved for a round with no mistakes", () => {
  const { engine } = setup();
  // 199/200 = 99.5%, which plain rounding would show as 100%
  assert.equal(engine.computeAccuracy(200, 1), 99);
  assert.equal(engine.computeAccuracy(1000, 1), 99);
});

test("an untimed round reports WPM from the real elapsed time", () => {
  const { env, engine } = setup();
  const text = "the quick brown fox jumps over the lazy dog and run"; // 51 chars
  assert.equal(text.length, 51);
  engine.init(text, { mode: "custom" });
  const box = collectResults(engine);

  // the clock starts on the first keystroke, so 51 keys 200 ms apart span 10 s
  typeText(env, engine, text, 200);

  assert.ok(box.results, "round ended when the last character was typed");
  assert.equal(box.results.duration, 10);
  assert.equal(box.results.wpm, 61); // (51 / 5) / (10 / 60) = 61.2
  assert.equal(box.results.rawWpm, 61);
  assert.equal(box.results.accuracy, 100);
  assert.equal(box.results.keystrokes, 51);
  assert.equal(box.results.mistakes, 0);
  assert.equal(box.results.configuredDuration, 0, "untimed rounds have no configured duration");
});

test("the final reading comes from the clock, not from the last frame", () => {
  const { env, engine } = setup();
  const text = "abcdefghijklmnopqrstuvwxyz"; // 26 chars
  engine.init(text, { mode: "custom" });
  const box = collectResults(engine);

  // No animation frame is ever delivered (a starved tab, or a script typing
  // faster than the display refreshes). 25 gaps of 240 ms = 6 s.
  engine.handleInput(text[0]);
  for (const char of text.slice(1)) {
    env.clock.advance(240);
    engine.handleInput(char);
  }

  assert.equal(box.results.duration, 6);
  assert.equal(box.results.wpm, 52); // (26 / 5) / (6 / 60)
});

test("a mistake still counts against accuracy after it is corrected", () => {
  const { env, engine } = setup();
  const text = "hello world foo";
  engine.init(text, { mode: "custom" });
  const box = collectResults(engine);

  engine.handleInput("x"); // wrong: expected "h"
  env.clock.run(100);
  engine.handleBackspace();
  typeText(env, engine, text, 100);

  assert.equal(box.results.keystrokes, 16);
  assert.equal(box.results.mistakes, 1);
  assert.equal(box.results.accuracy, 94); // 15 of 16 keystrokes
  assert.equal(box.results.correctCount, 15, "the finished text is fully correct");
  assert.equal(box.results.incorrectCount, 0, "nothing wrong is left in the text");
  assert.deepEqual(env.plain(box.results.mistyped), { h: 1 });
});

test("uncorrected mistakes lower both accuracy and WPM", () => {
  const { env, engine } = setup();
  engine.init("abcdefghij klmno", { mode: "custom" }); // 16 chars
  const box = collectResults(engine);

  typeText(env, engine, "abXdefghiZ klmno", 100); // 15 gaps = 1.5 s

  assert.equal(box.results.accuracy, 88); // 14 of 16
  assert.equal(box.results.mistakes, 2);
  assert.equal(box.results.incorrectCount, 2);
  assert.equal(box.results.wpm, 112); // (14 / 5) / (1.5 / 60)
  assert.equal(box.results.rawWpm, 128); // (16 / 5) / (1.5 / 60)
  assert.deepEqual(env.plain(box.results.mistyped), { c: 1, j: 1 });
});

test("Backspace gives characters back but never erases keystrokes", () => {
  const { env, engine } = setup();
  engine.init("abcdef", { mode: "custom" });
  collectResults(engine);

  engine.handleBackspace(); // nothing typed yet: ignored
  assert.equal(engine.getState().currentIndex, 0);

  engine.handleInput("a");
  engine.handleInput("b");
  engine.handleInput("X");
  env.clock.run(50);
  engine.handleBackspace();
  engine.handleBackspace();

  const s = engine.getState();
  assert.equal(s.currentIndex, 1);
  assert.equal(s.correctCount, 1);
  assert.equal(s.incorrectCount, 0);
  assert.equal(s.totalTyped, 1);
  assert.equal(s.keystrokes, 3);
  assert.equal(s.mistakes, 1);
  assert.equal(s.accuracy, 67); // 2 of 3
});

test("a timed test ends at the buzzer and reports its configured length", () => {
  const { env, engine } = setup();
  const text = "x".repeat(400);
  engine.init(text, { mode: "classic", difficulty: "hard", duration: 15 });
  const box = collectResults(engine);

  // 100 ms per key for a little over 15 s
  for (let i = 0; i < 200 && !box.results; i++) {
    engine.handleInput("x");
    env.clock.run(100);
  }

  assert.ok(box.results);
  assert.equal(box.results.duration, 15);
  assert.equal(box.results.configuredDuration, 15);
  assert.equal(box.results.correctCount, 150);
  assert.equal(box.results.wpm, 120); // (150 / 5) / (15 / 60)
  assert.equal(box.results.wpmOverTime.length, 15, "one chart point per second");
  assert.equal(box.results.wpmOverTime.at(-1).time, 15);
});

test("time spent in a hidden or throttled tab cannot stretch a timed test", () => {
  const { env, engine } = setup();
  engine.init("y".repeat(400), { mode: "classic", difficulty: "hard", duration: 15 });
  const box = collectResults(engine);

  // 40 correct characters in the first 2 seconds...
  for (let i = 0; i < 40; i++) {
    engine.handleInput("y");
    env.clock.run(50);
  }
  // ...then no frames for 25 s (the browser stops animation frames for a
  // hidden tab), then the tab comes back.
  env.clock.advance(25000);
  env.clock.frame();

  assert.ok(box.results);
  assert.equal(box.results.duration, 15, "not 27 s");
  assert.equal(box.results.wpm, 32); // (40 / 5) / (15 / 60), not 18
});

test("a key pressed after the buzzer does not count", () => {
  const { env, engine } = setup();
  engine.init("z".repeat(100), { mode: "code", language: "rust", duration: 15 });
  const box = collectResults(engine);

  for (let i = 0; i < 10; i++) {
    engine.handleInput("z");
    env.clock.run(100);
  }
  env.clock.advance(20000); // the frame that would end the test never arrives
  engine.handleInput("z");

  assert.ok(box.results, "the late key ended the test instead of being typed");
  assert.equal(box.results.totalTyped, 10);
  assert.equal(box.results.keystrokes, 10);
  assert.equal(box.results.duration, 15);

  engine.handleBackspace(); // finished: ignored
  assert.equal(engine.getState().currentIndex, 10);
});

test("a timed test whose text runs out ends early with the real time", () => {
  const { env, engine } = setup();
  engine.init("abcdefghijk", { mode: "classic", difficulty: "easy", duration: 60 }); // 11 chars
  const box = collectResults(engine);

  typeText(env, engine, "abcdefghijk", 300); // 10 gaps = 3 s

  assert.ok(box.results);
  assert.equal(box.results.duration, 3);
  assert.equal(box.results.configuredDuration, 60);
  assert.equal(box.results.wpm, 44); // (11 / 5) / (3 / 60)
});

test("an untimed round never ends on the clock", () => {
  const { env, engine } = setup();
  engine.init("some words to type", { mode: "words", wordCount: 4 });
  const box = collectResults(engine);

  engine.handleInput("s");
  env.clock.run(10000, 1000);
  env.clock.advance(3 * 60 * 60 * 1000); // three hours away from the keyboard
  env.clock.frame();

  const s = engine.getState();
  assert.equal(box.results, null);
  assert.equal(s.isFinished, false);
  assert.equal(s.timedMode, false);
  assert.ok(s.elapsed > 10000, "the clock counts up and is not capped");
});

test("paused time is not typing time", () => {
  const { env, engine } = setup();
  const text = "the quick brown fox jumps over the lazy dog"; // 43 chars
  engine.init(text, { mode: "custom" });
  const box = collectResults(engine);

  typeText(env, engine, text.slice(0, 20), 50); // 19 gaps = 0.95 s
  engine.pause();
  assert.equal(engine.isPausedState(), true);
  const frozen = engine.getState().elapsed;

  env.clock.run(4000);
  engine.handleInput("z"); // ignored while paused
  engine.handleBackspace(); // ignored while paused
  assert.equal(engine.getState().currentIndex, 20);
  assert.equal(engine.getState().elapsed, frozen, "the clock is stopped");

  engine.resume();
  typeText(env, engine, text.slice(20), 50); // 23 more gaps

  // 42 gaps of 50 ms = 2.1 s of typing; the 4 s pause is excluded
  assert.equal(box.results.duration, 2);
  assert.equal(box.results.wpm, 246); // (43 / 5) / (2.1 / 60)
  assert.equal(box.results.keystrokes, 43);
});

test("pausing before the first keystroke does nothing", () => {
  const { engine } = setup();
  engine.init("abc", { mode: "custom" });
  engine.pause();
  assert.equal(engine.isPausedState(), false);
});

test("starting a new round cancels the previous round's frame loop", () => {
  const { env, engine } = setup();
  engine.init("first round", { mode: "custom" });
  engine.handleInput("f");
  assert.equal(env.clock.pendingFrames(), 1);

  engine.init("second round", { mode: "custom" });
  assert.equal(env.clock.pendingFrames(), 0);
  assert.equal(engine.getState().isRunning, false);
});

test("each mode reports only the settings that belong to it", () => {
  const { engine } = setup();

  engine.init("abc", { mode: "classic", difficulty: "hard", duration: 30 });
  assert.equal(engine.getResults().difficulty, "hard");
  assert.equal(engine.getResults().language, "");

  engine.init("abc", { mode: "code", language: "python", duration: 30 });
  assert.equal(engine.getResults().difficulty, "", "Code has no difficulty");
  assert.equal(engine.getResults().language, "python");

  engine.init("abc", { mode: "words", wordCount: 25 });
  assert.equal(engine.getResults().difficulty, "");
  assert.equal(engine.getResults().wordCount, 25);
  assert.equal(engine.getState().timedMode, false);

  engine.init("abc", { mode: "custom" });
  assert.equal(engine.getResults().difficulty, "");
  assert.equal(engine.getState().timedMode, false, "Custom counts up; it is not a 9999-second countdown");
});

test("mistyped Enter and Space are reported by name", () => {
  const { env, engine } = setup();
  engine.init("a b\nc", { mode: "custom" });
  const box = collectResults(engine);

  typeText(env, engine, "aXbXc", 100);

  assert.deepEqual(env.plain(box.results.mistyped), { space: 1, enter: 1 });
});

test("consistency needs at least two per-second samples", () => {
  const { env, engine } = setup();
  engine.init("abcdef", { mode: "custom" });
  const box = collectResults(engine);
  typeText(env, engine, "abcdef", 100); // half a second
  assert.equal(box.results.consistency, "N/A");
  assert.equal(box.results.wpmOverTime.length, 0);
});

test("appendText extends a round in progress", () => {
  const { env, engine } = setup();
  engine.init("abc", { mode: "classic", difficulty: "easy", duration: 15 });
  const box = collectResults(engine);

  engine.handleInput("a");
  engine.handleInput("b");
  engine.appendText(" def");
  assert.equal(engine.getState().text, "abc def");
  assert.equal(engine.getState().chars.length, 7);

  typeText(env, engine, "c de", 100);
  assert.equal(box.results, null, "typing past the original end does not finish the round");
  assert.equal(engine.getState().currentIndex, 6);
  assert.equal(engine.getState().correctCount, 6);
});

test("a timed test kept supplied with text runs to the buzzer", () => {
  const { env, engine } = setup();
  engine.init("0123456789", { mode: "code", language: "css", duration: 30 });
  const box = collectResults(engine);

  // the caller tops the text up whenever fewer than 5 characters remain
  let typed = 0;
  while (!box.results) {
    const s = engine.getState();
    if (s.chars.length - s.currentIndex < 5) engine.appendText("0123456789");
    engine.handleInput(String(typed % 10));
    typed++;
    env.clock.run(100);
  }

  assert.equal(box.results.duration, 30);
  assert.equal(box.results.correctCount, 300);
  assert.equal(box.results.wpm, 120); // (300 / 5) / (30 / 60)
  assert.equal(box.results.accuracy, 100);
  assert.equal(box.results.wpmOverTime.length, 30);
});

test("appendText is ignored once the round is over, and for empty text", () => {
  const { env, engine } = setup();
  engine.init("ab", { mode: "custom" });
  collectResults(engine);

  engine.appendText("");
  assert.equal(engine.getState().chars.length, 2);

  typeText(env, engine, "ab", 100);
  assert.equal(engine.getState().isFinished, true);
  engine.appendText("cd");
  assert.equal(engine.getState().text, "ab");
});
