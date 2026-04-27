/* ═══════════════════════════════════════════════════════════════
   Chapter 6 Solo App — All Content
   Mapped DIRECTLY to the textbook end-of-chapter prompts:
     Phase 1 = Critical Thinking Q3 (BC heat warnings, at-risk pops)
     Phase 2 = Emancipatory Activity 2 (Emily Grayson, skin care)
     Phase 3 = Emancipatory Activity 3 (Mr. M, heart failure, relational practice)
   ═══════════════════════════════════════════════════════════════ */

// ── PHASE 1: Critical Thinking — Textbook CT Q3 (BC heat warnings) ──
const PHASE1 = {
  title: 'Heat warnings & at-risk older adults',
  scenario: `It is mid-July in British Columbia. Island Health has issued a heat warning across Vancouver Island as daytime temperatures climb into the high 30s and overnight lows give little relief. The official news release advises the public to drink fluids regularly, avoid strenuous outdoor activity, take cool showers, find air-conditioned spaces — libraries, malls, community cooling centres — and check on neighbours, family, and friends. The release names higher-risk groups: older adults, people with chronic illness, people experiencing homelessness, and those living alone.

Context the report does not say out loud: in BC's 2021 heat dome, 619 people died. The majority were older adults. Most were found alone, inside their own apartments, without air conditioning. Some had received the public advisory and could not act on it — a fixed income, a fourth-floor walk-up, no fan, no one to call. Others never saw the advisory at all.

You are the public-health nurse on call as the warning is issued.`,
  // Textbook CT Q3 has exactly two sub-prompts: (a) and (b).
  // Mapping: ct_q1 = textbook (a); ct_q2 = textbook (b) with emancipatory framing.
  questions: [
    {
      id: 'ct_q1',
      text:
        "Textbook Q3 (a): Although the Island Health release gives advice on preventing hyperthermia, do you think it reaches the most at-risk older adults? Identify at least TWO specific at-risk groups, explain WHY the standard advice does not land for them, and describe concretely what could be done to mitigate this gap. Avoid one-word answers — give clinical and social reasoning.",
    },
    {
      id: 'ct_q2',
      text:
        "Textbook Q3 (b): Through an EMANCIPATORY lens — collaborating WITH older adults rather than dictating TO them — how can nurses take an active role in addressing this crisis? Describe at least TWO concrete actions BEFORE a heat warning hits, and TWO actions DURING an active heat event. Be specific — what would you actually do, who would you call, what would you say?",
    },
  ],
  fallbackSummary:
    "Strong responses across the three sub-questions. Many of you correctly named the older adults the heat advisory does not actually reach — those living alone in older apartment blocks without AC, on fixed incomes (CPP/OAS), with mobility limitations or cognitive change, isolated from family, or with chronic illness that already strains their thermoregulation. The emancipatory critique is the powerful piece: this is not a one-off clinical event — it is a SOCIAL DETERMINANT story. Top-down public messaging dictates compliance; emancipatory nursing collaborates. That means before the heatwave we are doing wellness checks, knowing who lives alone, building neighbour networks, advocating for structural fixes — cooling centres in walking distance, building codes that don't bake older renters, transit during emergencies. During the event, we don't just say 'drink water' — we ask what's actually getting in the way, and we work the problem WITH the patient. Holistic care is never just about the body.",
};

