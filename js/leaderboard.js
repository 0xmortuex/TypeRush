const Leaderboard = (() => {
  const STORAGE_KEY = "typerush_leaderboard";
  const MAX_ENTRIES = 50;

  // Difficulty is a Classic-only setting and language a Code-only one.
  // Entries saved before November 2026 carry difficulty "medium" for every
  // mode (the engine used to default it), so the stray values are blanked
  // when entries are read. This keeps old Code / Words / Custom scores
  // counting towards personal bests now that new results leave those
  // fields empty, and stops old Code scores in different languages from
  // being lumped together.
  function normalizeEntry(entry) {
    return {
      ...entry,
      difficulty: entry.mode === "classic" ? (entry.difficulty || "") : "",
      language: entry.mode === "code" ? (entry.language || "") : ""
    };
  }

  // Scores are only comparable within the same mode and variant.
  function categoryKey(entry) {
    const e = normalizeEntry(entry);
    return `${e.mode}|${e.difficulty}|${e.language}`;
  }

  function load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data).map(normalizeEntry) : [];
    } catch {
      return [];
    }
  }

  function save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { /* storage full or unavailable */ }
  }

  function addEntry(result) {
    const entries = load();
    entries.push(normalizeEntry({
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
    }));
    entries.sort((a, b) => b.wpm - a.wpm);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    save(entries);
    return entries;
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
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));
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

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getTotalTests() {
    return load().length;
  }

  return { load, addEntry, getFiltered, isPersonalBest, getBestByMode, clear, getTotalTests };
})();
