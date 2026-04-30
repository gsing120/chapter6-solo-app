/* ═══════════════════════════════════════════════════════════════
   Chapter 6 Solo App — All Content
   Mapped DIRECTLY to the textbook end-of-chapter prompts:
     Phase 1 = Critical Thinking Q3 (BC heat warnings, at-risk pops)
              implemented as a 12-question one-word quiz with hints
     Phase 2 = Emancipatory Activity 2 (Emily Grayson, skin care)
              implemented as 12 myth-vs-fact statements
     Phase 3 = Emancipatory Activity 3 (Mr. M, heart failure, relational)
              implemented as 10 priority-ranking items in 2 parts
   ═══════════════════════════════════════════════════════════════ */

// ── PHASE 1: Critical Thinking — Textbook CT Q3 ──
// Quiz format: one-word fill-in answers with indirect hints.
// Each question has accepted-answers array (case-insensitive, trimmed).
const PHASE1 = {
  title: 'Heat warnings & at-risk older adults',
  scenario: `It is mid-July in British Columbia. Island Health has issued a heat warning across Vancouver Island as daytime temperatures climb into the high 30s and overnight lows give little relief. The official news release advises the public to drink fluids regularly, take cool showers, find air-conditioned spaces — libraries, malls, community cooling centres — and check on neighbours, family, and friends. The release names higher-risk groups: older adults, people with chronic illness, people experiencing homelessness, and those living alone.

In BC's 2021 heat dome, 619 people died — the majority older adults, most found alone in apartments without air conditioning. Some had received the public advisory and could not act on it; others never saw it at all.

You're now going to take a 12-question quick-fire quiz. Each question has a one-word answer. A hint will help you. Right answers earn 10 points for your group; wrong answers cost 5. Type fast, but type carefully.`,
  quiz: [
    {
      id: 'q1',
      text: "What ONE word names the lethal social risk factor that the heat advisory cannot solve — the thing that killed most of the 619 in BC's 2021 heat dome?",
      hint: "It's about who you don't have around you, not who you do.",
      answers: ['isolation', 'social isolation', 'loneliness'],
      roasts: {
        wrong: "For those of you who didn't get isolation — that's exactly the gap the advisory leaves wide open. Six hundred nineteen people didn't die from heat alone; they died alone in the heat. Isolation is the clinical word for nobody came to check.",
        right: "Yes — isolation. The advisory says check on neighbours for a reason. Closing that gap is upstream nursing.",
      },
    },
    {
      id: 'q2',
      text: "A 1°C rise above an older adult's baseline temperature can signal serious _____.",
      hint: "Pneumonia, UTI, sepsis — older adults often present this way without a full fever.",
      answers: ['infection'],
      roasts: {
        wrong: "For those of you who missed infection — older adults run cool. Their baseline IS the alarm. One degree up means investigate before sepsis is on the chart. Waiting for thirty-eight is waiting too long.",
        right: "Yes — infection. Atypical fever curves, but the bump is real. Know the baseline, catch the early signal.",
      },
    },
    {
      id: 'q3',
      text: "What ONE word describes the lens of nursing care that prioritizes patient autonomy, social determinants, and challenging ageism?",
      hint: "Chapter 6's recurring buzzword — it sets nurses free from paternalistic care.",
      answers: ['emancipatory', 'emancipation'],
      roasts: {
        wrong: "For those of you who didn't get emancipatory — that's the buzzword the chapter is selling. Autonomy. Social determinants. Challenge ageism. Collaborate WITH, not dictate TO.",
        right: "Yes — emancipatory. Chapter Six's whole pitch in one word. Now go practice it.",
      },
    },
    {
      id: 'q4',
      text: "Older adults often present with confusion, fatigue, or anorexia instead of a classic fever or pain. What ONE word describes this kind of presentation?",
      hint: "Not the textbook fever you'd expect. It's the rule, not the exception.",
      answers: ['atypical'],
      roasts: {
        wrong: "For those of you who missed atypical — atypical IS the typical in geriatrics. New confusion, refusing food, sundowning. Investigate first; don't wait for the textbook fever to show up. It usually doesn't.",
        right: "Yes — atypical. The textbook fever doesn't show up in older adults like it does in young patients. Confusion is the new fever.",
      },
    },
    {
      id: 'q5',
      text: "Five-or-more medications dramatically raise fall and adverse-event risk in older adults. What ONE word names this problem?",
      hint: "Greek prefix meaning 'many,' plus the word for medications.",
      answers: ['polypharmacy'],
      roasts: {
        wrong: "For those of you who missed polypharmacy — Greek for many meds. Five or more and the falls multiply like a bad investment. Med review IS your nursing job, not just the pharmacist's.",
        right: "Yes — polypharmacy. Each new prescription is another fall variable. Review, deprescribe, document.",
      },
    },
    {
      id: 'q6',
      text: "A core body temperature BELOW _____ degrees Celsius is considered hypothermia. (Number only.)",
      hint: "Body's lower limit — Margaret-territory.",
      answers: ['35', '35°c', '35c', 'thirty-five', 'thirty five'],
      roasts: {
        wrong: "For those of you who missed thirty-five — that's the hypothermia threshold. Below thirty-five and we're rewarming, not waiting. Older adults cross that line faster than you think.",
        right: "Yes — thirty-five. Below that, we act. No deliberation, no observation, just rewarm.",
      },
    },
    {
      id: 'q7',
      text: "A core body temperature ABOVE _____ degrees Celsius is considered hyperthermia. (Number only.)",
      hint: "Heatstroke threshold — also the answer to life, the universe, and everything, minus two.",
      answers: ['40', '40°c', '40c', 'forty'],
      roasts: {
        wrong: "For those of you who missed forty — heatstroke threshold. Above forty and organ damage starts fast. The 2021 BC heat dome killed at exactly that number.",
        right: "Yes — forty. Above that, organ damage is rapid. Cool, hydrate, escalate.",
      },
    },
    {
      id: 'q8',
      text: "Income, housing, and access to community supports are collectively called the social _____ of health.",
      hint: "What DETERMINES whether someone can act on a heat advisory.",
      answers: ['determinants', 'determinant'],
      roasts: {
        wrong: "For those of you who missed determinants — money, housing, support. They DETERMINE who can act on the heat advisory and who can't. Health doesn't happen in a vacuum; it happens in apartments without AC.",
        right: "Yes — determinants. Income is clinical. Housing is clinical. Isolation is clinical. We work the whole picture.",
      },
    },
    {
      id: 'q9',
      text: "What ONE word names the bias that lets nurses skip sexual-health questions, dismiss complaints, or assume incompetence simply because the patient is older?",
      hint: "Sister of racism and sexism — but discriminates on age.",
      answers: ['ageism'],
      roasts: {
        wrong: "For those of you who missed ageism — sister of racism, sexism. It hides in 'they probably aren't interested' and 'she's just confused.' Spoiler: they are, and she isn't.",
        right: "Yes — ageism. The bias that makes us skip the question we should always ask. Catch it in yourself first.",
      },
    },
    {
      id: 'q10',
      text: "What ONE word describes the older adult's RIGHT to make their own informed decisions about their care — even decisions we disagree with?",
      hint: "Self-rule. The patient is the captain.",
      answers: ['autonomy'],
      roasts: {
        wrong: "For those of you who missed autonomy — patients are the captains. We're the navigators. Even when we disagree, they steer the ship. That's the deal.",
        right: "Yes — autonomy. The patient's call, full stop. We inform; they decide.",
      },
    },
    {
      id: 'q11',
      text: "What ONE word names the COMMUNITY-LEVEL nursing intervention before a heat warning hits — the brief visit or call to assess a vulnerable older adult's preparedness?",
      hint: "Two words become one — see how someone is doing. ('______-in')",
      answers: ['wellness', 'check-in', 'checkin', 'check', 'wellness-check'],
      roasts: {
        wrong: "For those of you who missed wellness check — knock before the heat hits, not after. Proactive community visits are how we close the gap the advisory leaves open.",
        right: "Yes — wellness check. Show up before, not after. That's the nursing footprint that prevents a body count.",
      },
    },
    {
      id: 'q12',
      text: "Older adult skin sensitivity DECREASES with age. The clinical implication: small injuries go _____ until visual self-checks are taught.",
      hint: "The opposite of 'noticed.'",
      answers: ['unnoticed', 'undetected', 'unseen'],
      roasts: {
        wrong: "For those of you who missed unnoticed — older adult skin doesn't tattle the way young skin does. They don't feel it; they need to see it. Teach the visual check on their actual arm.",
        right: "Yes — unnoticed. Demonstrate the ABCDE on Emily's hand, then watch her do it. That's how the skill stays with her.",
      },
    },
  ],
  fallbackSummary:
    "Solid run. The 2021 heat dome killed 619 mostly because of isolation, fixed incomes, fourth-floor walk-ups, and chronic illness — public advisories don't reach the people most at risk of dying from the heat. Emancipatory nursing means we close that gap: wellness-checks before the warning, community networks during it, advocacy for cooling centres and building codes after. Older adults under-mount fevers, present atypically, and risk polypharmacy harm. The chapter's whole message: we don't just treat the body — we treat the person, in their context. Now go practice it.",
};

