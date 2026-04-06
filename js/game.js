const GameEngine = (() => {
  let state = null;
  let rafId = null;
  let onUpdate = null;
  let onEnd = null;
  let isPaused = false;
  let pauseStartTime = 0;
  let totalPausedTime = 0;
  let wpmHistory = [];
  let perSecondWpm = [];
  let lastSecond = 0;

  function init(text, options = {}) {
    const chars = text.split("");
    state = {
      text,
      chars,
      mode: options.mode || "classic",
      difficulty: options.difficulty || "medium",
      language: options.language || "",
      duration: options.duration || 60,
      wordCount: options.wordCount || 0,
      timedMode: options.mode !== "words",
      typed: [],
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      totalTyped: 0,
      startTime: null,
      elapsed: 0,
      wpm: 0,
      rawWpm: 0,
      accuracy: 100,
      isRunning: false,
      isFinished: false,
      charTimings: []
    };
    isPaused = false;
    totalPausedTime = 0;
    wpmHistory = [];
    perSecondWpm = [];
    lastSecond = 0;
    return state;
  }

  function start() {
    if (!state || state.isRunning) return;
    state.startTime = performance.now();
    state.isRunning = true;
    tick();
  }

  function tick() {
    if (!state || !state.isRunning || isPaused) return;

    const now = performance.now();
    state.elapsed = (now - state.startTime - totalPausedTime) / 1000;

    if (state.elapsed > 0) {
      state.wpm = Math.round((state.correctCount / 5) / (state.elapsed / 60));
      state.rawWpm = Math.round((state.totalTyped / 5) / (state.elapsed / 60));
      if (state.totalTyped > 0) {
        state.accuracy = Math.round((state.correctCount / state.totalTyped) * 100);
      }
    }

    const currentSecond = Math.floor(state.elapsed);
    if (currentSecond > lastSecond && currentSecond > 0) {
      perSecondWpm.push({ time: currentSecond, wpm: state.wpm });
      lastSecond = currentSecond;
    }

    if (state.timedMode && state.elapsed >= state.duration) {
      end();
      return;
    }

    if (onUpdate) onUpdate(state);
    rafId = requestAnimationFrame(tick);
  }

  function handleInput(char) {
    if (!state || state.isFinished || isPaused) return;

    if (!state.isRunning) {
      start();
    }

    const expected = state.chars[state.currentIndex];
    const now = performance.now();

    if (expected === undefined) return;

    state.charTimings.push({
      index: state.currentIndex,
      expected,
      typed: char,
      correct: char === expected,
      time: now - state.startTime - totalPausedTime
    });

    state.typed[state.currentIndex] = {
      char,
      correct: char === expected
    };

    if (char === expected) {
      state.correctCount++;
    } else {
      state.incorrectCount++;
    }

    state.totalTyped++;
    state.currentIndex++;

    if (state.currentIndex >= state.chars.length) {
      end();
      return;
    }

    if (onUpdate) onUpdate(state);
  }

  function handleBackspace() {
    if (!state || state.isFinished || isPaused || state.currentIndex === 0) return;

    state.currentIndex--;
    const removed = state.typed[state.currentIndex];
    if (removed) {
      if (removed.correct) {
        state.correctCount--;
      } else {
        state.incorrectCount--;
      }
      state.totalTyped--;
      state.typed[state.currentIndex] = undefined;
    }

    if (onUpdate) onUpdate(state);
  }

  function pause() {
    if (!state || !state.isRunning || isPaused) return;
    isPaused = true;
    pauseStartTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
  }

  function resume() {
    if (!state || !isPaused) return;
    totalPausedTime += performance.now() - pauseStartTime;
    isPaused = false;
    tick();
  }

  function end() {
    if (!state || state.isFinished) return;
    state.isFinished = true;
    state.isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);

    if (state.elapsed > 0) {
      state.wpm = Math.round((state.correctCount / 5) / (state.elapsed / 60));
      state.rawWpm = Math.round((state.totalTyped / 5) / (state.elapsed / 60));
      if (state.totalTyped > 0) {
        state.accuracy = Math.round((state.correctCount / state.totalTyped) * 100);
      }
    }

    if (onEnd) onEnd(getResults());
  }

  function getResults() {
    if (!state) return null;

    const wpmValues = perSecondWpm.map(p => p.wpm);
    let consistency = "N/A";
    if (wpmValues.length > 1) {
      const mean = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
      const variance = wpmValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / wpmValues.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? (stdDev / mean) * 100 : 100;
      if (cv < 10) consistency = "Excellent";
      else if (cv < 20) consistency = "Good";
      else if (cv < 35) consistency = "Fair";
      else consistency = "Poor";
    }

    const mistyped = {};
    state.charTimings.forEach(t => {
      if (!t.correct) {
        const key = t.expected === " " ? "space" : t.expected;
        mistyped[key] = (mistyped[key] || 0) + 1;
      }
    });

    return {
      mode: state.mode,
      difficulty: state.difficulty,
      language: state.language,
      duration: Math.round(state.elapsed),
      configuredDuration: state.duration,
      wordCount: state.wordCount,
      wpm: state.wpm,
      rawWpm: state.rawWpm,
      accuracy: state.accuracy,
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      totalTyped: state.totalTyped,
      consistency,
      wpmOverTime: perSecondWpm,
      mistyped,
      textPreview: state.text.substring(0, 30),
      date: new Date().toISOString()
    };
  }

  function setCallbacks(updateCb, endCb) {
    onUpdate = updateCb;
    onEnd = endCb;
  }

  function getState() {
    return state;
  }

  function isPausedState() {
    return isPaused;
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    state = null;
    isPaused = false;
    onUpdate = null;
    onEnd = null;
  }

  return { init, start, handleInput, handleBackspace, pause, resume, end, setCallbacks, getState, isPausedState, destroy, getResults };
})();
