/* ═══════════════════════════════════════════════════════════
   Presenter — laptop view logic
   ═══════════════════════════════════════════════════════════ */

const socket = io({ query: { role: 'presenter' } });
const $ = (id) => document.getElementById(id);

const stage = $('pStage');
const side = $('pSide');
const mainEl = $('pMain');
const segBadge = $('segBadge');
const phaseLabel = $('phaseLabel');
const subLabel = $('subLabel');
const studentCount = $('studentCount');
const groupCount = $('groupCount');
const qrCorner = $('qrCorner');
const qrCornerImg = $('qrCornerImg');
const qrCornerUrl = $('qrCornerUrl');

const btnStart = $('btnStart');
const btnJoke = $('btnJoke');
const btnSkipSub = $('btnSkipSub');
const btnAddTime = $('btnAddTime');
const btnPause = $('btnPause');
const btnNext = $('btnNext');
const btnBack = $('btnBack');
const btnReset = $('btnReset');
const btnAnswerNow = $('btnAnswerNow');
const queueBadge = $('queueBadge');
const chatInput = $('chatInput');
const chatSend = $('chatSend');

const timerText = $('timerText');
const timerBar = $('timerBar');
const timerBarWrap = $('timerBarWrap');

let qrCached = null;

/* ─── Button wiring ─────────────────────────────────────────── */
btnStart.onclick = () => {
  unlockAudio();
  socket.emit('presenter:start');
};
btnJoke.onclick = () => socket.emit('presenter:joke');
btnSkipSub.onclick = () => socket.emit('presenter:skip-sub');
btnAddTime.onclick = () => socket.emit('presenter:add-time', { seconds: 30 });
btnPause.onclick = () => socket.emit('presenter:pause');
btnNext.onclick = () => socket.emit('presenter:next');
btnReset.onclick = () => {
  if (confirm('Reset the entire session?')) socket.emit('presenter:reset');
};
btnBack.onclick = () => socket.emit('presenter:back');
btnAnswerNow.onclick = () => socket.emit('presenter:answer-now');
chatSend.onclick = sendChat;
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

/* ─── Voice dropdown ────────────────────────────────────────── */
const voiceSelect = $('voiceSelect');
async function loadVoices() {
  try {
    const r = await fetch('/api/voices').then((x) => x.json());
    voiceSelect.innerHTML = '';
    const groups = [
      { label: 'Male voices', voices: r.voices.male || [] },
      { label: 'Female voices', voices: r.voices.female || [] },
    ];
    for (const g of groups) {
      const og = document.createElement('optgroup');
      og.label = g.label;
      for (const v of g.voices) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.label;
        if (v.id === r.current) opt.selected = true;
        og.appendChild(opt);
      }
      voiceSelect.appendChild(og);
    }
  } catch (err) {
    voiceSelect.innerHTML = '<option>(failed to load)</option>';
  }
}
loadVoices();
voiceSelect.onchange = () => {
  unlockAudio();
  socket.emit('presenter:set-voice', { voice: voiceSelect.value });
};
socket.on('voice:changed', ({ voice }) => {
  if (voiceSelect.value !== voice) voiceSelect.value = voice;
});

function sendChat() {
  const q = chatInput.value.trim();
  if (q.length < 2) return;
  socket.emit('presenter:chat', { question: q });
  chatInput.value = '';
}

/* ─── Timer UI ──────────────────────────────────────────────── */
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
function updateTimer(seconds, total) {
  timerText.textContent = fmtTime(Math.max(0, seconds));
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  timerBar.style.width = `${Math.max(0, pct)}%`;
  timerBarWrap.classList.toggle('timer-warn', seconds <= 20 && seconds > 10);
  timerBarWrap.classList.toggle('timer-crit', seconds <= 10);
}
socket.on('timer:start', ({ seconds, total }) => updateTimer(seconds, total));
socket.on('timer:tick', ({ seconds, total }) => updateTimer(seconds, total));
socket.on('timer:done', () => updateTimer(0, 1));
socket.on('timer:paused', ({ paused }) => {
  btnPause.textContent = paused ? 'Resume' : 'Pause';
});

/* ─── QR code loader ────────────────────────────────────────── */
async function ensureQR() {
  if (qrCached) return qrCached;
  qrCached = await fetch('/qrcode').then((r) => r.json());
  qrCornerImg.src = qrCached.qr;
  qrCornerUrl.textContent = qrCached.url;
  return qrCached;
}
ensureQR();

