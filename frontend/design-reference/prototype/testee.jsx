// testee.jsx — Testee-facing screens (non-attempt).
// Attempt flow lives in attempt.jsx.

const { useState: tUseState, useEffect: tUseEffect, useMemo: tUseMemo, useRef: tUseRef } = React;

// ----- helpers -----
function pillById(id) {return window.PILLS.find((p) => p.id === id);}
function subjectById(id) {return window.SUBJECTS.find((s) => s.id === id);}

// Rotating greeting endings — picked once per page load.
const GREETINGS = [
'Welcome back,',
'Tuesday afternoon,',
'Back at it,',
'Hello again,',
'Good to see you,'];


// Rotating "Today's Reading" — horoscope-style notes from Acumen
// tied to constellation language. The dashboard's creative quirk.
const READINGS = [
{
  body: <>
      <mark>Antifouling</mark> is dim today &mdash; you've slipped half a band since last week.
      Three pills look pale around <mark className="dim">Marine Coatings</mark>; the loop has prepared
      learning material and a re-test in five days. Your strongest constellation,
      <mark className="dim"> NACE Prep</mark>, holds.
    </>,
  fortune: 'Re-test within the week.'
},
{
  body: <>
      Your <mark className="dim">Tuesday-afternoon</mark> attempts grade five points higher than your
      Friday ones, on average. The stars favour short sessions today &mdash; finish
      <mark> Antifouling</mark> before 16:00 and your loop closes ahead of schedule.
    </>,
  fortune: 'Schedule one short session.'
},
{
  body: <>
      <mark>Inspection Instruments</mark> is the brightest star in your sky &mdash; expert band,
      71 attempts, fully calibrated. Consider mentoring: two testees in your team
      have asked <mark className="dim">three questions</mark> tagged to this pill in the last week.
    </>,
  fortune: 'Share what you know.'
}];


function TodaysReading() {
  const reading = tUseMemo(() => READINGS[Math.floor(Date.now() / 60000) % READINGS.length], []);
  return (
    <div className="reading" style={{ fontFamily: "Quicksand" }}>
      <div className="glyph-row">
        <span className="star" />
        <span className="star" style={{ width: 4, height: 4 }} />
        <span className="star" style={{ width: 8, height: 8 }} />
        <span className="star" style={{ width: 3, height: 3 }} />
      </div>
      <div className="eyebrow-rule">
        <span className="eyebrow">Today's reading &middot; 22 May 2026 &middot; a short note from acumen</span>
      </div>
      <div className="text">{reading.body}</div>
      <div className="sig">
        acumen &middot; 14:32 &middot; <span style={{ color: 'var(--accent)' }}>{reading.fortune}</span>
      </div>
    </div>);

}

