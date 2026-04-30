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
        wrong: "Oh sweet summer nurses — whatever you typed, it wasn't isolation. Six hundred nineteen people didn't die from the heat. They died alone, in the heat, while a public service announcement looped on the radio nobody heard. Isolation is the clinical word for nobody came to check, and if you missed it, you ARE the nobody.",
        right: "Yes — isolation. The advisory says check on neighbours for a reason. Closing that gap is upstream nursing.",
      },
    },
    {
      id: 'q2',
      text: "A 1°C rise above an older adult's baseline temperature can signal serious _____.",
      hint: "Pneumonia, UTI, sepsis — older adults often present this way without a full fever.",
      answers: ['infection'],
      roasts: {
        wrong: "For those of you who didn't type infection — congratulations, you're now waiting for thirty-eight degrees while your patient quietly goes septic in bed four. Older adults run cool. Their baseline IS the alarm. One degree up is the whole party invitation. Don't ghost it.",
        right: "Yes — infection. Atypical fever curves, but the bump is real. Know the baseline, catch the early signal.",
      },
    },
    {
      id: 'q3',
      text: "What ONE word describes the lens of nursing care that prioritizes patient autonomy, social determinants, and challenging ageism?",
      hint: "Chapter 6's recurring buzzword — it sets nurses free from paternalistic care.",
      answers: ['emancipatory', 'emancipation'],
      roasts: {
        wrong: "Whatever you guessed there — no. The word is emancipatory. It's printed in the chapter title in fonts the size of a small dog. Autonomy. Social determinants. Challenge ageism. Collaborate WITH, not dictate TO. Read like your group's points depend on it, because they actively do.",
        right: "Yes — emancipatory. Chapter Six's whole pitch in one word. Now go practice it.",
      },
    },
    {
      id: 'q4',
      text: "Older adults often present with confusion, fatigue, or anorexia instead of a classic fever or pain. What ONE word describes this kind of presentation?",
      hint: "Not the textbook fever you'd expect. It's the rule, not the exception.",
      answers: ['atypical'],
      roasts: {
        wrong: "For those of you who missed atypical — geriatrics doesn't read your textbook. New confusion, refusing food, sundowning at three p.m. — THAT'S the fever in older adults. Wait for the classic presentation and you'll be charting it post-mortem. Atypical IS the typical. Write it on your hand.",
        right: "Yes — atypical. The textbook fever doesn't show up in older adults like it does in young patients. Confusion is the new fever.",
      },
    },
    {
      id: 'q5',
      text: "Five-or-more medications dramatically raise fall and adverse-event risk in older adults. What ONE word names this problem?",
      hint: "Greek prefix meaning 'many,' plus the word for medications.",
      answers: ['polypharmacy'],
      roasts: {
        wrong: "Whatever you typed — wasn't polypharmacy. It's Greek for too many meds and a fall risk that does math. Five drugs, ten side effects, twenty interactions, one trip to the floor. Med review is YOUR job, not a vibe the pharmacist gets to in a year.",
        right: "Yes — polypharmacy. Each new prescription is another fall variable. Review, deprescribe, document.",
      },
    },
    {
      id: 'q6',
      text: "A core body temperature BELOW _____ degrees Celsius is considered hypothermia. (Number only.)",
      hint: "Body's lower limit — Margaret-territory.",
      answers: ['35', '35°c', '35c', 'thirty-five', 'thirty five'],
      roasts: {
        wrong: "For those of you who didn't type thirty-five — your patient is currently turning blue while you debate. Below thirty-five we don't observe, we don't sip and ponder, we rewarm. Older adults cross that line faster than your group's running total just dropped.",
        right: "Yes — thirty-five. Below that, we act. No deliberation, no observation, just rewarm.",
      },
    },
    {
      id: 'q7',
      text: "A core body temperature ABOVE _____ degrees Celsius is considered hyperthermia. (Number only.)",
      hint: "Heatstroke threshold — also the answer to life, the universe, and everything, minus two.",
      answers: ['40', '40°c', '40c', 'forty'],
      roasts: {
        wrong: "Whatever number you put in — it wasn't forty, and forty is exactly where the kidneys file their resignation letter. Above forty, organ damage doesn't waltz, it sprints. The BC heat dome killed at that number while people were waiting for someone else to act. Don't be the someone else.",
        right: "Yes — forty. Above that, organ damage is rapid. Cool, hydrate, escalate.",
      },
    },
    {
      id: 'q8',
      text: "Income, housing, and access to community supports are collectively called the social _____ of health.",
      hint: "What DETERMINES whether someone can act on a heat advisory.",
      answers: ['determinants', 'determinant'],
      roasts: {
        wrong: "For those of you who didn't type determinants — health does NOT happen in a vacuum. It happens in a fourth-floor walk-up with no AC, on a fixed pension, with no ride to the cooling centre. Income is clinical. Housing is clinical. If you ignore the determinants, you're not nursing — you're just journaling.",
        right: "Yes — determinants. Income is clinical. Housing is clinical. Isolation is clinical. We work the whole picture.",
      },
    },
    {
      id: 'q9',
      text: "What ONE word names the bias that lets nurses skip sexual-health questions, dismiss complaints, or assume incompetence simply because the patient is older?",
      hint: "Sister of racism and sexism — but discriminates on age.",
      answers: ['ageism'],
      roasts: {
        wrong: "Whatever you typed there — wasn't ageism. The unloved sibling of racism and sexism. It hides in oh she's just confused and they probably aren't interested. Spoiler: she isn't, and they are. If you missed this word, you ARE the bias. Catch it in yourself first.",
        right: "Yes — ageism. The bias that makes us skip the question we should always ask. Catch it in yourself first.",
      },
    },
    {
      id: 'q10',
      text: "What ONE word describes the older adult's RIGHT to make their own informed decisions about their care — even decisions we disagree with?",
      hint: "Self-rule. The patient is the captain.",
      answers: ['autonomy'],
      roasts: {
        wrong: "For those of you who didn't get autonomy — the patient is the captain. You are the navigator with the binder. Even when you disagree, even when it stresses you out, even when you swear under your mask — they steer the ship. That's nursing. That's the deal. Sign here.",
        right: "Yes — autonomy. The patient's call, full stop. We inform; they decide.",
      },
    },
    {
      id: 'q11',
      text: "What hyphenated word names the COMMUNITY-LEVEL nursing intervention BEFORE a heat warning hits — the brief visit or call to see how a vulnerable older adult is doing?",
      hint: "How are you doing, Margaret? — said proactively, before the crisis. ('check-___')",
      answers: ['check-in', 'check in', 'checkin', 'wellness check', 'wellness-check', 'wellness'],
      roasts: {
        wrong: "Whatever you typed — wasn't check-in. You knock BEFORE the heat hits, not at the morgue. A check-in is the cheapest, lowest-tech, highest-impact thing nursing has ever invented. Five minutes, one phone call, one knock — and the body count goes down. That's the whole job.",
        right: "Yes — check-in. Show up BEFORE, not after. That's the nursing footprint that prevents a body count.",
      },
    },
    {
      id: 'q12',
      text: "Older adult skin sensitivity DECREASES with age. The clinical implication: small injuries go _____ until visual self-checks are taught.",
      hint: "The opposite of 'noticed.'",
      answers: ['unnoticed', 'undetected', 'unseen'],
      roasts: {
        wrong: "For those of you who didn't get unnoticed — older skin does NOT tattle. The nerves quiet down, the pain signal mellows, and the gardener finds out about the laceration when it's already infected. They don't FEEL it; they need to SEE it. Teach the eyeball, not the lecture.",
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
      wrong: "Oh-ho — those of you who voted FACT just told an eighty-three-year-old gardener to stop gardening because the sun exists. That isn't nursing, that's a hostage negotiation. The sun has been there her whole life. So has she. Hat, sleeves, timing, sunscreen — yes. Cancelling Emily's joy — absolutely not.",
      right: "Yes — you don't tell Emily to stop gardening. You work with her routine. Sun protection, not life subtraction.",
    },
    mvf_2: {
      wrong: "MYTH? Really? The epidermis literally thins, the collagen literally drops, the subcutaneous fat literally packs up and leaves. Emily isn't imagining the bruises. She's not being dramatic. Her dermis filed for early retirement and you said no it didn't. Read the chapter. With your eyes.",
      right: "Yes — thinning skin, less fat, more fragile. Use the knowledge to inform Emily, not scare her.",
    },
    mvf_3: {
      wrong: "FACT?? You just decided that an eighty-three-year-old heals at the same speed as a teenager. The fibroblasts have left the building. The stem cells are on vacation. A papercut Emily ignores is your problem in two weeks. Slower healing IS the answer. Tell her so she doesn't shrug off the small stuff.",
      right: "Yes — older skin heals slower. Tell Emily so she takes a small cut seriously. Informed is not afraid.",
    },
    mvf_4: {
      wrong: "Whoever voted MYTH on this — you walked into Emily's appointment and started lecturing about SPF before asking if she even uses sunscreen. That's not teaching, that's a podcast. Ask first. Then teach. That's the entire emancipatory game in one sentence.",
      right: "Yes — start where she is. The opening question is more powerful than the closing recommendation.",
    },
    mvf_5: {
      wrong: "Voted FACT? You just bet a four-hour-a-day gardener's entire skin on a single bottle of SPF that washes off in sweat. Sunscreen alone for Emily is like a seatbelt with no airbag. Hat. Sleeves. Timing. Sunscreen. ALL of them. Layers, like a casserole.",
      right: "Yes — multimodal protection. Hat, sleeves, timing, sunscreen. And it's also more affordable on a fixed income.",
    },
    mvf_6: {
      wrong: "MYTH? Sure — let's hand Emily a pamphlet, watch it die in a drawer next to a 2014 IKEA receipt, and call that education. Pamphlets are paper. Teach-back is muscle memory. Demonstrate. Then watch HER do it. The skill belongs in her hands, not the recycling.",
      right: "Yes — teach-back wins every time. The skill stays with her, not the system.",
    },
    mvf_7: {
      wrong: "Voting FACT here means you think skin gets MORE sensitive with age. Wild. Bold. Wrong. The nerves quiet, the pain signal fades, and Emily literally cannot feel the cut on her shin. That is exactly why we teach the visual check. Her eyes are now the smoke detector.",
      right: "Yes — sensitivity decreases. Visual self-checks compensate for what the nerves don't catch.",
    },
    mvf_8: {
      wrong: "MYTH? Then go ahead, ignore the fact that Emily can't afford the good sunscreen and pretend her skin will magically protect itself with positive thinking. Money is clinical. Pension is clinical. If you skip the budget question, you're treating a chart, not a person. Get the woman a generic.",
      right: "Yes — budget is clinical. Connect Emily to community pharmacy programs. That's nursing, not social work.",
    },
    mvf_9: {
      wrong: "Voting FACT means you just told an eighty-three-year-old with an evolving spot we'll see it next April. Congratulations — you've invented a stage three melanoma. New shape, new colour, new growth equals dermatology TODAY. Not next year. Not next month. Today.",
      right: "Yes — refer today. An ABCDE evolving spot doesn't wait for the next annual.",
    },
    mvf_10: {
      wrong: "MYTH? So Emily says I'm fine, look at me and you immediately go nope, you're not? That's not nursing, that's argumentative cosplay. Her experience is real. AND the new mole is real. Hold both. That's the whole point of relational practice — both can be true at once.",
      right: "Yes — hold both. Her self-knowledge and the new spot. Both can be true.",
    },
    mvf_11: {
      wrong: "Voted MYTH on this one? You just decided vaccines are optional for an eighty-three-year-old whose cough reflex is weaker than her wifi. Aspiration pneumonia is a thing. Flu kills older adults. Pneumococcal kills older adults. Get them BOTH. This is core prevention, not a side quest.",
      right: "Yes — flu and pneumococcal are core. Cough reflex doesn't get stronger with time.",
    },
    mvf_12: {
      wrong: "FACT?? So you'll only check Emily's skin if something looks dramatically wrong on the way in? Cool, cool — that's how stage four pressure injuries are born. Head-to-toe. Every visit. Systematic. If you don't look, you can't see, and if you can't see, you can't stage. Do the work.",
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
    "From Emily's garden to Mr. M's living room. He has heart failure, more medications than friends, and one appointment to figure out who he is before we figure out what he needs. Let's prioritize.",
  pyramid_to_complete:
    "Mr. M is collaborated with, Emily is empowered, the heat dome is closing — that's three older adults whose stories we just took seriously. Class dismissed.",
};

module.exports = { PHASE1, PHASE2, PHASE3, TRANSITION_JOKES };
