require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');
const { PHASE1, PHASE2, PHASE3 } = require('./data/content');

const app = express();
// Trust the cloud reverse proxy (Render, Heroku, Fly, etc.) so req.protocol
// reflects https when the original client used https.
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check for cloud uptime probes
app.get('/healthz', (req, res) => res.json({ ok: true, phase: state?.phase || 'startup' }));

/* ─── Gemini 3 Flash (text) + Gemini 2.5 Flash TTS (voice) ──── */
const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Available voices, presenter-changeable at runtime via dropdown
const VOICES = {
  male: [
    { id: 'Algieba', label: 'Algieba — smooth' },
    { id: 'Enceladus', label: 'Enceladus — breathy' },
    { id: 'Algenib', label: 'Algenib — gravelly / deep' },
    { id: 'Umbriel', label: 'Umbriel — easy-going' },
    { id: 'Charon', label: 'Charon — informative' },
    { id: 'Iapetus', label: 'Iapetus — clear' },
    { id: 'Achird', label: 'Achird — friendly' },
    { id: 'Schedar', label: 'Schedar — even' },
    { id: 'Sadaltager', label: 'Sadaltager — knowledgeable' },
    { id: 'Orus', label: 'Orus — firm' },
    { id: 'Alnilam', label: 'Alnilam — firm' },
    { id: 'Fenrir', label: 'Fenrir — excitable' },
    { id: 'Puck', label: 'Puck — upbeat' },
    { id: 'Rasalgethi', label: 'Rasalgethi — informative' },
    { id: 'Sadachbia', label: 'Sadachbia — lively' },
    { id: 'Zubenelgenubi', label: 'Zubenelgenubi — casual' },
  ],
  female: [
    { id: 'Kore', label: 'Kore — firm' },
    { id: 'Zephyr', label: 'Zephyr — bright' },
    { id: 'Leda', label: 'Leda — youthful' },
    { id: 'Aoede', label: 'Aoede — breezy' },
    { id: 'Callirrhoe', label: 'Callirrhoe — easy-going' },
    { id: 'Autonoe', label: 'Autonoe — bright' },
    { id: 'Despina', label: 'Despina — smooth' },
    { id: 'Erinome', label: 'Erinome — clear' },
    { id: 'Laomedeia', label: 'Laomedeia — upbeat' },
    { id: 'Achernar', label: 'Achernar — soft' },
    { id: 'Gacrux', label: 'Gacrux — mature' },
    { id: 'Pulcherrima', label: 'Pulcherrima — forward' },
    { id: 'Vindemiatrix', label: 'Vindemiatrix — gentle' },
    { id: 'Sulafat', label: 'Sulafat — warm' },
  ],
};
const ALL_VOICE_IDS = new Set(
  [...VOICES.male, ...VOICES.female].map((v) => v.id)
);
let currentVoice = process.env.GEMINI_TTS_VOICE || 'Algieba';
if (!ALL_VOICE_IDS.has(currentVoice)) currentVoice = 'Algieba';

/* PCM → WAV wrapper (Gemini TTS returns L16 PCM @ 24kHz, we add RIFF header) */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function generateTTS(text, voiceOverride) {
  if (!ai) return null;
  const clean = String(text || '').trim();
  if (!clean) return null;
  const voice = voiceOverride || currentVoice;
  try {
    const result = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: clean,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });
    const part = result?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData;
    if (!inline?.data) return null;
    // parse sample rate from mime: e.g. "audio/L16;codec=pcm;rate=24000"
    const rateMatch = /rate=(\d+)/.exec(inline.mimeType || '');
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const pcm = Buffer.from(inline.data, 'base64');
    const wav = pcmToWav(pcm, sampleRate, 1, 16);
    return { base64: wav.toString('base64'), mime: 'audio/wav' };
  } catch (err) {
    console.warn('[tts]', err.message);
    return null;
  }
}

let audioSeq = 0;
// Epoch increments every time we clear audio — any in-flight speakNarration
// captures the epoch at start and aborts if it changes (i.e., a new phase
// has begun and the old narration is stale).
let narrationEpoch = 0;

// Split into rough sentences for faster first-audio.
// Keeps short fragments together; merges <40-char tail into previous chunk.
function splitForTTS(text) {
  if (!text) return [];
  const raw = text.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$/g) || [text];
  const out = [];
  for (const part of raw) {
    const t = part.trim();
    if (!t) continue;
    if (out.length && (t.length < 40 || out[out.length - 1].length < 40)) {
      out[out.length - 1] = `${out[out.length - 1]} ${t}`.trim();
    } else {
      out.push(t);
    }
  }
  return out;
}

async function speakNarration(text, label = 'narration') {
  if (!ai) return;
  const chunks = splitForTTS(text);
  if (chunks.length === 0) return;
  const myEpoch = narrationEpoch;
  const promises = chunks.map((c) => generateTTS(c));
  for (const p of promises) {
    try {
      const audio = await p;
      if (narrationEpoch !== myEpoch) return;
      if (audio) {
        io.emit('audio:play', {
          id: ++audioSeq,
          label,
          audioBase64: audio.base64,
          mime: audio.mime,
        });
      }
    } catch (e) {
      console.warn('[tts] chunk failed:', e.message);
    }
  }
}

// "Synced" narration: don't emit the text until the FIRST TTS chunk is
// ready, so the typewriter and audio start at the same instant. Caller
// pre-emits a "processing" indicator so the user sees a smart spinner
// while the first chunk is generating.
async function speakAndShowSynced(text, emitTextFn, label = 'narration') {
  const chunks = splitForTTS(text);
  if (chunks.length === 0) {
    emitTextFn();
    return;
  }
  if (!ai) {
    emitTextFn();
    return;
  }
  const myEpoch = narrationEpoch;
  // Kick all TTS calls off in parallel
  const promises = chunks.map((c) => generateTTS(c));
  let textEmitted = false;
  // Safety: if first audio doesn't arrive in 6s, reveal text anyway
  const safetyTimer = setTimeout(() => {
    if (!textEmitted && narrationEpoch === myEpoch) {
      textEmitted = true;
      emitTextFn();
    }
  }, 6000);

  for (let i = 0; i < promises.length; i++) {
    try {
      const audio = await promises[i];
      if (narrationEpoch !== myEpoch) {
        clearTimeout(safetyTimer);
        return;
      }
      // First chunk: fire text reveal at the SAME moment we emit audio,
      // so the typewriter starts in lockstep with the voice.
      if (i === 0 && !textEmitted) {
        textEmitted = true;
        clearTimeout(safetyTimer);
        emitTextFn();
      }
      if (audio) {
        io.emit('audio:play', {
          id: ++audioSeq,
          label,
          audioBase64: audio.base64,
          mime: audio.mime,
        });
      }
    } catch (e) {
      console.warn('[tts] chunk failed:', e.message);
    }
  }
  if (!textEmitted) {
    clearTimeout(safetyTimer);
    emitTextFn();
  }
}

function clearAudio() {
  narrationEpoch++; // invalidate any in-flight speakNarration so its
                    // remaining chunks don't bleed into the next phase.
  io.emit('audio:clear', {});
  audioFinishedSeen = false;
}

/* ─── Narration wait: advance on click OR audio-end + grace ───── */
let audioFinishedSeen = false;
let narrationWait = null; // { onAdvance, advanced, graceMs, hardTimeout }

function startNarrationWait(onAdvance, { hardCapMs = 600000 } = {}) {
  cancelNarrationWait();
  audioFinishedSeen = false;
  const w = {
    onAdvance,
    advanced: false,
    // Hard cap is an emergency safety only (10 min default). It does NOT
    // function as auto-skip — the presenter is expected to click Next when
    // the room is ready to move on.
    hardTimeout: setTimeout(() => advanceNarration('hard-timeout'), hardCapMs),
  };
  narrationWait = w;
  io.emit('narration:waiting', {});
}

