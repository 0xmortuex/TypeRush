const GameEngine = (() => {
  let state = null;
  let rafId = null;
  let onUpdate = null;
  let onEnd = null;
  let isPaused = false;
  let pauseStartTime = 0;
  let totalPausedTime = 0;
  let perSecondWpm = [];
  let lastSecond = 0;

  // options.duration (seconds) makes the round a timed test that ends at the
  // buzzer. Without it the round is untimed: the clock counts up and the
  // round ends when the last character is typed.
  function init(text, options = {}) {
    // A new round must never inherit the previous round's frame loop.
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    const duration = options.duration > 0 ? Number(options.duration) : 0;
    state = {
      text,
      chars: text.split(""),
      mode: options.mode || "classic",
      difficulty: options.difficulty || "",
      language: options.language || "",
      duration,
      wordCount: options.wordCount || 0,
      timedMode: duration > 0,
      typed: [],
      currentIndex: 0,
      // Characters currently on screen (Backspace takes them back out).
      correctCount: 0,
      incorrectCount: 0,
      totalTyped: 0,
      // Every character key ever pressed this round, and how many of those
      // were wrong. Backspace does not undo these: accuracy is about what
      // your fingers did, not what the text looks like afterwards.
      keystrokes: 0,
      mistakes: 0,
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
    perSecondWpm = [];
    lastSecond = 0;
    return state;
  }

  // Share of character keystrokes that were correct, as a whole percentage.
  // 100 is reserved for a round without a single mistake, so 199 right out
  // of 200 reads 99%, not a rounded-up 100%.
  function computeAccuracy(keystrokes, mistakes) {
    if (keystrokes <= 0) return 100;
    const pct = Math.round(((keystrokes - mistakes) / keystrokes) * 100);
    return mistakes > 0 ? Math.min(pct, 99) : 100;
  }

  // WPM uses the standard five-characters-per-word convention.
  // wpm counts only characters that are currently correct; rawWpm counts
  // every character currently typed, right or wrong.
  function computeStats(counts) {
    const minutes = counts.elapsed / 60;
    return {
      wpm: minutes > 0 ? Math.round((counts.correctCount / 5) / minutes) : 0,
      rawWpm: minutes > 0 ? Math.round((counts.totalTyped / 5) / minutes) : 0,
      accuracy: computeAccuracy(counts.keystrokes, counts.mistakes)
    };
  }

  // Seconds of typing time at clock reading `now`: time since the first
  // keystroke minus pauses, never negative, and never past the buzzer of a
  // timed test (a throttled or hidden tab can deliver its next frame long
  // after the time ran out).
  function elapsedAt(now) {
    let seconds = (now - state.startTime - totalPausedTime) / 1000;
    if (seconds < 0) seconds = 0;
    if (state.timedMode && seconds > state.duration) seconds = state.duration;
    return seconds;
  }

  function refreshStats(now) {
    state.elapsed = elapsedAt(now);
    const stats = computeStats(state);
    state.wpm = stats.wpm;
    state.rawWpm = stats.rawWpm;
    state.accuracy = stats.accuracy;
  }

  // One point per whole second for the WPM-over-time chart.
  function recordSecond() {
    const currentSecond = Math.floor(state.elapsed);
    if (currentSecond > lastSecond && currentSecond > 0) {
      perSecondWpm.push({ time: currentSecond, wpm: state.wpm });
      lastSecond = currentSecond;
    }
  }

  // True once a timed test has used up its time, whether or not the frame
  // that ends it has been delivered yet.
  function timeIsUp(now) {
    return state.timedMode && state.isRunning && elapsedAt(now) >= state.duration;
  }

  function start() {
    if (!state || state.isRunning) return;
    state.startTime = performance.now();
    state.isRunning = true;
    tick();
  }

  function tick() {
    if (!state || !state.isRunning || isPaused) return;

    refreshStats(performance.now());
    recordSecond();

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

    const now = performance.now();

    // A key pressed after the buzzer does not count.
    if (timeIsUp(now)) {
      end();
      return;
    }

    const expected = state.chars[state.currentIndex];
    if (expected === undefined) return;

    const correct = char === expected;

    state.charTimings.push({
      index: state.currentIndex,
      expected,
      typed: char,
      correct,
      time: now - state.startTime - totalPausedTime
    });

    state.typed[state.currentIndex] = { char, correct };

    state.keystrokes++;
    if (correct) {
      state.correctCount++;
    } else {
      state.incorrectCount++;
      state.mistakes++;
    }

    state.totalTyped++;
    state.currentIndex++;

    if (state.currentIndex >= state.chars.length) {
      end();
      return;
    }

    refreshStats(now);
    if (onUpdate) onUpdate(state);
  }

  function handleBackspace() {
    if (!state || state.isFinished || isPaused || state.currentIndex === 0) return;

    const now = performance.now();
    if (timeIsUp(now)) {
      end();
      return;
    }

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

    if (state.isRunning) refreshStats(now);
    if (onUpdate) onUpdate(state);
  }

  // Adds more text to the end of a round in progress. Timed tests use this
  // to keep the player supplied until the buzzer.
  function appendText(extra) {
    if (!state || state.isFinished || !extra) return;
    state.text += extra;
    for (const char of extra.split("")) state.chars.push(char);
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

    // Take the final reading from the clock, not from whichever frame ran
    // last. While paused the clock is stopped, so the last reading stands.
    if (state.startTime !== null && !isPaused) {
      refreshStats(performance.now());
      recordSecond();
    }

    state.isFinished = true;
    state.isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);

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
        const key = t.expected === " " ? "space" : t.expected === "\n" ? "enter" : t.expected;
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
      keystrokes: state.keystrokes,
      mistakes: state.mistakes,
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
    rafId = null;
    state = null;
    isPaused = false;
    onUpdate = null;
    onEnd = null;
  }

  return { init, start, handleInput, handleBackspace, appendText, pause, resume, end, setCallbacks, getState, isPausedState, destroy, getResults, computeStats, computeAccuracy };
})();