/* ─── State dispatch ────────────────────────────────────────── */
/* ─── Session clock (30-min budget per the rubric) ─────────── */
const sessionClockEl = document.getElementById('sessionClock');
const sessionClockWrap = document.getElementById('sessionClockWrap');
let sessionStartedAt = null;
let sessionBudgetMs = 30 * 60 * 1000;
function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
setInterval(() => {
  if (!sessionStartedAt) {
    sessionClockWrap.classList.add('hidden');
    return;
  }
  sessionClockWrap.classList.remove('hidden');
  const elapsed = Date.now() - sessionStartedAt;
  const budget = sessionBudgetMs;
  if (elapsed >= budget) {
    const over = elapsed - budget;
    sessionClockEl.textContent = `+${fmtClock(over)} OVER · ${fmtClock(budget)} budget`;
    sessionClockWrap.classList.add('over');
    sessionClockWrap.classList.remove('warn');
  } else {
    sessionClockEl.textContent = `${fmtClock(elapsed)} / ${fmtClock(budget)}`;
    sessionClockWrap.classList.remove('over');
    if (budget - elapsed <= 5 * 60 * 1000) {
      sessionClockWrap.classList.add('warn');
    } else {
      sessionClockWrap.classList.remove('warn');
    }
  }
}, 1000);

socket.on('state:update', (s) => {
  studentCount.textContent = s.studentCount;
  groupCount.textContent = Object.keys(s.groups || {}).length;
  sessionStartedAt = s.sessionStartedAt || null;
  if (s.sessionBudgetMs) sessionBudgetMs = s.sessionBudgetMs;
  applyPhase(s);
});

socket.on('reset', () => {
  stage.innerHTML = '';
  side.innerHTML = '';
});

function applyPhase(s) {
  const live = s.phase !== 'LOBBY' && s.phase !== 'COMPLETE';
  btnStart.classList.toggle('hidden', s.phase !== 'LOBBY');
  btnJoke.classList.toggle('hidden', !live);
  btnBack.classList.toggle('hidden', !live);
  btnSkipSub.classList.toggle('hidden', !live);
  btnAddTime.classList.toggle('hidden', !live);
  btnPause.classList.toggle('hidden', !live);
  // Next is always visible while live — clicking it always advances something
  // (a narration wait, a pending advance, a running timer, or a phase-end).
  btnNext.classList.toggle('hidden', !live);

  // Show/hide QR corner + reserve stage padding when it's visible
  const qrOn = !(s.phase === 'LOBBY' || s.phase === 'COMPLETE');
  qrCorner.classList.toggle('hidden-corner', !qrOn);
  document.body.classList.toggle('qr-on', qrOn);

  if (s.phase === 'LOBBY') {
    setBadge('LOBBY', 'seg-1');
    phaseLabel.textContent = 'Waiting to start';
    subLabel.textContent = `${s.studentCount} student${s.studentCount === 1 ? '' : 's'} joined`;
    renderLobby(s);
    mainEl.classList.add('one-col');
  } else if (s.phase === 'CRITICAL_THINKING') {
    setBadge('PHASE 1 · CRITICAL THINKING', 'seg-1');
    phaseLabel.textContent = 'Critical Thinking';
    subLabel.textContent = subPhaseLabel(s.subPhase);
    if (s.subPhase && s.subPhase.startsWith('ct_q')) mainEl.classList.remove('one-col');
    else mainEl.classList.add('one-col');
  } else if (s.phase === 'MYTH_VS_FACT') {
    setBadge(`PHASE 2 · MYTH VS FACT (${s.mvf.currentIndex + 1}/${s.mvf.totalStatements})`, 'seg-2');
    phaseLabel.textContent = 'Myth vs Fact';
    subLabel.textContent = subPhaseLabel(s.subPhase);
    mainEl.classList.add('one-col');
  } else if (s.phase === 'PRIORITY_PYRAMID') {
    setBadge('PHASE 3 · PRIORITY PYRAMID', 'seg-3');
    phaseLabel.textContent = 'Priority Pyramid';
    subLabel.textContent = subPhaseLabel(s.subPhase);
    if (s.subPhase === 'pyramid_display' || s.subPhase === 'pyramid_ai') {
      mainEl.classList.remove('one-col');
    } else {
      mainEl.classList.add('one-col');
    }
  } else if (s.phase === 'COMPLETE') {
    setBadge('COMPLETE', 'seg-1');
    phaseLabel.textContent = 'Thank you!';
    subLabel.textContent = '';
    mainEl.classList.add('one-col');
  }
}

function setBadge(text, cls) {
  segBadge.textContent = text;
  segBadge.className = `seg-badge ${cls}`;
}

function subPhaseLabel(sp) {
  if (!sp) return '';
  const map = {
    ct_scenario: 'Scenario',
    ct_q1: 'Guiding Q1',
    ct_q2: 'Guiding Q2',
    ct_q3: 'Guiding Q3',
    ct_ai_processing: 'Analyzing',
    ct_ai: 'Class Summary',
    ct_scoreboard: 'Scoreboard',
    mvf_intro: 'Intro',
    mvf_vote: 'Voting',
    mvf_reveal: 'Reveal',
    mvf_summary_processing: 'Analyzing',
    mvf_summary: 'Final Summary',
    mvf_scoreboard: 'Scoreboard',
    pyramid_intro: 'Intro',
    pyramid_setup_a: 'Part 1 · Setup',
    pyramid_sort_a: 'Part 1 · Ranking',
    pyramid_display_a: 'Part 1 · Submissions',
    pyramid_setup_b: 'Part 2 · Setup',
    pyramid_sort_b: 'Part 2 · Ranking',
    pyramid_display_b: 'Part 2 · Submissions',
    pyramid_ai_processing: 'Analyzing',
    pyramid_ai: 'Analysis',
    pyramid_scoreboard: 'Scoreboard',
    closing_takeaways: 'Key Takeaways',
  };
  return map[sp] || sp;
}

