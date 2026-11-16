const App = (() => {
  let currentView = "home";
  let currentSettings = {};
  let soundEnabled = false;
  let audioCtx = null;
  let caretEl = null;

  // Per-round motion state. Cleared by resetRoundState() at the start of
  // every game so a rapid Try Again / New Mode can't carry over stale
  // milestone/animation bookkeeping from the previous round.
  let lastWpmMilestone = 0;
  const WPM_MILESTONES = [50, 80, 100, 120, 150];

  const reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const prefersReducedMotion = () => !!(reducedMotionQuery && reducedMotionQuery.matches);

  const views = {
    home: null,
    game: null,
    results: null,
    leaderboard: null,
    achievements: null
  };

  // The player of a timed test is never allowed closer than TIMED_LOOKAHEAD
  // characters to the end of the text: more is added before that happens.
  // 600 characters is nine or more lines, so it is added below the lines
  // in view. The opening text is long enough that someone typing
  // TIMED_CHARS_PER_SECOND for the whole test (16 a second is about
  // 190 WPM) never needs any added at all.
  const TIMED_CHARS_PER_SECOND = 16;
  const TIMED_LOOKAHEAD = 600;
  let textStream = null;

  // The round on screen: one span per character, and the cursor position
  // those spans were last painted for.
  let charSpans = [];
  let renderedIndex = 0;

  // True while the clock is stopped because the typing field lost focus or
  // the tab was hidden (as opposed to the player pressing Escape).
  let blurPaused = false;

  function init() {
    cacheViews();
    bindNav();
    bindModeCards();
    bindGameInput();
    showView("home");
  }

  function resetRoundState() {
    lastWpmMilestone = 0;
    blurPaused = false;
    if (caretEl) caretEl.classList.remove("visible");
  }

  // Abandons the round in progress, if any. Every way out of the game view
  // goes through here so a round can never keep running behind another
  // view and later pull the player onto a results screen.
  function leaveGame() {
    GameEngine.destroy();
    blurPaused = false;
    document.getElementById("pauseOverlay").style.display = "none";
    document.getElementById("focusOverlay").style.display = "none";
  }

  function cacheViews() {
    views.home = document.getElementById("homeView");
    views.game = document.getElementById("gameView");
    views.results = document.getElementById("resultsView");
    views.leaderboard = document.getElementById("leaderboardView");
    views.achievements = document.getElementById("achievementsView");
  }

  function showView(name) {
    Object.values(views).forEach(v => { if (v) v.classList.remove("active"); });
    if (views[name]) {
      views[name].classList.add("active");
      currentView = name;
    }
  }

  function bindNav() {
    document.getElementById("navLogo").addEventListener("click", (e) => {
      e.preventDefault();
      leaveGame();
      showView("home");
    });

    document.getElementById("leaderboardBtn").addEventListener("click", () => {
      leaveGame();
      renderLeaderboard();
      showView("leaderboard");
    });

    document.getElementById("achievementsBtn").addEventListener("click", () => {
      leaveGame();
      renderAchievements();
      showView("achievements");
    });

    document.getElementById("soundToggle").addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      document.getElementById("soundToggle").textContent = soundEnabled ? "\ud83d\udd0a" : "\ud83d\udd07";
    });

    document.getElementById("lbBackBtn").addEventListener("click", () => showView("home"));
    document.getElementById("achBackBtn").addEventListener("click", () => showView("home"));
  }

  function bindModeCards() {
    document.querySelectorAll(".mode-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".mode-options") || e.target.closest(".time-options") || e.target.closest(".word-options")) return;
        startFromCard(card);
      });

      card.querySelectorAll(".mode-option").forEach(opt => {
        opt.addEventListener("click", () => {
          opt.closest(".mode-options, .time-options, .word-options").querySelectorAll(".mode-option").forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
        });
      });
    });

    document.getElementById("startCustomBtn").addEventListener("click", () => {
      const text = document.getElementById("customTextarea").value.trim();
      if (text.length < 10) {
        showToast("Please enter at least 10 characters.");
        return;
      }
      startGame({ mode: "custom", text });
    });
  }

  function startFromCard(card) {
    const mode = card.dataset.mode;
    if (mode === "custom") return;

    const settings = { mode };

    if (mode === "classic") {
      settings.difficulty = card.querySelector(".mode-options .selected")?.dataset.value || "medium";
      settings.duration = parseInt(card.querySelector(".time-options .selected")?.dataset.value || "60");
    } else if (mode === "code") {
      settings.language = card.querySelector(".mode-options .selected")?.dataset.value || "javascript";
      settings.duration = parseInt(card.querySelector(".time-options .selected")?.dataset.value || "60");
    } else if (mode === "words") {
      settings.wordCount = parseInt(card.querySelector(".word-options .selected")?.dataset.value || "50");
    }

    settings.text = newRoundText(settings);
    startGame(settings);
  }

  // Fresh text for a round with these settings. Custom keeps the player's
  // own text; Words draws a new set of words; the timed modes open a new
  // stream of quotes or snippets and take enough of it for the whole test.
  function newRoundText(settings) {
    textStream = null;
    if (settings.mode === "custom") return settings.text;
    if (settings.mode === "words") return TextContent.generateWords(settings.wordCount);

    textStream = TextContent.createStream(settings.mode, settings.mode === "code" ? settings.language : settings.difficulty);
    let text = textStream.next();
    const wanted = settings.duration * TIMED_CHARS_PER_SECOND + TIMED_LOOKAHEAD;
    while (text.length < wanted) text += textStream.separator + textStream.next();
    return text;
  }

  // Keeps a timed test supplied with text. The opening text already covers
  // the whole test at TIMED_CHARS_PER_SECOND; this only adds more for a
  // player who outruns that, and does so well below the lines in view.
  function topUpText(state) {
    if (!state.timedMode || !textStream) return;
    while (state.chars.length - state.currentIndex < TIMED_LOOKAHEAD) {
      const extra = textStream.separator + textStream.next();
      const startIndex = state.chars.length;
      GameEngine.appendText(extra);
      appendTextDisplay(extra, startIndex);
    }
  }

  function startGame(settings) {
    resetRoundState();
    currentSettings = settings;
    const state = GameEngine.init(settings.text, settings);

    GameEngine.setCallbacks(
      (s) => updateGameUI(s),
      (results) => onGameEnd(results)
    );

    renderGameView(settings);
    showView("game");
    // The view was hidden while it was drawn, so there was nothing to
    // measure: place the caret now that the text has a layout.
    const display = document.getElementById("textDisplay");
    display.scrollTop = 0;
    positionCaret(display, 0, true);
    focusGame();
  }

  function renderGameView(settings) {
    document.getElementById("gameMode").textContent = Results.describeRound(settings);
    // Timed tests count down from their duration; the others count up.
    document.getElementById("gameTimer").textContent = formatTime(settings.duration || 0);
    document.getElementById("gameTimer").className = "timer";
    document.getElementById("gameWpm").textContent = "0";
    document.getElementById("gameAccuracy").textContent = "100%";
    document.getElementById("progressFill").style.width = "0%";

    renderTextDisplay(settings.text);
    document.getElementById("startHint").style.display = "block";
    document.getElementById("pauseOverlay").style.display = "none";
    document.getElementById("focusOverlay").style.display = "none";
  }

  // One <span> per character. A line break is shown as a return arrow
  // followed by a real <br>; a space stays a real space (not &nbsp;) so the
  // browser can wrap lines between words (.text-display is pre-wrap).
  function charHtml(char, index, cls) {
    if (char === "\n") return `<span class="${cls}" data-index="${index}">↵</span><br>`;
    if (char === " ") return `<span class="${cls}" data-index="${index}"> </span>`;
    return `<span class="${cls}" data-index="${index}">${escapeHtml(char)}</span>`;
  }

  // Draws a fresh round: every character untyped, the first one current.
  function renderTextDisplay(text) {
    const container = document.getElementById("textDisplay");
    let html = "";
    for (let i = 0; i < text.length; i++) {
      html += charHtml(text[i], i, i === 0 ? "char-current" : "char-untyped");
    }
    container.innerHTML = html;
    container.scrollTop = 0;
    charSpans = Array.from(container.querySelectorAll("span[data-index]"));
    renderedIndex = 0;
    ensureCaret(container);
    positionCaret(container, 0, true);
  }

  // Adds the characters of `extra` (which start at `startIndex` in the
  // round's text) after the existing ones, without redrawing anything.
  function appendTextDisplay(extra, startIndex) {
    const container = document.getElementById("textDisplay");
    const template = document.createElement("template");
    let html = "";
    for (let i = 0; i < extra.length; i++) {
      html += charHtml(extra[i], startIndex + i, "char-untyped");
    }
    template.innerHTML = html;
    const added = Array.from(template.content.querySelectorAll("span[data-index]"));
    container.insertBefore(template.content, caretEl);
    charSpans = charSpans.concat(added);
  }

  function ensureCaret(container) {
    caretEl = document.getElementById("typeCaret");
    if (!caretEl) {
      caretEl = document.createElement("div");
      caretEl.id = "typeCaret";
      caretEl.className = "type-caret";
    }
    container.appendChild(caretEl);
  }

  // Glides a single overlay caret to the current character position using
  // transform (compositor-friendly, no layout). Called once per keystroke —
  // cheap: one rect read, one style write. `instant` skips the transition
  // for the very first paint so the caret doesn't slide in from (0,0).
  function positionCaret(container, index, instant) {
    if (!caretEl) return;
    const target = charSpans[index];
    if (!target) {
      caretEl.classList.remove("visible");
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const x = rect.left - containerRect.left + container.scrollLeft;
    const y = rect.top - containerRect.top + container.scrollTop;

    if (instant) caretEl.style.transitionDuration = "0ms, 0ms, 0ms";
    caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    caretEl.style.height = rect.height + "px";
    caretEl.classList.add("visible");
    if (instant) {
      requestAnimationFrame(() => { caretEl.style.transitionDuration = ""; });
    }
  }

  function scrollToCurrentChar(index) {
    const container = document.getElementById("textDisplay");
    const current = charSpans[index];
    if (!current) return;
    const containerRect = container.getBoundingClientRect();
    const charRect = current.getBoundingClientRect();
    const relativeTop = charRect.top - containerRect.top;
    const targetScroll = container.scrollTop + relativeTop - containerRect.height / 3;
    if (relativeTop > containerRect.height * 0.6 || relativeTop < 0) {
      container.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  }

  function updateGameUI(state) {
    topUpText(state);

    const timerEl = document.getElementById("gameTimer");
    let progress;
    if (state.timedMode) {
      const remaining = Math.max(0, state.duration - state.elapsed);
      timerEl.textContent = formatTime(Math.ceil(remaining));
      timerEl.className = "timer" + (remaining <= 5 ? " timer-danger" : remaining <= 10 ? " timer-warning" : "");
      // A timed test is over when the time is, so the bar follows the clock.
      progress = (state.elapsed / state.duration) * 100;
    } else {
      timerEl.textContent = formatTime(Math.floor(state.elapsed));
      progress = (state.currentIndex / state.chars.length) * 100;
    }

    document.getElementById("gameWpm").textContent = state.wpm;
    document.getElementById("gameAccuracy").textContent = state.accuracy + "%";
    document.getElementById("progressFill").style.width = progress + "%";

    updateCharDisplay(state);
    checkWpmMilestone(state.wpm);
  }

  // Subtle pulse on the live WPM readout when the player crosses a speed
  // milestone. Purely decorative, so it's skipped entirely under
  // prefers-reduced-motion rather than just relying on the CSS gate.
  function checkWpmMilestone(wpm) {
    if (prefersReducedMotion()) return;
    const hit = WPM_MILESTONES.find(m => wpm >= m && lastWpmMilestone < m);
    if (!hit) return;
    lastWpmMilestone = hit;
    const liveStat = document.getElementById("gameWpm").closest(".live-stat");
    if (!liveStat) return;
    liveStat.classList.remove("milestone-pulse");
    void liveStat.offsetWidth; // restart the animation
    liveStat.classList.add("milestone-pulse");
  }

  function charClass(state, i) {
    if (i < state.currentIndex) {
      return state.typed[i] && state.typed[i].correct ? "char-correct" : "char-incorrect";
    }
    return i === state.currentIndex ? "char-current" : "char-untyped";
  }

  // Runs on every keystroke and every frame, so it only touches the
  // characters between where the cursor was at the last paint and where it
  // is now. Everything outside that range already has the right class.
  // (Rewriting every character's class each time cost about twice as much
  // per keystroke: 14 ms against 7 ms on a 10,000-character text. What is
  // left is the browser laying the text out again when the underlined
  // current character moves.)
  function updateCharDisplay(state) {
    const container = document.getElementById("textDisplay");
    const from = Math.min(renderedIndex, state.currentIndex);
    const to = Math.min(Math.max(renderedIndex, state.currentIndex), charSpans.length - 1);
    for (let i = from; i <= to; i++) {
      charSpans[i].className = charClass(state, i);
    }
    renderedIndex = state.currentIndex;

    positionCaret(container, state.currentIndex, false);
    scrollToCurrentChar(state.currentIndex);
  }

  function focusGame() {
    document.getElementById("gameInputHandler").focus();
  }

  // True while a round is on screen and not over.
  function roundIsLive() {
    const state = GameEngine.getState();
    return currentView === "game" && !!state && !state.isFinished;
  }

  // Buttons, links and form fields other than the hidden typing field.
  function isOtherControl(target) {
    const handler = document.getElementById("gameInputHandler");
    return target !== handler && target instanceof Element &&
      !!target.closest("button, a[href], input, textarea, select");
  }

  // Bound once for the lifetime of the page. Keys are read at document
  // level, so typing keeps working when the hidden typing field has lost
  // focus (a click on the page, Tab) instead of leaving the game dead.
  function bindGameInput() {
    const handler = document.getElementById("gameInputHandler");

    document.addEventListener("keydown", onGameKeydown);

    // Losing the typing field mid-round stops the clock until the player
    // comes back, so time away is not counted as typing time.
    handler.addEventListener("blur", pauseForLostFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForLostFocus();
    });
    document.getElementById("focusOverlay").addEventListener("click", returnToTyping);

    // A click on the game itself (the text, the stats bar) must not take
    // focus away from the typing field.
    views.game.addEventListener("mousedown", (e) => {
      if (!roundIsLive() || isOtherControl(e.target)) return;
      if (e.target.closest("#pauseOverlay, #focusOverlay")) return;
      e.preventDefault();
      if (!GameEngine.isPausedState()) handler.focus();
    });
  }

  function onGameKeydown(e) {
    if (!roundIsLive()) return;
    const handler = document.getElementById("gameInputHandler");
    const onOtherControl = isOtherControl(e.target);

    // Pause menu open: Escape resumes, every other key belongs to its buttons.
    if (GameEngine.isPausedState() && !blurPaused) {
      if (e.key === "Escape") {
        e.preventDefault();
        togglePause();
      }
      return;
    }

    // A keyboard user operating a button or link (nav, sound toggle).
    if (onOtherControl && (e.key === "Tab" || e.key === "Enter" || e.key === " ")) return;

    // "Press any key to continue": the key wakes the round up and is not
    // typed. Bare modifier keys (Alt from Alt+Tab, Shift) do not count.
    if (blurPaused) {
      if (["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock"].includes(e.key)) return;
      e.preventDefault();
      returnToTyping();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      takeTypingFocus(handler);
      GameEngine.handleBackspace();
      playSound("click");
      return;
    }

    if (e.key === "Tab" && currentSettings.mode === "code") {
      e.preventDefault();
      takeTypingFocus(handler);
      const s = GameEngine.getState();
      const upcoming = s.text.substring(s.currentIndex);
      if (upcoming.startsWith("  ")) {
        GameEngine.handleInput(" ");
        GameEngine.handleInput(" ");
      } else {
        GameEngine.handleInput("\t");
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      takeTypingFocus(handler);
      GameEngine.handleInput("\n");
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      takeTypingFocus(handler);
      const s = GameEngine.getState();
      const expected = s.chars[s.currentIndex];
      GameEngine.handleInput(e.key);
      if (e.key !== expected) {
        playSound("error");
      } else {
        playSound("click");
      }
    }
  }

  // Called for every key that is typed into the round.
  function takeTypingFocus(handler) {
    document.getElementById("startHint").style.display = "none";
    if (document.activeElement !== handler) handler.focus();
  }

  function pauseForLostFocus() {
    if (!roundIsLive()) return;
    const state = GameEngine.getState();
    if (!state.isRunning || GameEngine.isPausedState()) return;
    GameEngine.pause();
    blurPaused = true;
    document.getElementById("focusOverlay").style.display = "flex";
  }

  function returnToTyping() {
    document.getElementById("focusOverlay").style.display = "none";
    if (blurPaused) {
      blurPaused = false;
      GameEngine.resume();
    }
    document.getElementById("gameInputHandler").focus();
  }

  // Escape: open or close the pause menu. Before the first keystroke there
  // is no clock to stop, so there is nothing to pause.
  function togglePause() {
    const state = GameEngine.getState();
    if (!state || state.isFinished) return;

    if (GameEngine.isPausedState()) {
      GameEngine.resume();
      document.getElementById("pauseOverlay").style.display = "none";
      document.getElementById("gameInputHandler").focus();
    } else if (state.isRunning) {
      GameEngine.pause();
      document.getElementById("pauseOverlay").style.display = "flex";
      // Keyboard users land on Resume and can Tab to Quit.
      document.getElementById("pauseResume").focus();
    }
  }

  function onGameEnd(results) {
    const newAchievements = Achievements.checkUnlocks(results);
    newAchievements.forEach(a => {
      showToast(`\ud83c\udfc6 Achievement Unlocked: ${a.title}!`, { achievement: true });
    });

    const container = document.getElementById("resultsContent");
    Results.render(results, container);
    showView("results");

    document.getElementById("tryAgainBtn").addEventListener("click", () => {
      currentSettings.text = newRoundText(currentSettings);
      startGame(currentSettings);
    });

    document.getElementById("newModeBtn").addEventListener("click", () => {
      leaveGame();
      showView("home");
    });

    document.getElementById("saveBtn").addEventListener("click", () => {
      Leaderboard.addEntry(results);
      showToast("Score saved to leaderboard!");
      document.getElementById("saveBtn").disabled = true;
      document.getElementById("saveBtn").textContent = "Saved!";
    });

    playSound("complete");
  }

  function renderLeaderboard() {
    const container = document.getElementById("leaderboardContent");
    let currentFilter = "all";
    let currentSort = "wpm";

    function render() {
      const entries = Leaderboard.getFiltered(currentFilter, currentSort);
      const bestByMode = Leaderboard.getBestByMode();

      let html = `
        <div class="lb-filters">
          ${["all", "classic", "code", "words", "custom"].map(f =>
            `<button class="lb-filter ${currentFilter === f ? "active" : ""}" data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
          ).join("")}
        </div>
        <div class="lb-sort">
          Sort by:
          ${["wpm", "accuracy", "date"].map(s =>
            `<button class="lb-sort-btn ${currentSort === s ? "active" : ""}" data-sort="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`
          ).join("")}
        </div>
      `;

      if (entries.length === 0) {
        html += '<p class="lb-empty">No entries yet. Complete a typing test to see your scores here!</p>';
      } else {
        html += `<div class="lb-table">
          <div class="lb-header">
            <span class="lb-rank">#</span>
            <span class="lb-wpm">WPM</span>
            <span class="lb-acc">Accuracy</span>
            <span class="lb-mode">Mode</span>
            <span class="lb-dur">Duration</span>
            <span class="lb-date">Date</span>
          </div>
          ${entries.map((e, i) => {
            const isBest = Object.values(bestByMode).some(b => b.date === e.date && b.wpm === e.wpm);
            return `<div class="lb-row ${isBest ? "lb-best" : ""}" style="animation-delay: ${i * 0.03}s">
              <span class="lb-rank">${i + 1}</span>
              <span class="lb-wpm">${e.wpm}</span>
              <span class="lb-acc">${e.accuracy}%</span>
              <span class="lb-mode">${escapeHtml(Results.describeRound(e).toLowerCase())}</span>
              <span class="lb-dur">${e.duration}s</span>
              <span class="lb-date">${new Date(e.date).toLocaleDateString()}</span>
            </div>`;
          }).join("")}
        </div>`;
      }

      html += `<button class="btn btn-danger" id="clearLbBtn">Clear Leaderboard</button>`;
      container.innerHTML = html;

      container.querySelectorAll(".lb-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          currentFilter = btn.dataset.filter;
          render();
        });
      });

      container.querySelectorAll(".lb-sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentSort = btn.dataset.sort;
          render();
        });
      });

      document.getElementById("clearLbBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear the leaderboard? This cannot be undone.")) {
          Leaderboard.clear();
          render();
          showToast("Leaderboard cleared.");
        }
      });
    }

    render();
  }

  function renderAchievements() {
    const container = document.getElementById("achievementsContent");
    const all = Achievements.getAll();
    container.innerHTML = `<div class="achievements-grid">${all.map(a => `
      <div class="achievement-card ${a.unlocked ? "unlocked" : "locked"}">
        <span class="achievement-icon">${a.unlocked ? a.icon : "\ud83d\udd12"}</span>
        <div class="achievement-info">
          <span class="achievement-title">${a.title}</span>
          <span class="achievement-desc">${a.description}</span>
        </div>
      </div>
    `).join("")}</div>`;
  }

  function showToast(message, options = {}) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast" + (options.achievement && !prefersReducedMotion() ? " achievement" : "");
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function playSound(type) {
    if (!soundEnabled) return;
    // Single reused AudioContext instance for the app's lifetime — never
    // create a new one per toggle/play (browsers cap concurrent contexts).
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.05;

    if (type === "click") {
      osc.frequency.value = 800;
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === "error") {
      osc.frequency.value = 300;
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === "complete") {
      osc.frequency.value = 523;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return str.replace(/[&<>"']/g, c => map[c]);
  }

  document.addEventListener("DOMContentLoaded", init);

  document.getElementById("pauseResume")?.addEventListener("click", togglePause);
  document.getElementById("pauseQuit")?.addEventListener("click", () => {
    leaveGame();
    showView("home");
  });

  return { showView, showToast };
})();
