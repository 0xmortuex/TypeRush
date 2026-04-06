# TypeRush — How fast can you type?

A sleek typing speed game with multiple modes, live WPM tracking, code snippet challenges, achievements, and a personal leaderboard.

![TypeRush Screenshot](assets/screenshot.png)

## Features

- **Classic Mode** — Type famous quotes and excerpts at Easy, Medium, or Hard difficulty
- **Code Mode** — Type real code snippets in JavaScript, Python, HTML, CSS, or Rust
- **Words Mode** — Pure random words for raw speed testing (25, 50, 100, or 200 words)
- **Custom Mode** — Paste your own text and race against it
- **Live Stats** — Real-time WPM, accuracy, and progress tracking
- **WPM Chart** — SVG line chart showing speed over time
- **Achievements** — 10 unlockable achievements with toast notifications
- **Leaderboard** — Personal best tracking with filtering and sorting
- **Sound Effects** — Optional keystroke sounds via Web Audio API
- **Responsive** — Works on desktop, tablet, and mobile
- **Offline** — Fully client-side, no server required

## How to Use

1. Open `index.html` in your browser
2. Select a mode and configure options
3. Click the mode card to start
4. Start typing — the timer begins on your first keystroke
5. View your results, save scores, and unlock achievements

## Tech Stack

Vanilla HTML, CSS, JavaScript — zero dependencies.

- All data stored in `localStorage`
- Charts built with SVG
- Sound via Web Audio API oscillators
- Fonts: Syne, JetBrains Mono, Outfit (Google Fonts)

## Live Demo

[https://0xmortuex.github.io/TypeRush/](https://0xmortuex.github.io/TypeRush/)

## License

MIT