/* ─── LOBBY ──────────────────────────────────────────────── */
async function renderLobby(s) {
  side.innerHTML = '';
  const q = await ensureQR();
  const groupsHtml = Object.entries(s.groups || {})
    .map(
      ([g, names]) =>
        `<div class="group-chip"><b>${escapeHtml(g)}</b> · ${names.length}</div>`
    )
    .join('');
  stage.innerHTML = `
    <div class="lobby">
      <div class="qr-box glass">
        <img src="${q.qr}" alt="QR">
        <div class="qr-url">${q.url}</div>
        <div style="color:var(--text-dim);font-size:0.9rem">Scan or type URL to join</div>
      </div>
      <div class="join-info">
        <h1 class="hero-title">Chapter 6<br>Interactive Classroom</h1>
        <p>Scan the QR code. Enter your name + group (or just your name if solo).</p>
        <p style="color:var(--teal)"><b>${s.studentCount}</b> student${s.studentCount === 1 ? '' : 's'} joined · <b>${Object.keys(s.groups || {}).length}</b> group${Object.keys(s.groups || {}).length === 1 ? '' : 's'}</p>
        <div class="groups-list">${groupsHtml}</div>
      </div>
    </div>
  `;
}

/* ─── CT ─────────────────────────────────────────────────── */
const ctAnswersCache = { ct_q1: [], ct_q2: [], ct_q3: [] };
let currentCTQId = null;

socket.on('ct:scenario', ({ scenario }) => {
  currentCTQId = null;
  stage.innerHTML = `
    <div class="scenario-card">
      <span class="seg-badge seg-1" style="margin-bottom:10px">Phase 1 · Critical Thinking</span>
      <p style="color:var(--text-secondary);font-style:italic;margin-bottom:14px;font-size:0.95rem">
        Emancipatory lens: this isn't just a clinical case — it's about autonomy, social determinants, and challenging assumptions about older adults.
      </p>
      <h2>Scenario · Read aloud</h2>
      <div class="scenario-text">${escapeHtml(scenario)}</div>
    </div>
  `;
  side.innerHTML = `
    <div class="answers-feed">
      <h3>Live answers</h3>
      <p style="color:var(--text-dim);font-size:0.85rem">
        Guiding questions will appear after the scenario.
      </p>
    </div>
  `;
});

socket.on('ct:question', ({ id, text, index }) => {
  currentCTQId = id;
  stage.innerHTML = `
    <div class="question-card">
      <div class="q-label">Guiding Question ${index + 1} of 3</div>
      <div class="q-text">${escapeHtml(text)}</div>
    </div>
  `;
  renderCTSide(id);
});

socket.on('ct:answer', ({ questionId, name, group, text }) => {
  if (!ctAnswersCache[questionId]) ctAnswersCache[questionId] = [];
  ctAnswersCache[questionId].push({ name, group, text });
  if (currentCTQId === questionId) renderCTSide(questionId);
});

function renderCTSide(qid) {
  const answers = ctAnswersCache[qid] || [];
  side.innerHTML = `
    <div class="answers-feed">
      <h3>Live answers · ${answers.length}</h3>
      ${answers
        .slice()
        .reverse()
        .map(
          (a) => `
        <div class="answer-item">
          <div class="who">${escapeHtml(a.group)} · ${escapeHtml(a.name)}</div>
          <div class="what">${escapeHtml(a.text)}</div>
        </div>`
        )
        .join('') || '<p style="color:var(--text-dim)">Waiting for responses…</p>'}
    </div>
  `;
}

socket.on('ct:processing', () => {
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Analyzing</div>
      <div class="ai-text" style="color:var(--text-dim)">Grouping responses by theme, checking clinical reasoning, tying to emancipatory nursing.</div>
    </div>
  `;
});

socket.on('ct:summary', ({ summary }) => {
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Class Summary · Emancipatory Lens</div>
      <div class="ai-text" id="ctSummaryText"></div>
    </div>
  `;
  typewriter($('ctSummaryText'), summary);
  speak(summary);
});

/* ─── MVF ──────────────────────────────────────────────────── */
let mvfCurrent = null;

socket.on('mvf:statement', ({ id, text, index, total }) => {
  mvfCurrent = { id, text, index, total, myth: 0, fact: 0, revealed: false };
  renderMVFStatement();
});

