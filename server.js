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
  // Fire all TTS calls in parallel; emit each in order as it resolves so
  // first sentence plays as soon as it's ready. If clearAudio() runs while
  // we're awaiting, the epoch advances and we drop everything that's
  // still pending so it doesn't play over the next slide.
  const promises = chunks.map((c) => generateTTS(c));
  for (const p of promises) {
    try {
      const audio = await p;
      if (narrationEpoch !== myEpoch) return; // stale: a new phase took over
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

function clearAudio() {
  narrationEpoch++; // invalidate any in-flight speakNarration so its
                    // remaining chunks don't bleed into the next phase.
  io.emit('audio:clear', {});
  audioFinishedSeen = false;
}

/* ─── Narration wait: advance on click OR audio-end + grace ───── */
let audioFinishedSeen = false;
let narrationWait = null; // { onAdvance, advanced, graceMs, hardTimeout }

function startNarrationWait(onAdvance, { graceMs = 2500, hardCapMs = 240000 } = {}) {
  cancelNarrationWait(); // cancel any prior
  audioFinishedSeen = false;
  const w = {
    onAdvance,
    advanced: false,
    graceMs,
    hardTimeout: setTimeout(() => advanceNarration('hard-timeout'), hardCapMs),
  };
  narrationWait = w;
  io.emit('narration:waiting', { graceMs });
}

function cancelNarrationWait() {
  if (narrationWait) {
    if (narrationWait.hardTimeout) clearTimeout(narrationWait.hardTimeout);
    if (narrationWait.graceTimeout) clearTimeout(narrationWait.graceTimeout);
    narrationWait = null;
  }
}

function advanceNarration(reason) {
  if (!narrationWait || narrationWait.advanced) return;
  narrationWait.advanced = true;
  if (narrationWait.hardTimeout) clearTimeout(narrationWait.hardTimeout);
  if (narrationWait.graceTimeout) clearTimeout(narrationWait.graceTimeout);
  const fn = narrationWait.onAdvance;
  narrationWait = null;
  io.emit('narration:advanced', { reason });
  console.log(`[narration] advance: ${reason}`);
  if (fn) fn();
}

function onAudioFinished() {
  audioFinishedSeen = true;
  if (!narrationWait || narrationWait.advanced) return;
  if (narrationWait.graceTimeout) return; // already scheduled
  narrationWait.graceTimeout = setTimeout(
    () => advanceNarration('audio-finished+grace'),
    narrationWait.graceMs
  );
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
// Used to score students — prioritizes sexual health for bonus points.
const IDEAL_RANKING = { 1: 1, 4: 2, 9: 3, 3: 4, 6: 5, 8: 6, 5: 7, 7: 8, 10: 9, 2: 10 };

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  phase: 'LOBBY',
  subPhase: null,

  // clientId → { name, group, socketId|null, scores: {ct, mvf, pyramid, total}, mvfAnswers, pyramidRanking }
  students: {},
  socketToClient: {},

  ct: {
    answers: { ct_q1: [], ct_q2: [], ct_q3: [] },
    submittedBy: { ct_q1: new Set(), ct_q2: new Set(), ct_q3: new Set() }, // clientIds
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
  };
}

function broadcastState() {
  io.emit('state:update', publicState());
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
    ct: 'Critical Thinking (engagement points for submitting answers)',
    mvf: 'Myth vs Fact (correct answers)',
    pyramid: 'Priority Pyramid (emancipatory ranking bonus)',
  };

  const prompt = `You are the ARTIFICIAL NURSE — a warm, comedic nursing educator roasting and celebrating a live classroom leaderboard.

Phase just finished: ${phaseLabels[phaseKey]}
Top 3 students (EXACT names to use — do not invent, substitute, or add any other names):
${top3Desc}

Generate a playful 3-4 sentence announcement that:
1. Shouts out each of the top 3 using ONLY the exact names above, each with a different nursing-themed compliment or joke
2. Drops one content-related one-liner tying to Chapter 6 (skin, circulation, respiration, thermoregulation, or sex/intimacy)
3. Ends with energy. No emojis. Savage-but-loving big-sibling energy.

HARD RULES:
- Only use the student names provided above. Never use "Taylor", "Jordan", "Sam", "Alex", "Jamie" or any example/placeholder name.
- If fewer than 3 students are listed, only shout out the ones listed.
- Do not invent students or make up names.`;

  const fallback =
    top3.length > 0
      ? `Shoutout to ${top3.map((s) => s.name).join(', ')} — you're reading the room AND the chapter. Keep it up.`
      : `Nobody scored in this round, which is wild. Let's pick it up in the next phase — the textbook does NOT read itself.`;

  const praise = await callGemini(prompt, fallback, 10000);

  clearAudio();
  io.emit('scoreboard', {
    phaseKey,
    phaseLabel: phaseLabels[phaseKey],
    top,
    top3,
    praise,
    overall: leaderboard(10),
  });
  speakNarration(praise, `scoreboard_${phaseKey}`);
  // Wait for click OR audio-finished+grace; longer grace because praise can be long.
  startNarrationWait(() => { if (onDone) onDone(); }, { graceMs: 4000 });
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
  io.emit('joke', { joke, nextPhase: nextPhaseLabel });
  speakNarration(joke, 'joke');
}

/* ─── Phase: CRITICAL THINKING ──────────────────────────────── */
function enterCriticalThinking() {
  state.phase = 'CRITICAL_THINKING';
  state.subPhase = 'ct_scenario';
  broadcastState();
  clearAudio();
  io.emit('ct:scenario', { scenario: PHASE1.scenario });
  // Have the Artificial Nurse read the scenario aloud
  speakNarration(PHASE1.scenario, 'ct_scenario');
  startTimer('ct_scenario', TIMERS.ct_scenario, () => advanceCT('ct_q1'));
}

function advanceCT(nextSub) {
  state.subPhase = nextSub;
  broadcastState();
  if (nextSub.startsWith('ct_q')) {
    const qIndex = parseInt(nextSub.slice(-1), 10) - 1;
    const q = PHASE1.questions[qIndex];
    clearAudio();
    io.emit('ct:question', { id: q.id, text: q.text, index: qIndex });
    speakNarration(`Guiding question ${qIndex + 1}. ${q.text}`, `ct_q${qIndex + 1}`);
    startTimer(nextSub, TIMERS[nextSub], () => {
      const nextIdx = qIndex + 1;
      if (nextIdx < PHASE1.questions.length) advanceCT(`ct_q${nextIdx + 1}`);
      else runCTAISummary();
    });
  }
}

async function runCTAISummary() {
  state.subPhase = 'ct_ai_processing';
  broadcastState();
  io.emit('ct:processing', {});

  const allNames = [
    ...state.ct.answers.ct_q1,
    ...state.ct.answers.ct_q2,
    ...state.ct.answers.ct_q3,
  ]
    .map((a) => a.name)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const prompt = `You are the ARTIFICIAL NURSE — a sassy, warm nursing educator analyzing student responses about thermoregulation in older adults.

SCENARIO: ${PHASE1.scenario}

STUDENT RESPONSES (names in brackets are the ONLY names you may reference):
Q1 (${PHASE1.questions[0].text}):
${state.ct.answers.ct_q1.map((a) => `- [${a.name}] ${a.text}`).join('\n') || '(none)'}

Q2 (${PHASE1.questions[1].text}):
${state.ct.answers.ct_q2.map((a) => `- [${a.name}] ${a.text}`).join('\n') || '(none)'}

Q3 (${PHASE1.questions[2].text}):
${state.ct.answers.ct_q3.map((a) => `- [${a.name}] ${a.text}`).join('\n') || '(none)'}

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

Tone: warm, funny, clinical instructor who CARES but will call you out. No emojis. Under 220 words.`;

  // Grade student responses first, then emit summary
  await gradeCTResponses();

  const summary = await callGemini(prompt, PHASE1.fallbackSummary);
  state.ct.aiSummary = summary;
  state.subPhase = 'ct_ai';
  broadcastState();
  clearAudio();
  io.emit('ct:summary', { summary });
  speakNarration(summary, 'ct_summary');
  pushScoresToAllStudents();
  // Wait for click OR audio-finished+grace before showing scoreboard
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
  for (const qid of ['ct_q1', 'ct_q2', 'ct_q3']) {
    const qIdx = parseInt(qid.slice(-1), 10) - 1;
    const qText = PHASE1.questions[qIdx].text;
    for (const r of state.ct.answers[qid]) {
      allItems.push({ qid, qText, name: r.name, text: r.text });
    }
  }
  if (allItems.length === 0) return;

  const numbered = allItems
    .map(
      (it, i) =>
        `${i + 1}. [${it.name}] Q: "${it.qText}"\n   A: "${it.text}"`
    )
    .join('\n');

  const prompt = `You are grading nursing student responses for Chapter 6 (thermoregulation, emancipatory approach in older adults).

GRADING RUBRIC (strict, per response):
- 0: empty, troll, or completely irrelevant
- 1: vague / off-topic / single word
- 2: on-topic but very surface / no clinical detail
- 3: relevant with basic clinical reasoning
- 4: clear clinical reasoning with specifics (age-related change, factor, or intervention named correctly)
- 5: strong clinical reasoning + emancipatory lens (autonomy, social determinants, challenging ageism, collaboration)

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
  broadcastState();
  emitTransitionJoke('Myth vs Fact').finally(() => {
    // Wait for joke audio to finish (or click) before starting MvF statements
    startNarrationWait(() => startMVFStatement(0));
  });
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
  speakNarration(
    `Statement ${index + 1} of ${PHASE2.statements.length}. ${stmt.text}. Myth or fact?`,
    `mvf_statement_${stmt.id}`
  );
  startTimer('mvf_vote', TIMERS.mvf_vote, () => revealMVF(index));
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

  const prompt = `You are Nurse Mike — comedy-roast nursing educator. The class just voted on a myth-vs-fact statement.

STATEMENT: "${stmt.text}"
CORRECT: ${stmt.answer}
RESULTS: ${pctMyth}% said MYTH, ${pctFact}% said FACT (n=${total})
Wrong answer chosen: ${wrongAnswer} by ${wrongCount} students.
Emancipatory angle: ${stmt.emancipatory}

Write a 3-4 sentence spicy-but-warm reaction. REQUIREMENTS:
- If >30% got it wrong, OPEN with a playful ROAST of the wrong-voters (nursing-humor, big-sibling energy, NEVER mean). Example energy: "Y'all trying to retire sexual health at 70? Chapter 6 just sat up in its grave."
- If <=30% wrong, lead with a funny PRAISE of the class.
- Punch in WHY it's actually ${stmt.answer.toLowerCase()} with ONE clinical fact from Chapter 6.
- Close with the emancipatory one-liner.
- No emojis. Be funny — jokes land, not lectures.`;

  const roast = await callGemini(prompt, PHASE2.fallbackRoasts[stmt.id]);
  state.mvf.reveals[stmt.id] = { pctCorrect, roast };
  clearAudio();
  io.emit('mvf:roast', { id: stmt.id, roast });
  speakNarration(roast, `mvf_roast_${stmt.id}`);

  startNarrationWait(() => startMVFStatement(index + 1));
}

async function runMVFFinalSummary() {
  state.subPhase = 'mvf_summary_processing';
  broadcastState();
  io.emit('mvf:processing', {});

  const lines = PHASE2.statements
    .map((s, i) => `${i + 1}. "${s.text}" — ${state.mvf.reveals[s.id]?.pctCorrect ?? 0}% correct`)
    .join('\n');

  const prompt = `You are Nurse Mike wrapping up a 6-statement myth-vs-fact game. Results:
${lines}

Give a warm, funny 4-5 sentence wrap-up that:
1. Names which statement(s) tripped up the class most and makes a quick joke about WHY the ageism is showing
2. Connects patterns to ageism in healthcare
3. Reinforces emancipatory nursing: challenge assumptions, advocate for whole-person care
4. Ends with encouragement + one powerful one-liner. No emojis.`;

  const summary = await callGemini(prompt, PHASE2.fallbackFinal);
  state.mvf.finalSummary = summary;
  state.subPhase = 'mvf_summary';
  broadcastState();
  clearAudio();
  io.emit('mvf:final', { summary });
  speakNarration(summary, 'mvf_final');
  startNarrationWait(() => {
    emitScoreboard('mvf', () => io.emit('mvf:awaiting-next', {}));
  });
}

/* ─── Phase: PRIORITY PYRAMID ───────────────────────────────── */
function enterPriorityPyramid() {
  state.phase = 'PRIORITY_PYRAMID';
  state.subPhase = 'pyramid_intro';
  broadcastState();
  emitTransitionJoke('Priority Pyramid').finally(() => {
    // Wait for joke to finish before opening pyramid setup
    startNarrationWait(() => {
      state.subPhase = 'pyramid_setup';
      broadcastState();
      clearAudio();
      io.emit('pyramid:setup', { interventions: PHASE3.interventions });
      speakNarration(
        "Welcome to the Priority Pyramid. You will now individually rank ten nursing interventions for older adult care from highest to lowest priority. Tap each card on your phone to place it in your pyramid. Number one is the most important. Submit when all ten are placed. There is an emancipatory bonus for those who recognize that sexual health belongs near the top of the pyramid, not buried at the bottom. You'll have four minutes once sorting begins.",
        'pyramid_intro'
      );
      startTimer('pyramid_setup', TIMERS.pyramid_setup, () => {
      state.subPhase = 'pyramid_sort';
      broadcastState();
      io.emit('pyramid:sort', {});
      startTimer('pyramid_sort', TIMERS.pyramid_sort, () => {
        state.subPhase = 'pyramid_display';
        broadcastState();
        io.emit('pyramid:display', {
          submissions: namedSubmissions(),
        });
        startTimer('pyramid_display', TIMERS.pyramid_display, () => runPyramidAI());
      });
    });
  }); // close narrationWait
  });
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
  // Emancipatory bonus: reward placing sexual health (#3, #8) HIGH.
  const rankBonus = { 1: 20, 2: 15, 3: 10, 4: 7, 5: 5 };
  let pts = 0;
  for (const r of ranking) {
    if (r.id === 3 || r.id === 8) pts += rankBonus[r.rank] || 0;
  }
  // Small correctness bonus vs "ideal" ranking for fun
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

  const prompt = `You are the ARTIFICIAL NURSE — a warm, funny, perceptive nursing educator analyzing STUDENT-INDIVIDUAL priority rankings for Chapter 6 on older adult care.

INTERVENTIONS:
${interventionsList}

INDIVIDUAL STUDENT RANKINGS:
${lines}

Write a lively 6-8 sentence consolidated analysis that:
1. Names 1-3 students whose pyramids show strong emancipatory thinking (esp. those who ranked sexual health #3 or #8 high) with playful praise
2. Calls out the pattern IF sexual health landed near the bottom — joke about the ageism sneaking in
3. Notes the most common top priority and bottom priority
4. Ties to Chapter 6: holistic care = ALL systems, including sexuality
5. Reinforces emancipatory nursing: autonomy, challenging bias, social determinants
6. End with: "Emancipatory nursing means questioning our own hierarchy of care — who decided sexual health matters less?"

HARD RULES:
- Only reference these student names: ${submitterNames.length ? submitterNames.join(', ') : '(no submissions — do NOT name-drop anyone)'}
- NEVER use placeholder names like "Taylor", "Jordan", "Sam", "Alex", "Jamie".
- If fewer than the requested number of strong pyramids exist, only name the ones that do.

Tone: nursing-comedy-roast with teeth. No emojis. Under 280 words.`;

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
  io.emit('pyramid:analysis', {
    analysis,
    submissions: namedSubmissions(),
  });
  speakNarration(analysis, 'pyramid_analysis');
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

The class just completed:
- Phase 1: Critical Thinking (hypothermia case, emancipatory analysis)
- Phase 2: Myth vs Fact (10 statements on sexual health, thermoregulation, polypharmacy, atypical presentations, social isolation)
- Phase 3: Priority Pyramid (individual ranking of 10 interventions, sexual-health bias check)

Generate a concise CLOSING SUMMARY (5-6 sentences) that:
1. Names the THREE most important clinical takeaways from Chapter 6 (one each from skin/circulation/respiration, thermoregulation, sex/intimacy)
2. Explicitly names the EMANCIPATORY message: holistic care, autonomy, social determinants, challenging ageism
3. Calls back to Margaret (the case patient) with one specific reminder
4. Closes with one warm, motivating one-liner.

No emojis. Tone: warm, clear, end-of-class energy.`;

  const fallback =
    "Three things to take with you. One: in older adults, atypical IS typical — a 1°C bump above baseline, new confusion, or skipping meals can signal serious illness, so know your patient's baseline. Two: medications and social determinants like income and isolation are clinical issues, not just psychosocial ones — Margaret's hypothermia was as much about her thermostat as her thermoregulation. Three: sexual health and intimacy do not retire — silence on these topics is ageism in scrubs. Emancipatory nursing means we ask, we listen, we collaborate WITH the patient — never around them. Margaret left the ED with a heating-program referral, a med review, and a nurse who took her whole story seriously. That's the standard. Now go practice it.";

  const summary = await callGemini(prompt, fallback, 14000);
  clearAudio();
  io.emit('complete', { final: leaderboard(20), takeaways: summary });
  speakNarration(summary, 'closing_takeaways');
  startNarrationWait(() => {
    /* end of session — no auto-advance, just stay here */
  }, { graceMs: 6000, hardCapMs: 600000 });
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

Answer in 2-4 sentences. Accurate to Chapter 6 content (skin/circulation/respiration/thermoregulation/sex & intimacy in older adults, emancipatory nursing). Clinical where it matters, warm humor throughout. If off-topic, pivot back with a quick joke. No emojis.`;
  const answer = await callGemini(
    prompt,
    "The Artificial Nurse is buffering, but here's the short version: Chapter 6 is about treating the WHOLE older adult — every system, including the uncomfortable ones. Rephrase and I'll go deeper."
  );
  state.chatHistory.push({ q, a: answer, ts: Date.now() });
  if (state.chatHistory.length > 30) state.chatHistory.shift();
  clearAudio();
  io.emit('chat:answer', { question: q, answer });
  speakNarration(answer, 'chat_answer');
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

[n]. To <StudentName>: <your answer in 2-3 sentences — warm, funny, nursing-accurate, grounded in Chapter 6>

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
      if (state.phase === 'LOBBY') enterCriticalThinking();
    });

    socket.on('presenter:next', () => {
      // Click during a narration-wait: that's the "advance now" signal.
      if (narrationWait && !narrationWait.advanced) {
        advanceNarration('presenter-click');
        return;
      }
      // Otherwise: phase-level next (between major phases)
      if (state.phase === 'CRITICAL_THINKING') enterMythVsFact();
      else if (state.phase === 'MYTH_VS_FACT') enterPriorityPyramid();
      else if (state.phase === 'PRIORITY_PYRAMID') enterComplete();
    });

    socket.on('presenter:skip-sub', () => {
      if (narrationWait && !narrationWait.advanced) {
        advanceNarration('presenter-skip');
        return;
      }
      if (state.timer.interval) state.timer.seconds = 1;
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
      stopTimer();
      state.phase = 'LOBBY';
      state.subPhase = null;
      state.ct.answers = { ct_q1: [], ct_q2: [], ct_q3: [] };
      state.ct.submittedBy = { ct_q1: new Set(), ct_q2: new Set(), ct_q3: new Set() };
      state.ct.aiSummary = null;
      state.mvf = { currentIndex: 0, votes: {}, votedBy: {}, reveals: {}, finalSummary: null };
      state.pyramid = { submissions: {}, analysis: null };
      state.chatHistory = [];
      for (const s of Object.values(state.students)) {
        s.scores = { ct: 0, mvf: 0, pyramid: 0, total: 0 };
        s.mvfAnswers = {};
        s.pyramidRanking = null;
      }
      broadcastState();
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
      if (!['ct_q1', 'ct_q2', 'ct_q3'].includes(questionId)) return;
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

    socket.on('student:pyramid-submit', ({ ranking }) => {
      if (state.phase !== 'PRIORITY_PYRAMID') return;
      if (state.subPhase !== 'pyramid_sort') return;
      const cid = state.socketToClient[socket.id];
      const student = state.students[cid];
      if (!student) return;

      if (!Array.isArray(ranking) || ranking.length !== 10) return;
      const ids = new Set(ranking.map((r) => r.id));
      const ranks = new Set(ranking.map((r) => r.rank));
      if (ids.size !== 10 || ranks.size !== 10) return;

      state.pyramid.submissions[cid] = ranking;
      student.pyramidRanking = ranking;

      io.to('presenter').emit('pyramid:submission', {
        by: student.name,
        group: student.group,
        count: Object.keys(state.pyramid.submissions).length,
      });
      socket.emit('student:pyramid-ack', {});
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
