# 🧬 ბიოლოგია — ეროვნული გამოცდები 2010–2025

An interactive practice app for Georgia's National Exams (ერთიანი ეროვნული გამოცდები) in **Biology**. Take past exam papers in a faithful, exam-like interface, get instant MCQ scoring, grade your own open-ended answers, and track your progress over time.

🔗 **Live:** https://guramzhgamadze.github.io/exam_project/

> The interface and all content are in Georgian (ქართული). The app is fully client-side — no server, no accounts, no tracking. Everything is stored locally in your browser.

---

## ✨ Features

- **📄 18 official exam papers** spanning **2010–2025** (including the second variants for 2021 & 2022) — **~980 questions** total.
- **📝 Exam mode** — one question at a time, a live countdown timer, keyboard (↑ ↓ ← →) and swipe navigation, and a progress dot-bar.
- **💾 Autosave & resume** — close the tab mid-exam and pick up exactly where you left off (answers + remaining time are restored).
- **✅ Instant MCQ grading** — multiple-choice answers are checked automatically, including questions that accept several correct options.
- **🖊️ Self-graded open questions** — after finishing, mark each open answer ✓/✗ against the model answer. The final mark is withheld until every open answer is checked, with a clear notice that an ungraded exam won't count.
- **📊 Statistics dashboard** — overall %, per-year breakdown, full exam history, and a collapsible list of **every** mistake. Repeated mistakes show how many times you picked the same wrong answer.
- **🔁 Full review** — click any year to reopen a whole exam with your answers vs. the correct ones (questions, images, options included).
- **🤖 AI report export** — download a clean Markdown report of all your answers vs. the correct ones, ready to paste into an AI for personalised study advice.
- **📤 Backup / restore** — export and import your statistics as JSON.
- **📱 Responsive** — works on desktop and mobile, with a slide-in drawer and touch gestures.

---

## 🧮 How scoring works

- Each exam is scored out of its **whole test size** (all MCQs + every open sub-answer), e.g. `56 / 70`.
- MCQs are graded automatically. Open answers are **graded by you** on the results screen.
- A session is counted in your statistics **only once all open answers are graded**. Until then it's marked **⚠️ შეუმოწმებელი** (unchecked) and excluded from totals — so your stats always reflect honest, complete results.

---

## 🗂️ Project structure

```
exam_project/
├── index.html          # App shell: welcome, selection, exam, results screens
├── css/
│   └── styles.css      # All styling (fluid/responsive, no framework)
├── js/
│   ├── data.js         # All exam question data (EXAMS) — generated
│   ├── app.js          # Exam flow: selection, test mode, autosave, results
│   └── analytics.js    # Statistics, persistence, grading, review, export
└── images/             # NAEC logos and question illustrations
```

**Data model (localStorage):**
- `biology_exam_stats_v1` — completed sessions, answers, and open-answer grades.
- `biology_exam_progress_v1` — the in-progress exam for autosave/resume.

---

## 🚀 Running locally

No build step and no dependencies — it's plain HTML/CSS/JS.

```bash
# clone, then either open index.html directly,
# or serve it (recommended, so images load consistently):
python -m http.server 8000
# → http://localhost:8000
```

> Static assets are cache-busted via a `?v=` query string in `index.html`. Bump it when you change `css/` or `js/` so browsers fetch the new files.

---

## 🛠️ Tech

Vanilla **HTML + CSS + JavaScript** — no frameworks, no build tooling, no external runtime dependencies. State persists in the browser via `localStorage`.

---

## 🔒 Privacy

All data (your answers, grades, and statistics) stays in **your browser only**. Nothing is uploaded anywhere. Clearing your browser storage erases it — use the export button to keep a backup.

---

## 🙏 Credits

Exam content © National Assessment and Examinations Center (შეფასებისა და გამოცდების ეროვნული ცენტრი). This is an unofficial study tool created for practice purposes.
