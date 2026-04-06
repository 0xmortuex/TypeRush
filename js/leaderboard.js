const Leaderboard = (() => {
  const STORAGE_KEY = "typerush_leaderboard";
  const MAX_ENTRIES = 50;

  function load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
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
    entries.push({
      mode: result.mode,
      difficulty: result.difficulty || "",
      language: result.language || "",
      duration: result.duration,
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      consistency: result.consistency,
      date: result.date,
      textPreview: result.textPreview
    });
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
    const entries = load().filter(e =>
      e.mode === result.mode &&
      e.difficulty === (result.difficulty || "") &&
      e.language === (result.language || "")
    );
    if (entries.length === 0) return true;
    return result.wpm > Math.max(...entries.map(e => e.wpm));
  }

  function getBestByMode() {
    const entries = load();
    const best = {};
    entries.forEach(e => {
      const key = `${e.mode}-${e.difficulty || e.language || ""}`;
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