function cancelNarrationWait() {
  if (narrationWait) {
    if (narrationWait.hardTimeout) clearTimeout(narrationWait.hardTimeout);
    narrationWait = null;
  }
}

function advanceNarration(reason) {
  if (!narrationWait || narrationWait.advanced) return;
  narrationWait.advanced = true;
  if (narrationWait.hardTimeout) clearTimeout(narrationWait.hardTimeout);
  const fn = narrationWait.onAdvance;
  narrationWait = null;
  io.emit('narration:advanced', { reason });
  console.log(`[narration] advance: ${reason}`);
  if (fn) fn();
}

function onAudioFinished() {
  // Audio playback queue ran dry. We do NOT auto-advance — the presenter
  // must click Next. We just signal the client so the Next button can show
  // an "audio done" visual cue (the existing waiting-pulse already handles
  // this since narration:waiting fired at the start).
  audioFinishedSeen = true;
  io.emit('narration:audio-done', {});
}

const CHAPTER_6_CONTEXT = `
CHAPTER 6 CONTEXT — Complex Care of Older Adults (key concepts):

SKIN: With aging the epidermis thins, collagen production decreases, cell renewal slows, subcutaneous fat is lost → thin, fragile skin that bruises easily, pressure injury risk, slower wound healing. Skin sensitivity DECREASES, so injuries go unnoticed. Sun damage accumulates. Interventions: skin-integrity assessment, pressure injury prevention, sun protection, hydration, gentle cleansers.

CIRCULATION: Blood vessels lose elasticity (arteriosclerosis), peripheral resistance rises, BP tends up, cardiac output decreases, capillary density drops → reduced tissue perfusion, orthostatic hypotension. Interventions: cardiovascular exercise, BP monitoring, fall risk assessment, medication review.

RESPIRATION: Cough and laryngeal reflexes become blunted (aspiration risk), chest wall stiffens (costal cartilage calcifies), respiratory muscles weaken, vital capacity decreases. Interventions: vaccination (flu, pneumococcal), smoking cessation, positioning, swallowing assessment.

THERMOREGULATION: Older adults feel temperature changes less (dulled thermal sensitivity), have reduced vasoconstriction, less subcutaneous fat, slower shivering response. They often don't mount full fevers — a 1°C rise above THEIR baseline can signal serious infection. Normal oral temp for older adults tends ~36.1–36.3°C. Hypothermia risk is both INTRINSIC (body changes) and EXTRINSIC (housing, income, social). Interventions: establish baseline temp over several days, educate on hypothermia signs, connect to heating/cooling assistance programs, adequate clothing/nutrition.

SEX & INTIMACY: Sexual health and desire persist across the lifespan — they do NOT disappear after any age. Ageism causes providers to skip sexual health assessments in older adults — this is negligence, not professionalism. STI rates ARE rising in older adults (no STI checks birth certificates). ED is often TREATABLE — medications, circulation, chronic illness — not just "aging." Menopause is a transition, not termination of sexual health. Nurses must proactively open the door, using emancipatory communication: ask, don't assume; collaborate WITH not dictate TO.

EMANCIPATORY NURSING: autonomy, dignity, social determinants of health, challenging ageist assumptions, collaborating with the patient and family, addressing systemic/structural causes (income, housing, access). Holistic care means ALL systems matter — including the ones we're uncomfortable with.

SOCIAL ISOLATION: affects cardiovascular, immune, cognitive, AND sexual health. It is a nursing concern, not just a social one.
`;

async function callGemini(prompt, fallbackText, timeoutMs = 14000) {
  if (!ai) return fallbackText;
  try {
    const resultPromise = ai.models.generateContent({
      model: MODEL,
      contents: `${CHAPTER_6_CONTEXT}\n\n${prompt}`,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('gemini-timeout')), timeoutMs)
    );
    const result = await Promise.race([resultPromise, timeoutPromise]);
    const text = result?.text || result?.response?.text?.() || '';
    if (!text.trim()) return fallbackText;
    return text.trim();
  } catch (err) {
    console.warn(`[gemini] ${MODEL} failed: ${err.message} — fallback`);
    return fallbackText;
  }
}

/* ─── Timers (seconds) ──────────────────────────────────────── */
// Gameplay timers (real countdowns).
// AI narration / scoreboard / joke phases use narrationWait instead.
const TIMERS = {
  ct_scenario: 120,
  ct_q1: 120,
  ct_q2: 120,
  ct_q3: 120,

  mvf_vote: 20,

  pyramid_setup: 60,
  pyramid_sort: 240,
  pyramid_display: 60,
};

/* ─── "Emancipatory ideal" pyramid ranking ─────────────────── */
// Mr. M initial-encounter priorities (textbook Activity 3).
// Items 1-5 = relational/contextual (Part A); 6-10 = clinical/structural (Part B).
// Within Part A, "his goals" / "his own words" / "values" rank highest —
// they're what the chapter calls "knowing the whole person."
const IDEAL_RANKING = { 1: 1, 3: 2, 2: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 };

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  phase: 'LOBBY',
  subPhase: null,

  // clientId → { name, group, socketId|null, scores: {ct, mvf, pyramid, total}, mvfAnswers, pyramidRanking }
  students: {},
  socketToClient: {},

  ct: {
    answers: Object.fromEntries(PHASE1.questions.map((q) => [q.id, []])),
    submittedBy: Object.fromEntries(PHASE1.questions.map((q) => [q.id, new Set()])), // clientIds
    aiSummary: null,
  },

  mvf: {
    currentIndex: 0,
    votes: {},
    votedBy: {}, // statementId → Set(clientId)
    reveals: {},
    finalSummary: null,
  },

  pyramid: {
    submissions: {}, // clientId → ranking[]
    analysis: null,
  },

  history: [],     // breadcrumb stack for back navigation
  pendingAdvance: null, // { label, fn } — set when a gameplay timer hits 0
  chatHistory: [], // { q, a, ts }
  chatQueue: [],   // pending student questions: { id, from, group, question, ts }

  timer: {
    label: null,
    seconds: 0,
    total: 0,
    interval: null,
    paused: false,
  },
};

/* ─── Helpers ───────────────────────────────────────────────── */
const activeStudents = () =>
  Object.entries(state.students).filter(([, s]) => s.socketId);

function studentCount() {
  return activeStudents().length;
}

function groupsSnapshot() {
  const g = {};
  for (const [, s] of activeStudents()) {
    if (!g[s.group]) g[s.group] = [];
    if (!g[s.group].includes(s.name)) g[s.group].push(s.name);
  }
  return g;
}

function publicState() {
  return {
    phase: state.phase,
    subPhase: state.subPhase,
    studentCount: studentCount(),
    groups: groupsSnapshot(),
    timer: {
      label: state.timer.label,
      seconds: state.timer.seconds,
      total: state.timer.total,
      paused: state.timer.paused,
    },
    mvf: {
      currentIndex: state.mvf.currentIndex,
      totalStatements: PHASE2.statements.length,
    },
    sessionStartedAt: state.sessionStartedAt || null,
    sessionBudgetMs: 30 * 60 * 1000,
  };
}

function broadcastState() {
  io.emit('state:update', publicState());
}

function resetSessionState() {
  stopTimer();
  cancelNarrationWait();
  state.pendingAdvance = null;
  state.phase = 'LOBBY';
  state.subPhase = null;
  state.history = [];
  state.ct = {
    answers: Object.fromEntries(PHASE1.questions.map((q) => [q.id, []])),
    submittedBy: Object.fromEntries(PHASE1.questions.map((q) => [q.id, new Set()])),
    aiSummary: null,
  };
  state.mvf = {
    currentIndex: 0,
    votes: {},
    votedBy: {},
    reveals: {},
    finalSummary: null,
  };
  state.pyramid = {
    submissionsA: {},
    submissionsB: {},
    submissions: {}, // legacy combined view used by the AI prompt
    analysis: null,
  };
  state.chatHistory = [];
  state.chatQueue = [];
  state.sessionStartedAt = null;
  for (const s of Object.values(state.students)) {
    s.scores = { ct: 0, mvf: 0, pyramid: 0, total: 0 };
    s.mvfAnswers = {};
    s.pyramidRanking = null;
    s.pyramidA = null;
    s.pyramidB = null;
  }
  clearAudio();
  broadcastState();
}