// ============================================================
// DASHBOARD
// ============================================================
function TesteeDashboard({ onStartAttempt, onRoute }) {
  const I = window.Icon;
  const { ASSIGNMENTS, RECENT_ATTEMPTS, PILLS, bandOf } = window;

  // hero competence summary
  const competenceAvg = (PILLS.reduce((s, p) => s + p.competence, 0) / PILLS.length).toFixed(1);
  const passedCount = PILLS.filter((p) => p.competence >= 5).length;
  const totalCount = PILLS.length;

  // group assignments by status
  const inProgress = ASSIGNMENTS.filter((a) => a.status === 'in_progress');
  const pending = ASSIGNMENTS.filter((a) => a.status === 'pending');

  return (
    <div className="content">
      <div className="row jc-b ai-b mb-6 dash-hero" style={{ flexWrap: 'wrap', gap: '24px' }}>
        <div className="dash-hero-text">
          <div className="eyebrow mb-2">Tuesday · 22 May</div>
          <h1 className="h-display" style={{ fontFamily: "Quicksand" }}>Welcome back, Jay.</h1>
          <div className="muted mt-3" style={{ fontSize: '15px', maxWidth: '56ch' }}>
            You have <strong style={{ color: 'var(--ink)' }}>2 mandatory items</strong> outstanding and{' '}
            <strong style={{ color: 'var(--ink)' }}>2 follow-ups</strong> queued from your recent attempts.
            Your overall competence is up <span style={{ color: 'var(--ok)' }}>+0.3</span> this week.
          </div>
        </div>
        <div className="dash-hero-stats" style={{ fontFamily: "Quicksand" }}>
          <Stat value={competenceAvg} label="OVERALL COMPETENCE" hint={`across ${totalCount} pills`} />
          <Stat value={`${passedCount}/${totalCount}`} label="PILLS AT WORKING+" />
          <Stat value="14" label="DAY STREAK" tone="accent" />
        </div>
      </div>

      <TodaysReading />

      <div className="grid grid-12 gap-4">
        {/* ASSIGNED / FOLLOW-UPS */}
        <div className="col-span-8">
          <div className="card" style={{ fontFamily: "\"DM Sans\"" }}>
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Up next</div>
                <h3 className="h-3">Assigned to you</h3>
              </div>
              <div className="seg">
                <button data-active="true">All</button>
                <button>Mandatory</button>
                <button>Follow-ups</button>
              </div>
            </div>
            <div className="col gap-3">
              {[...inProgress, ...pending].map((a) =>
              <AssignmentRow key={a.id} a={a} onStart={() => onStartAttempt(a)} />
              )}
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Recommended for you</div>
                <h3 className="h-3">Step up — you're ready</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onRoute('catalogue')}>
                Browse all <span className="arrow">→</span>
              </button>
            </div>
            <div className="grid grid-3 gap-3">
              <RecommendCard pillId="reference-panels" reason="Passed D5 — try D7" />
              <RecommendCard pillId="corrosion-basics" reason="Same path as your strong pills" />
              <RecommendCard pillId="boq-prep" reason="Popular across QS team" />
            </div>
          </div>
        </div>

        {/* SIDE COLUMN */}
        <div className="col-span-4 col gap-4">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Recent</div>
                <h3 className="h-3">Your last attempts</h3>
              </div>
            </div>
            <div className="col gap-3">
              {RECENT_ATTEMPTS.map((r) => {
                const p = pillById(r.pill);
                return (
                  <div key={r.id} className="row jc-b ai-c" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p?.name}</div>
                      <div className="muted t-meta mt-2">{r.when} · {r.origin}</div>
                    </div>
                    <div className="right">
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(r.score * 100)}%</div>
                      <div className="t-meta" style={{ color: r.delta > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                        {r.delta > 0 ? '+' : ''}{r.delta.toFixed(1)}
                      </div>
                    </div>
                  </div>);

              })}
            </div>
          </div>

          <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'transparent', fontFamily: "Quicksand" }}>
            <div className="eyebrow" style={{ color: 'var(--accent-ink)' }}>Adaptive loop</div>
            <div className="h-2 mt-2" style={{ color: 'var(--accent-ink)' }}>
              <span className="serif-it">Your weakness in</span><br />
              Antifouling Systems
            </div>
            <div className="mt-3" style={{ color: 'var(--accent-ink)', fontSize: 13, lineHeight: 1.5 }}>
              Learning material is ready. A follow-up test is queued for in 5 days at D4.
            </div>
            <div className="row gap-2 mt-4">
              <button className="btn btn-accent btn-sm" onClick={() => onRoute('results')}>
                Read the explainer <span className="arrow">→</span>
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-ink)' }}>Defer</button>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

function AssignmentRow({ a, onStart }) {
  const p = pillById(a.pill);
  const s = subjectById(p?.subject);
  const isLoop = a.kind === 'loop';
  return (
    <div className="row gap-4" style={{ padding: '14px 12px', background: 'var(--bg-sunk)', borderRadius: 'var(--r-2)', border: '1px solid var(--line)' }}>
      <div style={{ width: 6, alignSelf: 'stretch', background: s?.color, borderRadius: 3, opacity: .9 }} />
      <div style={{ flex: 1 }}>
        <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{p?.name}</span>
          {a.mandatory && <Pill tone="warn" mono>Mandatory</Pill>}
          {isLoop && <Pill tone="accent" mono>Follow-up</Pill>}
          <span className="t-meta">D{a.diff} · {s?.name}</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {a.reason ? <>{a.reason}</> : <>Assigned by {a.assigner} · due {a.due}</>}
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onStart}>
        {a.progress > 0 ? 'Resume' : 'Start'} <span className="arrow">→</span>
      </button>
    </div>);

}

