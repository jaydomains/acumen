// data.jsx — mock state for the Acumen prototype.
// Exposed to window at bottom for cross-file access.

const SUBJECTS = [
  { id: 'paint-qa',    name: 'Paint QA',            color: '#b8743a' },
  { id: 'marine',      name: 'Marine Coatings',     color: '#3a5b8c' },
  { id: 'nace',        name: 'NACE Prep',           color: '#2f5d63' },
  { id: 'qs',          name: 'Quantity Surveying',  color: '#6e8f5b' },
  { id: 'safety',      name: 'Safety & Compliance', color: '#97352a' },
  { id: 'pm',          name: 'Project Management',  color: '#5b5d6e' },
];

// pills × pills constellation. Each pill carries: subject, competence (1-10 float),
// confidence n, attempts, last activity. safety_relevant = no AI explainer.
const PILLS = [
  // Paint QA
  { id: 'reference-panels',    subject: 'paint-qa',  name: 'Reference Panels',          band: 'working',  competence: 6.7, n: 47, lastDays: 3,  safety: false, related: ['batch-tracking','dft-measurement'] },
  { id: 'batch-tracking',      subject: 'paint-qa',  name: 'Batch Tracking',            band: 'advanced', competence: 7.4, n: 38, lastDays: 8,  safety: false, related: ['reference-panels'] },
  { id: 'dft-measurement',     subject: 'paint-qa',  name: 'DFT Measurement',           band: 'working',  competence: 6.1, n: 31, lastDays: 12, safety: false, related: ['reference-panels','adhesion-testing'] },
  { id: 'adhesion-testing',    subject: 'paint-qa',  name: 'Adhesion Testing',          band: 'junior',   competence: 4.2, n: 18, lastDays: 22, safety: false, related: ['dft-measurement'] },
  { id: 'gloss-measurement',   subject: 'paint-qa',  name: 'Gloss Measurement',         band: 'working',  competence: 5.9, n: 14, lastDays: 30, safety: false, related: [] },

  // Marine
  { id: 'antifouling',         subject: 'marine',    name: 'Antifouling Systems',       band: 'junior',   competence: 4.4, n: 22, lastDays: 6,  safety: false, related: ['immersion-service','ballast-tanks'] },
  { id: 'immersion-service',   subject: 'marine',    name: 'Immersion Service',         band: 'working',  competence: 6.3, n: 27, lastDays: 14, safety: false, related: ['antifouling'] },
  { id: 'ballast-tanks',       subject: 'marine',    name: 'Ballast Tank Coatings',     band: 'novice',   competence: 2.8, n: 9,  lastDays: 45, safety: false, related: ['antifouling'] },
  { id: 'cathodic-protection', subject: 'marine',    name: 'Cathodic Protection',       band: 'junior',   competence: 4.0, n: 12, lastDays: 41, safety: false, related: ['immersion-service'] },

  // NACE Prep
  { id: 'corrosion-basics',    subject: 'nace',      name: 'Corrosion Mechanisms',      band: 'advanced', competence: 7.8, n: 52, lastDays: 4,  safety: false, related: ['cathodic-protection','passivation'] },
  { id: 'passivation',         subject: 'nace',      name: 'Passivation',               band: 'working',  competence: 6.4, n: 24, lastDays: 18, safety: false, related: ['corrosion-basics'] },
  { id: 'inspection-tools',    subject: 'nace',      name: 'Inspection Instruments',    band: 'expert',   competence: 8.6, n: 71, lastDays: 2,  safety: false, related: [] },

  // QS
  { id: 'boq-prep',            subject: 'qs',        name: 'BoQ Preparation',           band: 'working',  competence: 6.2, n: 28, lastDays: 9,  safety: false, related: ['take-offs','rate-build-up'] },
  { id: 'take-offs',           subject: 'qs',        name: 'Take-offs',                 band: 'advanced', competence: 7.6, n: 34, lastDays: 11, safety: false, related: ['boq-prep'] },
  { id: 'rate-build-up',       subject: 'qs',        name: 'Rate Build-up',             band: 'junior',   competence: 4.6, n: 16, lastDays: 25, safety: false, related: ['boq-prep'] },

  // Safety (no AI teaching)
  { id: 'confined-space',      subject: 'safety',    name: 'Confined Space Entry',      band: 'working',  competence: 6.5, n: 19, lastDays: 13, safety: true,  related: ['height-work'] },
  { id: 'height-work',         subject: 'safety',    name: 'Working at Height',         band: 'advanced', competence: 7.2, n: 24, lastDays: 7,  safety: true,  related: ['confined-space'] },
  { id: 'solvent-handling',    subject: 'safety',    name: 'Solvent Handling',          band: 'novice',   competence: 3.0, n: 11, lastDays: 38, safety: true,  related: [] },

  // PM
  { id: 'rfi-management',      subject: 'pm',        name: 'RFI Management',            band: 'junior',   competence: 4.8, n: 15, lastDays: 19, safety: false, related: [] },
  { id: 'site-coordination',   subject: 'pm',        name: 'Site Coordination',         band: 'working',  competence: 6.0, n: 21, lastDays: 16, safety: false, related: [] },
];

