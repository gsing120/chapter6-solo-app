/* ═══════════════════════════════════════════════════════════
   Student — mobile view logic
   ═══════════════════════════════════════════════════════════ */

const socket = io({ query: { role: 'student' }, reconnection: true });
const $ = (id) => document.getElementById(id);

const joinScreen = $('joinScreen');
const stage = $('sStage');
const sHeader = $('sHeader');
const whoName = $('whoName');
const whoGroup = $('whoGroup');

const nameInput = $('nameInput');
const groupInput = $('groupInput');
const btnJoin = $('btnJoin');

/* ─── clientId persistence (fixes reconnect / phantom disconnect) ── */
function getClientId() {
  let cid = localStorage.getItem('nur3035_cid');
  if (!cid) {
    cid = 'cid_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
    localStorage.setItem('nur3035_cid', cid);
  }
  return cid;
}

const storedName = localStorage.getItem('nur3035_name') || '';
const storedGroup = localStorage.getItem('nur3035_group') || '';
nameInput.value = storedName;
groupInput.value = storedGroup;

let me = { clientId: null, name: null, group: null };
let currentState = null;
let timer = { label: null, seconds: 0, total: 0 };
let myScores = { ct: 0, mvf: 0, pyramid: 0, total: 0 };

/* ─── Re-join helper (fires on reconnect too) ─────────────────── */
function tryRejoin() {
  const name = localStorage.getItem('nur3035_name');
  const group = localStorage.getItem('nur3035_group');
  if (!name) return;
  socket.emit('student:join', {
    clientId: getClientId(),
    name,
    group: group || name,
  });
}

socket.on('connect', () => {
  if (me.name) tryRejoin();
});

btnJoin.onclick = () => {
  const name = nameInput.value.trim();
  const group = groupInput.value.trim() || name;
  if (name.length < 2) {
    nameInput.focus();
    return;
  }
  localStorage.setItem('nur3035_name', name);
  localStorage.setItem('nur3035_group', group);
  socket.emit('student:join', {
    clientId: getClientId(),
    name,
    group,
  });
};

socket.on('student:joined', ({ clientId, name, group }) => {
  me = { clientId, name, group };
  whoName.textContent = name;
  whoGroup.textContent = group;
  joinScreen.classList.add('hidden');
  sHeader.classList.remove('hidden');
  stage.classList.remove('hidden');
  $('askFab').classList.remove('hidden');
  render();
});

/* ─── Ask Artificial Nurse (student) ──────────────────────── */
const askFab = $('askFab');
const askModal = $('askModal');
const askInput = $('askInput');
const askSend = $('askSend');
const askCancel = $('askCancel');

askFab.onclick = () => {
  askModal.classList.remove('hidden');
  setTimeout(() => askInput.focus(), 100);
};
askCancel.onclick = () => {
  askModal.classList.add('hidden');
  askInput.value = '';
};
askSend.onclick = () => {
  const q = askInput.value.trim();
  if (q.length < 3) return;
  socket.emit('student:ask', { question: q });
  askInput.value = '';
  askModal.classList.add('hidden');
};

/* ─── Chat queue (visible to student) ─────────────────────── */
let myLastPendingQ = null;
socket.on('student:ask-ack', ({ id }) => {
  myLastPendingQ = id;
  const toast = document.createElement('div');
  toast.className = 's-ack';
  toast.textContent = '✓ Your question is in the queue';
  toast.style.position = 'fixed';
  toast.style.bottom = '90px';
  toast.style.right = '16px';
  toast.style.zIndex = '80';
  toast.style.background = 'var(--bg-surface)';
  toast.style.padding = '10px 16px';
  toast.style.borderRadius = '999px';
  toast.style.border = '1px solid var(--green)';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
});

socket.on('chat:queue', ({ queue }) => {
  renderStudentQueue(queue || []);
});

function renderStudentQueue(queue) {
  // Remove old queue block
  const old = document.getElementById('studentQueueBlock');
  if (old) old.remove();
  if (!queue || queue.length === 0) return;
  const pending = queue.filter((q) => q.status !== 'answered');
  const answered = queue.filter((q) => q.status === 'answered').slice(-4);
  if (pending.length === 0 && answered.length === 0) return;

  const block = document.createElement('div');
  block.id = 'studentQueueBlock';
  block.className = 's-card glass';
  block.style.marginTop = '12px';
  block.innerHTML = `
    <span class="seg-badge seg-1">Class Q&A queue · ${pending.length} pending</span>
    ${pending
      .map(
        (q) => `
      <div class="q-card">
        <div class="q-meta">${escapeHtml(q.from)}${q.status === 'answering' ? ' · answering…' : ''}</div>
        ${escapeHtml(q.question)}
      </div>
    `
      )
      .join('')}
    ${
      answered.length > 0
        ? `<p class="hint" style="margin:10px 0 6px">Recent answers</p>` +
          answered
            .map(
              (q) => `
      <div class="q-card answered">
        <div class="q-meta">To ${escapeHtml(q.from)}</div>
        ${escapeHtml(q.question)}
        <div class="q-ans">${escapeHtml(q.answer || '')}</div>
      </div>
    `
            )
            .join('')
        : ''
    }
  `;
  stage.appendChild(block);
}