function RecommendCard({ pillId, reason }) {
  const p = pillById(pillId);
  const s = subjectById(p.subject);
  return (
    <div style={{ padding: 14, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 'var(--r-2)' }}>
      <div className="t-meta" style={{ color: s.color }}>{s.name.toUpperCase()}</div>
      <div className="mt-2" style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
      <div className="muted mt-2" style={{ fontSize: 12 }}>{reason}</div>
      <div className="row jc-b ai-c mt-3">
        <BandTag band={p.band} />
        <button className="btn btn-ghost btn-sm">Take <span className="arrow">→</span></button>
      </div>
    </div>);

}

// ============================================================
// CATALOGUE / DISCOVERY
// ============================================================
function TesteeCatalogue({ onStartAttempt }) {
  const { PILLS, SUBJECTS } = window;
  const [subj, setSubj] = tUseState('all');
  const [q, setQ] = tUseState('');
  const filtered = PILLS.filter((p) =>
  (subj === 'all' || p.subject === subj) && (
  q === '' || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="content">
      <PageHeader
        eyebrow="Catalogue · 137 pills · 6 subjects"
        title={<><span className="serif-it">Find what you need to</span> learn.</>}
        subtitle="Self-directed practice. Pick a subject, pick a pill, pick a difficulty. Anything safety-tagged links out to curated industry sources — Acumen doesn't generate safety teaching content." />
      

      <div className="row gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        <input className="input" placeholder="Search pills…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <div className="seg">
          <button data-active={subj === 'all'} onClick={() => setSubj('all')}>All</button>
          {SUBJECTS.map((s) =>
          <button key={s.id} data-active={subj === s.id} onClick={() => setSubj(s.id)}>{s.name}</button>
          )}
        </div>
      </div>

      <div className="grid grid-3 gap-4">
        {filtered.map((p) => <PillCard key={p.id} pill={p} onStart={() => onStartAttempt({ pill: p.id, diff: 5 })} />)}
      </div>
    </div>);

}

function PillCard({ pill, onStart }) {
  const s = subjectById(pill.subject);
  const conf = pill.n >= 20 ? 'confident' : 'preliminary';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row jc-b ai-b">
        <div className="t-meta" style={{ color: s.color }}>{s.name.toUpperCase()}</div>
        {pill.safety && <Pill tone="danger" mono>Safety</Pill>}
      </div>
      <h3 className="h-3" style={{ fontSize: 18 }}>{pill.name}</h3>
      <div className="row jc-b ai-c">
        <BandTag band={pill.band} />
        <div className="t-meta">
          {pill.competence.toFixed(1)} <span className="dim">· n={pill.n} · {conf}</span>
        </div>
      </div>
      <div className="progress"><div className="fill accent" style={{ width: pill.competence * 10 + '%' }} /></div>
      <div className="row jc-b ai-c">
        <span className="t-meta">last activity {pill.lastDays}d ago</span>
        <button className="btn btn-sm" onClick={onStart}>
          {pill.safety ? 'Open links' : 'Practice'} <span className="arrow">→</span>
        </button>
      </div>
    </div>);

}