socket.on('mvf:votes', ({ statementId, myth, fact, total }) => {
  if (!mvfCurrent || mvfCurrent.id !== statementId) return;
  mvfCurrent.myth = myth;
  mvfCurrent.fact = fact;
  mvfCurrent.totalVotes = total;
  updateVoteBars();
});

socket.on('mvf:reveal', ({ id, correct, pctMyth, pctFact, pctCorrect, emancipatory }) => {
  if (!mvfCurrent || mvfCurrent.id !== id) return;
  mvfCurrent.revealed = true;
  mvfCurrent.correct = correct;
  mvfCurrent.pctMyth = pctMyth;
  mvfCurrent.pctFact = pctFact;
  mvfCurrent.pctCorrect = pctCorrect;
  mvfCurrent.emancipatory = emancipatory;
  renderMVFStatement();
});

socket.on('mvf:roast', ({ id, roast }) => {
  if (!mvfCurrent || mvfCurrent.id !== id) return;
  mvfCurrent.roast = roast;
  const el = document.getElementById('mvfRoastText');
  if (el) {
    typewriter(el, roast);
    speak(roast);
  } else {
    renderMVFStatement();
  }
});

socket.on('mvf:processing', () => {
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Analyzing</div>
    </div>
  `;
});

socket.on('mvf:final', ({ summary }) => {
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Round Summary</div>
      <div class="ai-text" id="mvfFinalText"></div>
    </div>
  `;
  typewriter($('mvfFinalText'), summary);
  speak(summary);
});

function renderMVFStatement() {
  if (!mvfCurrent) return;
  const c = mvfCurrent;
  const myth = c.myth || 0;
  const fact = c.fact || 0;
  const total = myth + fact;
  const pctM = total > 0 ? Math.round((myth / total) * 100) : 0;
  const pctF = total > 0 ? Math.round((fact / total) * 100) : 0;

  stage.innerHTML = `
    <div class="mvf-statement">
      <div class="stmt-idx">Statement ${c.index + 1} of ${c.total}</div>
      <div class="stmt-text">${escapeHtml(c.text)}</div>
      <div class="vote-bar-wrap">
        <div class="vote-row myth">
          <div class="label">MYTH</div>
          <div class="track"><div class="fill" id="fillMyth" style="width:${pctM}%"></div></div>
          <div class="pct" id="pctMyth">${pctM}% · ${myth}</div>
        </div>
        <div class="vote-row fact">
          <div class="label">FACT</div>
          <div class="track"><div class="fill" id="fillFact" style="width:${pctF}%"></div></div>
          <div class="pct" id="pctFact">${pctF}% · ${fact}</div>
        </div>
      </div>
      ${
        c.revealed
          ? `
        <div class="mvf-reveal-banner ${c.correct === 'MYTH' ? 'myth' : 'fact'}">
          Correct: ${c.correct} · ${c.pctCorrect}% got it right
        </div>
        <div class="mvf-roast"><span id="mvfRoastText">${c.roast ? escapeHtml(c.roast) : '…'}</span></div>
        <div class="mvf-emancipatory">${escapeHtml(c.emancipatory || '')}</div>
      `
          : ''
      }
    </div>
  `;
}

function updateVoteBars() {
  if (!mvfCurrent) return;
  const c = mvfCurrent;
  const total = c.myth + c.fact;
  const pctM = total > 0 ? Math.round((c.myth / total) * 100) : 0;
  const pctF = total > 0 ? Math.round((c.fact / total) * 100) : 0;
  const fM = document.getElementById('fillMyth');
  const fF = document.getElementById('fillFact');
  const pM = document.getElementById('pctMyth');
  const pF = document.getElementById('pctFact');
  if (fM) fM.style.width = `${pctM}%`;
  if (fF) fF.style.width = `${pctF}%`;
  if (pM) pM.textContent = `${pctM}% · ${c.myth}`;
  if (pF) pF.textContent = `${pctF}% · ${c.fact}`;
}

/* ─── PYRAMID ──────────────────────────────────────────────── */
let pyramidInterventions = [];
let pyramidSubmissions = {};

socket.on('pyramid:setup', ({ interventions, half, currentPart, totalParts }) => {
  pyramidInterventions = interventions;
  pyramidSubmissions = {};
  renderPyramidTutorial(interventions, { half, currentPart, totalParts });
  side.innerHTML = `<h3 style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.14em;font-size:0.85rem">Submissions</h3><p style="color:var(--text-dim)">Waiting for students…</p>`;
});

