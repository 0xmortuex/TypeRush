import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserEnv } from "./helpers/browser-env.mjs";

const env = createBrowserEnv({ scripts: ["texts.js"] });
const TextContent = env.get("TextContent");
const content = TextContent.getContent();

// Small deterministic generator so the shuffles are repeatable.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const classicPools = Object.entries(content.classicTexts);
const codePools = Object.entries(content.codeSnippets);

test("every difficulty and language has content", () => {
  assert.deepEqual(classicPools.map(([name]) => name), ["easy", "medium", "hard"]);
  assert.deepEqual(codePools.map(([name]) => name), ["javascript", "python", "html", "css", "rust"]);
  for (const [name, pool] of [...classicPools, ...codePools]) {
    assert.ok(pool.length >= 10, `${name} has ${pool.length} texts`);
    assert.equal(new Set(pool).size, pool.length, `${name} has no duplicate texts`);
  }
});

// Anything outside printable ASCII (curly quotes, long dashes, tabs,
// non-breaking spaces) cannot be typed on a plain keyboard.
test("classic texts contain only characters that can be typed", () => {
  for (const [name, pool] of classicPools) {
    pool.forEach((text, i) => {
      assert.match(text, /^[\x20-\x7e]+$/, `${name}[${i}]`);
      assert.doesNotMatch(text, / {2}/, `${name}[${i}] has a double space`);
      assert.equal(text, text.trim(), `${name}[${i}] has leading or trailing space`);
    });
  }
});

test("code snippets contain only characters that can be typed", () => {
  for (const [name, pool] of codePools) {
    pool.forEach((text, i) => {
      assert.match(text, /^[\x20-\x7e\n]+$/, `${name}[${i}]`);
      assert.doesNotMatch(text, / \n/, `${name}[${i}] has a line ending in a space`);
      assert.equal(text, text.trim(), `${name}[${i}] has leading or trailing whitespace`);
    });
  }
});

test("the word list is plain lowercase words", () => {
  assert.ok(content.wordList.length > 500);
  content.wordList.forEach(word => assert.match(word, /^[a-z]+$/));
});

test("generateWords returns the requested number of words from the list", () => {
  for (const count of [25, 50, 100, 200]) {
    const words = TextContent.generateWords(count).split(" ");
    assert.equal(words.length, count);
    words.forEach(word => assert.ok(content.wordList.includes(word), word));
  }
});

test("getClassicText and getCodeSnippet return a text from the right pool", () => {
  for (const [name, pool] of classicPools) assert.ok(pool.includes(TextContent.getClassicText(name)));
  for (const [name, pool] of codePools) assert.ok(pool.includes(TextContent.getCodeSnippet(name)));
  assert.ok(content.classicTexts.medium.includes(TextContent.getClassicText("unknown")), "unknown difficulty falls back to medium");
  assert.ok(content.codeSnippets.javascript.includes(TextContent.getCodeSnippet("unknown")), "unknown language falls back to JavaScript");
});

test("a stream serves the whole pool before repeating anything", () => {
  for (const [name, pool] of [...classicPools, ...codePools]) {
    const mode = name in content.classicTexts ? "classic" : "code";
    const stream = TextContent.createStream(mode, name, seededRandom(42));
    const firstPass = Array.from({ length: pool.length }, () => stream.next());
    assert.deepEqual([...firstPass].sort(), [...pool].sort(), name);
  }
});

test("a stream never serves the same text twice in a row", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const stream = TextContent.createStream("classic", "hard", seededRandom(seed));
    let previous = null;
    // 20 texts in the pool: 400 draws cross twenty reshuffles
    for (let i = 0; i < 400; i++) {
      const text = stream.next();
      assert.notEqual(text, previous, `seed ${seed}, draw ${i}`);
      previous = text;
    }
  }
});

test("streams are shuffled, not served in file order", () => {
  const pool = content.classicTexts.easy;
  const stream = TextContent.createStream("classic", "easy", seededRandom(7));
  const order = Array.from({ length: pool.length }, () => stream.next());
  assert.notDeepEqual(order, [...pool]);
});

test("quotes are joined by a space and code snippets by a blank line", () => {
  assert.equal(TextContent.createStream("classic", "easy").separator, " ");
  assert.equal(TextContent.createStream("code", "python").separator, "\n\n");
});

test("an unknown option falls back like the single-text getters do", () => {
  const classic = TextContent.createStream("classic", "nope", seededRandom(1));
  assert.ok(content.classicTexts.medium.includes(classic.next()));
  const code = TextContent.createStream("code", "nope", seededRandom(1));
  assert.ok(content.codeSnippets.javascript.includes(code.next()));
});