const BANDS = ['novice','junior','working','advanced','expert'];
const BAND_LABEL = { novice:'Novice', junior:'Junior', working:'Working', advanced:'Advanced', expert:'Expert' };
function bandOf(c) {
  if (c < 3) return 'novice';
  if (c < 5) return 'junior';
  if (c < 7) return 'working';
  if (c < 8.5) return 'advanced';
  return 'expert';
}

const ASSIGNMENTS = [
  { id: 'a1', kind: 'assigned',  mandatory: true,  pill: 'antifouling',      diff: 5, due: 'in 6 days',   assigner: 'Gys M.',     status: 'in_progress', progress: 0.3 },
  { id: 'a2', kind: 'loop',      mandatory: false, pill: 'adhesion-testing', diff: 4, due: '—',           assigner: 'system',     status: 'pending',     progress: 0,    reason: 'follow-up from a weak attempt 4 days ago' },
  { id: 'a3', kind: 'assigned',  mandatory: true,  pill: 'confined-space',   diff: 6, due: 'in 12 days',  assigner: 'Gys M.',     status: 'pending',     progress: 0 },
  { id: 'a4', kind: 'loop',      mandatory: false, pill: 'ballast-tanks',    diff: 3, due: '—',           assigner: 'system',     status: 'pending',     progress: 0,    reason: 'follow-up from yesterday\'s benchmark' },
];