function renderPyramidTutorial(interventions, opts = {}) {
  const partLabel = opts.currentPart
    ? `Part ${opts.currentPart} of ${opts.totalParts || 2}`
    : 'How to play';
  stage.innerHTML = `
    <div class="tutorial">
      <span class="seg-badge seg-3">${escapeHtml(partLabel)} · Priority Pyramid</span>
      <h1>Tap the card, watch it climb the pyramid</h1>
      <p class="tut-caption">Each student ranks these <b>5 interventions</b> from #1 (top priority) to #5 (lowest in this part). The full pyramid is split into two parts of 5 — you'll do this once for each half. Tap a card on your phone — it fills the next slot. Tap a placed card to un-rank it.</p>
      <div class="tutorial-anim">
        <div class="tut-cards">
          <div class="tut-card" data-tut="1">Assess baseline temperature</div>
          <div class="tut-card active" data-tut="2">Connect to heating assistance</div>
          <div class="tut-card" data-tut="3">Ask about sexual health needs</div>
        </div>
        <div class="tut-arrow">→</div>
        <div class="tut-pyramid">
          <div class="tut-pyr-tier"><div class="tut-pyr-cell filled" id="tp1">1</div></div>
          <div class="tut-pyr-tier"><div class="tut-pyr-cell" id="tp2">2</div><div class="tut-pyr-cell" id="tp3">3</div></div>
          <div class="tut-pyr-tier"><div class="tut-pyr-cell" id="tp4">4</div><div class="tut-pyr-cell" id="tp5">5</div><div class="tut-pyr-cell" id="tp6">6</div></div>
          <div class="tut-pyr-tier"><div class="tut-pyr-cell" id="tp7">7</div><div class="tut-pyr-cell" id="tp8">8</div><div class="tut-pyr-cell" id="tp9">9</div><div class="tut-pyr-cell" id="tp10">10</div></div>
        </div>
      </div>
      <p class="tut-caption" style="color:var(--gold);font-weight:600">Ranking starts in a moment — coordinate with yourself, this is an individual task.</p>
    </div>
  `;
  animateTutorial();
}

function animateTutorial() {
  const cells = [1, 2, 3, 4, 5];
  let i = 0;
  const tick = () => {
    cells.forEach((n) => {
      const el = document.getElementById(`tp${n}`);
      if (el) el.classList.remove('filled');
    });
    // keep tp1 filled as the "start"
    for (let j = 0; j <= i && j < cells.length; j++) {
      const el = document.getElementById(`tp${cells[j]}`);
      if (el) el.classList.add('filled');
    }
    i = (i + 1) % (cells.length + 1);
  };
  tick();
  const intId = setInterval(() => {
    // only animate while tutorial is on-screen
    if (!document.querySelector('.tutorial')) {
      clearInterval(intId);
      return;
    }
    tick();
  }, 700);
}

socket.on('pyramid:sort', () => {
  stage.innerHTML = `
    <div class="pyramid-intro">
      <span class="seg-badge seg-3">STUDENTS ARE RANKING</span>
      <h1>Individual pyramids in progress</h1>
      <p style="color:var(--text-secondary);line-height:1.6">
        Each student submits their own pyramid. You'll see them pile up on the right as they come in.
      </p>
    </div>
  `;
});

socket.on('pyramid:submission', ({ by, group, count }) => {
  pyramidSubmissions[`${by} (${group})`] = true;
  renderPyramidSide(count);
});

function renderPyramidSide(count) {
  const who = Object.keys(pyramidSubmissions);
  side.innerHTML = `
    <h3 style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.14em;font-size:0.85rem;margin-bottom:12px">Submissions · ${who.length}</h3>
    ${who
      .map(
        (n) =>
          `<div class="group-chip" style="display:block;margin-bottom:8px"><b>${escapeHtml(n)}</b> ✓ submitted</div>`
      )
      .join('')}
  `;
}

socket.on('pyramid:display', ({ submissions }) => {
  pyramidSubmissions = submissions || {};
  stage.innerHTML = `
    <h2 style="color:var(--gold);text-transform:uppercase;letter-spacing:0.14em;font-size:1rem;margin-bottom:16px">All Student Pyramids</h2>
    <div class="pyramid-grid">
      ${Object.entries(submissions || {})
        .map(([n, r]) => renderMiniPyramid(n, r))
        .join('') || '<p style="color:var(--text-dim)">No submissions received.</p>'}
    </div>
  `;
});

function renderMiniPyramid(who, ranking) {
  const byRank = {};
  ranking.forEach((r) => { byRank[r.rank] = r; });
  const interventionById = Object.fromEntries(pyramidInterventions.map((i) => [i.id, i]));
  const maxRank = ranking.reduce((m, r) => Math.max(m, r.rank), 0);
  // 5-item half = 1, 2-3, 4-5; 10-item full = 1, 2-3, 4-5-6, 7-8-9-10
  const tierRanks = maxRank <= 5
    ? [[1], [2, 3], [4, 5]]
    : [[1], [2, 3], [4, 5, 6], [7, 8, 9, 10]];

  const tierHtml = tierRanks
    .map(
      (tier) => `
    <div class="tier">
      ${tier
        .map((rank) => {
          const item = byRank[rank];
          const iv = item ? interventionById[item.id] : null;
          const isSexual = item && (item.id === 3 || item.id === 8);
          const txt = iv ? `${rank}. ${iv.text.slice(0, 30)}${iv.text.length > 30 ? '…' : ''}` : '—';
          return `<div class="cell ${isSexual ? 'sexual' : ''}">${escapeHtml(txt)}</div>`;
        })
        .join('')}
    </div>
  `
    )
    .join('');

  return `
    <div class="mini-pyramid">
      <div class="mg-name">${escapeHtml(who)}</div>
      ${tierHtml}
    </div>
  `;
}

