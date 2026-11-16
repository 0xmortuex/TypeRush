const Achievements = (() => {
  const STORAGE_KEY = "typerush_achievements";
  const STATS_KEY = "typerush_stats";

  const definitions = [
    { id: "first_steps", icon: "\u26a1", title: "First Steps", description: "Complete your first typing test", check: (r, s) => s.totalTests >= 1 },
    { id: "speed_demon", icon: "\ud83d\udd25", title: "Speed Demon", description: "Reach 80+ WPM", check: (r) => r.wpm >= 80 },
    { id: "perfectionist", icon: "\ud83d\udcaf", title: "Perfectionist", description: "Achieve 100% accuracy on any test", check: (r) => r.accuracy === 100 },
    // Earned by a round that actually lasted two minutes. This used to look
    // at the configured duration, which Words and Custom rounds reported as
    // 9999 seconds, so any of them unlocked it.
    { id: "marathoner", icon: "\ud83c\udfc3", title: "Marathoner", description: "Complete a 120-second test", check: (r) => r.duration >= 120 },
    { id: "code_monkey", icon: "\ud83d\udcbb", title: "Code Monkey", description: "Complete 5 tests in Code mode", check: (r, s) => s.codeTests >= 5 },
    { id: "wordsmith", icon: "\ud83d\udcda", title: "Wordsmith", description: "Complete 10 tests in Classic mode", check: (r, s) => s.classicTests >= 10 },
    { id: "sharpshooter", icon: "\ud83c\udfaf", title: "Sharpshooter", description: "Achieve 98%+ accuracy 5 times", check: (r, s) => s.highAccuracyCount >= 5 },
    { id: "century_club", icon: "\ud83c\udfc6", title: "Century Club", description: "Reach 100+ WPM", check: (r) => r.wpm >= 100 },
    { id: "consistent", icon: "\ud83d\udd01", title: "Consistent", description: "Get an Excellent consistency rating", check: (r) => r.consistency === "Excellent" },
    { id: "dedicated", icon: "\ud83c\udf1f", title: "Dedicated", description: "Complete 25 total tests", check: (r, s) => s.totalTests >= 25 }
  ];

  // The list of unlocked achievement ids. Anything that is not a list of
  // ids is reported and treated as "nothing unlocked yet".
  function loadUnlocked() {
    const stored = SaveData.read(STORAGE_KEY, []);
    if (!Array.isArray(stored)) {
      SaveData.report("Saved achievements were damaged and could not be loaded.");
      return [];
    }
    return stored.filter(id => typeof id === "string");
  }

  function saveUnlocked(unlocked) {
    return SaveData.write(STORAGE_KEY, unlocked);
  }

  // The running counts behind the "complete N tests" achievements. A count
  // that is missing starts at 0. A count that is present but not a number
  // (a broken value would otherwise turn into NaN on the next test and
  // stay that way for good) is reported and restarted at 0.
  function loadStats() {
    const stats = { totalTests: 0, codeTests: 0, classicTests: 0, highAccuracyCount: 0 };
    const stored = SaveData.read(STATS_KEY, null);
    if (stored === null) return stats;
    if (typeof stored !== "object" || Array.isArray(stored)) {
      SaveData.report("Saved test counts were damaged and have been restarted.");
      return stats;
    }
    Object.keys(stats).forEach(key => {
      const value = stored[key];
      if (value === undefined) return;
      if (Number.isFinite(value) && value >= 0) {
        stats[key] = Math.floor(value);
      } else {
        SaveData.report("Saved test counts were damaged and have been restarted.");
      }
    });
    return stats;
  }

  function saveStats(stats) {
    return SaveData.write(STATS_KEY, stats);
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
