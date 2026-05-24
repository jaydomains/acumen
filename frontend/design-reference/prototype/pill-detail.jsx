// pill-detail.jsx — v6 · FE-3 · #9 + #10
// Pill detail page at /pills/[pillId]. Two right-column treatments
// depending on whether the pill is safety_relevant.
//
// #9  Standard: AI-generated learning material.
// #10 Safety: curated industry links per AC-D21.
//
// A single STATE strip toggles between flavour (standard vs safety),
// and material lifecycle (loading / ready / regenerating + empty for safety).

const { useState: pdUseState, useEffect: pdUseEffect, useMemo: pdUseMemo } = React;

function PillDetailMock() {
  const states = [
    { id: 'std-loading',  label: 'AI · Loading' },
    { id: 'std-ready',    label: 'AI · Ready' },
    { id: 'std-regen',    label: 'AI · Regenerating' },
    { id: 'safety-ready', label: 'Safety · Links' },
    { id: 'safety-empty', label: 'Safety · No curation' },
  ];
  const [s, setS] = pdUseState('std-ready');
  const [diff, setDiff] = pdUseState(5);

  const isSafety = s.startsWith('safety');
  const pillId = isSafety ? 'confined-space' : 'antifouling';
  const pill = window.PILLS.find(p => p.id === pillId);
  const subject = window.SUBJECTS.find(x => x.id === pill.subject);

  return (
    <div className="content" style={{paddingBottom:120}}>
      <window.V6MockHeader id={isSafety ? 'FE-3 · #10' : 'FE-3 · #9'}
        title={isSafety ? 'Safety pill viewer' : 'Pill detail'}
        sub={isSafety
          ? "When a pill is flagged safety_relevant, Acumen swaps the AI explainer for curated industry links per AC-D21. Same route, same picker, same Practice CTA — different epistemic posture."
          : "Pill metadata on the left, AI-generated learning material on the right. The difficulty picker and Practice CTA sit in a sticky bottom bar so they're reachable from any scroll position."}
        states={states} state={s} onState={setS}/>

      {/* Subject crumb */}
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'18px 0 8px', flexWrap:'wrap'}}>
        <span className="t-meta" style={{color:subject.color}}>{subject.name.toUpperCase()}</span>
        <span style={{color:'var(--ink-4)'}}>/</span>
        <span className="t-meta">PILL · {pill.id}</span>
        {pill.safety && <window.Pill tone="danger" mono>Safety</window.Pill>}
      </div>

      {/* Pill name */}
      <h2 className="h-1" style={{fontSize:42, marginBottom:6, letterSpacing:'-0.018em'}}>
        <span className="serif-it">{isSafety ? 'Confined' : 'Antifouling'}</span> {isSafety ? 'Space Entry' : 'Systems'}
      </h2>

      <div className="grid grid-12 gap-4" style={{marginTop:32}}>
        <div className="col-span-4">
          <PillMetaCard pill={pill} subject={subject} isSafety={isSafety}/>
          {isSafety && <SafetyPosterCard/>}
        </div>
        <div className="col-span-8">
          {s === 'std-loading'  && <MaterialLoading/>}
          {s === 'std-ready'    && <MaterialReady regenerating={false} onRegen={() => setS('std-regen')}/>}
          {s === 'std-regen'    && <MaterialReady regenerating={true}  onRegen={() => {}}/>}
          {s === 'safety-ready' && <SafetyLinks/>}
          {s === 'safety-empty' && <SafetyEmpty/>}
        </div>
      </div>

      <StickyDifficultyBar diff={diff} setDiff={setDiff} pill={pill}/>
    </div>
  );
}

// ============================================================
// LEFT — pill metadata
// ============================================================
function PillMetaCard({ pill, subject, isSafety }) {
  return (
    <div className="card" style={{padding:24}}>
      <div className="eyebrow mb-3">About this pill</div>

      <Meta label="Subject" value={
        <span style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{width:8, height:8, background:subject.color, flexShrink:0}}/>
          {subject.name}
        </span>
      }/>
      <Meta label="Difficulty range" value={<span className="mono">D1 – D10</span>}/>
      <Meta label="Your current band" value={<window.BandTag band={pill.band}/>}/>
      <Meta label="Competence" value={
        <span className="mono">{pill.competence.toFixed(1)} <span className="muted">· n={pill.n}</span></span>
      }/>
      <Meta label="Last activity" value={<span className="muted">{pill.lastDays}d ago</span>}/>

      <div style={{height:1, background:'var(--line)', margin:'18px 0'}}/>

      <div className="eyebrow mb-2">Description</div>
      <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>
        {isSafety ? (
          <>
            Permit-to-work, atmospheric testing, ventilation, rescue. The standards
            that govern entry into tanks, voids, and any enclosed space classified
            under <span className="mono">OHSA Sec 21</span>. Safety-tagged: Acumen
            doesn't generate teaching content for this pill — only curated industry sources.
          </>
        ) : (
          <>
            Self-polishing copolymer (SPC), controlled-depletion polymer (CDP),
            hybrid, and fouling-release systems. Specification, application,
            and post-dry-dock inspection. Mostly seawater, but coverage extends
            to brackish boot-top and ballast service.
          </>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--line)'}}>
      <span className="t-meta">{label.toUpperCase()}</span>
      <span style={{fontSize:13}}>{value}</span>
    </div>
  );
}

