/* ═══════════════════════════════════════════════════════════════
   Chapter 6 Solo App — End-to-end stress test harness
   Spawns the server, connects presenter + 30 students, exercises
   every button, every flow, every edge case. Real Gemini API.
   Run: node test/stress.js
   ═══════════════════════════════════════════════════════════════ */

const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');
const { PHASE1, PHASE2, PHASE3 } = require('../data/content');

const PORT = 3998;
const HOST = `http://localhost:${PORT}`;
const NUM_STUDENTS = 30; // stress concurrency
const VERBOSE = process.env.VERBOSE === '1';

const log = (...a) => console.log('[test]', ...a);
const vlog = (...a) => { if (VERBOSE) console.log('[v]', ...a); };

/* ─── Helpers ──────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function presenterClient() {
  return io(HOST, { query: { role: 'presenter' }, reconnection: false });
}

function studentClient(name, group) {
  const cid = `cid_test_${name}_${Math.random().toString(36).slice(2, 8)}`;
  const sock = io(HOST, { query: { role: 'student' }, reconnection: false });
  sock._cid = cid;
  sock._name = name;
  sock._group = group;
  sock._lastState = null;
  // Auto-track latest state so late-join tests don't race the listener
  sock.on('state:update', (s) => { sock._lastState = s; });
  sock._joined = new Promise((resolve) => {
    sock.once('student:joined', resolve);
  });
  sock.on('connect', () => {
    sock.emit('student:join', { clientId: cid, name, group });
  });
  return sock;
}

function waitFor(sock, event, timeoutMs = 8000, predicate) {
  return new Promise((resolve, reject) => {
    const handler = (data) => {
      if (predicate && !predicate(data)) return; // keep waiting
      sock.off(event, handler);
      clearTimeout(timer);
      resolve(data);
    };
    const timer = setTimeout(() => {
      sock.off(event, handler);
      reject(new Error(`timeout waiting for "${event}"`));
    }, timeoutMs);
    sock.on(event, handler);
  });
}

/* ─── Test runner ──────────────────────────────────────────── */
const results = [];
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    log(`✓ ${name} (${ms}ms)`);
    results.push({ name, pass: true, ms });
  } catch (err) {
    log(`✗ ${name} — ${err.message}`);
    results.push({ name, pass: false, err: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ─── Server lifecycle ─────────────────────────────────────── */
let serverProc;
async function startServer() {
  log(`spawning server on :${PORT}`);
  serverProc = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stdout.on('data', (d) => vlog('[srv]', d.toString().trim()));
  serverProc.stderr.on('data', (d) => log('[srv-err]', d.toString().trim()));
  // wait for listen
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    try {
      const res = await fetch(`${HOST}/healthz`);
      if (res.ok) { log('server up'); return; }
    } catch {}
  }
  throw new Error('server did not start');
}

async function stopServer() {
  if (!serverProc) return;
  log('killing server');
  serverProc.kill('SIGTERM');
  await sleep(300);
  if (!serverProc.killed) serverProc.kill('SIGKILL');
}

/* ─── State capture ────────────────────────────────────────── */
function captureState(sock) {
  const captured = {
    state: null,
    groupScores: null,
    scoreboard: null,
    audioPlays: 0,
    audioClears: 0,
    audioEnabled: null,
  };
  sock.on('state:update', (s) => { captured.state = s; });
  sock.on('group:scores', (s) => { captured.groupScores = s; });
  sock.on('scoreboard', (s) => { captured.scoreboard = s; });
  sock.on('audio:play', () => { captured.audioPlays++; });
  sock.on('audio:clear', () => { captured.audioClears++; });
  sock.on('audio:enabled', ({ enabled }) => { captured.audioEnabled = enabled; });
  return captured;
}

/* ─── Find correct/wrong answer for a question ─────────────── */
function correctAnswerFor(quizQ) {
  return quizQ.answers[0];
}
function wrongAnswerFor(quizQ) {
  // use a deliberately wrong word
  return 'definitelywrongplaceholder';
}

/* ─── Main test sequence ───────────────────────────────────── */
async function main() {
  await startServer();

  // -------- Lobby --------
  let presenter, students;
  await check('Lobby: presenter connects', async () => {
    presenter = presenterClient();
    await waitFor(presenter, 'state:update', 5000);
  });

  // Persistent presenter capture for race-prone tests
  let pCap;
  await check('Lobby: 30 students join with mixed groups', async () => {
    students = [];
    // 10 groups of 3
    for (let g = 1; g <= 10; g++) {
      for (let s = 1; s <= 3; s++) {
        const name = `Stu${g}${s}`;
        const group = `Table${g}`;
        students.push(studentClient(name, group));
      }
    }
    await Promise.all(students.map((s) => s._joined));
    // Persistent capture so we can read latest group:scores etc. anytime
    pCap = captureState(presenter);
    await sleep(200);
  });

  await check('Lobby: presenter sees all 30 + 10 groups', async () => {
    // Trigger a fresh state push by hitting /api/state via HTTP (deterministic)
    const resp = await fetch(`${HOST}/api/state`);
    const s = await resp.json();
    assert(s.studentCount === 30, `expected 30 students, got ${s.studentCount}`);
    const groupCount = Object.keys(s.groups).length;
    assert(groupCount === 10, `expected 10 groups, got ${groupCount}`);
  });

  // -------- Phase 1: CT scenario + quiz --------
  let presenterCap;
  await check('Start: presenter:start triggers CT scenario', async () => {
    presenterCap = captureState(presenter);
    presenter.emit('presenter:start');
    const sc = await waitFor(students[0], 'ct:scenario', 8000);
    assert(sc.scenario && sc.scenario.length > 100, 'scenario missing or too short');
  });

  await check('Phase 1: presenter:next advances to first quiz Q', async () => {
    await sleep(500);
    presenter.emit('presenter:next');
    const q = await waitFor(students[0], 'ct:question', 8000);
    assert(q.id === 'q1', `expected q1, got ${q.id}`);
    assert(q.hint && q.hint.length > 5, 'hint missing');
    assert(q.total === 12, `expected total=12, got ${q.total}`);
  });

  await check('Phase 1: 30 concurrent submissions on Q1 (mix correct/wrong)', async () => {
    const q = PHASE1.quiz[0];
    const correct = correctAnswerFor(q);
    const wrong = wrongAnswerFor(q);
    // 20 correct, 10 wrong
    const promises = students.map((s, i) => {
      const ans = i < 20 ? correct : wrong;
      return new Promise((resolve) => {
        s.once('student:ct-ack', resolve);
        s.emit('student:ct-answer', { questionId: q.id, answer: ans });
      });
    });
    await Promise.all(promises);
  });

  await check('Phase 1: presenter:skip-sub triggers reveal', async () => {
    presenter.emit('presenter:skip-sub');
    const reveal = await waitFor(students[0], 'ct:reveal', 15000);
    assert(reveal.correctAnswer, 'no correct answer in reveal');
    assert(reveal.totalSubmissions === 30, `expected 30 submissions, got ${reveal.totalSubmissions}`);
    assert(reveal.correctCount === 20, `expected 20 correct, got ${reveal.correctCount}`);
    assert(reveal.pctCorrect === 67, `expected 67%, got ${reveal.pctCorrect}%`);
    assert(reveal.roast && reveal.roast.length > 0, 'no roast');
  });

  await check('Phase 1: scoring +10/-5 applied (group sum check)', async () => {
    // 20 correct × +10 = 200; 10 wrong × -5 = -50; net group total = 150.
    // broadcastGroupScores is throttled 200ms; wait for the next emit.
    await sleep(350);
    const latest = pCap.groupScores ? pCap.groupScores.groups : null;
    if (!latest) throw new Error('no group:scores received yet');
    const total = latest.reduce((sum, g) => sum + (g.total || 0), 0);
    assert(total === 150, `expected total 150, got ${total}. Groups: ${latest.map((g) => `${g.group}=${g.total}`).join(',')}`);
  });

  await check('Phase 1: presenter:next advances reveal → next question', async () => {
    presenter.emit('presenter:next'); // advance through narration wait
    const q2 = await waitFor(students[0], 'ct:question', 30000, (q) => q.id === 'q2');
    assert(q2.id === 'q2', `expected q2, got ${q2.id}`);
  });

  await check('Phase 1: End Phase jumps directly to summary', async () => {
    presenter.emit('presenter:end-phase');
    // Now we should land in ct_ai_processing then ct_ai
    const summary = await waitFor(students[0], 'ct:summary', 30000);
    assert(summary.summary && summary.summary.length > 50, 'no summary text');
  });

  await check('Phase 1: presenter:next advances summary → group scoreboard', async () => {
    presenter.emit('presenter:next');
    const sb = await waitFor(presenter, 'scoreboard', 30000, (d) => d.phaseKey === 'ct');
    assert(Array.isArray(sb.groups), 'no groups array');
    assert(sb.groups.length > 0, 'no groups in scoreboard');
    assert(sb.praise && sb.praise.length > 0, 'no praise');
    // No name-drops check — praise should not contain real student names
    for (const stu of students) {
      assert(!sb.praise.includes(stu._name), `praise mentions student name: ${stu._name}`);
    }
  });

  // -------- Phase 2: MvF --------
  await check('Phase 2: scoreboard advance → joke (auto-transition to MvF)', async () => {
    presenter.emit('presenter:next');
    await waitFor(students[0], 'joke', 30000);
  });

  await check('Phase 2: joke → Emily context', async () => {
    presenter.emit('presenter:next');
    const ctx = await waitFor(students[0], 'mvf:context', 30000);
    assert(ctx.context && ctx.context.includes('Emily'), 'context missing Emily');
  });

  await check('Phase 2: first MvF statement appears', async () => {
    presenter.emit('presenter:next');
    const stmt = await waitFor(students[0], 'mvf:statement', 30000);
    assert(stmt.id === 'mvf_1', `expected mvf_1, got ${stmt.id}`);
    assert(stmt.total === 12, `expected total=12, got ${stmt.total}`);
  });

  await check('Phase 2: 30 concurrent votes (mix MYTH/FACT)', async () => {
    const stmt = PHASE2.statements[0];
    const correct = stmt.answer; // MYTH for #1
    const wrong = correct === 'MYTH' ? 'FACT' : 'MYTH';
    const promises = students.map((s, i) => {
      const v = i < 18 ? correct : wrong;
      return new Promise((resolve) => {
        s.once('student:mvf-ack', resolve);
        s.emit('student:mvf-vote', { statementId: stmt.id, vote: v });
      });
    });
    await Promise.all(promises);
  });

  await check('Phase 2: skip → reveal + roast', async () => {
    // Both events fire in tight succession with pre-baked roasts.
    // Register both listeners BEFORE triggering to avoid the race.
    const revealP = waitFor(students[0], 'mvf:reveal', 15000);
    const roastP = waitFor(students[0], 'mvf:roast', 15000);
    presenter.emit('presenter:skip-sub');
    const reveal = await revealP;
    assert(reveal.correct === PHASE2.statements[0].answer, 'wrong correct field');
    assert(reveal.total === 30, `expected total=30, got ${reveal.total}`);
    assert(reveal.pctCorrect === 60, `expected pctCorrect=60, got ${reveal.pctCorrect}`);
    const roast = await roastP;
    assert(roast.roast && roast.roast.length > 0, 'no roast');
  });

  await check('Phase 2: End Phase jumps to final summary', async () => {
    presenter.emit('presenter:end-phase');
    const final = await waitFor(students[0], 'mvf:final', 30000);
    assert(final.summary && final.summary.length > 50, 'no final summary');
  });

  await check('Phase 2: next → group scoreboard for MvF', async () => {
    presenter.emit('presenter:next');
    const sb = await waitFor(presenter, 'scoreboard', 30000, (d) => d.phaseKey === 'mvf');
    assert(sb.groups && sb.groups.length > 0, 'no groups');
  });

  // -------- Phase 3: Pyramid --------
  await check('Phase 3: scoreboard advance → joke (auto-transition to Pyramid)', async () => {
    presenter.emit('presenter:next');
    await waitFor(students[0], 'joke', 30000);
  });

  await check('Phase 3: joke → Mr. M context', async () => {
    presenter.emit('presenter:next');
    const ctx = await waitFor(students[0], 'pyramid:context', 30000);
    assert(ctx.context && ctx.context.includes('Mr. M'), 'context missing Mr. M');
  });

  await check('Phase 3: setup Part A appears', async () => {
    presenter.emit('presenter:next');
    const setup = await waitFor(students[0], 'pyramid:setup', 30000);
    assert(setup.half === 'A', `expected half A, got ${setup.half}`);
    assert(setup.interventions.length === 5, `expected 5 items in A, got ${setup.interventions.length}`);
  });

  await check('Phase 3: skip to sort A', async () => {
    presenter.emit('presenter:skip-sub');
    await waitFor(students[0], 'pyramid:sort', 5000);
  });

  await check('Phase 3: 30 students submit Part A ranking', async () => {
    // submit a "good" ranking: relational items 1-3 at top
    const rankingA = [
      { id: 1, rank: 1 },
      { id: 3, rank: 2 },
      { id: 2, rank: 3 },
      { id: 4, rank: 4 },
      { id: 5, rank: 5 },
    ];
    const promises = students.map((s) =>
      new Promise((resolve) => {
        s.once('student:pyramid-ack', resolve);
        s.emit('student:pyramid-submit', { half: 'A', ranking: rankingA });
      })
    );
    await Promise.all(promises);
  });

  await check('Phase 3: skip A display → setup B', async () => {
    presenter.emit('presenter:skip-sub'); // sort_a → display_a
    await sleep(300);
    presenter.emit('presenter:skip-sub'); // display_a (pendingAdvance) → setup_b
    await waitFor(students[0], 'pyramid:setup', 30000, (d) => d.half === 'B');
  });

  await check('Phase 3: 30 students submit Part B ranking', async () => {
    presenter.emit('presenter:skip-sub'); // setup_b → sort_b
    await sleep(300);
    const rankingB = [
      { id: 6, rank: 1 },
      { id: 7, rank: 2 },
      { id: 8, rank: 3 },
      { id: 9, rank: 4 },
      { id: 10, rank: 5 },
    ];
    const promises = students.map((s) =>
      new Promise((resolve) => {
        s.once('student:pyramid-ack', resolve);
        s.emit('student:pyramid-submit', { half: 'B', ranking: rankingB });
      })
    );
    await Promise.all(promises);
  });

  await check('Phase 3: skip → AI analysis runs', async () => {
    presenter.emit('presenter:skip-sub'); // sort_b → display_b
    await sleep(300);
    presenter.emit('presenter:skip-sub'); // display_b → ai_processing
    const analysis = await waitFor(students[0], 'pyramid:analysis', 30000);
    assert(analysis.analysis && analysis.analysis.length > 50, 'no analysis');
  });

  await check('Phase 3: presenter:next → group scoreboard', async () => {
    presenter.emit('presenter:next');
    const sb = await waitFor(presenter, 'scoreboard', 30000, (d) => d.phaseKey === 'pyramid');
    assert(sb.groups && sb.groups.length > 0, 'no groups in pyramid scoreboard');
  });

  // -------- Audio toggle --------
  await check('Audio: toggle off suppresses audio:play emissions', async () => {
    // 1) Disable audio first; clearAudio() server-side stops any in-flight
    //    chunks from the previous phase's scoreboard narration.
    presenter.emit('presenter:audio-enable', { enabled: false });
    // 2) Drain pending audio:play events from prior narration before we
    //    start counting. 1.5s buffer covers the longest in-flight TTS chunk.
    await sleep(1500);
    let audioPlayed = false;
    const onPlay = () => { audioPlayed = true; };
    students[0].on('audio:play', onPlay);
    // 3) Trigger fresh narration that should NOT produce audio
    presenter.emit('presenter:joke');
    await waitFor(students[0], 'joke', 30000);
    // 4) Give Gemini-call latency time to NOT produce audio
    await sleep(3000);
    students[0].off('audio:play', onPlay);
    assert(!audioPlayed, 'audio:play emitted while audio disabled');
    // restore
    presenter.emit('presenter:audio-enable', { enabled: true });
    await sleep(200);
  });

  await check('Audio: stop button clears playback', async () => {
    let cleared = false;
    students[0].on('audio:clear', () => { cleared = true; });
    presenter.emit('presenter:audio-stop');
    await sleep(200);
    assert(cleared, 'audio:clear not received');
  });

  // -------- Voice change --------
  await check('Voice: presenter:set-voice changes voice + emits sample', async () => {
    presenter.emit('presenter:audio-enable', { enabled: true });
    await sleep(200);
    presenter.emit('presenter:set-voice', { voice: 'Charon' });
    const evt = await waitFor(presenter, 'voice:changed', 5000);
    assert(evt.voice === 'Charon', `expected Charon, got ${evt.voice}`);
  });

  // -------- Complete --------
  await check('Complete: pyramid scoreboard advance → finalGroups + takeaways', async () => {
    // Single click on pyramid scoreboard now flows directly to enterComplete
    presenter.emit('presenter:next');
    const c = await waitFor(presenter, 'complete', 60000);
    assert(c.finalGroups && c.finalGroups.length > 0, 'no finalGroups');
    assert(c.takeaways && c.takeaways.length > 50, 'no takeaways');
    // No name-drops in takeaways
    for (const stu of students.slice(0, 5)) {
      assert(!c.takeaways.includes(stu._name), `takeaways mentions ${stu._name}`);
    }
  });

  // -------- Reset --------
  await check('Reset: presenter:reset clears scores and returns to LOBBY', async () => {
    presenter.emit('presenter:reset');
    await sleep(500);
    const cap = captureState(presenter);
    await sleep(500);
    if (!cap.state || cap.state.phase !== 'LOBBY') {
      // Trigger a state push
      presenter.emit('presenter:add-time', { seconds: 0 });
      await sleep(300);
    }
    // Get fresh state via http
    const resp = await fetch(`${HOST}/api/state`);
    const s = await resp.json();
    assert(s.phase === 'LOBBY', `expected LOBBY, got ${s.phase}`);
    assert(s.audioEnabled === true, 'audioEnabled not reset');
    assert(s.sessionStartedAt === null, 'sessionStartedAt not reset');
    assert(s.phaseStartedAt === null, 'phaseStartedAt not reset');
  });

  // -------- Edge cases --------
  await check('Edge: duplicate CT submission rejected', async () => {
    presenter.emit('presenter:start');
    await waitFor(students[0], 'ct:scenario', 30000);
    presenter.emit('presenter:next');
    await waitFor(students[0], 'ct:question', 30000);
    const q = PHASE1.quiz[0];
    students[0].emit('student:ct-answer', { questionId: q.id, answer: q.answers[0] });
    await waitFor(students[0], 'student:ct-ack', 5000);
    let secondAck = false;
    students[0].once('student:ct-ack', () => { secondAck = true; });
    students[0].emit('student:ct-answer', { questionId: q.id, answer: 'wrongduplicate' });
    await sleep(800);
    assert(!secondAck, 'second ack received — duplicate not rejected');
  });

  await check('Edge: empty answer rejected (no ack)', async () => {
    let acked = false;
    students[1].once('student:ct-ack', () => { acked = true; });
    students[1].emit('student:ct-answer', { questionId: PHASE1.quiz[0].id, answer: '   ' });
    await sleep(500);
    assert(!acked, 'empty answer was acked');
  });

  await check('Edge: answer to wrong question id rejected', async () => {
    let acked = false;
    students[2].once('student:ct-ack', () => { acked = true; });
    students[2].emit('student:ct-answer', { questionId: 'nonexistent_q', answer: 'foo' });
    await sleep(500);
    assert(!acked, 'wrong-id answer was acked');
  });

  await check('Edge: late join during CT receives state', async () => {
    const late = studentClient('LateLarry', 'TableLate');
    await late._joined;
    // Listener registered at client construction now auto-captures state
    await sleep(300);
    assert(late._lastState, 'late joiner did not receive state');
    assert(late._lastState.phase === 'CRITICAL_THINKING', `expected CT, got ${late._lastState.phase}`);
    late.disconnect();
  });

  // Cleanup
  await check('Cleanup: disconnect all', async () => {
    for (const s of students) s.disconnect();
    presenter.disconnect();
    await sleep(300);
  });

  // Final report
  console.log('\n══════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`RESULT: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.err}`);
    });
  }
  console.log('══════════════════════════════════════════════════════════');

  await stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  log('FATAL:', err.message);
  console.error(err);
  await stopServer();
  process.exit(1);
});
