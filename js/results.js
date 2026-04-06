const Results = (() => {
  function render(result, container) {
    const isPB = Leaderboard.isPersonalBest(result);
    const wpmColor = getWpmColor(result.wpm);
    const wpmLabel = getWpmLabel(result.wpm);
    const accColor = result.accuracy >= 95 ? "var(--success)" : result.accuracy >= 80 ? "var(--primary)" : "var(--error)";
    const modeLabel = getModeLabel(result);

    container.innerHTML = `
      ${isPB ? '<div class="personal-best-banner"><span class="pb-trophy">\ud83c\udfc6</span> New Personal Best!<div class="confetti-container" id="confetti"></div></div>' : ""}
      <div class="results-hero">
        <div class="wpm-display" style="color: ${wpmColor}">
          <span class="wpm-number" id="wpmCounter">0</span>
          <span class="wpm-unit">WPM</span>
        </div>
        <p class="wpm-label" style="color: ${wpmColor}">${wpmLabel}</p>
        <p class="results-subtitle">${modeLabel}</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">${result.rawWpm}</span>
          <span class="stat-label">Raw WPM</span>
        </div>
        <div class="stat-card">
          <div class="accuracy-ring-container">
            <svg class="accuracy-ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="${accColor}" stroke-width="8"
                stroke-dasharray="${(result.accuracy / 100) * 327} 327"
                stroke-linecap="round" transform="rotate(-90 60 60)"
                class="accuracy-ring-fill"/>
            </svg>
            <span class="accuracy-ring-text">${result.accuracy}%</span>
          </div>
          <span class="stat-label">Accuracy</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${result.correctCount}<span class="stat-dim">/${result.incorrectCount}/${result.totalTyped}</span></span>
          <span class="stat-label">Correct / Errors / Total</span>
        </div>
        <div class="stat-card">
          <span class="stat-value stat-consistency-${result.consistency.toLowerCase()}">${result.consistency}</span>
          <span class="stat-label">Consistency</span>
        </div>
      </div>
      ${renderWpmChart(result.wpmOverTime)}
      ${renderCharBreakdown(result)}
      <div class="results-actions">
        <button class="btn btn-primary" id="tryAgainBtn">Try Again</button>
        <button class="btn btn-secondary" id="newModeBtn">New Mode</button>
        ${isPB ? '<button class="btn btn-save pulse" id="saveBtn">\ud83c\udfc6 Save to Leaderboard</button>' : '<button class="btn btn-secondary" id="saveBtn">Save to Leaderboard</button>'}
      </div>
    `;

    animateWpmCounter(result.wpm, wpmColor);
    if (isPB) spawnConfetti();

    setTimeout(() => {
      container.querySelectorAll(".stat-card").forEach((card, i) => {
        card.style.animationDelay = `${0.8 + i * 0.1}s`;
        card.classList.add("animate-in");
      });
    }, 50);
  }

  function animateWpmCounter(target, color) {
    const el = document.getElementById("wpmCounter");
    if (!el) return;
    const duration = 1000;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderWpmChart(data) {
    if (!data || data.length < 2) return "";
    const maxWpm = Math.max(...data.map(d => d.wpm), 10);
    const maxTime = data[data.length - 1].time;
    const w = 600, h = 200, pad = 40;
    const chartW = w - pad * 2, chartH = h - pad * 2;

    const points = data.map(d => ({
      x: pad + (d.time / maxTime) * chartW,
      y: pad + chartH - (d.wpm / maxWpm) * chartH
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaD = pathD + ` L${points[points.length - 1].x},${pad + chartH} L${points[0].x},${pad + chartH} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
      const y = pad + chartH - pct * chartH;
      const val = Math.round(maxWpm * pct);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>
              <text x="${pad - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${val}</text>`;
    }).join("");

    const timeLabels = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0 || i === data.length - 1)
      .map(d => `<text x="${pad + (d.time / maxTime) * chartW}" y="${h - 5}" fill="var(--text-muted)" font-size="11" text-anchor="middle">${d.time}s</text>`)
      .join("");

    const dots = points.map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--primary)" stroke="var(--surface)" stroke-width="1.5"/>`
    ).join("");

    return `
      <div class="chart-container">
        <h3 class="chart-title">WPM Over Time</h3>
        <svg viewBox="0 0 ${w} ${h}" class="wpm-chart">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${gridLines}
          ${timeLabels}
          <path d="${areaD}" fill="url(#chartGrad)" class="chart-area"/>
          <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>
          ${dots}
        </svg>
      </div>`;
  }

  function renderCharBreakdown(result) {
    const total = result.correctCount + result.incorrectCount;
    if (total === 0) return "";
    const correctPct = (result.correctCount / total) * 100;
    const incorrectPct = (result.incorrectCount / total) * 100;

    const mistypedEntries = Object.entries(result.mistyped || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const mistypedHtml = mistypedEntries.length > 0
      ? `<div class="mistyped-list"><h4>Most Mistyped</h4>${mistypedEntries.map(([ch, count]) =>
          `<span class="mistyped-char"><kbd>${ch}</kbd> ${count}x</span>`
        ).join("")}</div>`
      : "";

    return `
      <div class="char-breakdown">
        <h3 class="chart-title">Character Breakdown</h3>
        <div class="char-bar">
          <div class="char-bar-correct" style="width: ${correctPct}%"></div>
          <div class="char-bar-incorrect" style="width: ${incorrectPct}%"></div>
        </div>
        <div class="char-bar-labels">
          <span class="char-label-correct">${result.correctCount} correct</span>
          <span class="char-label-incorrect">${result.incorrectCount} errors</span>
        </div>
        ${mistypedHtml}
      </div>`;
  }

  function spawnConfetti() {
    const container = document.getElementById("confetti");
    if (!container) return;
    const colors = ["#fbbf24", "#818cf8", "#34d399", "#ef4444", "#f472b6", "#60a5fa"];
    for (let i = 0; i < 30; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.5 + "s";
      piece.style.animationDuration = (2 + Math.random() * 2) + "s";
      container.appendChild(piece);
    }
    setTimeout(() => { if (container) container.innerHTML = ""; }, 4000);
  }

  function getWpmColor(wpm) {
    if (wpm >= 100) return "var(--primary)";
    if (wpm >= 71) return "var(--success)";
    if (wpm >= 51) return "var(--secondary)";
    if (wpm >= 31) return "var(--primary)";
    return "var(--error)";
  }

  function getWpmLabel(wpm) {
    if (wpm >= 100) return "Legendary!";
    if (wpm >= 71) return "Speed demon!";
    if (wpm >= 51) return "Solid typist!";
    if (wpm >= 31) return "Getting there!";
    return "Keep practicing!";
  }

  function getModeLabel(result) {
    let label = result.mode.charAt(0).toUpperCase() + result.mode.slice(1);
    if (result.difficulty) label += ` \u00b7 ${result.difficulty}`;
    if (result.language) label += ` \u00b7 ${result.language}`;
    label += ` \u00b7 ${result.duration}s`;
    return label;
  }

  return { render };
})();
