// Every read and write of saved data goes through here, so that a problem
// with localStorage is handled in one way: it is reported (the app shows it
// to the player) and the game carries on with safe values. Nothing is
// swallowed silently, and a damaged value can never stop a results screen.
const SaveData = (() => {
  // Until the app installs its own handler, problems go to the console.
  let problemHandler = (message, error) => {
    if (error) console.error(`[TypeRush] ${message}`, error);
    else console.error(`[TypeRush] ${message}`);
  };

  // The same damaged value is read many times in one visit (every results
  // screen, every leaderboard filter); it is reported once.
  const reported = new Set();

  function setProblemHandler(handler) {
    problemHandler = handler;
  }

  function report(message, error) {
    if (reported.has(message)) return;
    reported.add(message);
    problemHandler(message, error);
  }

  // The parsed value stored under `key`, or `fallback` when nothing is
  // stored. Blocked storage and text that is not JSON are reported, and
  // `fallback` is returned. Checking the shape is the caller's job.
  function read(key, fallback) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      report("Your browser is blocking saved data, so scores and achievements cannot be loaded.", error);
      return fallback;
    }
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      report(`Saved data "${key}" could not be read and was ignored.`, error);
      return fallback;
    }
  }

  // true when the value was stored. A failure (storage full or blocked) is
  // reported every time it happens: each one is something that was not saved.
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      problemHandler("Could not save: your browser's storage is full or blocked.", error);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      problemHandler("Could not clear saved data: your browser's storage is blocked.", error);
      return false;
    }
  }

  return { read, write, remove, report, setProblemHandler };
})();