socket.on('student:score', ({ scores }) => {
  myScores = scores;
  const badge = document.getElementById('scoreBadge');
  if (badge) badge.textContent = `${scores.total || 0} pts`;
});

socket.on('state:update', (s) => {
  currentState = s;
  if (me.name) render();
});

socket.on('timer:tick', ({ label, seconds, total }) => {
  timer = { label, seconds, total };
  const el = document.getElementById('sTimerValue');
  if (el) el.textContent = fmtTime(Math.max(0, seconds));
});
socket.on('timer:start', ({ label, seconds, total }) => {
  timer = { label, seconds, total };
  const el = document.getElementById('sTimerValue');
  if (el) el.textContent = fmtTime(Math.max(0, seconds));
});
socket.on('timer:done', () => {
  const el = document.getElementById('sTimerValue');
  if (el) el.textContent = '0:00';
});

/* ─── Main render dispatch ─────────────────────────────────── */
function render() {
  if (!currentState || !me.name) return;
  const s = currentState;
  if (s.phase === 'LOBBY') return renderLobby();
  if (s.phase === 'CRITICAL_THINKING') return renderCT(s);
  if (s.phase === 'MYTH_VS_FACT') return renderMVF(s);
  if (s.phase === 'PRIORITY_PYRAMID') return renderPyramid(s);
  if (s.phase === 'COMPLETE') return renderComplete();
}

function renderLobby() {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Lobby</span>
      <h2>You're in!</h2>
      <p class="hint">Waiting for your instructor to start. This will auto-update when it begins.</p>
      <div class="s-waiting">
        <div class="pulse-dot"></div>
        <h3>Ready when class is</h3>
      </div>
    </div>
  `;
}

/* ─── CT ───────────────────────────────────────────────────── */
let cachedScenario = '';
let ctCurrent = null;
let ctSubmittedIds = new Set();

socket.on('ct:scenario', ({ scenario }) => {
  ctCurrent = null;
  cachedScenario = scenario || cachedScenario;
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Phase 1 · Critical Thinking</span>
      <h2>Scenario · Margaret</h2>
      <div class="scenario-readonly">${escapeHtml(cachedScenario)}</div>
      <div class="hint">Your instructor is reading this aloud. Guiding questions will appear next.</div>
      ${renderTimerPill()}
    </div>
  `;
});

socket.on('ct:question', ({ id, text, index }) => {
  ctCurrent = { id, text, index };
  const already = ctSubmittedIds.has(id);
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Guiding Q${index + 1} of 3</span>
      <details class="scenario-readonly" style="font-size:0.78rem;color:var(--text-dim)">
        <summary style="cursor:pointer;color:var(--teal)">View scenario</summary>
        <div style="margin-top:8px">${escapeHtml(cachedScenario)}</div>
      </details>
      <h2>${escapeHtml(text)}</h2>
      ${renderTimerPill()}
      ${
        already
          ? `<div class="s-ack">✓ Submitted — waiting for next question…</div>`
          : `
        <textarea id="ctAnswer" placeholder="Type your answer…" maxlength="500"></textarea>
        <button id="btnCTSend" class="btn btn-block">Send answer</button>
      `
      }
    </div>
  `;
  const ta = $('ctAnswer');
  if (ta) ta.focus();
  const btn = $('btnCTSend');
  if (btn) {
    btn.onclick = () => {
      const val = $('ctAnswer').value.trim();
      if (val.length < 30) {
        alert('Write at least a couple of sentences (30+ characters). One-word answers will not be graded.');
        return;
      }
      socket.emit('student:ct-answer', { questionId: id, answer: val });
      btn.disabled = true;
      btn.textContent = 'Sending…';
    };
  }
});

socket.on('student:ct-ack', ({ questionId }) => {
  ctSubmittedIds.add(questionId);
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Submitted</span>
      <div class="s-ack">✓ Submitted — graded by AI after all 3 questions</div>
      <div class="s-waiting"><div class="pulse-dot"></div><h3>Waiting for next question…</h3></div>
      ${renderTimerPill()}
    </div>
  `;
});