function SafetyPosterCard() {
  return (
    <div className="card mt-4" style={{padding:18, background:'var(--danger-soft)', borderColor:'transparent'}}>
      <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
        <span style={{color:'var(--danger)', flexShrink:0, marginTop:1}}>
          <window.Icon name="shield" size={16}/>
        </span>
        <div>
          <div style={{fontSize:13, fontWeight:600, color:'var(--danger)', marginBottom:4}}>
            Safety-relevant pill
          </div>
          <div style={{fontSize:12, color:'var(--danger)', lineHeight:1.55, opacity:0.9}}>
            Acumen never generates safety teaching content. Material below comes from
            curated industry sources — vetted publishers, regulators, and OEMs.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RIGHT (STANDARD) — AI-generated material
// ============================================================
function MaterialLoading() {
  return (
    <div className="card" style={{padding:30}}>
      <div className="row jc-b ai-c mb-4">
        <div className="eyebrow">Learning material</div>
        <div className="t-meta" style={{color:'var(--ink-4)'}}>
          <span className="pulse-dot" style={{width:6, height:6, marginRight:8}}/>
          Generating · claude-sonnet-4-5
        </div>
      </div>
      <div className="skel" style={{width:'70%', height:30, marginBottom:14}}/>
      <div className="skel" style={{width:'90%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'85%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'40%', height:12, marginBottom:24}}/>

      <div className="skel" style={{width:'52%', height:22, marginBottom:14}}/>
      <div className="skel" style={{width:'88%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'92%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'74%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'56%', height:12, marginBottom:24}}/>

      <div className="skel" style={{width:'42%', height:22, marginBottom:14}}/>
      <div className="skel" style={{width:'80%', height:12, marginBottom:8}}/>
      <div className="skel" style={{width:'76%', height:12}}/>

      <div style={{
        marginTop:32, paddingTop:18, borderTop:'1px solid var(--line)',
        fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)',
      }}>
        Usually ready in 4–8 seconds. The longer this runs, the more reading material is being prepared.
      </div>
    </div>
  );
}

function MaterialReady({ regenerating, onRegen }) {
  return (
    <div className="card" style={{padding:30, position:'relative', opacity: regenerating ? 0.5 : 1}}>
      {regenerating && (
        <div style={{
          position:'absolute', top:14, right:18,
          display:'flex', gap:8, alignItems:'center',
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent)',
          background:'var(--accent-soft)', padding:'4px 10px',
        }}>
          <span className="pulse-dot" style={{width:6, height:6, marginRight:4, background:'var(--accent)'}}/>
          regenerating…
        </div>
      )}
      <div className="eyebrow mb-4">Learning material · <span className="muted">~4 min read</span></div>

      <h2 className="serif" style={{fontSize:28, lineHeight:1.2, letterSpacing:'-0.012em', marginBottom:14}}>
        <span className="serif-it">Why service-speed</span> matters for SPC.
      </h2>
      <p style={proseP}>
        Self-polishing copolymer antifoulings work by hydrolysing — the polymer's
        outermost layer breaks down in contact with seawater, exposing fresh biocide
        beneath. <strong>The rate of hydrolysis is proportional to water flow across
        the hull</strong>: the faster the ship moves, the faster the surface refreshes.
      </p>
      <p style={proseP}>
        This is the central trade-off when picking SPC over a controlled-depletion
        polymer (CDP) system. CDP releases biocide on a fixed schedule independent
        of vessel speed; SPC self-regulates. For a vessel routinely operating above
        12 knots, SPC's self-polishing behaviour gives a more uniform release curve
        across the docking interval.
      </p>

      <h3 className="serif" style={proseH3}>The static-berth problem</h3>
      <p style={proseP}>
        SPC's strength is also its weakness. A vessel that sits motionless for weeks
        between operations starves its coating of the flow it needs to self-polish.
        Fouling colonises the static surface; once colonised, no amount of subsequent
        movement reverses the build-up.
      </p>

      <CodeishExample
        title="Service profile · coastal patrol example"
        rows={[
          ['Static days at berth',     '10–14',     'starves SPC of flow'],
          ['Active days at sea',       '2–3',       'partial self-polish, insufficient to recover'],
          ['Expected SPC life',        '36 months', 'vendor spec'],
          ['Observed SPC life',        '~9 months', 'this case'],
        ]}/>

      <h3 className="serif" style={proseH3}>What to recommend instead</h3>
      <p style={proseP}>
        For vessels that spend more than 30% of time static, consider a biocide-boosted
        CDP system or a fouling-release (silicone) topcoat over an SPC primer. Each has
        cost implications worth communicating to the operator before specifying.
      </p>

      <div style={{
        marginTop:30, paddingTop:18, borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
      }}>
        <div className="t-meta" style={{color:'var(--ink-3)', display:'flex', alignItems:'center', gap:8}}>
          <window.Icon name="sparkles" size={11}/>
          Generated 22 May by <span className="mono">claude-sonnet-4-5</span> · grounded on 3 Drive sources
        </div>
        <button onClick={onRegen} disabled={regenerating} style={{
          fontSize:12, color: regenerating ? 'var(--ink-4)' : 'var(--ink-3)',
          borderBottom:'1px dotted ' + (regenerating ? 'var(--ink-4)' : 'var(--ink-3)'),
          paddingBottom:1, cursor: regenerating ? 'default' : 'pointer',
        }}>
          {regenerating ? 'Regenerating…' : 'Regenerate this material'}
        </button>
      </div>
    </div>
  );
}

const proseP = {
  fontSize:14.5, fontFamily:'var(--font-serif)',
  color:'var(--ink)', lineHeight:1.65, marginBottom:14,
  maxWidth:'66ch',
};
const proseH3 = {
  fontSize:20, lineHeight:1.3, letterSpacing:'-0.005em',
  marginTop:26, marginBottom:10,
};

function CodeishExample({ title, rows }) {
  return (
    <div style={{
      margin:'18px 0',
      background:'var(--bg-sunk)',
      border:'1px solid var(--line)',
      padding:'14px 16px',
      fontFamily:'var(--font-mono)', fontSize:12, lineHeight:1.7,
    }}>
      <div style={{
        fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.12em',
        color:'var(--ink-3)', textTransform:'uppercase', marginBottom:8,
      }}>{title}</div>
      {rows.map((row, i) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'180px 100px 1fr', gap:14, padding:'2px 0'}}>
          <span style={{color:'var(--ink-2)'}}>{row[0]}</span>
          <span style={{color:'var(--accent-ink)', fontWeight:600}}>{row[1]}</span>
          <span style={{color:'var(--ink-3)'}}>{row[2]}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RIGHT (SAFETY) — curated links
// ============================================================
const SAFETY_LINKS = [
  {
    title: 'Confined Space Entry — Guidance Note GN-78',
    source: 'Department of Employment & Labour, South Africa',
    sourceShort: 'DoEL · ZA',
    kind: 'regulator',
    body: 'Statutory definition of a confined space under OHSA, plus the minimum permit-to-work elements. Start here.',
    minutes: 12,
  },
  {
    title: 'API Recommended Practice 2016 — Entry into Refinery Vessels',
    source: 'American Petroleum Institute',
    sourceShort: 'API',
    kind: 'standard',
    body: 'The industry reference for atmospheric testing sequencing (O₂ → LEL → toxic), retesting intervals, and ventilation calculations.',
    minutes: 28,
  },
  {
    title: 'Rescue from a Confined Space — Operational Lessons',
    source: 'NIOSH FACE Reports (case-study collection)',
    sourceShort: 'NIOSH · US',
    kind: 'casebook',
    body: 'Eight fatal-incident reconstructions. The recurring failure mode is well-meaning rescuers entering without their own air supply.',
    minutes: 35,
  },
  {
    title: 'BS EN 689:2018 — Workplace Exposure: Measurement Strategy',
    source: 'British Standards Institution',
    sourceShort: 'BSI',
    kind: 'standard',
    body: 'How to size and design the atmospheric monitoring programme for a recurring confined-space operation.',
    minutes: 20,
  },
];

function SafetyLinks() {
  return (
    <div className="card" style={{padding:30}}>
      <div className="row jc-b ai-c mb-4">
        <div className="eyebrow">Curated industry sources · AC-D21</div>
        <div className="t-meta" style={{color:'var(--ink-3)'}}>last curated 14 days ago · by Gys M.</div>
      </div>

      <p style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.6, marginBottom:20, maxWidth:'58ch'}}>
        Four hand-picked sources, in the order an administrator suggested working
        through them. Open each in a new tab — Acumen tracks which links you've
        opened so the difficulty picker can be calibrated to your reading.
      </p>

      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {SAFETY_LINKS.map((l, i) => <SafetyLink key={i} l={l} n={i+1}/>)}
      </div>
    </div>
  );
}

function SafetyLink({ l, n }) {
  const kindLabel = { regulator:'REGULATOR', standard:'STANDARD', casebook:'CASE STUDIES' }[l.kind];
  return (
    <a style={{
      display:'flex', gap:14,
      padding:'16px 18px',
      background:'var(--bg-sunk)',
      borderLeft:'2px solid var(--ink)',
      cursor:'pointer',
      textDecoration:'none', color:'inherit',
    }}>
      <span className="serif" style={{fontSize:24, color:'var(--ink-3)', lineHeight:1, paddingTop:2}}>
        {String(n).padStart(2,'0')}
      </span>
      <div style={{flex:1}}>
        <div style={{display:'flex', gap:8, alignItems:'baseline', flexWrap:'wrap', marginBottom:4}}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em',
            color:'var(--ink-3)',
          }}>{kindLabel}</span>
          <span style={{color:'var(--ink-4)'}}>·</span>
          <span className="muted" style={{fontSize:11.5}}>{l.sourceShort}</span>
          <span style={{color:'var(--ink-4)'}}>·</span>
          <span className="muted" style={{fontSize:11.5}}>~{l.minutes} min</span>
        </div>
        <div style={{fontWeight:600, fontSize:14, marginBottom:4, lineHeight:1.4}}>
          {l.title} <window.Icon name="external" size={12} style={{verticalAlign:'middle', marginLeft:4, color:'var(--ink-3)'}}/>
        </div>
        <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>{l.body}</div>
        <div className="t-meta" style={{marginTop:8, color:'var(--ink-4)'}}>
          {l.source}
        </div>
      </div>
    </a>
  );
}

