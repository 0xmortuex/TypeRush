const Achievements = (() => {
  const STORAGE_KEY = "typerush_achievements";
  const STATS_KEY = "typerush_stats";

  const definitions = [
    { id: "first_steps", icon: "\u26a1", title: "First Steps", description: "Complete your first typing test", check: (r, s) => s.totalTests >= 1 },
    { id: "speed_demon", icon: "\ud83d\udd25", title: "Speed Demon", description: "Reach 80+ WPM", check: (r) => r.wpm >= 80 },
    { id: "perfectionist", icon: "\ud83d\udcaf", title: "Perfectionist", description: "Achieve 100% accuracy on any test", check: (r) => r.accuracy === 100 },
    { id: "marathoner", icon: "\ud83c\udfc3", title: "Marathoner", description: "Complete a 120-second test", check: (r) => r.configuredDuration >= 120 },
    { id: "code_monkey", icon: "\ud83d\udcbb", title: "Code Monkey", description: "Complete 5 tests in Code mode", check: (r, s) => s.codeTests >= 5 },
    { id: "wordsmith", icon: "\ud83d\udcda", title: "Wordsmith", description: "Complete 10 tests in Classic mode", check: (r, s) => s.classicTests >= 10 },
    { id: "sharpshooter", icon: "\ud83c\udfaf", title: "Sharpshooter", description: "Achieve 98%+ accuracy 5 times", check: (r, s) => s.highAccuracyCount >= 5 },
    { id: "century_club", icon: "\ud83c\udfc6", title: "Century Club", description: "Reach 100+ WPM", check: (r) => r.wpm >= 100 },
    { id: "consistent", icon: "\ud83d\udd01", title: "Consistent", description: "Get an Excellent consistency rating", check: (r) => r.consistency === "Excellent" },
    { id: "dedicated", icon: "\ud83c\udf1f", title: "Dedicated", description: "Complete 25 total tests", check: (r, s) => s.totalTests >= 25 }
  ];

  function loadUnlocked() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveUnlocked(unlocked) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    } catch { /* ignore */ }
  }

  function loadStats() {
    try {
      const data = localStorage.getItem(STATS_KEY);
      return data ? JSON.parse(data) : { totalTests: 0, codeTests: 0, classicTests: 0, highAccuracyCount: 0 };
    } catch {
      return { totalTests: 0, codeTests: 0, classicTests: 0, highAccuracyCount: 0 };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch { /* ignore */ }
  }

  function updateStats(result) {
    const stats = loadStats();
    stats.totalTests++;
    if (result.mode === "code") stats.codeTests++;
    if (result.mode === "classic") stats.classicTests++;
    if (result.accuracy >= 98) stats.highAccuracyCount++;
    saveStats(stats);
    return stats;
  }

  function checkUnlocks(result) {
    const stats = updateStats(result);
    const unlocked = loadUnlocked();
    const newlyUnlocked = [];

    definitions.forEach(def => {
      if (!unlocked.includes(def.id) && def.check(result, stats)) {
        unlocked.push(def.id);
        newlyUnlocked.push(def);
      }
    });

    if (newlyUnlocked.length > 0) {
      saveUnlocked(unlocked);
    }

    return newlyUnlocked;
  }

  function getAll() {
    const unlocked = loadUnlocked();
    return definitions.map(def => ({
      ...def,
      unlocked: unlocked.includes(def.id)
    }));
  }

  return { checkUnlocks, getAll, definitions };
})();
