// ============================================================
// analytics.js  —  Exam statistics, persistence, UI
// Depends on: data.js (EXAMS constant)
// ============================================================

const STORAGE_KEY = 'biology_exam_stats_v1';

/* ── Storage helpers ────────────────────────────────────────────────────── */

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Could not save stats:', e);
  }
}

/* ── Record a completed session ─────────────────────────────────────────── */
// openAnswers: { [qId]: { typed: string, items: [{id, typed}] } }

function recordSession(examKey, mcqAnswers, openAnswers) {
  const exam = EXAMS[examKey];

  // MCQ results
  const mcqResults = exam.questions
    .filter(q => q.type === 'mcq')
    .map(q => ({
      qId:      q.id,
      num:      q.num,
      text:     q.text.slice(0, 120),
      selected: mcqAnswers[q.id] ?? null,
      correct:  q.answer ?? null,
      isRight:  q.answer ? mcqAnswers[q.id] === q.answer : null,
    }));

  // Open results
  const openResults = exam.questions
    .filter(q => q.type === 'open')
    .map(q => {
      const saved = openAnswers?.[q.id] ?? { typed: '', items: [] };
      const items = q.items || [];

      if (!items.length) {
        // Single-answer open question
        return {
          qId:   q.id,
          num:   q.num,
          text:  q.text.slice(0, 120),
          typed: saved.typed || '',
          modelAnswer: q.single_answer ?? null,
          items: [],
        };
      }

      // Sub-item open question
      return {
        qId:  q.id,
        num:  q.num,
        text: q.text.slice(0, 120),
        typed: '',
        modelAnswer: null,
        items: items.map(item => {
          const savedItem = (saved.items || []).find(si => String(si.id) === String(item.id));
          return {
            id:          item.id,
            text:        item.text,
            typed:       savedItem?.typed || '',
            modelAnswer: item.answer ?? null,
          };
        }),
      };
    });

  // Score
  const scored   = mcqResults.filter(r => r.correct !== null);
  const nCorrect = scored.filter(r => r.isRight).length;

  const session = {
    id:          Date.now(),
    examKey,
    year:        exam.year,
    variant:     exam.variant,
    label:       `${exam.year} · ${exam.variantLabel}`,
    date:        new Date().toISOString(),
    mcqResults,
    openResults,
    score:       nCorrect,
    total:       scored.length,
    pct:         scored.length ? Math.round(nCorrect / scored.length * 100) : null,
  };

  const stats = loadStats();
  stats.sessions.push(session);
  saveStats(stats);

  if (document.getElementById('analytics-pane')?.classList.contains('active')) {
    renderAnalytics();
  }
}

/* ── Aggregate stats ────────────────────────────────────────────────────── */

function computeStats() {
  const { sessions } = loadStats();
  if (!sessions.length) return null;

  const allMcq      = sessions.flatMap(s => s.mcqResults.filter(r => r.correct !== null));
  const totalAnswered = allMcq.length;
  const totalCorrect  = allMcq.filter(r => r.isRight).length;
  const totalWrong    = allMcq.filter(r => !r.isRight && r.selected !== null).length;
  const totalSkipped  = allMcq.filter(r => !r.isRight && r.selected === null).length;

  // Per-year
  const byYear = {};
  sessions.forEach(s => {
    if (!byYear[s.year]) byYear[s.year] = { sessions: 0, correct: 0, total: 0 };
    byYear[s.year].sessions++;
    byYear[s.year].correct += s.score;
    byYear[s.year].total   += s.total;
  });

  // Mistake map
  const mistakeMap = {};
  sessions.forEach(s => {
    s.mcqResults.forEach(r => {
      if (r.correct === null) return;
      if (!mistakeMap[r.qId]) {
        mistakeMap[r.qId] = {
          qId: r.qId, num: r.num, text: r.text,
          label: s.label, wrongCount: 0, total: 0, examples: []
        };
      }
      mistakeMap[r.qId].total++;
      if (!r.isRight) {
        mistakeMap[r.qId].wrongCount++;
        if (mistakeMap[r.qId].examples.length < 3) {
          mistakeMap[r.qId].examples.push({ selected: r.selected, correct: r.correct, date: s.date });
        }
      }
    });
  });

  const mistakes = Object.values(mistakeMap)
    .filter(m => m.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount);

  return { sessions, totalAnswered, totalCorrect, totalWrong, totalSkipped, byYear, mistakes };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ka-GE', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
}

