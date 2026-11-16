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

// ---------------------------------------------------------------------------
// Custom text: pasted text is made typable.
// Special characters are built from code points so this file stays ASCII
// and the invisible ones can be seen.
// ---------------------------------------------------------------------------

const u = (...codePoints) => String.fromCodePoint(...codePoints);
const normalize = text => TextContent.normalizeCustomText(text);

test("curly quotes become straight quotes", () => {
  const curly = `${u(0x201c)}It${u(0x2019)}s ${u(0x2018)}fine${u(0x2019)},${u(0x201d)} she said.`;
  assert.equal(normalize(curly), `"It's 'fine'," she said.`);
  assert.equal(normalize(`${u(0x201e)}low${u(0x201f)} ${u(0x201a)}low${u(0x201b)} 5${u(0x2032)} 3${u(0x2033)}`), `"low" 'low' 5' 3"`);
});

test("dashes of every length become a hyphen and an ellipsis becomes three dots", () => {
  const dashes = [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212].map(c => `a${u(c)}b`).join(" ");
  assert.equal(normalize(dashes), "a-b a-b a-b a-b a-b a-b a-b");
  assert.equal(normalize(`wait${u(0x2026)} what`), "wait... what");
});

test("non-breaking and fixed-width spaces become a normal space", () => {
  for (const code of [0x00a0, 0x2002, 0x2003, 0x2009, 0x202f, 0x3000]) {
    assert.equal(normalize(`one${u(code)}two`), "one two", `U+${code.toString(16)}`);
  }
});

test("invisible characters are removed", () => {
  for (const code of [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad]) {
    assert.equal(normalize(`in${u(code)}visible`), "invisible", `U+${code.toString(16)}`);
  }
  assert.equal(normalize(`bell${u(0x07)} null${u(0x00)} delete${u(0x7f)}`), "bell null delete");
});

test("line endings are unified, tabs become two spaces, trailing spaces go", () => {
  assert.equal(normalize("one\r\ntwo\rthree\nfour"), "one\ntwo\nthree\nfour");
  assert.equal(normalize("if (x) {\n\treturn 1;\n}"), "if (x) {\n  return 1;\n}");
  assert.equal(normalize("ends in spaces   \nnext line \t\nlast"), "ends in spaces\nnext line\nlast");
  assert.equal(normalize("   padded   "), "padded");
});

test("indentation, blank lines and double spaces inside a line are kept", () => {
  const code = "def f():\n    return 1\n\n\nx  =  2";
  assert.equal(normalize(code), code);
});

test("typable text is returned unchanged", () => {
  const plain = "Plain text, nothing special: 100% typable! (a+b)*c = [d] {e} <f> #g @h ~i `j` \\k | l ^m & n";
  assert.equal(normalize(plain), plain);
  for (const pool of [...Object.values(content.classicTexts), ...Object.values(content.codeSnippets)]) {
    pool.forEach(text => assert.equal(normalize(text), text));
  }
});

test("letters of any alphabet, accents and emoji are left alone", () => {
  const text = `na${u(0xef)}ve caf${u(0xe9)} ${u(0xfc)}ber ${u(0x434, 0x43e, 0x431, 0x440, 0x44b, 0x439)} ${u(0x65e5, 0x672c)} ${u(0x1f600)}`;
  assert.equal(normalize(text), text);
});

test("a realistic paste from a document", () => {
  const pasted = `${u(0x201c)}It${u(0x2019)}s a long${u(0x2011)}awaited day,${u(0x201d)} she said ${u(0x2014)} and smiled${u(0x2026)}${u(0xa0)}Really.  \r\n\tSecond line${u(0x200b)} here.   `;
  assert.equal(normalize(pasted), `"It's a long-awaited day," she said - and smiled... Really.\n  Second line here.`);
  assert.match(normalize(pasted), /^[\x20-\x7e\n]+$/);
});

test("an unknown option falls back like the single-text getters do", () => {
  const classic = TextContent.createStream("classic", "nope", seededRandom(1));
  assert.ok(content.classicTexts.medium.includes(classic.next()));
  const code = TextContent.createStream("code", "nope", seededRandom(1));
  assert.ok(content.codeSnippets.javascript.includes(code.next()));
});
