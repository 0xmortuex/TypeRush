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

  function init() {
    cacheViews();
    bindNav();
    bindModeCards();
    showView("home");
  }

  function resetRoundState() {
    lastWpmMilestone = 0;
    if (caretEl) caretEl.classList.remove("visible");
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
      GameEngine.destroy();
      showView("home");
    });

    document.getElementById("leaderboardBtn").addEventListener("click", () => {
      renderLeaderboard();
      showView("leaderboard");
    });

    document.getElementById("achievementsBtn").addEventListener("click", () => {
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
      settings.text = TextContent.getClassicText(settings.difficulty);
    } else if (mode === "code") {
      settings.language = card.querySelector(".mode-options .selected")?.dataset.value || "javascript";
      settings.duration = parseInt(card.querySelector(".time-options .selected")?.dataset.value || "60");
      settings.text = TextContent.getCodeSnippet(settings.language);
    } else if (mode === "words") {
      settings.wordCount = parseInt(card.querySelector(".word-options .selected")?.dataset.value || "50");
      settings.text = TextContent.generateWords(settings.wordCount);
    }

    startGame(settings);
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

    renderTextDisplay(settings.text, [], 0);
    document.getElementById("startHint").style.display = "block";
    document.getElementById("pauseOverlay").style.display = "none";
    document.getElementById("focusOverlay").style.display = "none";
  }

  function renderTextDisplay(text, typed, currentIndex) {
    const container = document.getElementById("textDisplay");
    let html = "";
    for (let i = 0; i < text.length; i++) {
      let cls = "char-untyped";
      let char = text[i];
      if (i < currentIndex) {
        if (typed[i] && typed[i].correct) {
          cls = "char-correct";
        } else {
          cls = "char-incorrect";
        }
      } else if (i === currentIndex) {
        cls = "char-current";
      }
      if (char === "\n") {
        html += `<span class="${cls}" data-index="${i}">\u21b5</span><br>`;
      } else if (char === " ") {
        // A real space (not &nbsp;) so the browser can wrap lines between
        // words; .text-display uses white-space: pre-wrap to keep it visible.
        html += `<span class="${cls}" data-index="${i}"> </span>`;
      } else {
        html += `<span class="${cls}" data-index="${i}">${escapeHtml(char)}</span>`;
      }
    }
    container.innerHTML = html;
    ensureCaret(container);
    positionCaret(container, currentIndex, true);
    scrollToCurrentChar(currentIndex);
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
    const target = container.querySelector(`span[data-index="${index}"]`);
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
    const current = container.querySelector(".char-current");
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
    const timerEl = document.getElementById("gameTimer");
    if (state.timedMode) {
      const remaining = Math.max(0, state.duration - state.elapsed);
      timerEl.textContent = formatTime(Math.ceil(remaining));
      timerEl.className = "timer" + (remaining <= 5 ? " timer-danger" : remaining <= 10 ? " timer-warning" : "");
    } else {
      timerEl.textContent = formatTime(Math.floor(state.elapsed));
    }

    document.getElementById("gameWpm").textContent = state.wpm;
    document.getElementById("gameAccuracy").textContent = state.accuracy + "%";

    const progress = (state.currentIndex / state.chars.length) * 100;
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

  function updateCharDisplay(state) {
    const container = document.getElementById("textDisplay");
    const spans = container.querySelectorAll("span[data-index]");

    spans.forEach(span => {
      const i = parseInt(span.dataset.index);
      if (i < state.currentIndex) {
        if (state.typed[i] && state.typed[i].correct) {
          span.className = "char-correct";
        } else {
          span.className = "char-incorrect";
        }
      } else if (i === state.currentIndex) {
        span.className = "char-current";
      } else {
        span.className = "char-untyped";
      }
    });

    positionCaret(container, state.currentIndex, false);
    scrollToCurrentChar(state.currentIndex);
  }

  function focusGame() {
    const handler = document.getElementById("gameInputHandler");
    handler.focus();
    bindGameInput();
  }

  function bindGameInput() {
    const handler = document.getElementById("gameInputHandler");

    handler.onkeydown = (e) => {
      const state = GameEngine.getState();
      if (!state || state.isFinished) return;

      if (e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }

      if (GameEngine.isPausedState()) return;

      document.getElementById("startHint").style.display = "none";

      if (e.key === "Backspace") {
        e.preventDefault();
        GameEngine.handleBackspace();
        playSound("click");
        return;
      }

      if (e.key === "Tab" && currentSettings.mode === "code") {
        e.preventDefault();
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
        GameEngine.handleInput("\n");
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const s = GameEngine.getState();
        const expected = s.chars[s.currentIndex];
        GameEngine.handleInput(e.key);
        if (e.key !== expected) {
          playSound("error");
        } else {
          playSound("click");
        }
      }
    };

    handler.addEventListener("blur", () => {
      const state = GameEngine.getState();
      if (state && state.isRunning && !state.isFinished && !GameEngine.isPausedState()) {
        document.getElementById("focusOverlay").style.display = "flex";
      }
    });

    document.getElementById("focusOverlay").addEventListener("click", () => {
      document.getElementById("focusOverlay").style.display = "none";
      handler.focus();
    });

    document.addEventListener("keydown", (e) => {
      if (currentView === "game" && document.getElementById("focusOverlay").style.display === "flex") {
        document.getElementById("focusOverlay").style.display = "none";
        handler.focus();
      }
    });
  }

  function togglePause() {
    if (GameEngine.isPausedState()) {
      GameEngine.resume();
      document.getElementById("pauseOverlay").style.display = "none";
      document.getElementById("gameInputHandler").focus();
    } else {
      GameEngine.pause();
      document.getElementById("pauseOverlay").style.display = "flex";
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
      if (currentSettings.mode === "words") {
        currentSettings.text = TextContent.generateWords(currentSettings.wordCount);
      } else if (currentSettings.mode === "classic") {
        currentSettings.text = TextContent.getClassicText(currentSettings.difficulty);
      } else if (currentSettings.mode === "code") {
        currentSettings.text = TextContent.getCodeSnippet(currentSettings.language);
      }
      startGame(currentSettings);
    });

    document.getElementById("newModeBtn").addEventListener("click", () => {
      GameEngine.destroy();
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
    GameEngine.destroy();
    document.getElementById("pauseOverlay").style.display = "none";
    showView("home");
  });

  return { showView, showToast };
})();