const QUESTIONS = [
  {
    id: 'q1',
    pillId: 'antifouling',
    type: 'multiple-choice',
    prompt: 'A self-polishing copolymer (SPC) antifouling is specified for a vessel scheduled to operate at <strong>14 knots average service speed</strong>. Which property of SPC chemistry most directly justifies this choice over a controlled-depletion-polymer (CDP) system?',
    referenceImage: {
      caption: 'Cross-section of an applied SPC system showing leached layer, intact polymer, and primer over substrate.',
      placeholder: 'Cross-section diagram of an SPC antifouling system',
      number: 1,
    },
    options: [
      { id: 'A', text: 'The biocide release rate is fixed independent of vessel speed' },
      { id: 'B', text: 'The polymer hydrolyses at a rate proportional to water flow across the hull' },
      { id: 'C', text: 'SPC contains no soluble pigment, so leaching is uniform' },
      { id: 'D', text: 'SPC develops a higher dry-film hardness, reducing mechanical erosion' },
    ],
    correct: 'B',
    timeMs: 45000,
  },
  {
    id: 'q2',
    pillId: 'antifouling',
    type: 'short-answer',
    prompt: 'A surveyor finds <strong>localised blistering</strong> at the boot-top within 18 months of an SPC application. The dry-dock specification, surface prep, and DFT records are all clean. List <strong>two</strong> service-side factors you would investigate next, and for each, briefly explain why.',
    referenceImage: {
      caption: 'Boot-top blistering observed at routine inspection — 18 months in service.',
      placeholder: 'Photograph of localised blistering at vessel boot-top',
      number: 2,
    },
    rubric: 'Looks for: extended port stays / static immersion (SPC chemistry needs movement), or fresh-water layering / brackish berth (SPC is calibrated for seawater hydrolysis). Cathodic over-protection also acceptable.',
    expectedSeconds: 90,
  },
  {
    id: 'q3',
    pillId: 'immersion-service',
    type: 'true-false',
    prompt: 'For an immersed coating system in ballast service, raising the dry-film thickness <strong>beyond the manufacturer\'s maximum</strong> recommendation reliably improves long-term protection because more film equals more barrier.',
    correct: 'false',
  },
  {
    id: 'q4',
    pillId: 'antifouling',
    type: 'scenario',
    prompt: 'A coastal patrol vessel berths static for <strong>10\u201314 days at a stretch</strong> between operations, then runs at speed for 2\u20133 days. The current SPC system is fouling heavily within 9 months \u2014 well short of its 36-month nominal life. Outline the recoat approach you would recommend and the trade-offs to communicate to the operator.',
    rubric: 'Strong answers: identify static-berthing vs SPC mismatch, propose hybrid (CDP for low-activity periods) or biocide-boost CDP, address dry-dock window cost, note no-fouling-release option if budget permits.',
    expectedSeconds: 180,
  },
  {
    id: 'q5',
    pillId: 'cathodic-protection',
    type: 'multiple-choice',
    prompt: 'Excessive cathodic protection on a steel hull with an SPC antifouling system can cause coating failure primarily because:',
    options: [
      { id: 'A', text: 'Alkaline conditions at the cathode degrade the polymer binder (saponification)' },
      { id: 'B', text: 'The biocide reacts with sacrificial anode material' },
      { id: 'C', text: 'Increased current draw heats the substrate above the coating\'s Tg' },
      { id: 'D', text: 'Cathodic protection is incompatible with copper-based antifouling' },
    ],
    correct: 'A',
    timeMs: 50000,
  },
  {
    id: 'q6',
    pillId: 'antifouling',
    type: 'matching',
    prompt: 'Match each fouling organism to the typical environmental driver where it dominates.',
    pairs: [
      { left: 'Barnacles',     right: 'Warm, high-salinity, calm berths' },
      { left: 'Tubeworms',     right: 'Estuarine, mid-salinity, structured surfaces' },
      { left: 'Slime film',    right: 'All conditions; first to colonise' },
      { left: 'Macroalgae',    right: 'Shallow, photic-zone immersion' },
    ],
  },
  {
    id: 'q7',
    pillId: 'immersion-service',
    type: 'short-answer',
    prompt: 'In one sentence each, name the <strong>two key inspection checks</strong> a Coatings Inspector should perform on an SPC system immediately after dry-docking but before refloat.',
    rubric: 'Looks for: leached-layer / chalk-layer integrity check; DFT spot checks against original schedule; visual for blistering or mud-cracking; sea-chest grating clearance.',
    expectedSeconds: 80,
  },
  {
    id: 'q8',
    pillId: 'antifouling',
    type: 'multiple-choice',
    layout: 'image-only',
    prompt: 'Four edge-protection details have been proposed for the bow-thruster tunnel coating. <strong>Which detail correctly addresses the high-shear edge condition?</strong>',
    referenceImage: null,
    options: [
      { id: 'A', text: 'Detail A · square-cut edge',       image: true, placeholder: 'Square-cut tunnel edge, single-pass coating' },
      { id: 'B', text: 'Detail B · 3 mm chamfer + stripe', image: true, placeholder: 'Chamfered edge with stripe-coat application' },
      { id: 'C', text: 'Detail C · radius + over-spray',   image: true, placeholder: 'Radiused edge, over-sprayed transition' },
      { id: 'D', text: 'Detail D · weld bead untouched',   image: true, placeholder: 'Untreated weld bead at tunnel mouth' },
    ],
    correct: 'B',
    timeMs: 60000,
  },
];

const GRADE_REVIEW_QUEUE = [
  { id: 'gr1', testee: 'Themba N.', pill: 'antifouling',     question: 'Why SPC over CDP at 14kn service speed?',     primaryGrade: 'partial (0.6)', reviewVerdict: 'flagged',   reviewer: 'OpenAI gpt-4o-mini', reason: 'Response identifies hydrolysis but conflates rate-control mechanism with biocide release; rubric requires explicit naming of polymer-rate-vs-flow link. Grade appears generous.', age: '4m' },
  { id: 'gr2', testee: 'Lerato D.', pill: 'corrosion-basics',question: 'Galvanic series ordering — Zn vs Mg anode',      primaryGrade: 'full (1.0)',    reviewVerdict: 'flagged',   reviewer: 'OpenAI gpt-4o-mini', reason: 'Testee answer reverses Zn/Mg electrochemical potential. Primary grade likely incorrect.', age: '11m' },
  { id: 'gr3', testee: 'Sipho M.',  pill: 'boq-prep',        question: 'Provisional sums vs Prime cost sums',          primaryGrade: 'partial (0.5)', reviewVerdict: 'confirmed', reviewer: 'OpenAI gpt-4o-mini', reason: '—', age: '21m' },
  { id: 'gr4', testee: 'Kabelo R.', pill: 'immersion-service', question: 'Post-dry-dock inspection checks',             primaryGrade: 'none (0.0)',    reviewVerdict: 'flagged',   reviewer: 'OpenAI gpt-4o-mini', reason: 'Two valid checks present (leached layer, DFT spot check) but graded zero. Suspect rubric mis-mapping.', age: '32m' },
];