function pctColor(pct) {
  if (pct === null) return 'var(--muted)';
  if (pct >= 80) return 'var(--green)';
  if (pct >= 55) return '#e08800';
  return 'var(--red)';
}

function pctBar(pct, color) {
  return `<div class="an-bar-bg"><div class="an-bar-fill" style="width:${pct ?? 0}%;background:${color}"></div></div>`;
}


/* ── Render a full question visual inside a mistake card ─────────────────── */
function renderMistakeQuestion(m) {
  // Find the question data from EXAMS
  let q = null;
  for (const exam of Object.values(EXAMS)) {
    const found = exam.questions.find(x => x.id === m.qId);
    if (found) { q = found; break; }
  }
  if (!q) return `<div class="an-mq-text">${m.text}${m.text.length>=120?'…':''}</div>`;

  const lastEx    = m.examples[m.examples.length - 1];
  const selChoice = lastEx ? lastEx.selected : null;
  const correct   = lastEx ? lastEx.correct  : q.answer;

  let out = `<div class="an-mq-wrap">`;

  // Question text
  out += `<div class="an-mq-text">${q.text}</div>`;

  // Image
  if (q.img) {
    out += `<div class="an-mq-img-wrap"><img src="${q.img}" alt="ილუსტრაცია" loading="lazy"></div>`;
  }

  // Statements (roman numeral options)
  if (q.stmts && q.stmts.length) {
    out += '<div class="an-mq-stmts">';
    q.stmts.forEach(item => {
      const [k, v] = Array.isArray(item) ? item : ['', item];
      if (k || v) out += `<div class="an-mq-stmt-row"><span class="an-mq-stmt-k">${k}</span><span>${v}</span></div>`;
    });
    out += '</div>';
  }

  // Answer choices
  if (q.choices && q.choices.length) {
    out += '<div class="an-mq-choices">';
    q.choices.forEach(ch => {
      ch = ch.trim();
      let k = '', v = ch;
      if (ch.includes(')')) { const i = ch.indexOf(')'); k = ch.slice(0,i).trim(); v = ch.slice(i+1).trim(); }
      else if (ch && 'აბგდ'.includes(ch[0])) { k = ch[0]; v = ch.slice(1).replace(/^[)\s]+/,''); }

      const isCorrect = correct && k === correct;
      const isWrong   = k === selChoice && selChoice !== correct;
      const cls = isCorrect ? 'an-mq-opt-correct' : isWrong ? 'an-mq-opt-wrong' : '';
      const icon = isCorrect ? ' ✓' : isWrong ? ' ✗' : '';
      out += `<div class="an-mq-opt ${cls}">
        <span class="an-mq-opt-k">${k}</span>
        <span>${v}${icon ? `<strong class="an-mq-icon">${icon}</strong>` : ''}</span>
      </div>`;
    });
    out += '</div>';
  }

  // Table choices
  if (q.table) {
    const cols = q.table.cols || q.table.columns || [];
    out += '<table class="an-mq-tbl"><tr>';
    cols.forEach(c => out += `<th>${c}</th>`);
    out += '</tr>';
    (q.table.rows||[]).forEach(row => {
      const k = row[0];
      const isCorrect = correct && k === correct;
      const isWrong   = k === selChoice && selChoice !== correct;
      const cls = isCorrect ? 'an-mq-opt-correct' : isWrong ? 'an-mq-opt-wrong' : '';
      out += `<tr class="${cls}">`;
      row.forEach((cell, ci) => out += `<td${ci===0?' class="an-mq-tbl-k"':''}>${cell}</td>`);
      out += '</tr>';
    });
    out += '</table>';
  }

  // Summary line showing what student picked vs correct
  if (lastEx) {
    out += `<div class="an-mq-verdict">
      <span class="an-mq-wrong-pick">✗ არჩეული: <strong>${lastEx.selected ?? '—'}</strong></span>
      <span class="an-mq-arrow">→</span>
      <span class="an-mq-correct-pick">✓ სწორი: <strong>${correct ?? '—'}</strong></span>
    </div>`;
  }

  out += '</div>';
  return out;
}

/* ── Main render ────────────────────────────────────────────────────────── */