socket.on('ct:processing', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Phase 1</span>
      <div class="s-waiting"><div class="pulse-dot"></div><h3>AI is reviewing the class's answers…</h3></div>
    </div>
  `;
});

socket.on('ct:summary', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-1">Class Summary</span>
      <h2>Look at the front screen</h2>
      <p class="hint">The AI summary is being revealed up front. Your instructor will debrief next.</p>
    </div>
  `;
});

function renderCT(s) {
  if (!stage.innerHTML.trim()) {
    stage.innerHTML = `<div class="s-card glass"><span class="seg-badge seg-1">Phase 1</span><div class="s-waiting"><div class="pulse-dot"></div><h3>Joining…</h3></div></div>`;
  }
}

/* ─── MVF ──────────────────────────────────────────────────── */
let mvfCurrent = null;
let mvfVote = null;

socket.on('mvf:statement', ({ id, text, index, total }) => {
  mvfCurrent = { id, text, index, total };
  mvfVote = null;
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-2">Myth vs Fact · ${index + 1}/${total}</span>
      <h2>${escapeHtml(text)}</h2>
      ${renderTimerPill()}
      <div class="mvf-buttons">
        <button class="mvf-btn myth" id="btnMyth">MYTH</button>
        <button class="mvf-btn fact" id="btnFact">FACT</button>
      </div>
      <div class="hint">Tap your answer. You can't change it once submitted.</div>
    </div>
  `;
  $('btnMyth').onclick = () => castMVF('MYTH');
  $('btnFact').onclick = () => castMVF('FACT');
});

function castMVF(vote) {
  if (!mvfCurrent || mvfVote) return;
  mvfVote = vote;
  socket.emit('student:mvf-vote', { statementId: mvfCurrent.id, vote });
  const btn = vote === 'MYTH' ? $('btnMyth') : $('btnFact');
  const other = vote === 'MYTH' ? $('btnFact') : $('btnMyth');
  if (btn) btn.classList.add('selected');
  if (other) other.disabled = true;
  if (btn) btn.disabled = true;
}

socket.on('mvf:reveal', ({ id, correct, pctMyth, pctFact }) => {
  if (!mvfCurrent || mvfCurrent.id !== id) return;
  const theyGotIt = mvfVote && mvfVote === correct;
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-2">Reveal · ${mvfCurrent.index + 1}/${mvfCurrent.total}</span>
      <h2>${escapeHtml(mvfCurrent.text)}</h2>
      <div class="mvf-result ${theyGotIt ? 'correct' : 'wrong'}">
        ${theyGotIt ? '✓ You got it! +10 pts' : mvfVote ? '✗ Not quite' : '— You did not vote'}<br>
        <span style="font-size:0.9rem;font-weight:600">Correct: ${correct}</span>
      </div>
      <div class="hint" style="text-align:center">
        Class split: <b style="color:var(--teal)">MYTH ${pctMyth}%</b> · <b style="color:var(--magenta)">FACT ${pctFact}%</b>
      </div>
      <div class="hint">Watch the front screen for the reaction.</div>
    </div>
  `;
});

socket.on('mvf:processing', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-2">Wrapping up</span>
      <div class="s-waiting"><div class="pulse-dot"></div><h3>Final summary coming up…</h3></div>
    </div>
  `;
});

socket.on('mvf:final', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-2">Round summary</span>
      <h2>Look at the front screen</h2>
      <p class="hint">Your instructor is reviewing the full round.</p>
    </div>
  `;
});

function renderMVF(s) {
  if (!stage.innerHTML.trim()) {
    stage.innerHTML = `<div class="s-card glass"><span class="seg-badge seg-2">Phase 2</span><div class="s-waiting"><div class="pulse-dot"></div><h3>Loading…</h3></div></div>`;
  }
}

/* ─── PYRAMID (split into 5+5) ───────────────────────────── */
let pyramidInterventions = [];
let pyramidRanks = {};
let pyramidSubmitted = false;
let pyramidHalf = 'A';
let pyramidPartCount = 1;
let pyramidPartTotal = 2;
const PYRAMID_SIZE = 5;