const PENDING_ENGAGEMENT = [
  { id: 'e1', testee: 'Naledi P.', assignment: 'Confined Space Entry (D6)', assigner: 'Gys M.', daysStale: 14, remindersSent: 2, escalated: true },
  { id: 'e2', testee: 'Bongani K.',assignment: 'Antifouling Systems (D5)',  assigner: 'Gys M.', daysStale: 9,  remindersSent: 1, escalated: false },
  { id: 'e3', testee: 'Pieter v.W.',assignment: 'BoQ Preparation (D6)',     assigner: 'Jay',    daysStale: 8,  remindersSent: 1, escalated: false },
  { id: 'e4', testee: 'Sibusiso L.',assignment: 'NACE Prep — Module 2',     assigner: 'Jay',    daysStale: 16, remindersSent: 2, escalated: true },
];

const COST_BREAKDOWN = {
  monthBudget: 30,
  monthSpend: 18.42,
  budgetAlert: '80%',
  operations: [
    { op: 'Test generation',          provider: 'Anthropic', calls: 412, tokens: 1480000, cost: 7.84, share: 0.43 },
    { op: 'Grading (AI)',             provider: 'Anthropic', calls: 268, tokens: 540000,  cost: 3.12, share: 0.17 },
    { op: 'Grade review',             provider: 'OpenAI',    calls: 142, tokens: 220000,  cost: 1.96, share: 0.11 },
    { op: 'Weakness identification',  provider: 'Anthropic', calls: 88,  tokens: 195000,  cost: 1.42, share: 0.08 },
    { op: 'Learning material',        provider: 'Anthropic', calls: 71,  tokens: 310000,  cost: 2.18, share: 0.12 },
    { op: 'Pill proposal',            provider: 'Anthropic', calls: 12,  tokens: 84000,   cost: 0.48, share: 0.03 },
    { op: 'Drive embedding',          provider: 'OpenAI',    calls: 6,   tokens: 410000,  cost: 1.42, share: 0.06 },
  ],
  daily: [0.4,0.55,0.6,0.7,0.8,0.45,0.3, 0.5,0.62,0.71,0.9,0.85,0.55,0.4, 0.6,0.72,0.88,1.1,0.95,0.62,0.45, 0.55,0.7,0.82,1.0,0.65,0.4,0.3],
};

const RECENT_ATTEMPTS = [
  { id: 'at1', testee: 'You', pill: 'reference-panels', score: 0.82, when: '3d ago',  band: 'working',  origin: 'self', delta: +0.4 },
  { id: 'at2', testee: 'You', pill: 'batch-tracking',   score: 0.91, when: '8d ago',  band: 'advanced', origin: 'assignment', delta: +0.2 },
  { id: 'at3', testee: 'You', pill: 'adhesion-testing', score: 0.42, when: '4d ago',  band: 'junior',   origin: 'self', delta: -0.3 },
  { id: 'at4', testee: 'You', pill: 'corrosion-basics', score: 0.88, when: '4d ago',  band: 'advanced', origin: 'assignment', delta: +0.5 },
];

// Weakness report for the just-completed antifouling attempt
const WEAKNESS_REPORT = {
  attemptId: 'at-current',
  score: 0.58,
  pillScores: [
    { pillId: 'antifouling',         score: 0.50, severity: 'severe',   missed: 3, total: 5 },
    { pillId: 'immersion-service',   score: 0.75, severity: 'mild',     missed: 1, total: 2 },
    { pillId: 'cathodic-protection', score: 0.00, severity: 'critical', missed: 1, total: 1 },
  ],
  loopAction: {
    mode: 'autonomous',
    nextAttempt: 'in 5 days',
    pills: ['antifouling','cathodic-protection'],
    diff: 4,
    materialReady: true,
  },
};

const PILL_PROPOSALS = [
  { id: 'pp1', name: 'Edge Retention',     subject: 'paint-qa', rationale: 'Seen in 14 generated questions tagged "edge effect" without a clean pill mapping.', safetyAuto: false },
  { id: 'pp2', name: 'Anchor Pattern Profile', subject: 'nace', rationale: 'Six testees searched "anchor profile" + "Rz" with no result.', safetyAuto: false },
  { id: 'pp3', name: 'Hot-Work Permits',   subject: 'safety',  rationale: 'AC-D21 keyword match: hot work, permit, ignition source.', safetyAuto: true  },
];

Object.assign(window, {
  SUBJECTS, PILLS, BANDS, BAND_LABEL, bandOf,
  ASSIGNMENTS, QUESTIONS, GRADE_REVIEW_QUEUE,
  PENDING_ENGAGEMENT, COST_BREAKDOWN, RECENT_ATTEMPTS,
  WEAKNESS_REPORT, PILL_PROPOSALS,
});