function renderAnalytics() {
  const pane = document.getElementById('analytics-pane');
  if (!pane) return;

  const stats = computeStats();

  if (!stats) {
    pane.innerHTML = `
      <div class="an-empty">
        <div class="an-empty-icon">📊</div>
        <div class="an-empty-title">სტატისტიკა ჯერ არ არის</div>
        <div class="an-empty-sub">გაიარეთ ერთი გამოცდა მაინც, შემდეგ სტატისტიკა გამოჩნდება.</div>
      </div>`;
    return;
  }

  const { sessions, totalAnswered, totalCorrect, totalWrong, totalSkipped, byYear, mistakes } = stats;
  const overallPct   = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : null;
  const overallColor = pctColor(overallPct);

  // ── Overview ──
  let html = `
<div class="an-section-title">📊 საერთო სტატისტიკა</div>
<div class="an-overview-grid">
  <div class="an-card an-card-accent">
    <div class="an-big-num" style="color:${overallColor}">${overallPct ?? '—'}%</div>
    <div class="an-card-lbl">სწორი პასუხების</div>
    ${pctBar(overallPct, overallColor)}
  </div>
  <div class="an-card"><div class="an-big-num">${sessions.length}</div><div class="an-card-lbl">გავლილი გამოცდა</div></div>
  <div class="an-card"><div class="an-big-num" style="color:var(--green)">${totalCorrect}</div><div class="an-card-lbl">სწორი პასუხი</div></div>
  <div class="an-card"><div class="an-big-num" style="color:var(--red)">${totalWrong}</div><div class="an-card-lbl">არასწორი პასუხი</div></div>
  <div class="an-card"><div class="an-big-num" style="color:var(--muted)">${totalSkipped}</div><div class="an-card-lbl">გამოტოვებული</div></div>
  <div class="an-card"><div class="an-big-num">${totalAnswered}</div><div class="an-card-lbl">სულ კითხვა</div></div>
</div>`;

  // ── Per-year ──
  html += `<div class="an-section-title" style="margin-top:28px">📅 წლების მიხედვით</div><div class="an-year-grid">`;
  Object.entries(byYear).sort().forEach(([yr, d]) => {
    const p = d.total ? Math.round(d.correct / d.total * 100) : null;
    const col = pctColor(p);
    html += `<div class="an-year-card">
      <div class="an-year-label">${yr}</div>
      <div class="an-year-pct" style="color:${col}">${p ?? '—'}%</div>
      ${pctBar(p, col)}
      <div class="an-year-meta">${d.sessions} გამოცდა · ${d.correct}/${d.total}</div>
    </div>`;
  });
  html += '</div>';

  // ── Session history (with expandable open answers) ──
  html += `<div class="an-section-title" style="margin-top:28px">🕓 გამოცდების ისტორია</div>`;

  [...sessions].reverse().forEach((s, idx) => {
    const sid   = `sess-${s.id}`;
    const p     = s.pct;
    const col   = pctColor(p);
    const hasOpen = s.openResults && s.openResults.some(r =>
      (r.items.length ? r.items.some(it => it.typed) : r.typed)
    );

    const scoreDelta = s.rechecked && s.originalScore !== undefined && s.originalScore !== s.score
      ? `<span class="an-sess-delta" title="განახლებამდე: ${s.originalScore}/${s.originalTotal}">(ადრე: ${s.originalScore}/${s.originalTotal})</span>`
      : '';
    const recheckBadge = s.rechecked
      ? `<span class="an-recheck-badge" title="შედეგი განახლდა ახალი მონაცემებით">🔄</span>`
      : `<span class="an-needs-recheck" title="ეს შედეგი ჯერ არ არის განახლებული">⚠️</span>`;

    html += `
<div class="an-sess-card">
  <div class="an-sess-head" onclick="toggleSession('${sid}')">
    <span class="an-exam-tag">${s.label}</span>
    <span class="an-date">${fmtDate(s.date)}</span>
    <span class="an-sess-score">${s.score} / ${s.total}</span>
    ${scoreDelta}
    <span class="an-sess-pct" style="color:${col}">${p ?? '—'}%</span>
    ${recheckBadge}
    <span class="an-sess-toggle" id="tog-${sid}">▶</span>
  </div>
  <div class="an-sess-body" id="${sid}" style="display:none">`;

    // MCQ wrong answers — full question visual
    const wrong = s.mcqResults.filter(r => r.correct && !r.isRight);
    if (wrong.length) {
      html += `<div class="an-sess-sub-title">❌ არასწორი MCQ პასუხები (${wrong.length})</div>
<div class="an-wrong-list">`;
      wrong.forEach(r => {
        // Build a fake "mistake" object so renderMistakeQuestion can work
        const fakeM = {
          qId:      r.qId,
          num:      r.num,
          text:     r.text,
          examples: [{ selected: r.selected, correct: r.correct, date: s.date }]
        };
        html += `<div class="an-wrong-card">
          <div class="an-wrong-card-head">
            <span class="an-wrong-num">კ.${r.num}</span>
            <span class="an-wrong-card-label">${s.label}</span>
          </div>
          ${renderMistakeQuestion(fakeM)}
        </div>`;
      });
      html += '</div>';
    } else if (s.mcqResults.some(r => r.correct)) {
      html += `<div class="an-sess-perfect">✅ ყველა MCQ სწორად!</div>`;
    }

    // Open answers
    if (s.openResults && s.openResults.length) {
      html += `<div class="an-sess-sub-title">📝 ღია კითხვების პასუხები</div>
<div class="an-open-list">`;
      s.openResults.forEach(r => {
        if (!r.items.length) {
          // Single open answer
          const hasTyped = r.typed && r.typed.trim();
          html += `<div class="an-open-card">
            <div class="an-open-q"><strong>კ.${r.num}</strong> ${r.text}${r.text.length >= 120 ? '…' : ''}</div>
            <div class="an-open-row">
              <div class="an-open-col">
                <div class="an-open-lbl">თქვენი პასუხი</div>
                <div class="an-open-typed ${hasTyped ? '' : 'an-open-empty'}">${hasTyped ? escHtml(r.typed) : '— არ შეგიყვანიათ —'}</div>
              </div>
              ${r.modelAnswer ? `<div class="an-open-col">
                <div class="an-open-lbl">სწორი პასუხი</div>
                <div class="an-open-model">${escHtml(r.modelAnswer)}</div>
              </div>` : ''}
            </div>
          </div>`;
        } else {
          // Sub-item open answers
          html += `<div class="an-open-card">
            <div class="an-open-q"><strong>კ.${r.num}</strong> ${r.text}${r.text.length >= 120 ? '…' : ''}</div>`;
          r.items.forEach(item => {
            const hasTyped = item.typed && item.typed.trim();
            html += `<div class="an-open-item">
              <div class="an-open-item-id">${item.id}</div>
              <div class="an-open-item-q">${item.text}</div>
              <div class="an-open-row">
                <div class="an-open-col">
                  <div class="an-open-lbl">თქვენი პასუხი</div>
                  <div class="an-open-typed ${hasTyped ? '' : 'an-open-empty'}">${hasTyped ? escHtml(item.typed) : '— არ შეგიყვანიათ —'}</div>
                </div>
                ${item.modelAnswer ? `<div class="an-open-col">
                  <div class="an-open-lbl">სწორი პასუხი</div>
                  <div class="an-open-model">${escHtml(item.modelAnswer)}</div>
                </div>` : ''}
              </div>
            </div>`;
          });
          html += '</div>';
        }
      });
      html += '</div>';
    }

    html += `</div></div>`;  // close sess-body + sess-card
  });

  // ── MCQ Mistakes ──
  if (mistakes.length) {
    html += `<div class="an-section-title" style="margin-top:28px">❌ ყველაზე ხშირი შეცდომები</div>
<div class="an-mistakes-list">`;
    mistakes.slice(0, 30).forEach((m, i) => {
      const errPct = Math.round(m.wrongCount / m.total * 100);
      const col    = pctColor(100 - errPct);
      html += `<div class="an-mistake-card">
        <div class="an-mistake-head">
          <span class="an-mistake-rank">#${i + 1}</span>
          <span class="an-mistake-ref">${m.label} · კ.${m.num}</span>
          <span class="an-mistake-count" style="color:var(--red)">${m.wrongCount}× შეცდომა</span>
          <span class="an-bar-inline-wrap" style="flex:1;max-width:120px">${pctBar(100 - errPct, col)}</span>
          <span class="an-mistake-stat">${m.total - m.wrongCount}/${m.total} სწორი</span>
        </div>
        ${renderMistakeQuestion(m)}
      </div>`;
    });
    html += '</div>';
  }

  // ── Recheck + Reset ──
  const anyUnrechecked = sessions.some(s => !s.rechecked);
  html += `
<div class="an-reset-wrap">
  ${anyUnrechecked ? `<button class="an-recheck-btn" onclick="recheckAllSessions()">🔄 ძველი შედეგების განახლება</button>` : `<span class="an-recheck-done">✅ ყველა შედეგი განახლებულია</span>`}
  <button class="an-reset-btn" onclick="confirmReset()">🗑 სტატისტიკის გასუფთავება</button>
</div>`;

  pane.innerHTML = html;
}