// ── PHASE 2: Emancipatory Activity — Textbook Activity 2 (Emily Grayson, skin care) ──
const PHASE2 = {
  title: "Emily Grayson — person-centred skin care education",
  emilyContext: `Emily Grayson is 83. She is healthy, active, and an avid gardener — she's outside in her garden three to four hours most days, year-round. Today she's at your community-health appointment for her annual visit. You have been asked to provide health teaching about skin health and aging.

Emily mentions she "doesn't bother with much sunscreen — never has, and look at me, I'm fine." She also says she has noticed a new spot on the back of her hand that "looks a bit different." She lives on a modest pension and asks if there's anything in particular she should be doing.

The next ten statements are about HOW you would educate Emily — person-centred, emancipatory, respecting her autonomy, her health literacy, her preferences. For each statement, vote MYTH (this is wrong, paternalistic, or clinically inaccurate) or FACT (this is correct, person-centred, evidence-based).`,
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
        "Knowing the why builds trust. Don't lecture — explain the change so Emily can recognize it on her own skin and decide what to do.",
    },
    {
      id: 'mvf_3',
      text: 'Wound healing rates in older skin are about the same as in younger adults — age does not slow healing.',
      answer: 'MYTH',
      emancipatory:
        "Healing IS slower (loss of stem cells, thinner dermis, fewer fibroblasts). Tell Emily so she takes a small cut seriously, not so she panics.",
    },
    {
      id: 'mvf_4',
      text: "Asking Emily about her current sun-protection routine BEFORE giving advice is best practice.",
      answer: 'FACT',
      emancipatory:
        "Start where she is. Education that ignores what she already does — and why — lands as a lecture, not a partnership.",
    },
    {
      id: 'mvf_5',
      text: "Sunscreen alone is sufficient sun protection — wide-brim hat, long sleeves, and timing of outdoor work do not add much.",
      answer: 'MYTH',
      emancipatory:
        "Multimodal protection wins, especially for someone outside 3–4 hours daily. And on a fixed income, layered strategies are also more affordable.",
    },
    {
      id: 'mvf_6',
      text: 'Teaching Emily the ABCDE skin self-check (Asymmetry, Border, Colour, Diameter, Evolving) and watching her demonstrate it on her own arm is more empowering than handing her a pamphlet.',
      answer: 'FACT',
      emancipatory:
        "Teach-back transfers ownership. A pamphlet leaves it with the system — the demonstration leaves it with her.",
    },
    {
      id: 'mvf_7',
      text: "Older adults' skin sensitivity INCREASES with age, so they reliably notice small injuries early.",
      answer: 'MYTH',
      emancipatory:
        "Skin sensitivity DECREASES with age. Ask Emily to do a routine visual self-check — she may not feel a small injury.",
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
      text: "Because Emily said the new spot 'looks a bit different,' you can reassure her and revisit at her next annual visit.",
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
  ],
  fallbackRoasts: {
    mvf_1:
      "Telling an 83-year-old gardener to stop gardening? That's not nursing — that's grief delivery. Emancipatory practice works WITH her life, not against it.",
    mvf_2:
      "Yes — thinning skin, less fat, more fragile. The point isn't to scare Emily. It's to help her see what we see so she can act on her own terms.",
    mvf_3:
      "Older skin heals slower, full stop. Knowing this helps Emily take a small cut seriously without spiraling. That's the difference between informed and afraid.",
    mvf_4:
      "Start where she is. The class that goes straight to 'wear SPF 50' before asking what she already does just turned a partnership into a lecture.",
    mvf_5:
      "Sunscreen ALONE for a 4-hour-a-day gardener? You've turned skin protection into a single-point-of-failure system. Hat, sleeves, timing, sunscreen — all of it.",
    mvf_6:
      "Pamphlet vs teach-back? Teach-back wins every time. The skill stays with HER, not in a drawer.",
    mvf_7:
      "Skin sensitivity DROPS with age. That's exactly why Emily needs the visual self-check — her body may not tell her something happened.",
    mvf_8:
      "Money is a clinical determinant of skin health. The minute we ignore it we're treating the patient on paper, not the one in front of us.",
    mvf_9:
      "Reassure-and-revisit is how late-stage skin cancer happens. New, different, evolving spot = referral. Today, not next April.",
    mvf_10:
      "'I'm fine, look at me' deserves respect. So does the new mole on her hand. Emancipatory practice holds both — her experience AND the clinical reality.",
  },
  fallbackFinal:
    "Three patterns to take away. Anywhere paternalism crept in — telling Emily to stop gardening, ignoring her budget, dismissing the new spot, lecturing instead of asking — that's where ageism wears scrubs. Emancipatory skin-care education starts with what she already does, names age changes without alarm, teaches the ABCDE check on HER skin, and treats her financial reality as a clinical concern. You're not protecting Emily from her life. You're partnering with her in it.",
};

// ── PHASE 3: Emancipatory Activity — Textbook Activity 3 (Mr. M, heart failure, relational practice) ──
// Items 1–5 (Part A) = relational / contextual / "who is Mr. M"
// Items 6–10 (Part B) = clinical / structural / "what's happening to him"
// The textbook prompt asks: what info is essential, acknowledging his unique identity?
// The architecture forces relational items into the top 5 — the within-half ranking
// reveals which relational priority students treat as most foundational.
const PHASE3 = {
  title: 'Mr. M — initial encounter, relational practice',
  mrMContext: `Mr. M is 70 years old. He has heart failure. He is struggling — fatigue, shortness of breath, edema have crept in over the last six months, and he is unable to do many of the activities he loves. This is your INITIAL ENCOUNTER with him. He is sitting across from you and you have one appointment to begin a relationship that will carry his care.

You will rank ten things you might want to know about Mr. M, in two parts. The textbook asks: "What information is essential, acknowledging his unique identity and experiences? How can this knowledge serve as a tool to comprehend and respect Mr. M's personal perspective on his experience of illness?"

PART 1: rank 5 RELATIONAL priorities — who he is, what matters to him.
PART 2: rank 5 CLINICAL priorities — the disease state, meds, symptoms, function, history.

Both matter. Their ORDER tells the story.`,
  interventions: [
    // ── Part A: relational / contextual (ids 1-5) ──
    { id: 1, text: 'His goals — what HE wants from his care, his life, this conversation' },
    { id: 2, text: "His values, beliefs, and what gives his life meaning" },
    { id: 3, text: "His own words for his diagnosis — how HE understands and experiences it" },
    { id: 4, text: 'The activities he misses most and why those activities matter to him' },
    { id: 5, text: 'His social support network — who lives with him, close relationships, who would notice if he was off' },
    // ── Part B: clinical / structural (ids 6-10) ──
    { id: 6, text: 'Current cardiac symptoms — orthopnea, fatigue, edema, dyspnea on exertion' },
    { id: 7, text: 'Current cardiac medications and how he manages adherence day-to-day' },
    { id: 8, text: 'Activity tolerance and functional status — walking distance, stairs, ADLs' },
    { id: 9, text: 'Detailed cardiac history — ejection fraction, recent admissions, comorbidities' },
    { id: 10, text: 'Financial situation, insurance coverage, access to medications and follow-up care' },
  ],
  fallbackAnalysis:
    "Strong patterns to call out. Anyone who put 'his goals' (#1) or 'his own words for his diagnosis' (#3) at the very top of Part 1 is doing exactly what the chapter asks of us — building care AROUND the person, not around the diagnosis. The relational items are the foundation; the clinical items in Part 2 give us the data, but they only become CARE when we know who Mr. M is. The single most common mistake in initial encounters is jumping straight to symptoms, meds, EF, and history — the clinical script — and forgetting that the man across from us is more than his ejection fraction. Emancipatory nursing means knowing the WHOLE person — Mr. M's heart failure is treated; Mr. M is collaborated WITH.",
};

module.exports = { PHASE1, PHASE2, PHASE3 };