function startTimer(label, seconds, onDone) {
  stopTimer();
  state.timer.label = label;
  state.timer.seconds = seconds;
  state.timer.total = seconds;
  state.timer.paused = false;
  io.emit('timer:start', { label, seconds, total: seconds });

  state.timer.interval = setInterval(() => {
    if (state.timer.paused) return;
    state.timer.seconds--;
    io.emit('timer:tick', {
      label,
      seconds: state.timer.seconds,
      total: state.timer.total,
    });
    if (state.timer.seconds <= 0) {
      stopTimer();
      io.emit('timer:done', { label });
      if (onDone) onDone();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timer.interval) clearInterval(state.timer.interval);
  state.timer.interval = null;
}

function addTime(seconds) {
  if (!state.timer.interval) return;
  state.timer.seconds += seconds;
  state.timer.total += seconds;
  io.emit('timer:tick', {
    label: state.timer.label,
    seconds: state.timer.seconds,
    total: state.timer.total,
  });
}

/* ─── Scoring ───────────────────────────────────────────────── */
function updateStudentTotals() {
  for (const s of Object.values(state.students)) {
    s.scores.total =
      (s.scores.ct || 0) + (s.scores.mvf || 0) + (s.scores.pyramid || 0);
  }
}

function leaderboard(limit = 10) {
  updateStudentTotals();
  return Object.entries(state.students)
    .map(([cid, s]) => ({
      clientId: cid,
      name: s.name,
      group: s.group,
      scores: { ...s.scores },
    }))
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, limit);
}

function scoreboardForPhase(phaseKey, limit = 10) {
  updateStudentTotals();
  return Object.entries(state.students)
    .map(([cid, s]) => ({
      clientId: cid,
      name: s.name,
      group: s.group,
      phaseScore: s.scores[phaseKey] || 0,
      total: s.scores.total,
    }))
    .sort((a, b) => b.phaseScore - a.phaseScore || b.total - a.total)
    .slice(0, limit);
}

async function emitScoreboard(phaseKey, onDone) {
  // Batch-answer pending student questions before the scoreboard praise
  await flushChatQueue();

  const top = scoreboardForPhase(phaseKey, 10);
  const top3 = top.slice(0, 3).filter((s) => s.phaseScore > 0);

  const top3Desc =
    top3.length > 0
      ? top3
          .map(
            (s, i) =>
              `${i + 1}. ${s.name}${s.group !== s.name ? ` (${s.group})` : ''} — ${s.phaseScore} pts`
          )
          .join('\n')
      : '(no scoring students yet)';

  const phaseLabels = {
    ct: 'Critical Thinking — heat warnings & at-risk older adults (AI-graded)',
    mvf: "Myth vs Fact — Emily Grayson's skin care education",
    pyramid: 'Priority Pyramid — initial encounter with Mr. M',
  };

  const prompt = `You are the ARTIFICIAL NURSE — a warm, comedic nursing educator roasting and celebrating a live classroom leaderboard.

Phase just finished: ${phaseLabels[phaseKey]}
Top 3 students (EXACT names to use — do not invent, substitute, or add any other names):
${top3Desc}

Generate a playful 2-3 sentence announcement that:
1. Shouts out each of the top 3 using ONLY the exact names above, with one quick nursing-themed compliment each
2. Drops one Chapter 6 one-liner
3. Ends with energy. No emojis. STRICT MAX 60 words.

HARD RULES:
- Only use the student names provided above. Never use "Taylor", "Jordan", "Sam", "Alex", "Jamie" or any placeholder name.
- If fewer than 3 students are listed, only shout out the ones listed.`;

  const fallback =
    top3.length > 0
      ? `Shoutout to ${top3.map((s) => s.name).join(', ')} — you're reading the room AND the chapter. Keep it up.`
      : `Nobody scored in this round, which is wild. Let's pick it up in the next phase — the textbook does NOT read itself.`;

  const praise = await callGemini(prompt, fallback, 10000);

  clearAudio();
  speakAndShowSynced(praise, () => {
    io.emit('scoreboard', {
      phaseKey,
      phaseLabel: phaseLabels[phaseKey],
      top,
      top3,
      praise,
      overall: leaderboard(10),
    });
  }, `scoreboard_${phaseKey}`);
  startNarrationWait(() => { if (onDone) onDone(); });
}

/* ─── Transition joke ───────────────────────────────────────── */
async function emitTransitionJoke(nextPhaseLabel) {
  const prompt = `You are Nurse Mike hosting a nursing classroom activity. Give ONE short (max 2 sentences) content-related joke or one-liner to transition into the next phase: "${nextPhaseLabel}". Keep it clean, nursing-themed, and related to Chapter 6 concepts (skin, circulation, respiration, thermoregulation, or sex/intimacy in older adults). No emojis.`;
  const fallbacks = [
    "Why did the older adult's nurse become a detective? Because in geriatrics, a 1-degree temp bump IS the whole crime scene.",
    "I told my patient sexual health doesn't stop at 70. She said 'honey, I know, the nurses keep forgetting to ask.'",
    "Why is older-adult skin like a first-year nursing student? Thin, sensitive, and bruises if you look at it wrong.",
  ];
  const joke = await callGemini(
    prompt,
    fallbacks[Math.floor(Math.random() * fallbacks.length)],
    8000
  );
  clearAudio();
  speakAndShowSynced(joke, () => {
    io.emit('joke', { joke, nextPhase: nextPhaseLabel });
  }, 'joke');
}

/* ─── Pending-advance: timers no longer auto-advance ──────────── */
// When a gameplay timer hits 0, we stash a pending fn and wait for the
// presenter to click Next. This lets the room finish the activity at its
// own pace instead of being skipped by the clock.
function setPendingAdvance(label, fn) {
  state.pendingAdvance = { label, fn };
  io.emit('pending:advance', { label });
}
function consumePendingAdvance() {
  if (!state.pendingAdvance) return false;
  const { fn } = state.pendingAdvance;
  state.pendingAdvance = null;
  io.emit('pending:advance', { label: null });
  fn();
  return true;
}

/* ─── Back navigation ───────────────────────────────────────── */
// Re-enter a previous sub-phase. Resets answers/votes for the target step
// so students can redo it. Best-effort coverage of the common cases.
function goBack() {
  stopTimer();
  cancelNarrationWait();
  state.pendingAdvance = null;
  clearAudio();

  const sp = state.subPhase;
  if (state.phase === 'CRITICAL_THINKING') {
    if (sp === 'ct_q1' || sp === 'ct_scenario') {
      // Already at the start — re-emit scenario
      enterCriticalThinking();
      return;
    }
    // Generic back-step through guiding questions
    const ctMatch = sp && /^ct_q(\d+)$/.exec(sp);
    if (ctMatch) {
      const idx = parseInt(ctMatch[1], 10);
      if (idx > 1) return advanceCT(`ct_q${idx - 1}`);
      return enterCriticalThinking();
    }
    if (sp && sp.startsWith('ct_ai')) {
      const lastQ = `ct_q${PHASE1.questions.length}`;
      return advanceCT(lastQ);
    }
    if (sp === 'ct_scoreboard') {
      // Roll back into the AI summary screen
      runCTAISummary();
      return;
    }
  }

  if (state.phase === 'MYTH_VS_FACT') {
    if (sp === 'mvf_vote' || sp === 'mvf_reveal') {
      const i = state.mvf.currentIndex;
      if (i > 0) {
        // Wipe the prior statement's votes so the class can re-vote on it
        const prevId = PHASE2.statements[i - 1].id;
        state.mvf.votes[prevId] = { MYTH: [], FACT: [] };
        state.mvf.votedBy[prevId] = new Set();
        delete state.mvf.reveals[prevId];
        for (const s of Object.values(state.students)) {
          delete s.mvfAnswers?.[prevId];
        }
        return startMVFStatement(i - 1);
      }
      // First statement — back goes to CT summary
      return runCTAISummary();
    }
    if (sp === 'mvf_summary' || sp === 'mvf_summary_processing') {
      return startMVFStatement(PHASE2.statements.length - 1);
    }
    if (sp === 'mvf_scoreboard') {
      return runMVFFinalSummary();
    }
  }

  if (state.phase === 'PRIORITY_PYRAMID') {
    if (sp === 'pyramid_setup_a' || sp === 'pyramid_sort_a' || sp === 'pyramid_display_a') {
      return enterPriorityPyramid();
    }
    if (sp === 'pyramid_setup_b' || sp === 'pyramid_sort_b' || sp === 'pyramid_display_b') {
      // Back into Half A's display
      state.pyramid.submissionsB = {};
      for (const s of Object.values(state.students)) s.pyramidB = null;
      return endPyramidSort('A');
    }
    if (sp === 'pyramid_ai' || sp === 'pyramid_ai_processing') {
      return endPyramidSort('B');
    }
    if (sp === 'pyramid_scoreboard') {
      return runPyramidAI();
    }
  }

  // Fallback: nothing to go back to (LOBBY or COMPLETE) — no-op
}

/* ─── Phase: CRITICAL THINKING ──────────────────────────────── */
function enterCriticalThinking() {
  state.phase = 'CRITICAL_THINKING';
  state.subPhase = 'ct_scenario';
  // Stamp the session start so the presenter sees a single 30-min clock
  state.sessionStartedAt = Date.now();
  broadcastState();
  clearAudio();
  io.emit('ct:scenario', { scenario: PHASE1.scenario });
  // No TTS for hardcoded content — the presenter reads the scenario aloud.
  startTimer('ct_scenario', TIMERS.ct_scenario, () => {
    setPendingAdvance('ct_scenario', () => advanceCT('ct_q1'));
  });
}

function advanceCT(nextSub) {
  state.subPhase = nextSub;
  broadcastState();
  if (nextSub.startsWith('ct_q')) {
    const qIndex = parseInt(nextSub.slice(-1), 10) - 1;
    const q = PHASE1.questions[qIndex];
    clearAudio();
    // Clear any prior submissions for THIS question (relevant when redoing
    // via the Back button)
    state.ct.answers[nextSub] = [];
    state.ct.submittedBy[nextSub] = new Set();
    io.emit('ct:question', { id: q.id, text: q.text, index: qIndex, total: PHASE1.questions.length });
    // No TTS — students read on their phone, presenter reads to the room.
    startTimer(nextSub, TIMERS[nextSub], () => {
      const nextIdx = qIndex + 1;
      if (nextIdx < PHASE1.questions.length) {
        setPendingAdvance(nextSub, () => advanceCT(`ct_q${nextIdx + 1}`));
      } else {
        setPendingAdvance(nextSub, () => runCTAISummary());
      }
    });
  }
}

async function runCTAISummary() {
  state.subPhase = 'ct_ai_processing';
  broadcastState();
  io.emit('ct:processing', {});

  const allAnswers = PHASE1.questions.flatMap((q) => state.ct.answers[q.id] || []);
  const allNames = allAnswers
    .map((a) => a.name)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const responseBlocks = PHASE1.questions
    .map((q, i) => {
      const ansList = (state.ct.answers[q.id] || [])
        .map((a) => `- [${a.name}] ${a.text}`)
        .join('\n') || '(none)';
      return `Q${i + 1} (${q.text}):\n${ansList}`;
    })
    .join('\n\n');

  const prompt = `You are the ARTIFICIAL NURSE — a sassy, warm nursing educator analyzing student responses to textbook Critical Thinking Question 3 (BC heat warnings, at-risk older adults).

SCENARIO: ${PHASE1.scenario}

STUDENT RESPONSES (names in brackets are the ONLY names you may reference):
${responseBlocks}

Ignore troll or empty responses. Write a 4-6 sentence live-classroom summary that:
1. Groups responses by common themes — you MAY name-drop 1-2 students IF AND ONLY IF their name appears in the list above
2. Gently roasts any common miss or vague answer in a playful, big-sibling way
3. Highlights strongest clinical reasoning
4. Ties to the emancipatory approach: autonomy, social determinants (heating costs!), challenging ageist assumptions, collaborating WITH not dictating TO
5. End with ONE powerful takeaway sentence.

HARD RULES:
- Only reference names from this list: ${allNames.length ? allNames.join(', ') : '(no student names — do NOT name-drop anyone)'}
- NEVER use placeholder names like "Taylor", "Jordan", "Sam", "Alex", "Jamie", "Maria" unless they appear in the list above.
- If no real names are provided, do not name-drop at all — refer to "the class" or "most of you".

Tone: warm, funny, clinical instructor who CARES but will call you out. No emojis. STRICT MAX 100 words — be punchy, not preachy.`;

  // Grade student responses first, then emit summary
  await gradeCTResponses();

  const summary = await callGemini(prompt, PHASE1.fallbackSummary);
  state.ct.aiSummary = summary;
  state.subPhase = 'ct_ai';
  broadcastState();
  clearAudio();
  pushScoresToAllStudents();
  // Sync text reveal with first TTS chunk
  speakAndShowSynced(summary, () => {
    io.emit('ct:summary', { summary });
  }, 'ct_summary');
  startNarrationWait(() => {
    emitScoreboard('ct', () => io.emit('ct:awaiting-next', {}));
  });
}

function pushScoresToAllStudents() {
  for (const [cid, s] of Object.entries(state.students)) {
    if (s.socketId) {
      io.to(s.socketId).emit('student:score', { scores: s.scores });
    }
  }
}

/* ─── CT AI grading (0-5 per response) ──────────────────────── */
async function gradeCTResponses() {
  if (!ai) return;
  const allItems = [];
  for (const q of PHASE1.questions) {
    for (const r of state.ct.answers[q.id] || []) {
      allItems.push({ qid: q.id, qText: q.text, name: r.name, text: r.text });
    }
  }
  if (allItems.length === 0) return;

  const numbered = allItems
    .map(
      (it, i) =>
        `${i + 1}. [${it.name}] Q: "${it.qText}"\n   A: "${it.text}"`
    )
    .join('\n');

  const prompt = `You are grading nursing student responses for textbook Chapter 6 Critical Thinking Q3 (BC heat warnings, at-risk older adults, emancipatory critique).

GRADING RUBRIC (strict, per response):
- 0: empty, troll, or completely irrelevant
- 1: vague / off-topic / single word
- 2: on-topic but very surface / no specific reasoning
- 3: relevant with basic reasoning
- 4: specific reasoning — names a real at-risk group, barrier, or concrete nursing action
- 5: specific reasoning + emancipatory lens (autonomy, social determinants, structural critique, collaborating WITH the patient)

RESPONSES:
${numbered}

Return STRICT JSON only (no prose, no markdown fences):
{"grades":[{"idx":1,"score":0,"reason":"short"},...]}
Every response must get a grade. Keep "reason" under 10 words.`;

  const raw = await callGemini(prompt, '');
  if (!raw) return;

  let cleaned = raw.trim();
  // strip ```json ... ``` if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim();
  // also handle case where it wraps in prose
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  try {
    const parsed = JSON.parse(cleaned);
    for (const g of parsed.grades || []) {
      const item = allItems[g.idx - 1];
      if (!item) continue;
      const score = Math.max(0, Math.min(5, Number(g.score) || 0));
      const student = Object.values(state.students).find(
        (s) => s.name === item.name
      );
      if (student) {
        student.scores.ct = (student.scores.ct || 0) + score;
      }
    }
    updateStudentTotals();
    console.log(`[grading] graded ${allItems.length} CT responses`);
  } catch (e) {
    console.warn('[grading] JSON parse failed — keeping engagement points only:', e.message);
  }
}

/* ─── Phase: MYTH vs FACT ───────────────────────────────────── */
function enterMythVsFact() {
  state.phase = 'MYTH_VS_FACT';
  state.mvf.currentIndex = 0;
  state.subPhase = 'mvf_intro';
  broadcastState();
  emitTransitionJoke('Emily Grayson — Skin Care Myth vs Fact').finally(() => {
    startNarrationWait(() => showEmilyContext());
  });
}

function showEmilyContext() {
  state.subPhase = 'mvf_context';
  broadcastState();
  clearAudio();
  io.emit('mvf:context', {
    title: PHASE2.title,
    context: PHASE2.emilyContext,
  });
  speakNarration(PHASE2.emilyContext, 'mvf_context');
  startNarrationWait(() => startMVFStatement(0));
}

function startMVFStatement(index) {
  if (index >= PHASE2.statements.length) return runMVFFinalSummary();
  state.mvf.currentIndex = index;
  state.subPhase = 'mvf_vote';
  const stmt = PHASE2.statements[index];
  state.mvf.votes[stmt.id] = { MYTH: [], FACT: [] };
  state.mvf.votedBy[stmt.id] = new Set();
  broadcastState();
  clearAudio();
  io.emit('mvf:statement', {
    id: stmt.id,
    text: stmt.text,
    index,
    total: PHASE2.statements.length,
  });
  // No TTS — students read on phone; voice is reserved for AI commentary.
  startTimer('mvf_vote', TIMERS.mvf_vote, () => {
    setPendingAdvance('mvf_vote', () => revealMVF(index));
  });
}

async function revealMVF(index) {
  const stmt = PHASE2.statements[index];
  const mythCount = state.mvf.votes[stmt.id].MYTH.length;
  const factCount = state.mvf.votes[stmt.id].FACT.length;
  const total = mythCount + factCount;
  const pctMyth = total ? Math.round((mythCount / total) * 100) : 0;
  const pctFact = total ? Math.round((factCount / total) * 100) : 0;
  const pctCorrect = stmt.answer === 'MYTH' ? pctMyth : pctFact;

  state.subPhase = 'mvf_reveal';
  broadcastState();
  io.emit('mvf:reveal', {
    id: stmt.id,
    correct: stmt.answer,
    pctMyth,
    pctFact,
    pctCorrect,
    total,
    emancipatory: stmt.emancipatory,
  });

  const wrongAnswer = stmt.answer === 'MYTH' ? 'FACT' : 'MYTH';
  const wrongCount = stmt.answer === 'MYTH' ? factCount : mythCount;

  const prompt = `You are the ARTIFICIAL NURSE — comedy-roast nursing educator. The class just voted on a myth-vs-fact statement about person-centred SKIN CARE EDUCATION for Emily Grayson, an 83-year-old avid gardener (textbook Chapter 6 Activity 2).

STATEMENT: "${stmt.text}"
CORRECT: ${stmt.answer}
RESULTS: ${pctMyth}% said MYTH, ${pctFact}% said FACT (n=${total})
Wrong answer chosen: ${wrongAnswer} by ${wrongCount} students.
Emancipatory angle: ${stmt.emancipatory}

Write a SHORT 2-3 sentence spicy-but-warm reaction. REQUIREMENTS:
- If >30% got it wrong, OPEN with a playful ROAST (big-sibling energy, never mean).
- If <=30% wrong, lead with a funny PRAISE.
- Punch in WHY with ONE specific clinical or person-centred-care fact (skin aging, sun protection, ABCDE, social determinants, teach-back).
- Close with the emancipatory one-liner about Emily's autonomy / dignity / lived experience.
- No emojis. STRICT MAX 50 words.`;

  const roast = await callGemini(prompt, PHASE2.fallbackRoasts[stmt.id]);
  state.mvf.reveals[stmt.id] = { pctCorrect, roast };
  clearAudio();
  speakAndShowSynced(roast, () => {
    io.emit('mvf:roast', { id: stmt.id, roast });
  }, `mvf_roast_${stmt.id}`);

  startNarrationWait(() => startMVFStatement(index + 1));
}

async function runMVFFinalSummary() {
  state.subPhase = 'mvf_summary_processing';
  broadcastState();
  io.emit('mvf:processing', {});

  const lines = PHASE2.statements
    .map((s, i) => `${i + 1}. "${s.text}" — ${state.mvf.reveals[s.id]?.pctCorrect ?? 0}% correct`)
    .join('\n');

  const prompt = `You are the ARTIFICIAL NURSE wrapping up a 10-statement myth-vs-fact round on PERSON-CENTRED SKIN CARE EDUCATION for Emily Grayson, an 83-year-old gardener (textbook Chapter 6 Activity 2). Results:
${lines}

Give a warm, funny 3-4 sentence wrap-up that:
1. Names which statement(s) tripped up the class most — connect to where paternalism / ageism crept in around Emily
2. Reinforces the emancipatory message in ONE punch line: education that starts with HER (her routine, her budget, her self-knowledge)
3. Ends with encouragement + one powerful one-liner.
No emojis. STRICT MAX 80 words.`;

  const summary = await callGemini(prompt, PHASE2.fallbackFinal);
  state.mvf.finalSummary = summary;
  state.subPhase = 'mvf_summary';
  broadcastState();
  clearAudio();
  speakAndShowSynced(summary, () => {
    io.emit('mvf:final', { summary });
  }, 'mvf_final');
  startNarrationWait(() => {
    emitScoreboard('mvf', () => io.emit('mvf:awaiting-next', {}));
  });
}

/* ─── Phase: PRIORITY PYRAMID ───────────────────────────────── */
function enterPriorityPyramid() {
  state.phase = 'PRIORITY_PYRAMID';
  state.subPhase = 'pyramid_intro';
  broadcastState();
  emitTransitionJoke('Mr. M — Initial Encounter Priority Pyramid').finally(() => {
    startNarrationWait(() => showMrMContext());
  });
}

function showMrMContext() {
  state.subPhase = 'pyramid_context';
  broadcastState();
  clearAudio();
  io.emit('pyramid:context', {
    title: PHASE3.title,
    context: PHASE3.mrMContext,
  });
  speakNarration(PHASE3.mrMContext, 'pyramid_context');
  startNarrationWait(() => startPyramidPart('A'));
}

// Pyramid split into halves of 5 items each.
const PYRAMID_HALVES = {
  A: [1, 2, 3, 4, 5], // thermoregulation/skin/social/cardio + sex item #3
  B: [6, 7, 8, 9, 10], // respiratory/skin/sex/lifestyle + sex item #8
};
function pyramidItemsForHalf(half) {
  const ids = new Set(PYRAMID_HALVES[half]);
  return PHASE3.interventions.filter((iv) => ids.has(iv.id));
}

function startPyramidPart(half) {
  const lower = half.toLowerCase();
  state.subPhase = `pyramid_setup_${lower}`;
  broadcastState();
  clearAudio();
  io.emit('pyramid:setup', {
    half,
    currentPart: half === 'A' ? 1 : 2,
    totalParts: 2,
    interventions: pyramidItemsForHalf(half),
  });
  startTimer(`pyramid_setup_${lower}`, TIMERS.pyramid_setup, () => {
    setPendingAdvance(`pyramid_setup_${lower}`, () => beginPyramidSort(half));
  });
}

function beginPyramidSort(half) {
  const lower = half.toLowerCase();
  state.subPhase = `pyramid_sort_${lower}`;
  broadcastState();
  io.emit('pyramid:sort', { half });
  startTimer(`pyramid_sort_${lower}`, TIMERS.pyramid_sort, () => {
    setPendingAdvance(`pyramid_sort_${lower}`, () => endPyramidSort(half));
  });
}

function endPyramidSort(half) {
  const lower = half.toLowerCase();
  state.subPhase = `pyramid_display_${lower}`;
  broadcastState();
  io.emit('pyramid:display', {
    half,
    submissions: namedSubmissionsHalf(half),
  });
  startTimer(`pyramid_display_${lower}`, TIMERS.pyramid_display, () => {
    if (half === 'A') {
      setPendingAdvance('pyramid_display_a', () => startPyramidPart('B'));
    } else {
      setPendingAdvance('pyramid_display_b', () => runPyramidAI());
    }
  });
}

function namedSubmissionsHalf(half) {
  const src = half === 'A' ? state.pyramid.submissionsA : state.pyramid.submissionsB;
  const out = {};
  for (const [cid, ranking] of Object.entries(src || {})) {
    const s = state.students[cid];
    if (s) out[`${s.name} (${s.group})`] = ranking;
  }
  return out;
}

function namedSubmissions() {
  const out = {};
  for (const [cid, ranking] of Object.entries(state.pyramid.submissions)) {
    const s = state.students[cid];
    if (s) out[`${s.name} (${s.group})`] = ranking;
  }
  return out;
}

function scorePyramid(ranking) {
  // Emancipatory bonus (Mr. M relational practice): reward placing the
  // RELATIONAL CORE items at the very top within Part A.
  //   #1 = his goals
  //   #3 = his own words for his diagnosis
  //   #2 = his values / what gives his life meaning
  // These three are the heart of "knowing the whole person."
  const rankBonus = { 1: 20, 2: 15, 3: 10, 4: 7, 5: 5 };
  const relationalCore = new Set([1, 2, 3]);
  let pts = 0;
  for (const r of ranking) {
    if (relationalCore.has(r.id) && r.rank <= 5) {
      pts += rankBonus[r.rank] || 0;
    }
  }
  // Small correctness bonus vs the ideal ranking
  for (const r of ranking) {
    const ideal = IDEAL_RANKING[r.id];
    if (ideal && Math.abs(ideal - r.rank) <= 1) pts += 2;
  }
  return pts;
}

async function runPyramidAI() {
  state.subPhase = 'pyramid_ai_processing';
  broadcastState();
  io.emit('pyramid:processing', {});

  const lines =
    Object.entries(state.pyramid.submissions)
      .map(([cid, ranking]) => {
        const s = state.students[cid];
        if (!s) return null;
        const sorted = [...ranking].sort((a, b) => a.rank - b.rank);
        return `${s.name} (${s.group}): top3=${sorted.slice(0, 3).map((r) => `#${r.id}`).join(',')} | bottom3=${sorted.slice(-3).map((r) => `#${r.id}`).join(',')}`;
      })
      .filter(Boolean)
      .join('\n') || '(no submissions)';

  const interventionsList = PHASE3.interventions
    .map((i) => `#${i.id}: ${i.text}`)
    .join('\n');

  const submitterNames = Object.keys(state.pyramid.submissions)
    .map((cid) => state.students[cid]?.name)
    .filter(Boolean);

  const prompt = `You are the ARTIFICIAL NURSE — a warm, funny, perceptive nursing educator analyzing INDIVIDUAL STUDENT pyramid rankings for Chapter 6 Activity 3 (Mr. M, 70yo with heart failure, INITIAL ENCOUNTER, relational practice).

THE 10 ITEMS (1-5 are RELATIONAL/CONTEXTUAL "who is Mr. M"; 6-10 are CLINICAL/STRUCTURAL "what's happening to him"):
${interventionsList}

INDIVIDUAL STUDENT RANKINGS (top3 = first three things they said they'd want to know):
${lines}

Write a lively 6-8 sentence consolidated analysis that:
1. Names 1-3 students whose Part 1 ranking shows strong relational practice — especially anyone who placed #1 (his goals), #3 (his own words for his diagnosis), or #2 (his values) at the very top — with playful praise
2. Calls out the pattern IF the class jumped straight to clinical items (#6 symptoms, #7 meds, #9 history) over relational ones — joke about how easy it is to slip into "treat the diagnosis, not the person"
3. Notes the most common Part 1 top priority and Part 2 top priority
4. Ties to the textbook's question: knowing the WHOLE person makes clinical care possible, not the other way around
5. Reinforces emancipatory nursing: collaborating WITH Mr. M, not assessing him AT
6. End with: "Mr. M's heart failure is treated. Mr. M is collaborated WITH."

HARD RULES:
- Only reference these student names: ${submitterNames.length ? submitterNames.join(', ') : '(no submissions — do NOT name-drop anyone)'}
- NEVER use placeholder names like "Taylor", "Jordan", "Sam", "Alex", "Jamie".
- If fewer than the requested number of strong pyramids exist, only name the ones that do.

Tone: nursing-comedy-roast with teeth. No emojis. STRICT MAX 140 words — keep it punchy.`;

  const analysis = await callGemini(prompt, PHASE3.fallbackAnalysis);
  state.pyramid.analysis = analysis;

  // apply scoring
  for (const [cid, ranking] of Object.entries(state.pyramid.submissions)) {
    const s = state.students[cid];
    if (s) s.scores.pyramid = scorePyramid(ranking);
  }
  updateStudentTotals();

  state.subPhase = 'pyramid_ai';
  broadcastState();
  clearAudio();
  speakAndShowSynced(analysis, () => {
    io.emit('pyramid:analysis', {
      analysis,
      submissions: namedSubmissions(),
    });
  }, 'pyramid_analysis');
  startNarrationWait(() => {
    emitScoreboard('pyramid', () => io.emit('pyramid:awaiting-next', {}));
  });
}

async function enterComplete() {
  state.phase = 'COMPLETE';
  state.subPhase = 'closing_takeaways';
  stopTimer();
  broadcastState();

  // Generate live "Key Takeaways" tying everything together
  const prompt = `You are the ARTIFICIAL NURSE wrapping up a 30-minute classroom activity on Chapter 6 (complex care of older adults).

The class just completed the three textbook end-of-chapter prompts:
- Phase 1: Critical Thinking Q3 — at-risk older adults during BC heat warnings; who falls through the cracks of public messaging
- Phase 2: Emancipatory Activity 2 — person-centred skin care education with Emily Grayson, 83yo gardener
- Phase 3: Emancipatory Activity 3 — initial encounter with Mr. M, 70yo with heart failure; relational practice

Generate a concise CLOSING SUMMARY (3-4 sentences, MAX 90 words) that:
1. Names the THREE biggest takeaways — one tying to each phase (heat/at-risk pops, skin/Emily, heart failure/Mr. M)
2. Explicitly names the EMANCIPATORY message: holistic care, autonomy, social determinants, challenging ageism
3. Names Emily Grayson AND Mr. M with one specific reminder each
4. Closes with one warm, motivating one-liner.

No emojis. Tone: warm, clear, end-of-class energy.`;

  const fallback =
    "Three things to take with you. One: when a heat warning goes out, the older adults the public-health release names are the ones it least often reaches — the renter on the fourth floor with no AC, the woman widowed last year, the man on a fixed income. Nursing is who closes that gap. Two: with Emily, person-centred skin care starts with what she already does — her routine, her budget, her self-knowledge — and treats the new spot on her hand seriously. Three: with Mr. M, the heart failure is treated; Mr. M is collaborated with — his goals, his words, his values come BEFORE the ejection fraction. Emancipatory nursing means autonomy, social determinants, and refusing to let age stereotypes shrink our scope of care. Now go practice it.";

  const summary = await callGemini(prompt, fallback, 14000);
  clearAudio();
  speakAndShowSynced(summary, () => {
    io.emit('complete', { final: leaderboard(20), takeaways: summary });
  }, 'closing_takeaways');
  startNarrationWait(() => {
    /* end of session — no auto-advance, just stay here */
  }, { hardCapMs: 600000 });
}

/* ─── Artificial Nurse chat: queue + batch + ad-hoc ──────────── */
let chatSeq = 0;

function enqueueStudentQuestion({ from, group, question }) {
  const q = String(question || '').trim().slice(0, 400);
  if (q.length < 3) return null;
  const entry = {
    id: `q_${++chatSeq}`,
    from,
    group,
    question: q,
    ts: Date.now(),
    status: 'pending',
  };
  state.chatQueue.push(entry);
  io.emit('chat:queue', { queue: state.chatQueue });
  return entry;
}

async function answerSingleAdHoc(question) {
  const q = String(question || '').trim().slice(0, 500);
  if (!q) return;
  io.emit('chat:processing', { question: q });
  const prompt = `You are the ARTIFICIAL NURSE — a warm, sassy, funny nursing educator answering live in a Chapter 6 classroom. Do NOT mention "Gemini" or "AI model" — you are the Artificial Nurse.

QUESTION: "${q}"

Answer in 2-3 short sentences (MAX 60 words). Accurate to Chapter 6 content (skin/circulation/respiration/thermoregulation/sex & intimacy in older adults, emancipatory nursing). Clinical where it matters, warm humor throughout. If off-topic, pivot back with a quick joke. No emojis.`;
  const answer = await callGemini(
    prompt,
    "The Artificial Nurse is buffering, but here's the short version: Chapter 6 is about treating the WHOLE older adult — every system, including the uncomfortable ones. Rephrase and I'll go deeper."
  );
  state.chatHistory.push({ q, a: answer, ts: Date.now() });
  if (state.chatHistory.length > 30) state.chatHistory.shift();
  clearAudio();
  speakAndShowSynced(answer, () => {
    io.emit('chat:answer', { question: q, answer });
  }, 'chat_answer');
}

async function flushChatQueue() {
  const pending = state.chatQueue.filter((e) => e.status === 'pending');
  if (pending.length === 0) return;

  // mark them all as answering
  for (const e of pending) e.status = 'answering';
  io.emit('chat:queue', { queue: state.chatQueue });
  io.emit('chat:batch-processing', { count: pending.length });

  const numbered = pending
    .map((e, i) => `${i + 1}. [${e.from}${e.group && e.group !== e.from ? ` · ${e.group}` : ''}] ${e.question}`)
    .join('\n');

  const prompt = `You are the ARTIFICIAL NURSE — a warm, sassy, funny nursing educator answering a BATCH of live student questions from a Chapter 6 classroom activity. Do NOT mention "Gemini" or "AI model" — you are the Artificial Nurse.

QUESTIONS (from named students):
${numbered}

For EACH question, output exactly this format on its own line-block:

[n]. To <StudentName>: <your answer in 1-2 short sentences (max 35 words) — warm, funny, nursing-accurate, grounded in Chapter 6>

Rules:
- Address the student by first name when you answer.
- Accurate to Chapter 6 content. Clinical where it matters.
- Humor welcome; never mean. Big-sibling energy.
- If a question is off-topic, pivot back to Chapter 6 with a quick joke.
- No emojis.
- Do NOT add an intro or outro — just the numbered answers.`;

  const fallbackBatch = pending
    .map((e, i) => `${i + 1}. To ${e.from}: Great question — the short version for Chapter 6: older adult care is whole-person care. Every system matters, including the ones we skip out of discomfort. That's the emancipatory lens.`)
    .join('\n\n');

  const batchAnswer = await callGemini(prompt, fallbackBatch, 18000);

  // parse by leading "N." — lenient splitter
  const chunks = batchAnswer
    .split(/\n(?=\d+\.)/)
    .map((c) => c.trim())
    .filter(Boolean);

  pending.forEach((e, i) => {
    let answer = chunks[i] || '';
    // strip leading "1. " if present
    answer = answer.replace(/^\d+\.\s*/, '').trim();
    if (!answer) answer = `To ${e.from}: I couldn't generate a response — but Chapter 6 has the full picture.`;
    e.status = 'answered';
    e.answer = answer;
    state.chatHistory.push({ q: `[${e.from}] ${e.question}`, a: answer, ts: Date.now() });
  });

  if (state.chatHistory.length > 40) state.chatHistory.splice(0, state.chatHistory.length - 40);

  io.emit('chat:queue', { queue: state.chatQueue });
  const answeredList = pending.map(({ id, from, group, question, answer }) => ({ id, from, group, question, answer }));
  clearAudio();
  io.emit('chat:batch-answered', { answered: answeredList });
  // Speak each batch answer sequentially (queued on client)
  for (const a of answeredList) {
    speakNarration(`${a.from}: ${a.answer}`, `chat_batch_${a.id}`);
  }
}

/* ─── Routes ────────────────────────────────────────────────── */
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

app.get('/qrcode', async (req, res) => {
  // Priority: explicit ?host=, PUBLIC_URL env (set on cloud), then forwarded
  // host from the proxy, then the raw request Host header, then local LAN.
  let host = req.query.host || process.env.PUBLIC_URL;
  if (!host) {
    const fwdProto = req.headers['x-forwarded-proto'];
    const fwdHost = req.headers['x-forwarded-host'] || req.headers.host;
    const isLocal =
      !fwdHost ||
      fwdHost.startsWith('localhost') ||
      fwdHost.startsWith('127.') ||
      fwdHost.startsWith('10.') ||
      fwdHost.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(fwdHost);
    if (fwdHost && !isLocal) {
      // Cloud / public domain or public IP — use it as-is.
      host = `${fwdProto || req.protocol}://${fwdHost}`;
    } else {
      host = `http://${getLocalIP()}:${process.env.PORT || 3000}`;
    }
  }
  try {
    const dataUrl = await QRCode.toDataURL(host, {
      width: 340,
      margin: 2,
      color: { dark: '#00f5d4', light: '#06080f' },
    });
    res.json({ qr: dataUrl, url: host });
  } catch (e) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

app.get('/presenter', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'presenter.html'))
);

app.get('/api/state', (req, res) => res.json(publicState()));
app.get('/api/voices', (req, res) =>
  res.json({ voices: VOICES, current: currentVoice })
);

/* ─── Socket.io ─────────────────────────────────────────────── */
io.on('connection', (socket) => {
  const role = socket.handshake.query.role;

  if (role === 'presenter') {
    socket.join('presenter');

    socket.on('presenter:start', () => {
      if (state.phase !== 'LOBBY') return;
      // Wipe ALL session state so a new presentation starts clean
      // (no leftover answers, votes, scores, queue, or chat from a prior class)
      resetSessionState();
      enterCriticalThinking();
    });

    socket.on('presenter:next', () => {
      // 1. Click during a narration-wait: end the wait now.
      if (narrationWait && !narrationWait.advanced) {
        advanceNarration('presenter-click');
        return;
      }
      // 2. Click during a gameplay phase whose timer has hit 0: advance now.
      if (state.pendingAdvance) {
        consumePendingAdvance();
        return;
      }
      // 3. Click during a gameplay phase whose timer is STILL running:
      //    treat as "skip ahead" — fire the same advance the timer would.
      if (state.timer.interval) {
        // Force the running timer to expire on the next tick. Its onDone will
        // either advance immediately or stash a pendingAdvance.
        state.timer.seconds = 0;
        // Then immediately consume any pendingAdvance the onDone created.
        // Use a microtask so the onDone has a chance to register first.
        setTimeout(() => {
          if (state.pendingAdvance) consumePendingAdvance();
        }, 50);
        return;
      }
      // 4. Otherwise: cross-phase advance (between major phases).
      if (state.phase === 'CRITICAL_THINKING') enterMythVsFact();
      else if (state.phase === 'MYTH_VS_FACT') enterPriorityPyramid();
      else if (state.phase === 'PRIORITY_PYRAMID') enterComplete();
    });

    socket.on('presenter:skip-sub', () => {
      if (narrationWait && !narrationWait.advanced) {
        advanceNarration('presenter-skip');
        return;
      }
      if (state.pendingAdvance) {
        consumePendingAdvance();
        return;
      }
      if (state.timer.interval) state.timer.seconds = 1;
    });

    socket.on('presenter:back', () => {
      goBack();
    });

    socket.on('audio:finished', onAudioFinished);

    socket.on('presenter:pause', () => {
      state.timer.paused = !state.timer.paused;
      io.emit('timer:paused', { paused: state.timer.paused });
    });

    socket.on('presenter:add-time', ({ seconds }) => {
      addTime(Math.max(5, Math.min(300, Number(seconds) || 30)));
    });

    socket.on('presenter:chat', ({ question }) => answerSingleAdHoc(question));
    socket.on('presenter:answer-now', () => {
      flushChatQueue();
    });

    socket.on('presenter:set-voice', async ({ voice }) => {
      if (!ALL_VOICE_IDS.has(voice)) return;
      currentVoice = voice;
      io.emit('voice:changed', { voice });
      // Speak a short sample in the new voice immediately so the presenter
      // can hear it.
      try {
        const audio = await generateTTS(
          `This is the ${voice} voice. Ready when you are.`,
          voice
        );
        if (audio) {
          io.emit('audio:clear', {});
          io.emit('audio:play', {
            id: ++audioSeq,
            label: 'voice_sample',
            audioBase64: audio.base64,
            mime: audio.mime,
          });
        }
      } catch (e) { /* best-effort sample */ }
    });

    socket.on('presenter:joke', async () => {
      await emitTransitionJoke('(freestyle)');
    });

    socket.on('presenter:reset', () => {
      resetSessionState();
      io.emit('reset', {});
    });

    socket.emit('state:update', publicState());
    socket.emit('chat:history', state.chatHistory);
    socket.emit('chat:queue', { queue: state.chatQueue });
  }

  if (role === 'student') {
    socket.on('student:join', ({ clientId, name, group }) => {
      const cid = String(clientId || '').trim() || `anon-${socket.id}`;
      const cleanName = String(name || '').trim().slice(0, 40) || 'Student';
      const cleanGroup = String(group || '').trim().slice(0, 40) || cleanName;

      const existing = state.students[cid];
      if (existing) {
        existing.socketId = socket.id;
        existing.name = cleanName;
        existing.group = cleanGroup;
      } else {
        state.students[cid] = {
          name: cleanName,
          group: cleanGroup,
          socketId: socket.id,
          scores: { ct: 0, mvf: 0, pyramid: 0, total: 0 },
          mvfAnswers: {},
          pyramidRanking: null,
        };
      }
      state.socketToClient[socket.id] = cid;

      socket.emit('student:joined', { clientId: cid, name: cleanName, group: cleanGroup });
      socket.emit('state:update', publicState());
      if (state.phase !== 'LOBBY') {
        socket.emit('late:join', { phase: state.phase, subPhase: state.subPhase });
      }
      socket.emit('student:score', { scores: state.students[cid].scores });
      socket.emit('chat:queue', { queue: state.chatQueue });
      broadcastState();
    });

    socket.on('student:ask', ({ question }) => {
      const cid = state.socketToClient[socket.id];
      const student = state.students[cid];
      if (!student) return;
      const entry = enqueueStudentQuestion({
        from: student.name,
        group: student.group,
        question,
      });
      if (entry) socket.emit('student:ask-ack', { id: entry.id });
    });

    socket.on('student:ct-answer', ({ questionId, answer }) => {
      if (state.phase !== 'CRITICAL_THINKING') return;
      if (!PHASE1.questions.some((q) => q.id === questionId)) return;
      if (state.subPhase !== questionId) return;

      const cid = state.socketToClient[socket.id];
      const student = state.students[cid];
      if (!student) return;
      if (state.ct.submittedBy[questionId].has(cid)) return;
      const text = String(answer || '').trim();
      if (text.length < 30) return;

      state.ct.submittedBy[questionId].add(cid);
      state.ct.answers[questionId].push({
        name: student.name,
        group: student.group,
        text: text.slice(0, 500),
      });
      // Scoring is assigned later by gradeCTResponses() (0-5 per answer).

      io.to('presenter').emit('ct:answer', {
        questionId,
        name: student.name,
        group: student.group,
        text: text.slice(0, 500),
        totalForQ: state.ct.answers[questionId].length,
      });
      socket.emit('student:ct-ack', { questionId });
      socket.emit('student:score', { scores: student.scores });
    });

    socket.on('student:mvf-vote', ({ statementId, vote }) => {
      if (state.phase !== 'MYTH_VS_FACT') return;
      if (state.subPhase !== 'mvf_vote') return;
      const stmt = PHASE2.statements[state.mvf.currentIndex];
      if (!stmt || stmt.id !== statementId) return;
      if (!['MYTH', 'FACT'].includes(vote)) return;

      const cid = state.socketToClient[socket.id];
      const student = state.students[cid];
      if (!student) return;
      if (state.mvf.votedBy[statementId].has(cid)) return;

      state.mvf.votedBy[statementId].add(cid);
      state.mvf.votes[statementId][vote].push(student.name);
      student.mvfAnswers[statementId] = vote;
      if (vote === stmt.answer) {
        student.scores.mvf = (student.scores.mvf || 0) + 10;
        updateStudentTotals();
      }

      const v = state.mvf.votes[statementId];
      io.emit('mvf:votes', {
        statementId,
        myth: v.MYTH.length,
        fact: v.FACT.length,
        total: v.MYTH.length + v.FACT.length,
      });
      socket.emit('student:mvf-ack', { statementId, vote });
      socket.emit('student:score', { scores: student.scores });
    });

    socket.on('student:pyramid-submit', ({ half, ranking }) => {
      if (state.phase !== 'PRIORITY_PYRAMID') return;
      const expectedSub = half === 'A' ? 'pyramid_sort_a' : 'pyramid_sort_b';
      if (state.subPhase !== expectedSub) return;
      const cid = state.socketToClient[socket.id];
      const student = state.students[cid];
      if (!student) return;

      const allowedIds = PYRAMID_HALVES[half] || [];
      if (!Array.isArray(ranking) || ranking.length !== 5) return;
      const ids = new Set(ranking.map((r) => r.id));
      const ranks = new Set(ranking.map((r) => r.rank));
      if (ids.size !== 5 || ranks.size !== 5) return;
      // Validate every id is in this half and every rank is 1..5
      for (const r of ranking) {
        if (!allowedIds.includes(r.id)) return;
        if (r.rank < 1 || r.rank > 5) return;
      }

      const target = half === 'A' ? state.pyramid.submissionsA : state.pyramid.submissionsB;
      target[cid] = ranking;
      if (half === 'A') student.pyramidA = ranking;
      else student.pyramidB = ranking;

      // Once both halves are submitted, merge into a 1..10 combined ranking.
      // Half A occupies ranks 1..5, half B occupies ranks 6..10. We preserve
      // each student's within-half ordering when collapsing.
      if (student.pyramidA && student.pyramidB) {
        const combined = [
          ...student.pyramidA.map((r) => ({ id: r.id, rank: r.rank })),
          ...student.pyramidB.map((r) => ({ id: r.id, rank: 5 + r.rank })),
        ];
        state.pyramid.submissions[cid] = combined;
        student.pyramidRanking = combined;
      }

      io.to('presenter').emit('pyramid:submission', {
        by: student.name,
        group: student.group,
        half,
        count: Object.keys(target).length,
      });
      socket.emit('student:pyramid-ack', { half });
    });

    socket.on('disconnect', () => {
      const cid = state.socketToClient[socket.id];
      if (cid && state.students[cid]) {
        state.students[cid].socketId = null;
        // Keep student record for reconnect — scores preserved.
      }
      delete state.socketToClient[socket.id];
      broadcastState();
    });
  }
});

/* ─── Start ─────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`\n  🎓 NUR3035 Solo App is live!`);
  console.log(`  ├─ Presenter: http://localhost:${PORT}/presenter`);
  console.log(`  ├─ Students:  http://${ip}:${PORT}`);
  console.log(`  ├─ Model:     ${MODEL}`);
  console.log(`  └─ Gemini:    ${ai ? 'ON' : 'DISABLED (fallbacks active)'}\n`);
});