/* ── Toggle session detail ──────────────────────────────────────────────── */

function toggleSession(sid) {
  const body = document.getElementById(sid);
  const tog  = document.getElementById('tog-' + sid);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display  = open ? 'block' : 'none';
  if (tog) tog.textContent = open ? '▼' : '▶';
}

/* ── Recheck past sessions ───────────────────────────────────────────────── */

function recheckAllSessions() {
  const stats = loadStats();
  let changed = 0;

  stats.sessions.forEach(session => {
    const exam = EXAMS[session.examKey];
    if (!exam) return;

    // ── 1. Re-evaluate MCQ scores with current answer keys ──
    const mcqAnswers = {};
    session.mcqResults.forEach(r => { mcqAnswers[r.qId] = r.selected; });

    const newMcqResults = exam.questions
      .filter(q => q.type === 'mcq')
      .map(q => ({
        qId:      q.id,
        num:      q.num,
        text:     q.text.slice(0, 120),
        selected: mcqAnswers[q.id] ?? null,
        correct:  q.answer ?? null,
        isRight:  q.answer ? (mcqAnswers[q.id] === q.answer) : null,
      }));

    const scored   = newMcqResults.filter(r => r.correct !== null);
    const nCorrect = scored.filter(r => r.isRight).length;
    const newScore = nCorrect;
    const newTotal = scored.length;
    const newPct   = newTotal ? Math.round(nCorrect / newTotal * 100) : null;

    // ── 2. Rebuild open results with current model answers ──
    // Collect what the student typed (keyed by qId + itemId)
    const prevOpenMap = {};
    (session.openResults || []).forEach(r => {
      prevOpenMap[r.qId] = r;
    });

    const newOpenResults = exam.questions
      .filter(q => q.type === 'open')
      .map(q => {
        const prev  = prevOpenMap[q.id] || { typed: '', items: [] };
        const items = q.items || [];

        if (!items.length) {
          return {
            qId:         q.id,
            num:         q.num,
            text:        q.text.slice(0, 120),
            typed:       prev.typed || '',
            modelAnswer: q.single_answer ?? null,
            items:       [],
          };
        }

        return {
          qId:         q.id,
          num:         q.num,
          text:        q.text.slice(0, 120),
          typed:       '',
          modelAnswer: null,
          items: items.map(item => {
            const prevItem = (prev.items || []).find(si => String(si.id) === String(item.id));
            return {
              id:          item.id,
              text:        item.text,
              typed:       prevItem?.typed || '',
              modelAnswer: item.answer ?? null,
            };
          }),
        };
      });

    // ── 3. Save original score (only once) ──
    if (!session.rechecked) {
      session.originalScore = session.score;
      session.originalTotal = session.total;
      session.originalPct   = session.pct;
    }

    if (session.score !== newScore || session.total !== newTotal) changed++;

    session.mcqResults  = newMcqResults;
    session.openResults = newOpenResults;
    session.score       = newScore;
    session.total       = newTotal;
    session.pct         = newPct;
    session.rechecked   = true;
    session.recheckedAt = new Date().toISOString();
  });

  saveStats(stats);

  const msg = changed > 0
    ? `განახლდა ${stats.sessions.length} გამოცდა. ${changed} შემთხვევაში ქულა შეიცვალა.`
    : `განახლდა ${stats.sessions.length} გამოცდა. ქულები არ შეცვლილა.`;
  alert(msg);
  renderAnalytics();
}

/* ── Reset ──────────────────────────────────────────────────────────────── */

function confirmReset() {
  if (!confirm('გსურთ მთელი სტატისტიკის წაშლა? ეს ქმედება შეუქცევადია.')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderAnalytics();
}

/* ── Analytics tab ──────────────────────────────────────────────────────── */

function showAnalytics() {
  document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.year-btn[data-year="analytics"]').classList.add('active');
  document.querySelectorAll('.variant-bar').forEach(b => b.classList.remove('visible'));
  document.querySelectorAll('.exam-pane').forEach(e => e.classList.remove('active'));
  const pane = document.getElementById('analytics-pane');
  if (pane) {
    pane.classList.add('active');
    renderAnalytics();
  }
}

/* ── Utility ────────────────────────────────────────────────────────────── */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