function SafetyEmpty() {
  return (
    <div className="card" style={{padding:'48px 30px', textAlign:'center'}}>
      <div style={{
        width:48, height:48, borderRadius:'50%',
        background:'var(--bg-sunk)', color:'var(--ink-3)',
        display:'grid', placeItems:'center',
        margin:'0 auto 18px',
        border:'1px solid var(--line)',
      }}>
        <window.Icon name="book" size={22}/>
      </div>
      <div className="serif" style={{fontSize:24, lineHeight:1.2, letterSpacing:'-0.012em', marginBottom:8}}>
        <span className="serif-it">We're sourcing</span> safety-grade resources.
      </div>
      <div className="muted" style={{fontSize:13, lineHeight:1.6, marginBottom:18, maxWidth:'44ch', margin:'0 auto 18px'}}>
        This pill was flagged safety-relevant after curation closed for the week.
        An administrator is identifying vetted sources — usually back within 48 hours.
        You'll get a notification when material is ready.
      </div>
      <div className="t-meta" style={{color:'var(--ink-3)'}}>
        Per AC-D21 · Acumen never generates safety teaching content
      </div>
    </div>
  );
}

// ============================================================
// STICKY BOTTOM — difficulty + practice CTA
// ============================================================
function StickyDifficultyBar({ diff, setDiff, pill }) {
  return (
    <div style={{
      position:'sticky', bottom:0, marginTop:32, marginLeft:-48, marginRight:-48, marginBottom:-64,
      background:'var(--bg-raised)', borderTop:'1px solid var(--line-strong)',
      padding:'18px 48px', zIndex:5,
      display:'flex', alignItems:'center', gap:24, flexWrap:'wrap',
      boxShadow:'0 -1px 0 0 var(--bg)',
    }}>
      <div>
        <div className="t-meta" style={{marginBottom:6}}>DIFFICULTY</div>
        <div style={{display:'flex', gap:1}}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const active = n === diff;
            return (
              <button key={n} onClick={() => setDiff(n)} style={{
                width:32, height:32,
                fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:600,
                color: active ? 'var(--bg-raised)' : 'var(--ink-2)',
                background: active ? 'var(--ink)' : 'var(--bg-sunk)',
                border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
                marginLeft: n===1 ? 0 : -1,
              }}>{n}</button>
            );
          })}
        </div>
      </div>
      <div style={{flex:1, minWidth:120}}>
        <div className="t-meta" style={{marginBottom:6}}>YOUR BAND AT D{diff}</div>
        <window.BandTag band={pill.band}/>
        <span className="muted" style={{fontSize:11.5, marginLeft:8}}>
          {diff > 6 ? 'above your current working level' : diff < 4 ? 'below your current band' : 'matched to your band'}
        </span>
      </div>
      <button className="btn btn-primary btn-lg" style={{minWidth:200, justifyContent:'center'}}>
        Practice at D{diff} <span className="arrow">→</span>
      </button>
    </div>
  );
}

window.PillDetailMock = PillDetailMock;