// ── PHASE 2: Emancipatory Activity — Textbook Activity 2 (Emily Grayson, skin care) ──
const PHASE2 = {
  title: "Emily Grayson — person-centred skin care education",
  emilyContext: `Emily Grayson is 83. She is healthy, active, and an avid gardener — she's outside in her garden three to four hours most days, year-round. Today she's at your community-health appointment for her annual visit. You have been asked to provide health teaching about skin health and aging.

Emily mentions she "doesn't bother with much sunscreen — never has, and look at me, I'm fine." She also says she has noticed a new spot on the back of her hand that "looks a bit different." She lives on a modest pension and asks if there's anything in particular she should be doing.

Twelve statements about HOW you would educate Emily. Vote MYTH (wrong / paternalistic / clinically inaccurate) or FACT (correct / person-centred / evidence-based). +10 for right, -5 for wrong.`,
  statements: [
    {
      id: 'mvf_1',
      text: "An 83-year-old who has gardened her whole life should be told to stop gardening — sun exposure is too risky.",
      answer: 'MYTH',
      emancipatory:
        "Paternalistic. Gardening is meaningful to Emily. Emancipatory practice works WITH her routine — protective clothing, hat, timing, sunscreen — not against it.",
    },
    {
      id: 'mvf_2',
      text: "An older adult's epidermis thins and loses subcutaneous fat with age, increasing fragility, bruising, and tear risk.",
      answer: 'FACT',
      emancipatory:
        "Knowing the why builds trust. Don't lecture — explain the change so Emily can recognize it and decide what to do.",
    },
    {
      id: 'mvf_3',
      text: "Wound healing rates in older skin are about the same as in younger adults — age does not slow healing.",
      answer: 'MYTH',
      emancipatory:
        "Healing IS slower (loss of stem cells, thinner dermis, fewer fibroblasts). Tell Emily so a small cut gets taken seriously, not so she panics.",
    },
    {
      id: 'mvf_4',
      text: "Asking Emily about her current sun-protection routine BEFORE giving advice is best practice.",
      answer: 'FACT',
      emancipatory:
        "Start where she is. Education that ignores what she already does lands as a lecture, not a partnership.",
    },
    {
      id: 'mvf_5',
      text: "Sunscreen alone is sufficient sun protection — wide-brim hat, long sleeves, and timing of outdoor work do not add much.",
      answer: 'MYTH',
      emancipatory:
        "Multimodal protection wins, especially for someone outside 3–4 hours daily. On a fixed income, layered strategies are also more affordable.",
    },
    {
      id: 'mvf_6',
      text: "Teaching Emily the ABCDE skin self-check (Asymmetry, Border, Colour, Diameter, Evolving) and watching her demonstrate it is more empowering than handing her a pamphlet.",
      answer: 'FACT',
      emancipatory:
        "Teach-back transfers ownership. A pamphlet leaves it with the system — the demonstration leaves it with her.",
    },
    {
      id: 'mvf_7',
      text: "Older adults' skin sensitivity INCREASES with age, so they reliably notice small injuries early.",
      answer: 'MYTH',
      emancipatory:
        "Skin sensitivity DECREASES with age. Visual self-checks matter — the body may not signal the injury.",
    },
    {
      id: 'mvf_8',
      text: "Emily mentions she can't always afford the 'nice' sunscreens. Treating her budget constraint as a clinical issue — not just a personal one — is part of the nursing assessment.",
      answer: 'FACT',
      emancipatory:
        "Social determinants ARE clinical determinants. Connecting her to community pharmacy programs or generic-equivalent options is nursing work.",
    },
    {
      id: 'mvf_9',
      text: "Because Emily said the new spot 'looks a bit different,' you can reassure her and revisit it at her next annual visit.",
      answer: 'MYTH',
      emancipatory:
        "Asymmetry, irregular border, colour change, growing diameter, evolving lesion — all warrant prompt dermatology referral. Earlier diagnosis = better outcome.",
    },
    {
      id: 'mvf_10',
      text: "When Emily says 'I'm fine, look at me,' the nurse should acknowledge her experience and her body of evidence — not override it — while still surfacing what age changes mean for her gardening.",
      answer: 'FACT',
      emancipatory:
        'Respecting her self-knowledge is not the same as agreeing she needs nothing. Both can be true. That is relational practice.',
    },
    {
      id: 'mvf_11',
      text: "Adults over 65 are recommended to receive annual flu vaccination plus the pneumococcal vaccine.",
      answer: 'FACT',
      emancipatory:
        "Cough reflex weakens with age, aspiration and pneumonia risk rise. Vaccination is an upstream nursing priority — it's prevention, not just treatment.",
    },
    {
      id: 'mvf_12',
      text: "Skin assessment in older adults should be opportunistic — only when something looks obviously wrong.",
      answer: 'MYTH',
      emancipatory:
        "Routine, head-to-toe skin assessment is core nursing practice in geriatric care. Pressure injuries, skin tears, and early carcinoma all reward systematic looking — not waiting.",
    },
  ],
  // Pre-baked roasts. Each statement gets a "wrong" variant aimed at
  // whichever side voted incorrectly, plus a "right" variant for high
  // pass rate. Server picks based on pctCorrect threshold (~50%).
  // No live AI call. Audio is pre-generated at scripts/pregen-audio.js.
  roasts: {
    mvf_1: {
      wrong: "For those of you who said FACT — you just told an eighty-three-year-old gardener to stop gardening. That's not nursing, that's grief delivery. Emancipatory practice works WITH her life, not against it. Hat, sleeves, timing, sunscreen — yes. Quitting the thing she loves — no.",
      right: "Yes — you don't tell Emily to stop gardening. You work with her routine. Sun protection, not life subtraction.",
    },
    mvf_2: {
      wrong: "For those of you who said MYTH — the epidermis really does thin, collagen really does decrease, subcutaneous fat really does drop. That's why Emily bruises and tears easier. Knowing this helps her see what we see, not panic.",
      right: "Yes — thinning skin, less fat, more fragile. Use the knowledge to inform Emily, not scare her.",
    },
    mvf_3: {
      wrong: "For those of you who said FACT — older skin heals SLOWER, period. Loss of stem cells, fewer fibroblasts, thinner dermis. Knowing this means Emily takes a small cut seriously without spiraling. Informed is not the same as afraid.",
      right: "Yes — older skin heals slower. Tell Emily so she takes a small cut seriously. Informed is not afraid.",
    },
    mvf_4: {
      wrong: "For those of you who said MYTH — going straight to wear SPF fifty before asking what Emily already does turns a partnership into a lecture. Start where she is. That's the whole game.",
      right: "Yes — start where she is. The opening question is more powerful than the closing recommendation.",
    },
    mvf_5: {
      wrong: "For those of you who said FACT — sunscreen ALONE for a four-hour-a-day gardener? You've turned skin protection into a single point of failure. Hat. Sleeves. Timing. Sunscreen. All of it.",
      right: "Yes — multimodal protection. Hat, sleeves, timing, sunscreen. And it's also more affordable on a fixed income.",
    },
    mvf_6: {
      wrong: "For those of you who said MYTH — pamphlets stay in the drawer. Teach-back puts the skill in HER hands. Demonstrate, then watch her demonstrate. That's what transfers ownership.",
      right: "Yes — teach-back wins every time. The skill stays with her, not the system.",
    },
    mvf_7: {
      wrong: "For those of you who said FACT — skin sensitivity DROPS with age, not increases. That's exactly why Emily needs the visual self-check. Her body may not tell her something happened. Her eyes have to.",
      right: "Yes — sensitivity decreases. Visual self-checks compensate for what the nerves don't catch.",
    },
    mvf_8: {
      wrong: "For those of you who said MYTH — money is a clinical determinant of skin health. The minute we ignore it, we're treating the patient on paper, not the one in front of us. Generic equivalents, community pharmacy programs — that's nursing work too.",
      right: "Yes — budget is clinical. Connect Emily to community pharmacy programs. That's nursing, not social work.",
    },
    mvf_9: {
      wrong: "For those of you who said FACT — reassure-and-revisit is how late-stage skin cancer happens. New, different, evolving spot equals referral. Today. Not next April.",
      right: "Yes — refer today. An ABCDE evolving spot doesn't wait for the next annual.",
    },
    mvf_10: {
      wrong: "For those of you who said MYTH — I'm fine, look at me deserves respect. So does the new mole on her hand. Emancipatory practice holds BOTH. Her experience AND the clinical reality.",
      right: "Yes — hold both. Her self-knowledge and the new spot. Both can be true.",
    },
    mvf_11: {
      wrong: "For those of you who said MYTH — vaccinations aren't optional add-ons in geriatric care. Cough reflex is weaker, aspiration is real. Flu and pneumococcal are core prevention.",
      right: "Yes — flu and pneumococcal are core. Cough reflex doesn't get stronger with time.",
    },
    mvf_12: {
      wrong: "For those of you who said FACT — opportunistic skin assessment is how stage four pressure injuries happen. Routine, head-to-toe is the standard. If you can't see it, you can't stage it.",
      right: "Yes — systematic, head-to-toe. Pressure injuries don't announce themselves.",
    },
  },
  fallbackFinal:
    "Three patterns to take away. Anywhere paternalism crept in — telling Emily to stop gardening, ignoring her budget, dismissing the new spot, lecturing instead of asking — that's where ageism wears scrubs. Emancipatory skin-care education starts with what she already does, names age changes without alarm, teaches the ABCDE check on HER skin, and treats her financial reality as a clinical concern. You're not protecting Emily from her life — you're partnering with her in it.",
};

