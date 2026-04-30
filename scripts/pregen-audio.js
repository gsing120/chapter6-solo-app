/* ═══════════════════════════════════════════════════════════════
   Pre-generate Gemini TTS WAV files for every pre-baked roast variant
   and transition joke. Produces public/audio/preloaded/*.wav so the
   live class never waits on TTS for per-question reveals.
   Run: node scripts/pregen-audio.js [--force]
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { PHASE1, PHASE2, TRANSITION_JOKES } = require('../data/content');

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const VOICE = process.env.GEMINI_TTS_VOICE || 'Algieba';
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'preloaded');
const FORCE = process.argv.includes('--force');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not set in .env');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

async function genTTS(text, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      });
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const inline = part?.inlineData;
      if (!inline?.data) throw new Error('no audio in response');
      const rateMatch = /rate=(\d+)/.exec(inline.mimeType || '');
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const pcm = Buffer.from(inline.data, 'base64');
      return pcmToWav(pcm, sampleRate, 1, 16);
    } catch (err) {
      console.warn(`  retry ${attempt + 1}/${retries}: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

// Build the full job list
const jobs = [];

// MvF roasts: per-statement × {wrong, right}
for (const [id, variants] of Object.entries(PHASE2.roasts || {})) {
  jobs.push({ key: `${id}_wrong`, text: variants.wrong, label: `MvF ${id} wrong` });
  jobs.push({ key: `${id}_right`, text: variants.right, label: `MvF ${id} right` });
}

// CT quiz roasts: per-question × {wrong, right}
for (const q of PHASE1.quiz) {
  if (!q.roasts) continue;
  jobs.push({ key: `${q.id}_wrong`, text: q.roasts.wrong, label: `CT ${q.id} wrong` });
  jobs.push({ key: `${q.id}_right`, text: q.roasts.right, label: `CT ${q.id} right` });
}

// Transition jokes
for (const [key, text] of Object.entries(TRANSITION_JOKES)) {
  jobs.push({ key: `joke_${key}`, text, label: `joke ${key}` });
}

console.log(`📋 ${jobs.length} audio files to generate`);
console.log(`📁 output dir: ${OUT_DIR}`);
console.log(`🎤 voice: ${VOICE} · model: ${TTS_MODEL}`);
console.log('');

let done = 0;
let skipped = 0;
let failed = 0;
let totalBytes = 0;
const startedAt = Date.now();

(async () => {
  for (const job of jobs) {
    const outPath = path.join(OUT_DIR, `${job.key}.wav`);
    if (!FORCE && fs.existsSync(outPath)) {
      const size = fs.statSync(outPath).size;
      console.log(`⏭  ${job.key}.wav already exists (${(size / 1024).toFixed(0)}KB) — skipping`);
      skipped++;
      totalBytes += size;
      continue;
    }
    try {
      process.stdout.write(`🔊 ${job.label} … `);
      const wav = await genTTS(job.text);
      fs.writeFileSync(outPath, wav);
      const kb = (wav.length / 1024).toFixed(0);
      console.log(`${kb}KB`);
      done++;
      totalBytes += wav.length;
    } catch (err) {
      console.error(`✗ ${job.label}: ${err.message}`);
      failed++;
    }
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log('');
  console.log(`══════════════════════════════════════════════════`);
  console.log(`Done in ${elapsed}s. Generated: ${done} · Skipped: ${skipped} · Failed: ${failed}`);
  console.log(`Total audio: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`══════════════════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
})();
