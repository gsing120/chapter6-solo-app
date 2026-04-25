/* ═══════════════════════════════════════════════════════════════
   Chapter 6 Solo App — All Content (swap here without touching logic)
   ═══════════════════════════════════════════════════════════════ */

// ── PHASE 1: Critical Thinking ──
const PHASE1 = {
  scenario: `Margaret is an 82-year-old widow who lives alone in a second-floor walk-up apartment. Her husband died four years ago. Her two adult children live out of province and call her about once a week.

She is brought to the ED in mid-January after a neighbour found her sitting in her kitchen wearing two sweaters and a scarf, looking "a bit confused." Her core temperature on arrival is 34.8°C. Vitals: BP 102/64, HR 52, SpO₂ 94% on room air, BGL 4.6 mmol/L. She is alert but slow to respond, and tells the triage nurse she's been feeling "a bit off — but nothing really."

History reveals she has been wearing extra layers indoors for weeks. Her thermostat is set to 16°C — she explains that heating costs have "gotten ridiculous" since her CPP and OAS are her only income. She has not seen her family doctor in 8 months. Her medication list includes hydrochlorothiazide, atenolol, and a recent self-increased dose of lorazepam she's been taking "to help me sleep through the long winter nights." She has stopped attending her usual community group at the local library because she's "too tired" lately. She has not been eating regular meals.

You are her admitting nurse.`,
  questions: [
    {
      id: 'ct_q1',
      text: 'Margaret did not recognize how cold she was. Identify at least TWO age-related physiological changes (think: nervous system, vasculature, fat/skin) that contributed to her unawareness, and EXPLAIN how each one specifically blunted her ability to perceive or respond to the cold. One-word answers will not cut it — give clinical reasoning.',
    },
    {
      id: 'ct_q2',
      text: "List at least TWO INTRINSIC and TWO EXTRINSIC risk factors in Margaret's situation, and explain how each contributes to her hypothermia and overall vulnerability. Don't just label them — show how income, isolation, medications, and her body interact.",
    },
    {
      id: 'ct_q3',
      text: 'Using an EMANCIPATORY nursing lens, describe TWO specific actions you would take to help Margaret while protecting her autonomy and dignity. Be specific — what would you actually say to her, and what concrete resources or referrals would you make? Avoid being paternalistic.',
    },
  ],
  fallbackSummary:
    "Strong responses overall. Many of you correctly identified the age-related changes — reduced vasoconstriction, decreased subcutaneous fat, dulled thermal sensitivity, and a slower shivering response — and connected them to why Margaret didn't notice she was hypothermic. The emancipatory takeaway is the powerful part: this isn't just a clinical problem, it's rooted in social determinants — income, isolation, lack of follow-up, and medications she felt she had to manage on her own. Emancipatory nursing means we don't just rewarm her — we connect her to community heating programs, follow up on the lorazepam she increased without her doctor, gently bring her social isolation into the conversation, and respect her right to make informed decisions. Holistic care is never just about the body.",
};