socket.on('pyramid:processing', () => {
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Analyzing</div>
    </div>
  `;
});

socket.on('pyramid:analysis', ({ analysis, submissions }) => {
  pyramidSubmissions = submissions || pyramidSubmissions;
  stage.innerHTML = `
    <div class="ai-summary">
      <div class="ai-badge"><span class="dot"></span> Consolidated Analysis · Emancipatory Lens</div>
      <div class="ai-text" id="pyrAnalysisText"></div>
    </div>
  `;
  side.innerHTML = `
    <h3 style="color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.14em;font-size:0.85rem;margin-bottom:12px">Pyramids</h3>
    <div class="pyramid-grid" style="grid-template-columns:1fr">
      ${Object.entries(pyramidSubmissions || {}).map(([n, r]) => renderMiniPyramid(n, r)).join('')}
    </div>
  `;
  typewriter($('pyrAnalysisText'), analysis);
  speak(analysis);
});

/* ─── SCOREBOARD ─────────────────────────────────────────── */
socket.on('scoreboard', ({ phaseLabel: pl, top, top3, praise }) => {
  const medalCls = ['top1', 'top2', 'top3'];
  const rows = top
    .map(
      (s, i) => `
    <div class="sb-row ${medalCls[i] || ''}">
      <div class="rank">#${i + 1}</div>
      <div class="name">${escapeHtml(s.name)}${s.group && s.group !== s.name ? `<small>${escapeHtml(s.group)}</small>` : ''}</div>
      <div class="phase-pts">+${s.phaseScore}</div>
      <div class="total-pts">${s.total} total</div>
    </div>
  `
    )
    .join('');

  stage.innerHTML = `
    <div class="scoreboard">
      <div><span class="seg-badge seg-3">SCOREBOARD</span></div>
      <h1>Top of the class</h1>
      <div class="sb-phase">Phase: ${escapeHtml(pl)}</div>
      <div class="sb-praise" id="sbPraiseText"></div>
      <div class="sb-rows">${rows || '<p style="color:var(--text-dim)">No scores recorded.</p>'}</div>
    </div>
  `;
  typewriter($('sbPraiseText'), praise);
  speak(praise);
});

/* ─── CHAT ───────────────────────────────────────────────── */
socket.on('chat:processing', ({ question }) => {
  const card = document.createElement('div');
  card.className = 'chat-card glass';
  card.style.marginTop = '12px';
  card.innerHTML = `
    <div class="chat-q">Q · ${escapeHtml(question)}</div>
    <div class="chat-a" id="chatAnsPending"><span style="color:var(--text-dim)">Artificial Nurse thinking…</span></div>
  `;
  stage.appendChild(card);
  stage.scrollTop = stage.scrollHeight;
});

socket.on('chat:answer', ({ question, answer }) => {
  const pending = document.getElementById('chatAnsPending');
  if (pending) {
    pending.id = '';
    typewriter(pending, answer);
    speak(answer);
  } else {
    const card = document.createElement('div');
    card.className = 'chat-card glass';
    card.style.marginTop = '12px';
    card.innerHTML = `
      <div class="chat-q">Q · ${escapeHtml(question)}</div>
      <div class="chat-a" id="chatAnsPost"></div>
    `;
    stage.appendChild(card);
    typewriter(document.getElementById('chatAnsPost'), answer);
    speak(answer);
  }
  stage.scrollTop = stage.scrollHeight;
});

/* ─── JOKE ───────────────────────────────────────────────── */
socket.on('joke', ({ joke, nextPhase }) => {
  stage.innerHTML = `
    <div class="joke-card">
      <span class="joke-badge">Quick joke before ${escapeHtml(nextPhase)}</span>
      <div class="joke-text" id="jokeTextEl"></div>
    </div>
  `;
  typewriter($('jokeTextEl'), joke, 30);
  speak(joke);
});

/* ─── COMPLETE ─────────────────────────────────────────── */
socket.on('complete', ({ final, takeaways }) => {
  const rows = (final || [])
    .map(
      (s, i) => `
    <div class="sb-row ${i < 3 ? ['top1','top2','top3'][i] : ''}">
      <div class="rank">#${i + 1}</div>
      <div class="name">${escapeHtml(s.name)}${s.group && s.group !== s.name ? `<small>${escapeHtml(s.group)}</small>` : ''}</div>
      <div class="phase-pts">${s.scores.total} pts</div>
      <div class="total-pts">CT ${s.scores.ct} · MvF ${s.scores.mvf} · Pyr ${s.scores.pyramid}</div>
    </div>
  `
    )
    .join('');
  stage.innerHTML = `
    <div class="scoreboard">
      <h1 class="hero-title" style="font-size:3rem">Key Takeaways</h1>
      <div class="sb-praise" id="closingTakeaways"></div>
      <h2 style="margin-top:18px;font-size:1.4rem">Final standings</h2>
      <div class="sb-rows">${rows || '<p style="color:var(--text-dim)">No scores.</p>'}</div>
    </div>
  `;
  if (takeaways) {
    typewriter($('closingTakeaways'), takeaways, 12);
  }
});

/* ─── Typewriter + voice ─────────────────────────────────── */
// Held typewriter: starts immediately if no pending hold, otherwise waits
// for the first audio chunk to flush.
function typewriter(el, text, speed = 35) {
  if (pendingTypewriter) {
    // Already holding for someone else — replace and let audio fire it.
    schedulePendingTypewriter(el, text, speed);
    return;
  }
  schedulePendingTypewriter(el, text, speed);
  // If no audio is expected (TTS off / failed), fall through immediately.
  // Otherwise the first audio:play flushes the hold.
}

function typewriterNow(el, text, speed = 35) {
  if (!el) return;
  el.classList.add('typing');
  el.textContent = '';
  let i = 0;
  let lastScroll = 0;
  const tick = () => {
    if (i >= text.length) {
      el.classList.remove('typing');
      return;
    }
    el.textContent += text[i++];
    // Auto-scroll: keep the typing cursor in view, but throttle to every
    // ~120ms so we don't fight the browser layout on long text.
    const now = performance.now();
    if (now - lastScroll > 120) {
      lastScroll = now;
      if (stage) stage.scrollTop = stage.scrollHeight;
    }
    setTimeout(tick, speed);
  };
  tick();
}

/* Gemini TTS playback — queued, serial */
const audioQueue = [];
let audioPlaying = false;
let currentAudioEl = null;
let audioUnlocked = false;

// Pending typewriter — set when text arrives but we want to wait for the
// first audio chunk so they start in lockstep.
let pendingTypewriter = null;
function schedulePendingTypewriter(el, text, speed) {
  pendingTypewriter = { el, text, speed };
  // Failsafe: if no audio fires within 6s (TTS down), just type anyway.
  setTimeout(() => {
    if (pendingTypewriter && pendingTypewriter.el === el) {
      const p = pendingTypewriter;
      pendingTypewriter = null;
      typewriterNow(p.el, p.text, p.speed);
    }
  }, 6000);
}
function flushPendingTypewriter() {
  if (!pendingTypewriter) return;
  const p = pendingTypewriter;
  pendingTypewriter = null;
  typewriterNow(p.el, p.text, p.speed);
}

function unlockAudio() {
  if (audioUnlocked) return;
  // Play a silent buffer on first user gesture to satisfy autoplay policy
  try {
    const a = new Audio();
    a.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    a.volume = 0;
    a.play().catch(() => {});
  } catch {}
  audioUnlocked = true;
}
document.addEventListener('click', unlockAudio, { once: false });

function notifyServerIfQueueEmpty() {
  if (!audioPlaying && audioQueue.length === 0) {
    socket.emit('audio:finished');
  }
}

function playNextAudio() {
  if (audioPlaying) return;
  const next = audioQueue.shift();
  if (!next) return;
  audioPlaying = true;
  const audio = new Audio(`data:${next.mime || 'audio/wav'};base64,${next.audioBase64}`);
  currentAudioEl = audio;
  const advance = () => {
    audioPlaying = false;
    currentAudioEl = null;
    if (audioQueue.length > 0) playNextAudio();
    else notifyServerIfQueueEmpty();
  };
  audio.onended = advance;
  audio.onerror = advance;
  audio.play().catch((err) => {
    console.warn('audio play blocked:', err.message);
    advance();
  });
}

socket.on('audio:play', (payload) => {
  // First audio chunk arriving for this narration — release the held
  // typewriter so visual + audio start together.
  flushPendingTypewriter();
  audioQueue.push(payload);
  playNextAudio();
});

socket.on('audio:clear', () => {
  audioQueue.length = 0;
  if (currentAudioEl) {
    try { currentAudioEl.pause(); } catch {}
    currentAudioEl = null;
  }
  audioPlaying = false;
});

socket.on('narration:waiting', () => {
  btnNext.classList.remove('hidden');
  btnNext.textContent = 'Next →';
  btnNext.classList.add('waiting-pulse');
});
socket.on('narration:audio-done', () => {
  // Voice finished; presenter still drives the advance manually.
  btnNext.textContent = 'Next → (voice done)';
  btnNext.classList.add('waiting-pulse');
});
socket.on('narration:advanced', () => {
  btnNext.classList.remove('waiting-pulse');
  btnNext.textContent = 'Next →';
});

// Server raises this when a gameplay timer hits 0 and is waiting for click.
socket.on('pending:advance', ({ label }) => {
  if (label) {
    btnNext.classList.add('waiting-pulse');
    btnNext.textContent = "Time's up — Next →";
  } else {
    btnNext.classList.remove('waiting-pulse');
    btnNext.textContent = 'Next →';
  }
});

/* speak() retained as a no-op (Gemini TTS now drives all voice) */
function speak() { /* replaced by Gemini TTS via audio:play */ }

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[m]);
}

/* ─── Student-question queue ──────────────────────────────── */
let currentQueue = [];

socket.on('chat:queue', ({ queue }) => {
  currentQueue = queue || [];
  renderQueueRail();
  updateAnswerNowButton();
});

function updateAnswerNowButton() {
  const pending = currentQueue.filter((q) => q.status === 'pending').length;
  if (pending > 0) {
    btnAnswerNow.classList.remove('hidden');
    queueBadge.textContent = pending;
    queueBadge.classList.remove('hidden');
  } else {
    // keep visible if any answering in progress
    const answering = currentQueue.some((q) => q.status === 'answering');
    if (!answering) {
      btnAnswerNow.classList.add('hidden');
      queueBadge.classList.add('hidden');
    } else {
      btnAnswerNow.classList.remove('hidden');
      queueBadge.textContent = '…';
      queueBadge.classList.remove('hidden');
    }
  }
}

function renderQueueRail() {
  // Remove any existing rail from side
  const existing = document.getElementById('queueRail');
  if (existing) existing.remove();

  const pending = currentQueue.filter((q) => q.status !== 'answered');
  const recent = currentQueue.filter((q) => q.status === 'answered').slice(-3);

  if (pending.length === 0 && recent.length === 0) return;

  const rail = document.createElement('div');
  rail.className = 'queue-rail';
  rail.id = 'queueRail';

  const pendingHtml = pending
    .map(
      (q) => `
    <div class="q-item ${q.status === 'answering' ? 'answering' : ''}">
      <span class="q-from">${escapeHtml(q.from)}${q.group && q.group !== q.from ? ` · ${escapeHtml(q.group)}` : ''}${q.status === 'answering' ? ' · answering…' : ''}</span>
      ${escapeHtml(q.question)}
    </div>
  `
    )
    .join('');

  const answeredHtml = recent
    .map(
      (q) => `
    <div class="q-item answered">
      <span class="q-from">Answered · ${escapeHtml(q.from)}</span>
      ${escapeHtml(q.question)}
      <div class="q-answer">${escapeHtml(q.answer || '')}</div>
    </div>
  `
    )
    .join('');

  rail.innerHTML = `
    <h4>Student Q&A <span class="count">${pending.length} pending</span></h4>
    ${pendingHtml || '<p style="color:var(--text-dim);font-size:0.8rem">Queue is empty — tap Ask from a phone.</p>'}
    ${recent.length > 0 ? `<h4 style="margin-top:14px">Recently answered</h4>${answeredHtml}` : ''}
  `;

  // Prefer side panel, but if stage is in one-col mode, append to stage
  if (side && !mainEl.classList.contains('one-col')) {
    side.appendChild(rail);
  } else {
    stage.appendChild(rail);
  }
}

socket.on('chat:batch-processing', ({ count }) => {
  const card = document.createElement('div');
  card.className = 'chat-card glass';
  card.id = 'batchProcessingCard';
  card.style.marginTop = '12px';
  card.innerHTML = `
    <div class="chat-q">Artificial Nurse is answering ${count} student question${count === 1 ? '' : 's'}…</div>
  `;
  stage.appendChild(card);
  stage.scrollTop = stage.scrollHeight;
});

socket.on('chat:batch-answered', ({ answered }) => {
  const proc = document.getElementById('batchProcessingCard');
  if (proc) proc.remove();

  const wrap = document.createElement('div');
  wrap.className = 'chat-card glass';
  wrap.style.marginTop = '12px';
  wrap.innerHTML = `
    <div class="chat-q">Artificial Nurse · Batch answers (${answered.length})</div>
    <div id="batchAns"></div>
  `;
  stage.appendChild(wrap);
  const container = document.getElementById('batchAns');

  // Render each answer sequentially with a short delay so it reads like a feed
  let i = 0;
  const next = () => {
    if (i >= answered.length) return;
    const a = answered[i++];
    const block = document.createElement('div');
    block.style.marginTop = '14px';
    block.innerHTML = `
      <div style="color:var(--teal);font-size:0.82rem;margin-bottom:4px"><b>${escapeHtml(a.from)}</b>${a.group && a.group !== a.from ? ` · ${escapeHtml(a.group)}` : ''}</div>
      <div style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:6px">Q: ${escapeHtml(a.question)}</div>
      <div class="chat-a" style="margin-top:4px" data-ans="${i}"></div>
    `;
    container.appendChild(block);
    const ansEl = block.querySelector('[data-ans]');
    typewriter(ansEl, a.answer, 18);
    speak(a.answer);
    stage.scrollTop = stage.scrollHeight;
    // schedule next after current finishes roughly
    setTimeout(next, Math.max(1200, a.answer.length * 22));
  };
  next();
});