// ============================================================
// RESULTS (post-attempt + weakness report + loop preview)
// ============================================================
function TesteeResults({ onRoute }) {
  const { WEAKNESS_REPORT, QUESTIONS, PILLS } = window;
  const r = WEAKNESS_REPORT;

  return (
    <div className="content">
      <PageHeader
        eyebrow={`Attempt #${r.attemptId} · Antifouling Systems · D5 · submitted 4 minutes ago`}
        title={<><span className="serif-it">You scored</span> 58<span className="serif-it">% —</span> below working band.</>}
        subtitle="The autonomous loop has identified two weak areas and prepared learning material. A targeted follow-up is queued for 5 days from now." />
      

      <div className="grid grid-12 gap-4 mb-6">
        <div className="col-span-3">
          <div className="card center" style={{ padding: '28px 20px' }}>
            <div className="stat-big">58<span style={{ fontSize: 22 }}>%</span></div>
            <BandTag band="junior" />
            <div className="t-meta mt-2">7 of 12 correct or partial</div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{ padding: '28px 20px' }}>
            <div className="stat-big" style={{ color: 'var(--accent)' }}>5.4</div>
            <div className="t-meta">PILL COMPETENCE</div>
            <div className="muted mt-2" style={{ fontSize: 12 }}>was 5.9 · <span style={{ color: 'var(--danger)' }}>−0.5</span></div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{ padding: '28px 20px' }}>
            <div className="stat-big">23<span style={{ fontSize: 22 }}>min</span></div>
            <div className="t-meta">TIME ON TEST</div>
            <div className="muted mt-2" style={{ fontSize: 12 }}>median for D5: 19 min</div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{ padding: '28px 20px', background: 'var(--ok-soft)', borderColor: 'transparent' }}>
            <div className="row gap-2 jc-c ai-c" style={{ justifyContent: 'center' }}>
              <div className="pulse-dot" style={{ background: 'var(--ok)' }} />
              <span className="t-meta" style={{ color: 'var(--ok)' }}>REVIEW COMPLETE</span>
            </div>
            <div className="mt-3" style={{ fontSize: 13, color: 'var(--ok)' }}>
              All 6 AI grades cross-checked by OpenAI in 4.2s
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-12 gap-4">
        <div className="col-span-7">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">By pill</div>
                <h3 className="h-3">Where you struggled</h3>
              </div>
            </div>
            <div className="col gap-3">
              {r.pillScores.map((ps) => {
                const p = pillById(ps.pillId);
                const sevTone = ps.severity === 'critical' ? 'danger' : ps.severity === 'severe' ? 'warn' : 'info';
                return (
                  <div key={ps.pillId} style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                    <div className="row jc-b ai-c mb-3">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p?.name}</div>
                        <div className="t-meta mt-2">missed {ps.missed} of {ps.total} questions</div>
                      </div>
                      <div className="row gap-3">
                        <Pill tone={sevTone} mono>{ps.severity}</Pill>
                        <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(ps.score * 100)}%</div>
                      </div>
                    </div>
                    <div className="progress">
                      <div className="fill" style={{ width: ps.score * 100 + '%', background: ps.severity === 'critical' ? 'var(--danger)' : ps.severity === 'severe' ? 'var(--warn)' : 'var(--ok)' }} />
                    </div>
                  </div>);

              })}
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Question by question</div>
                <h3 className="h-3">Your answers</h3>
              </div>
              <button className="btn btn-ghost btn-sm">Download PDF <span className="arrow">→</span></button>
            </div>
            <div className="col gap-2">
              {[
              { n: 1, q: 'Why SPC over CDP at 14kn service speed?', ok: true, type: 'mc', hasFig: true },
              { n: 2, q: 'Two service-side factors for boot-top blistering', ok: false, type: 'sa', ai: true, partial: true, hasFig: true },
              { n: 3, q: 'DFT above max recommendation — true or false', ok: true, type: 'tf' },
              { n: 4, q: 'Recoat approach for static-berth patrol vessel', ok: false, type: 'sc', ai: true, partial: false },
              { n: 5, q: 'Cathodic protection failure mechanism', ok: false, type: 'mc' },
              { n: 6, q: 'Fouling organism / environment matching', ok: true, type: 'ma' },
              { n: 7, q: 'Post-dry-dock inspection checks', ok: true, type: 'sa', ai: true, partial: true, reviewFlagged: true },
              { n: 8, q: 'Four edge-protection details', ok: true, type: 'mc', hasFig: true }].
              map((item) =>
              <div key={item.n} className="row gap-3 ai-c" style={{ padding: '8px 4px' }}>
                  <span className="mono" style={{ width: 24, color: 'var(--ink-3)' }}>{String(item.n).padStart(2, '0')}</span>
                  <span style={{ width: 32 }}>
                    {item.ok ?
                  <span className="chip chip-ok" style={{ padding: '1px 6px' }}><window.Icon name="check" size={11} /></span> :
                  <span className="chip chip-danger" style={{ padding: '1px 6px' }}><window.Icon name="x" size={11} /></span>}
                  </span>
                  <span className="t-meta" style={{ width: 32, textTransform: 'uppercase' }}>{item.type}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{item.q}</span>
                  {item.hasFig && (
                    <span className="chip chip-soft" title="Question included a figure" style={{ padding: '1px 6px' }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="12" height="10"/>
                        <path d="m4 11 3-3 2 2 3-4 0 5z" fill="currentColor" opacity=".25"/>
                        <circle cx="6" cy="6" r="1.2" fill="currentColor"/>
                      </svg>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 0.06 + 'em' }}>FIG</span>
                    </span>
                  )}
                  {item.ai && <Pill tone="soft" mono>AI graded</Pill>}
                  {item.partial && <Pill tone="warn" mono>Partial</Pill>}
                  {item.reviewFlagged && <Pill tone="accent" mono>Admin reviewing</Pill>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-5 col gap-4">
          <div className="card">
            <div className="eyebrow">Adaptive loop · autonomous mode</div>
            <h3 className="h-2 mt-2" style={{ fontFamily: 'var(--font-serif)', fontSize: 24 }}>
              <span className="serif-it">Here's the plan</span> Acumen built for you.
            </h3>
            <div className="col gap-4 mt-4">
              <LoopStep n={1} title="Read this explainer" status="ready"
              desc="A 350-word piece on SPC vs CDP polymer chemistry, with worked examples of static-berth failures." cta="Open" />
              <LoopStep n={2} title="Skim 2 manufacturer TDSes" status="optional"
              desc="Hempel Olympic and International Intersleek 1100SR — both relevant to your operator scenario." cta="Open Drive" />
              <LoopStep n={3} title="Re-test on Antifouling at D4" status="queued"
              desc="In 5 days. 8 questions, ~12 min. We've stepped the difficulty down by 1 band per AC-D9 since this was your third weak attempt." cta="Defer" />
            </div>
          </div>

          <div className="card sunk">
            <div className="eyebrow mb-3">Cross-family review · transparency</div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              Your two short-answer responses were graded by <span className="mono">claude-sonnet-4-5</span> and
              independently reviewed by <span className="mono">openai gpt-4o-mini</span>. Both passes ran in a single 4.2-second batch.
              One review was flagged for admin attention — your Q7 grade may be too low.
              You'll be notified if the admin adjusts it.
            </div>
          </div>
        </div>
      </div>
    </div>);

}

