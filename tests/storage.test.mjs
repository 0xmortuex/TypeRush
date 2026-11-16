import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserEnv } from "./helpers/browser-env.mjs";

function setup(storage = {}) {
  const env = createBrowserEnv({ scripts: ["storage.js"], storage });
  const save = env.get("SaveData");
  const problems = [];
  save.setProblemHandler((message, error) => problems.push({ message, hasError: error !== undefined }));
  return { env, save, problems };
}

test("read returns the fallback when nothing is stored", () => {
  const { save, problems } = setup();
  assert.equal(save.read("missing", "fallback"), "fallback");
  assert.deepEqual(problems, []);
});

test("read returns the parsed value", () => {
  const { env, save, problems } = setup({ a: '{"n":1,"list":[1,2]}', b: "0", c: "null", d: '""' });
  assert.deepEqual(env.plain(save.read("a", null)), { n: 1, list: [1, 2] });
  assert.equal(save.read("b", "fallback"), 0, "a stored falsy value is not mistaken for nothing");
  assert.equal(save.read("c", "fallback"), null);
  assert.equal(save.read("d", "fallback"), "");
  assert.deepEqual(problems, []);
});

test("text that is not JSON is reported once and the fallback returned", () => {
  const { env, save, problems } = setup({ bad: "{oops" });
  assert.equal(save.read("bad", "fallback"), "fallback");
  assert.equal(save.read("bad", "fallback"), "fallback");
  assert.deepEqual(problems, [{ message: 'Saved data "bad" could not be read and was ignored.', hasError: true }]);
  assert.equal(env.storage.get("bad"), "{oops", "the unreadable value is left in place");
});

test("blocked storage is reported once for reads", () => {
  const { env, save, problems } = setup({ a: "1" });
  env.storage.block();
  assert.equal(save.read("a", "fallback"), "fallback");
  assert.equal(save.read("b", "other"), "other");
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /blocking saved data/);
});

test("write stores JSON and says whether it worked", () => {
  const { env, save, problems } = setup();
  assert.equal(save.write("k", { a: [1, 2] }), true);
  assert.equal(env.storage.get("k"), '{"a":[1,2]}');
  env.storage.failWrites();
  assert.equal(save.write("k", { a: [] }), false);
  assert.equal(save.write("k", { a: [] }), false);
  assert.equal(env.storage.get("k"), '{"a":[1,2]}', "the previous value survives a failed write");
  assert.equal(problems.length, 2, "every failed save is reported: each one is something that was lost");
});

test("remove deletes the key and says whether it worked", () => {
  const { env, save, problems } = setup({ k: "1" });
  assert.equal(save.remove("k"), true);
  assert.equal(env.storage.get("k"), null);
  env.storage.block();
  assert.equal(save.remove("k"), false);
  assert.equal(problems.length, 1);
});

test("report passes a message on once", () => {
  const { save, problems } = setup();
  save.report("something is off");
  save.report("something is off");
  save.report("something else");
  assert.deepEqual(problems.map(p => p.message), ["something is off", "something else"]);
});

test("without an app handler problems go to console.error", () => {
  const env = createBrowserEnv({ scripts: ["storage.js"], storage: { bad: "nope" } });
  env.get("SaveData").read("bad", null);
  assert.equal(env.consoleErrors.length, 1);
  assert.match(env.consoleErrors[0], /\[TypeRush\] Saved data "bad" could not be read/);
});
