const Leaderboard = (() => {
  const STORAGE_KEY = "typerush_leaderboard";
  // The fastest runs kept for each mode. The limit is per mode so that the
  // slower kinds of typing (code) are not pushed off by the faster ones.
  const MAX_ENTRIES = 50;
  const MODES = ["classic", "code", "words", "custom"];

  const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  // Returns the entry in the shape the rest of the app relies on, or null
  // when it is not a usable score (no known mode, no WPM, no accuracy).
  //
  // Difficulty is a Classic-only setting and language a Code-only one.
  // Entries saved before November 2026 carry difficulty "medium" for every
  // mode (the engine used to default it), so the stray values are blanked.
  // This keeps old Code / Words / Custom scores counting towards personal
  // bests now that new results leave those fields empty, and stops old
  // Code scores in different languages from being lumped together.
  function cleanEntry(entry) {
    if (entry === null || typeof entry !== "object") return null;
    if (!MODES.includes(entry.mode)) return null;
    if (!Number.isFinite(entry.wpm) || !Number.isFinite(entry.accuracy)) return null;
    return {
      ...entry,
      difficulty: entry.mode === "classic" && typeof entry.difficulty === "string" ? entry.difficulty : "",
      language: entry.mode === "code" && typeof entry.language === "string" ? entry.language : "",
      duration: finiteOr(entry.duration, 0),
      rawWpm: finiteOr(entry.rawWpm, entry.wpm),
      date: typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) ? entry.date : ""
    };
  }

  // Scores are only comparable within the same mode and variant.
  function categoryKey(entry) {
    const difficulty = entry.mode === "classic" ? (entry.difficulty || "") : "";
    const language = entry.mode === "code" ? (entry.language || "") : "";
    return `${entry.mode}|${difficulty}|${language}`;
  }

  function load() {
    const stored = SaveData.read(STORAGE_KEY, []);
    if (!Array.isArray(stored)) {
      SaveData.report("The saved leaderboard was damaged and could not be loaded.");
      return [];
    }
    const entries = stored.map(cleanEntry).filter(entry => entry !== null);
    const skipped = stored.length - entries.length;
    if (skipped > 0) {
      SaveData.report(`${skipped} damaged leaderboard ${skipped === 1 ? "entry was" : "entries were"} skipped.`);
    }
    return entries;
  }

  // Fastest first, at most MAX_ENTRIES per mode. Between equal speeds the
  // run that was saved first stays ahead.
  function trim(entries) {
    const perMode = {};
    return entries
      .slice()
      .sort((a, b) => b.wpm - a.wpm)
      .filter(entry => {
        perMode[entry.mode] = (perMode[entry.mode] || 0) + 1;
        return perMode[entry.mode] <= MAX_ENTRIES;
      });
  }

  // Returns { saved: true }, or { saved: false, reason } where reason is
  // "not-fast-enough" (slower than the MAX_ENTRIES runs already kept for
  // this mode) or "storage" (the browser refused the write).
  function addEntry(result) {
    const entry = cleanEntry({
      mode: result.mode,
      difficulty: result.difficulty || "",
      language: result.language || "",
      wordCount: result.wordCount || 0,
      duration: result.duration,
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      consistency: result.consistency,
      date: result.date,
      textPreview: result.textPreview
    });
    if (entry === null) throw new Error("Leaderboard.addEntry: result is not a valid score");

    const kept = trim([...load(), entry]);
    if (!kept.includes(entry)) return { saved: false, reason: "not-fast-enough" };
    if (!SaveData.write(STORAGE_KEY, kept)) return { saved: false, reason: "storage" };
    return { saved: true };
  }

  function getFiltered(mode, sortBy) {
    let entries = load();
    if (mode && mode !== "all") {
      entries = entries.filter(e => e.mode === mode);
    }
    switch (sortBy) {
      case "accuracy":
        entries.sort((a, b) => b.accuracy - a.accuracy);
        break;
      case "date":
        // Entries without a usable date sort as the oldest.
        entries.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
        break;
      default:
        entries.sort((a, b) => b.wpm - a.wpm);
    }
    return entries;
  }

  function isPersonalBest(result) {
    const key = categoryKey(result);
    const entries = load().filter(e => categoryKey(e) === key);
    if (entries.length === 0) return true;
    return result.wpm > Math.max(...entries.map(e => e.wpm));
  }

  function getBestByMode() {
    const entries = load();
    const best = {};
    entries.forEach(e => {
      const key = categoryKey(e);
      if (!best[key] || e.wpm > best[key].wpm) {
        best[key] = e;
      }
    });
    return best;
  }

  // true when the stored leaderboard was removed.
  function clear() {
    return SaveData.remove(STORAGE_KEY);
  }

  function getTotalTests() {
    return load().length;
  }

  return { load, addEntry, getFiltered, isPersonalBest, getBestByMode, clear, getTotalTests, MAX_ENTRIES };
})();