function LoopStep({ n, title, desc, status, cta }) {
  const toneByStatus = {
    ready: 'ok',
    optional: 'info',
    queued: 'soft'
  };
  return (
    <div className="row gap-4" style={{ alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: status === 'ready' ? 'var(--ok-soft)' : status === 'queued' ? 'var(--bg-deep)' : 'var(--info-soft)',
        color: status === 'ready' ? 'var(--ok)' : status === 'queued' ? 'var(--ink-3)' : 'var(--info)',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-serif)', fontSize: 16, flexShrink: 0
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div className="row gap-2 ai-c">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <Pill tone={toneByStatus[status]} mono>{status}</Pill>
        </div>
        <div className="muted mt-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{desc}</div>
        <button className="btn btn-sm mt-3">{cta} <span className="arrow">→</span></button>
      </div>
    </div>);

}

// ============================================================
// HISTORY — minimal screen
// ============================================================
function TesteeHistory() {
  const { RECENT_ATTEMPTS, PILLS } = window;
  const rows = [
  ...RECENT_ATTEMPTS,
  { id: 'at5', pill: 'antifouling', score: 0.58, when: 'just now', band: 'junior', origin: 'assignment', delta: -0.5 },
  { id: 'at6', pill: 'rate-build-up', score: 0.55, when: '2w ago', band: 'junior', origin: 'self', delta: +0.1 },
  { id: 'at7', pill: 'inspection-tools', score: 0.94, when: '3w ago', band: 'expert', origin: 'self', delta: +0.3 },
  { id: 'at8', pill: 'passivation', score: 0.71, when: '3w ago', band: 'working', origin: 'loop', delta: +0.4 },
  { id: 'at9', pill: 'take-offs', score: 0.86, when: '4w ago', band: 'advanced', origin: 'assignment', delta: +0.1 }];

  return (
    <div className="content">
      <PageHeader eyebrow="Your attempt history · 32 records" title={<><span className="serif-it">Everything you've</span> taken.</>} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>When</th><th>Pill</th><th>Origin</th><th className="right">Score</th><th>Band</th><th className="right">Δ comp</th></tr></thead>
          <tbody>
          {rows.map((r) => {
              const p = pillById(r.pill);
              return (
                <tr key={r.id}>
                <td className="t-meta">{r.when}</td>
                <td>{p?.name}</td>
                <td><Pill tone="soft" mono>{r.origin}</Pill></td>
                <td className="right num">{Math.round(r.score * 100)}%</td>
                <td><BandTag band={r.band} /></td>
                <td className="right num" style={{ color: r.delta > 0 ? 'var(--ok)' : 'var(--danger)' }}>{r.delta > 0 ? '+' : ''}{r.delta.toFixed(1)}</td>
              </tr>);

            })}
          </tbody>
        </table>
      </div>
    </div>);

}

Object.assign(window, { TesteeDashboard, TesteeCatalogue, TesteeResults, TesteeHistory });