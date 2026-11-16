// Loads the site's plain <script> files into an isolated context so their
// logic can be tested with Node's built-in test runner — no dependencies and
// no build step. The scripts are the exact files the browser runs.
//
// The context gets a fake clock, a fake requestAnimationFrame queue and an
// in-memory localStorage, all controlled by the test.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "js");

export function createBrowserEnv({ scripts, storage = {} } = {}) {
  let now = 1000; // arbitrary non-zero start, like a page that has been open for a second
  let nextFrameId = 1;
  let frames = [];
  const store = new Map(Object.entries(storage));
  const consoleErrors = [];

  const sandbox = {
    console: {
      log: (...args) => console.log(...args),
      warn: (...args) => console.warn(...args),
      // Captured rather than printed: tests assert on what was reported.
      error: (...args) => consoleErrors.push(args.map(String).join(" "))
    },
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      const id = nextFrameId++;
      frames.push({ id, callback });
      return id;
    },
    cancelAnimationFrame(id) {
      frames = frames.filter(f => f.id !== id);
    },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); }
    }
  };
  const context = vm.createContext(sandbox);

  for (const name of scripts) {
    const file = path.join(JS_DIR, name);
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }

  return {
    // Top-level `const X = ...` in a script is not a property of the global
    // object, so modules are read back by evaluating their name.
    get(name) {
      return vm.runInContext(name, context);
    },
    // Objects created inside the context have that context's prototypes;
    // round-trip through JSON to compare them with plain literals.
    plain(value) {
      return JSON.parse(JSON.stringify(value));
    },
    consoleErrors,
    storage: {
      get: key => (store.has(key) ? store.get(key) : null),
      getJson: key => (store.has(key) ? JSON.parse(store.get(key)) : null),
      set: (key, value) => { store.set(key, value); },
      // Makes every write fail, like a full or blocked localStorage.
      failWrites() {
        sandbox.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
      },
      // Makes every access fail, like storage blocked by browser settings.
      block() {
        const fail = () => { throw new Error("SecurityError: storage is blocked"); };
        sandbox.localStorage.getItem = fail;
        sandbox.localStorage.setItem = fail;
        sandbox.localStorage.removeItem = fail;
      }
    },
    clock: {
      now: () => now,
      // Moves the clock without delivering a frame (a hidden or throttled tab).
      advance(ms) {
        now += ms;
      },
      // Delivers one animation frame at the current time.
      frame() {
        const due = frames;
        frames = [];
        due.forEach(f => f.callback(now));
      },
      // Runs the clock forward delivering a frame every `step` ms, like a
      // visible tab at 60 fps.
      run(ms, step = 16) {
        let left = ms;
        while (left > 0) {
          const d = Math.min(step, left);
          now += d;
          left -= d;
          this.frame();
        }
      },
      pendingFrames: () => frames.length
    }
  };
}

// Types `text` into the engine one character every `msPerChar`, with frames
// running in between, the way a person at a visible tab would.
export function typeText(env, engine, text, msPerChar) {
  for (const char of text) {
    env.clock.run(msPerChar);
    engine.handleInput(char);
  }
}