// ── PHASE 2: Myth vs Fact ──
const PHASE2 = {
  statements: [
    {
      id: 'mvf_1',
      text: 'Sexual desire naturally disappears after age 70.',
      answer: 'MYTH',
      emancipatory:
        "Ageist assumption that erases older adults' needs — sexuality doesn't have an expiry date.",
    },
    {
      id: 'mvf_2',
      text: 'Nurses should wait for older patients to bring up sexual health concerns themselves.',
      answer: 'MYTH',
      emancipatory:
        'Silence is complicity. Emancipatory nursing means proactive advocacy — we open the door, we don\'t stand by it.',
    },
    {
      id: 'mvf_3',
      text: 'Older adults can get sexually transmitted infections.',
      answer: 'FACT',
      emancipatory:
        'STI rates are rising in older adults — screening matters at every age.',
    },
    {
      id: 'mvf_4',
      text: 'Erectile dysfunction is a normal, inevitable part of aging.',
      answer: 'MYTH',
      emancipatory:
        'ED is often treatable — medications, circulation, chronic illness. Don\'t normalize it as "just aging."',
    },
    {
      id: 'mvf_5',
      text: 'A 1°C rise above baseline temperature in an older adult can indicate a serious infection.',
      answer: 'FACT',
      emancipatory:
        'Older adults often don\'t mount full fevers — knowing their individual baseline is life-saving.',
    },
    {
      id: 'mvf_6',
      text: "Social isolation has no significant impact on an older adult's physical health.",
      answer: 'MYTH',
      emancipatory:
        'Isolation affects cardiovascular, immune, cognitive, and sexual health — it IS a nursing concern.',
    },
    {
      id: 'mvf_7',
      text: 'Older adults experience pain less intensely, so we can rely on their reports of mild pain being accurate.',
      answer: 'MYTH',
      emancipatory:
        'Older adults often UNDER-report pain due to stoicism, fear of medication, or cognitive change. Use multimodal pain assessment — never assume mild means mild.',
    },
    {
      id: 'mvf_8',
      text: 'Polypharmacy is a major risk factor for falls in older adults.',
      answer: 'FACT',
      emancipatory:
        'Five or more meds dramatically increases fall risk. Medication review is a nursing intervention — not just a pharmacist task.',
    },
    {
      id: 'mvf_9',
      text: 'A confused older adult with a UTI will reliably present with a high fever.',
      answer: 'MYTH',
      emancipatory:
        'Atypical presentation is the rule, not the exception — confusion, incontinence, fatigue, anorexia. Don\'t wait for a fever to investigate.',
    },
    {
      id: 'mvf_10',
      text: 'Touch and physical affection remain important for older adults\' wellbeing.',
      answer: 'FACT',
      emancipatory:
        'Intimacy is broader than sex. Touch deprivation has measurable effects on cardiovascular and mental health — this is a holistic-care issue.',
    },
  ],
  fallbackRoasts: {
    mvf_1:
      "Sexual desire doesn't have an expiry date, folks. The fact that any of you thought it does? That's the ageism Chapter 6 warns us about.",
    mvf_2:
      "Waiting for the patient to bring it up is like waiting for a fire to put itself out. We're nurses — we open doors, we don't stand by them.",
    mvf_3:
      "STIs don't check birth certificates. Nice work if you knew this — it's the kind of fact that saves lives in practice.",
    mvf_4:
      "ED is not 'just aging' — it's often medications, chronic illness, or circulation changes. All treatable. All worth asking about.",
    mvf_5:
      "One degree up from baseline matters. Older adults don't spike fevers the way younger patients do — subtle is serious.",
    mvf_6:
      "Social isolation doesn't just make you lonely — it makes you sick. Cardiovascular, immune, everything. This is a nursing concern.",
    mvf_7:
      "Older adults under-report pain — stoicism, fear of opioids, cognitive change. Trust your assessment, not just their numerical rating.",
    mvf_8:
      "Polypharmacy + older adult = falls until proven otherwise. Med review is part of your nursing assessment, not someone else's job.",
    mvf_9:
      "Atypical is the typical in geriatrics. New confusion, incontinence, refusing food — investigate before waiting for a fever to show up.",
    mvf_10:
      "Touch is a vital sign of human wellbeing. Intimacy is bigger than sex — and the absence of it has real, measurable health effects.",
  },
  fallbackFinal:
    "Few patterns to call out: the sexual-health and atypical-presentation myths tripped up the most students, and that's not a coincidence — it's ageism leaking into clinical judgment. The emancipatory message of Chapter 6 is simple: challenge your own assumptions, assess the whole person, and don't let stereotypes narrow your scope of care. You all showed up for the hard conversations today — that's exactly what this chapter asks of us.",
};

// ── PHASE 3: Priority Pyramid ──
const PHASE3 = {
  interventions: [
    { id: 1, text: 'Assess baseline temperature over several days' },
    { id: 2, text: 'Educate patient on sun protection and skin hydration' },
    { id: 3, text: 'Ask the patient about their sexual health needs' },
    { id: 4, text: 'Connect patient to community heating assistance programs' },
    { id: 5, text: 'Promote regular cardiovascular exercise' },
    { id: 6, text: 'Assess respiratory function and encourage vaccinations' },
    { id: 7, text: 'Educate on signs of hypothermia' },
    { id: 8, text: 'Screen for erectile dysfunction or menopausal symptoms' },
    { id: 9, text: 'Assess skin integrity and pressure injury risk' },
    { id: 10, text: 'Discuss smoking cessation and pollutant exposure' },
  ],
  fallbackAnalysis:
    "Interesting pattern — most students put temperature assessment and skin integrity at the top, and sexual health near the bottom. Ask yourselves: is that evidence-based prioritization, or is it your own discomfort? Chapter 6 is clear: holistic care includes ALL systems, sexuality among them. If we consistently deprioritize sexual health in older adults, we reinforce the exact ageist assumptions this course challenges us to break. Emancipatory nursing means questioning our own hierarchy of care — who decided sexual health matters less?",
};

module.exports = { PHASE1, PHASE2, PHASE3 };