// ── PHASE 3: Emancipatory Activity — Textbook Activity 3 (Mr. M, heart failure, relational practice) ──
// Items 1–5 (Part A) = relational / contextual / "who is Mr. M"
// Items 6–10 (Part B) = clinical / structural / "what's happening to him"
const PHASE3 = {
  title: 'Mr. M — initial encounter, relational practice',
  mrMContext: `Mr. M is 70. He has heart failure. He is struggling — fatigue, shortness of breath, edema have crept in over the last six months, and he is unable to do many of the activities he loves. This is your INITIAL ENCOUNTER. He is sitting across from you and you have one appointment to begin a relationship that will carry his care.

You will rank ten things you might want to know about Mr. M, in two parts. PART 1 = 5 RELATIONAL priorities — who he is, what matters. PART 2 = 5 CLINICAL priorities — disease, meds, symptoms, function, history. Both matter. Their ORDER tells the story. Wrong placement (more than 2 ranks off ideal) deducts 5 points.`,
  interventions: [
    // Part A: relational / contextual (ids 1-5)
    { id: 1, text: 'His goals — what HE wants from his care, his life, this conversation' },
    { id: 2, text: "His values, beliefs, and what gives his life meaning" },
    { id: 3, text: "His own words for his diagnosis — how HE understands and experiences it" },
    { id: 4, text: 'The activities he misses most and why those activities matter to him' },
    { id: 5, text: 'His social support network — who lives with him, close relationships, who would notice if he was off' },
    // Part B: clinical / structural (ids 6-10)
    { id: 6, text: 'Current cardiac symptoms — orthopnea, fatigue, edema, dyspnea on exertion' },
    { id: 7, text: 'Current cardiac medications and how he manages adherence day-to-day' },
    { id: 8, text: 'Activity tolerance and functional status — walking distance, stairs, ADLs' },
    { id: 9, text: 'Detailed cardiac history — ejection fraction, recent admissions, comorbidities' },
    { id: 10, text: 'Financial situation, insurance coverage, access to medications and follow-up care' },
  ],
  fallbackAnalysis:
    "Strong patterns to call out. Anyone who put 'his goals' (#1) or 'his own words for his diagnosis' (#3) at the top of Part 1 is doing exactly what the chapter asks of us — building care AROUND the person, not around the diagnosis. The single most common mistake in initial encounters is jumping straight to symptoms, meds, and EF — the clinical script — and forgetting that the man across from us is more than his ejection fraction. Emancipatory nursing means knowing the WHOLE person — Mr. M's heart failure is treated; Mr. M is collaborated WITH.",
};

/* ─── Pre-baked transition jokes (no live Gemini call) ─────── */
// Pre-recorded audio in public/audio/preloaded/joke_*.wav.
const TRANSITION_JOKES = {
  ct_to_mvf:
    "From freezing apartments to sun-baked gardens. Whoever drew the chapter assigning thermoregulation AND skin AND sex AND respiration on the same week — we'll be having a word.",
  mvf_to_pyramid:
    "Emily wraps up her ABCDE check, you wrap up the ageism, and we walk into Mr. M's living room. He's got more meds than tablemates. Let's prioritize.",
  pyramid_to_complete:
    "Mr. M is collaborated with, Emily is empowered, the heat dome is closing — that's three older adults whose stories we just took seriously. Class dismissed.",
};

module.exports = { PHASE1, PHASE2, PHASE3, TRANSITION_JOKES };