socket.on('pyramid:setup', ({ interventions, half, currentPart, totalParts }) => {
  pyramidInterventions = interventions;
  pyramidRanks = {};
  pyramidSubmitted = false;
  pyramidHalf = half || 'A';
  pyramidPartCount = currentPart || 1;
  pyramidPartTotal = totalParts || 2;
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Phase 3 · Part ${pyramidPartCount} of ${pyramidPartTotal}</span>
      <h2>Rank these 5 interventions</h2>
      <p class="hint">When sort starts, each card you tap goes into the next slot (#1, then #2, …). Tap a placed card to un-rank. Five items in this part — pick the priority order.</p>
      ${renderTimerPill()}
    </div>
  `;
});

socket.on('pyramid:sort', ({ half }) => {
  pyramidRanks = {};
  pyramidSubmitted = false;
  pyramidHalf = half || pyramidHalf;
  renderPyramidSort();
});

function renderPyramidSort() {
  if (pyramidSubmitted) {
    stage.innerHTML = `
      <div class="s-card glass">
        <span class="seg-badge seg-3">Part ${pyramidPartCount} submitted</span>
        <div class="s-ack">✓ Your ranking is in!${pyramidPartCount < pyramidPartTotal ? ' Part 2 coming up.' : ''}</div>
        <p class="hint">Watch the front screen — class results next.</p>
        ${renderTimerPill()}
      </div>
    `;
    return;
  }

  const ranksFilled = Object.keys(pyramidRanks).length;
  const byRank = {};
  Object.entries(pyramidRanks).forEach(([id, rank]) => { byRank[rank] = parseInt(id, 10); });
  const unranked = pyramidInterventions.filter((iv) => pyramidRanks[iv.id] === undefined);

  // 5-item pyramid: 1, 2-3, 4-5
  const tierRanks = [[1], [2, 3], [4, 5]];

  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Part ${pyramidPartCount}/${pyramidPartTotal} · ${ranksFilled}/${PYRAMID_SIZE} placed</span>
      <h2 style="font-size:1.05rem">Tap to place · tap a placed card to un-rank</h2>
      ${renderTimerPill()}

      <div class="pyramid-visual">
        ${tierRanks
          .map(
            (tier, ti) => `
          <div class="pyr-tier-label">${ti === 0 ? '#1 · TOP PRIORITY' : ti === 2 ? '#4–5 · lowest in this part' : `#${tier[0]}–${tier[tier.length - 1]}`}</div>
          <div class="pyr-tier">
            ${tier
              .map((rank) => {
                const id = byRank[rank];
                const iv = id ? pyramidInterventions.find((x) => x.id === id) : null;
                return iv
                  ? `<div class="pyr-cell filled" data-unrank="${iv.id}">${rank}. ${escapeHtml(iv.text.slice(0, 22))}${iv.text.length > 22 ? '…' : ''}</div>`
                  : `<div class="pyr-cell">${rank}</div>`;
              })
              .join('')}
          </div>
        `
          )
          .join('')}
      </div>

      <div class="unranked-list" style="margin-top:16px">
        ${
          unranked.length === 0
            ? `<div class="s-ack">All ${PYRAMID_SIZE} placed — ready to submit!</div>`
            : unranked
                .map(
                  (iv) => `
          <div class="unranked-card" data-rank="${iv.id}">${escapeHtml(iv.text)}</div>`
                )
                .join('')
        }
      </div>

      <button id="btnPyramidSubmit" class="btn btn-gold btn-block btn-xl" ${unranked.length > 0 ? 'disabled' : ''} style="margin-top:14px">
        Submit Part ${pyramidPartCount}
      </button>
    </div>
  `;

  document.querySelectorAll('[data-rank]').forEach((el) => {
    el.onclick = () => placeCard(parseInt(el.dataset.rank, 10));
  });
  document.querySelectorAll('[data-unrank]').forEach((el) => {
    el.onclick = () => unrankCard(parseInt(el.dataset.unrank, 10));
  });

  const submitBtn = $('btnPyramidSubmit');
  if (submitBtn) submitBtn.onclick = submitPyramid;
}

function placeCard(id) {
  const used = new Set(Object.values(pyramidRanks));
  for (let r = 1; r <= PYRAMID_SIZE; r++) {
    if (!used.has(r)) {
      pyramidRanks[id] = r;
      break;
    }
  }
  renderPyramidSort();
}

function unrankCard(id) {
  delete pyramidRanks[id];
  const entries = Object.entries(pyramidRanks)
    .map(([k, v]) => [parseInt(k, 10), v])
    .sort((a, b) => a[1] - b[1]);
  pyramidRanks = {};
  entries.forEach(([id2], i) => { pyramidRanks[id2] = i + 1; });
  renderPyramidSort();
}

function submitPyramid() {
  const ranking = Object.entries(pyramidRanks).map(([id, rank]) => ({
    id: parseInt(id, 10),
    rank,
  }));
  if (ranking.length !== PYRAMID_SIZE) return;
  socket.emit('student:pyramid-submit', { half: pyramidHalf, ranking });
}

socket.on('student:pyramid-ack', () => {
  pyramidSubmitted = true;
  renderPyramidSort();
});

socket.on('pyramid:display', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Results</span>
      <h2>All pyramids are up</h2>
      <p class="hint">Look at the front screen.</p>
    </div>
  `;
});

socket.on('pyramid:processing', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Analyzing</span>
      <div class="s-waiting"><div class="pulse-dot"></div><h3>AI is analyzing patterns…</h3></div>
    </div>
  `;
});

socket.on('pyramid:analysis', () => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Analysis</span>
      <h2>Check the front screen</h2>
      <p class="hint">Emancipatory-lens analysis incoming.</p>
    </div>
  `;
});

function renderPyramid(s) {
  if (s.subPhase === 'pyramid_sort_a' || s.subPhase === 'pyramid_sort_b') {
    renderPyramidSort();
  }
}

/* ─── SCOREBOARD (student view) ─────────────────────────── */
socket.on('scoreboard', ({ phaseLabel, top, praise }) => {
  const myRank = top.findIndex((t) => t.name === me.name) + 1;
  const topRow = top
    .slice(0, 5)
    .map(
      (t, i) =>
        `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--glass-border)"><span><b style="color:${['#ffd93d','#cbd5e1','#c57b57','#94a3b8','#94a3b8'][i] || '#94a3b8'}">#${i + 1}</b> ${escapeHtml(t.name)}</span><span style="color:var(--teal)">+${t.phaseScore}</span></div>`
    )
    .join('');
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3">Scoreboard</span>
      <h2>${escapeHtml(phaseLabel)}</h2>
      ${myRank ? `<div class="s-ack">You're #${myRank} · ${myScores.total} total pts</div>` : `<p class="hint">No points this round.</p>`}
      <div style="margin-top:6px">${topRow || ''}</div>
      <p class="hint" style="margin-top:8px">Look at the front screen for the shoutouts.</p>
    </div>
  `;
});

/* ─── JOKE ───────────────────────────────────────────── */
socket.on('joke', ({ joke }) => {
  stage.innerHTML = `
    <div class="s-card glass">
      <span class="seg-badge seg-3" style="color:var(--gold);border-color:var(--gold)">Quick joke</span>
      <h2 style="font-size:1.15rem">${escapeHtml(joke)}</h2>
      <p class="hint">Next phase starting…</p>
    </div>
  `;
});

/* ─── CHAT (student sees Q&A on their phone too) ───────── */
socket.on('chat:processing', ({ question }) => {
  // We don't replace the main stage — just append a small card if room
  const notice = document.createElement('div');
  notice.className = 's-card glass';
  notice.style.marginTop = '12px';
  notice.innerHTML = `<span class="seg-badge seg-1">Q&A</span><p class="hint"><b>Q:</b> ${escapeHtml(question)}</p><div class="s-waiting" style="padding:12px"><div class="pulse-dot"></div></div>`;
  stage.appendChild(notice);
  window.scrollTo(0, document.body.scrollHeight);
});

socket.on('chat:answer', ({ question, answer }) => {
  const notice = document.createElement('div');
  notice.className = 's-card glass';
  notice.style.marginTop = '12px';
  notice.innerHTML = `
    <span class="seg-badge seg-1">Q&A answer</span>
    <p class="hint"><b>Q:</b> ${escapeHtml(question)}</p>
    <p>${escapeHtml(answer)}</p>
  `;
  stage.appendChild(notice);
  window.scrollTo(0, document.body.scrollHeight);
});

/* ─── COMPLETE ─────────────────────────────────────────── */
function renderComplete() {
  stage.innerHTML = `
    <div class="s-card glass" style="text-align:center;padding:40px 20px">
      <h1 class="hero-title" style="font-size:2.2rem;margin-bottom:12px">Thank You!</h1>
      <div class="s-ack">Your final: ${myScores.total} pts</div>
      <p class="hint" style="line-height:1.6">
        Holistic care means every system matters — including the ones we're uncomfortable talking about. That's emancipatory nursing.
      </p>
    </div>
  `;
}

/* ─── Utils ────────────────────────────────────────────── */
function renderTimerPill() {
  return `
    <div class="s-timer">
      <span class="t-label">Time</span>
      <span class="t-value" id="sTimerValue">${fmtTime(Math.max(0, timer.seconds))}</span>
      <span style="margin-left:auto;color:var(--teal);font-weight:700" id="scoreBadge">${myScores.total || 0} pts</span>
    </div>
  `;
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[m]);
}
