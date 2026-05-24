// admin-ops.jsx — v6 · FE-9 · #23 + #24 + #25 + #26
// Administrator-side additions. Each mock extends an existing screen
// (loop queue, engagement, system, calibration) in-place; all rendered
// inside the shell with rail + topbar present.

const { useState: aoUseState, useEffect: aoUseEffect } = React;

function AdminOpsMock() {
  const states = [
    { id: 'loops',       label: '#23 · Loop approve / reject' },
    { id: 'engagement',  label: '#24 · Engagement sweep' },
    { id: 'system',      label: '#25 · System page' },
    { id: 'calibration', label: '#26 · Anchor calibration' },
  ];
  const [s, setS] = aoUseState('loops');

  const titleByState = {
    loops: 'Loop queue actions',
    engagement: 'Engagement sweep',
    system: 'System operations',
    calibration: 'Anchor calibration',
  };
  const subByState = {
    loops: "AdminLoops gains per-row Approve / Reject affordances on rows in the Your review state. Both open modals; reject requires a reason, approve makes notes optional.",
    engagement: "Engagement gains a 'Run sweep' header button. The per-row Nudge / Reassign affordances are removed — v1 rule: sweep-only.",
    system: "New consolidated page replacing what used to be individual cron toggles. Each block represents one admin operation with its own run state.",
    calibration: "New /admin/calibration page. Run a calibration pass across all pills, then resolve flagged anchors one at a time.",
  };

  return (
    <div className="content" style={{paddingBottom:80}}>
      <window.V6MockHeader id="FE-9"
        title={titleByState[s]}
        sub={subByState[s]}
        states={states} state={s} onState={setS}/>

      <div style={{marginTop:24}}>
        {s === 'loops'       && <LoopActionsMock/>}
        {s === 'engagement'  && <EngagementSweepMock/>}
        {s === 'system'      && <SystemPageMock/>}
        {s === 'calibration' && <CalibrationMock/>}
      </div>
    </div>
  );
}

// ============================================================
// #23 — LOOP APPROVE / REJECT
// ============================================================
function LoopActionsMock() {
  const subStates = [
    { id: 'idle',    label: 'Row state' },
    { id: 'approve', label: 'Approve modal' },
    { id: 'reject',  label: 'Reject modal' },
    { id: 'submitting', label: 'Submitting · reject' },
  ];
  const [ss, setSs] = aoUseState('idle');

  return (
    <div style={{position:'relative'}}>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>

      {/* Reuse the AdminLoops layout, but with action buttons on review rows */}
      <div className="grid grid-4 gap-4" style={{marginBottom:24}}>
        <window.Stat value="34" label="ACTIVE LOOPS"/>
        <window.Stat value="8"  label="AWAITING YOUR REVIEW" tone="accent"/>
        <window.Stat value="73%" label="LOOP SUCCESS RATE" hint="closed within 2 follow-ups"/>
        <window.Stat value="2.1" label="AVG FOLLOW-UPS TO CLOSE"/>
      </div>

      <div className="card">
        <table className="tbl">
          <thead><tr><th>Testee</th><th>Pill</th><th>Mode</th><th>Iteration</th><th>Last attempt</th><th>Status</th><th style={{width:160}} className="right">Action</th></tr></thead>
          <tbody>
            <LoopRow row={LOOP_ROWS[0]} actionable/>
            <LoopRow row={LOOP_ROWS[1]} actionable/>
            <LoopRow row={LOOP_ROWS[2]}/>
            <LoopRow row={LOOP_ROWS[3]}/>
            <LoopRow row={LOOP_ROWS[4]}/>
          </tbody>
        </table>
      </div>

      {ss === 'approve' && <ApproveModal/>}
      {ss === 'reject' && <RejectModal submitting={false}/>}
      {ss === 'submitting' && <RejectModal submitting={true}/>}
    </div>
  );
}

const LOOP_ROWS = [
  { name:'Lerato D.', pill:'Corrosion Mechanisms',  mode:'admin-reviewed', iter:'1 of 1', last:'11m ago',  status:'review',    note:'weakness report ready · D5 → D4 follow-up proposed'},
  { name:'Themba N.', pill:'Antifouling Systems',   mode:'admin-reviewed', iter:'2 of 2', last:'21m ago',  status:'review',    note:'second weak attempt · D4 follow-up proposed'},
  { name:'Sipho M.',  pill:'BoQ Preparation',       mode:'autonomous',     iter:'3 of ∞', last:'21m ago',  status:'step-down', note:'AC-D9: 3 failed at D5, suggesting D4'},
  { name:'Kabelo R.', pill:'Immersion Service',     mode:'autonomous',     iter:'2 of ∞', last:'32m ago',  status:'material-served', note:'explainer + 2 TDSes served'},
  { name:'Naledi P.', pill:'Adhesion Testing',      mode:'autonomous',     iter:'1 of ∞', last:'2d ago',   status:'closed',    note:'passed at D5 · loop closed'},
];

function LoopRow({ row, actionable }) {
  return (
    <tr>
      <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{row.name[0]}</div>{row.name}</div></td>
      <td>{row.pill}</td>
      <td><window.Pill tone={row.mode === 'autonomous' ? 'soft' : 'accent'} mono>{row.mode}</window.Pill></td>
      <td className="num">{row.iter}</td>
      <td className="t-meta">{row.last}</td>
      <td>
        {row.status === 'review'    && <window.Pill tone="warn"   mono>Your review</window.Pill>}
        {row.status === 'queued'    && <window.Pill tone="info"   mono>Follow-up queued</window.Pill>}
        {row.status === 'step-down' && <window.Pill tone="accent" mono>Step-down suggested</window.Pill>}
        {row.status === 'material-served' && <window.Pill tone="ok" mono>Material served</window.Pill>}
        {row.status === 'closed'    && <window.Pill tone="soft"   mono>Closed</window.Pill>}
      </td>
      <td className="right">
        {actionable ? (
          <div className="row gap-2" style={{justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>Reject</button>
            <button className="btn btn-sm">Approve</button>
          </div>
        ) : (
          <span className="muted" style={{fontSize:12}}>{row.note}</span>
        )}
      </td>
    </tr>
  );
}

function ApproveModal() {
  return (
    <Modal width={560}>
      <div className="eyebrow mb-2">Approve loop iteration</div>
      <div className="serif" style={{fontSize:24, lineHeight:1.25, letterSpacing:'-0.01em', marginBottom:16}}>
        <span className="serif-it">Approve the D4 follow-up</span> for Lerato D.?
      </div>

      <div className="card sunk tight" style={{padding:16, marginBottom:16, background:'var(--bg-sunk)'}}>
        <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:'8px 14px', fontSize:13}}>
          <span className="t-meta">TESTEE</span>     <span>Lerato D.</span>
          <span className="t-meta">PILL</span>       <span>Corrosion Mechanisms</span>
          <span className="t-meta">CURRENT</span>    <span>D5 · 52% · <window.BandTag band="junior"/></span>
          <span className="t-meta">PROPOSED</span>   <span>D4 follow-up · 8 questions · ~12 min · in 5 days</span>
          <span className="t-meta">RATIONALE</span>  <span className="muted">First weak attempt · loop generated explainer + 2 TDS skims. AC-D9 step-down threshold not yet reached.</span>
        </div>
      </div>

      <label style={modalLabelStyle}>NOTES (optional, visible to the testee)</label>
      <textarea className="input" rows={3} placeholder="e.g. Skim the Hempel Olympic datasheet before the follow-up — pages 4-6 cover the static-berth case directly."/>

      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary">Confirm approval <span className="arrow">→</span></button>
      </ModalActions>
    </Modal>
  );
}

function RejectModal({ submitting }) {
  return (
    <Modal width={560}>
      <div className="eyebrow mb-2" style={{color:'var(--danger)'}}>Reject loop iteration</div>
      <div className="serif" style={{fontSize:24, lineHeight:1.25, letterSpacing:'-0.01em', marginBottom:16}}>
        <span className="serif-it">Reject the D4 follow-up</span> for Themba N.?
      </div>

      <div className="card sunk tight" style={{padding:16, marginBottom:16, background:'var(--bg-sunk)'}}>
        <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:'8px 14px', fontSize:13}}>
          <span className="t-meta">TESTEE</span>    <span>Themba N.</span>
          <span className="t-meta">PILL</span>      <span>Antifouling Systems</span>
          <span className="t-meta">CURRENT</span>   <span>D4 · 41% · <window.BandTag band="junior"/></span>
          <span className="t-meta">PROPOSED</span>  <span>D4 follow-up · 8 questions · ~12 min · in 5 days</span>
        </div>
      </div>

      <div style={{
        background:'var(--danger-soft)', padding:'12px 14px',
        marginBottom:16, borderLeft:'2px solid var(--danger)',
      }}>
        <div style={{fontSize:12.5, color:'var(--danger)', lineHeight:1.55}}>
          Rejecting closes this loop iteration. The testee will be notified;
          no follow-up is scheduled automatically.
        </div>
      </div>

      <label style={modalLabelStyle}>REASON (required, visible to the testee)</label>
      <textarea className="input" rows={4}
        defaultValue={submitting ? "Second weak attempt at D4 — recommend they meet me 1:1 before a third pass. I'll schedule a session manually." : ""}
        placeholder="Why are you rejecting this loop iteration? (visible to the testee)"
        style={{borderColor: submitting ? 'var(--line)' : 'var(--line)'}}/>

      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary" disabled={submitting}
          style={{background: submitting ? 'var(--danger)' : 'var(--danger)', borderColor: 'var(--danger)'}}>
          {submitting ? (
            <><span className="pulse-dot" style={{width:7, height:7, background:'currentColor'}}/> Rejecting…</>
          ) : (
            <>Confirm rejection <span className="arrow">→</span></>
          )}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ============================================================
// #24 — ENGAGEMENT SWEEP
// ============================================================
function EngagementSweepMock() {
  const subStates = [
    { id: 'idle',    label: 'Idle' },
    { id: 'running', label: 'Sweep running' },
    { id: 'done',    label: 'Sweep complete + toast' },
  ];
  const [ss, setSs] = aoUseState('idle');

  return (
    <div>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>

      <window.PageHeader
        eyebrow="AC-D26 · derived engagement_status · 7-day default threshold"
        title={<><span className="serif-it">Who's</span> not engaging.</>}
        subtitle="Mandatory assignments that have been pending past your configured threshold. Auto-reminders fire at the schedule below; non-engagement after the second escalates to you."
        actions={<SweepButton state={ss}/>}
      />

      <div className="grid grid-4 gap-4 mb-6">
        <window.Stat value="4"   label="ESCALATED"   hint="past 2nd reminder"/>
        <window.Stat value="11"  label="OVERDUE"     hint="soft deadline lapsed"/>
        <window.Stat value="23"  label="PENDING"     hint="not started"/>
        <window.Stat value="34d" label="OLDEST STALE" hint="Confined Space · Naledi P."/>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">Pending mandatory</div>
            <h3 className="h-3">38 assignments</h3>
          </div>
          <div className="seg">
            <button data-active="true">Stale</button>
            <button>By assigner</button>
            <button>By pill</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Testee</th><th>Assignment</th><th>Assigned by</th><th>Stale</th><th>Reminders</th><th>Status</th></tr>
          </thead>
          <tbody>
            {[
              {testee:'Naledi P.',  assignment:'Confined Space Entry', assigner:'Gys M.', daysStale:34, remindersSent:2, escalated:true},
              {testee:'Bongani K.', assignment:'BoQ Preparation',      assigner:'Jay V.', daysStale:22, remindersSent:2, escalated:true},
              {testee:'Sipho M.',   assignment:'Adhesion Testing',     assigner:'Gys M.', daysStale:18, remindersSent:2, escalated:false},
              {testee:'Kabelo R.',  assignment:'Antifouling Systems',  assigner:'Jay V.', daysStale:14, remindersSent:1, escalated:false},
              {testee:'Themba N.',  assignment:'Corrosion Mechanisms', assigner:'Gys M.', daysStale: 9, remindersSent:1, escalated:false},
              {testee:'Lerato D.',  assignment:'Inspection Tools',     assigner:'Jay V.', daysStale: 8, remindersSent:0, escalated:false},
            ].map(e => (
              <tr key={e.testee + e.assignment}>
                <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{e.testee[0]}</div>{e.testee}</div></td>
                <td>{e.assignment}</td>
                <td>{e.assigner}</td>
                <td className="num">{e.daysStale}d</td>
                <td className="num">{e.remindersSent} of 2</td>
                <td>{e.escalated ? <window.Pill tone="danger" mono>Escalated</window.Pill> : <window.Pill tone="warn" mono>Pending</window.Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Removal callout */}
      <div style={{
        marginTop:24, padding:'14px 16px',
        background:'var(--bg-sunk)', borderLeft:'2px solid var(--accent)',
      }}>
        <div className="eyebrow mb-2">Per-row drift removed · v1 rule</div>
        <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6}}>
          The v5 prototype had per-row <strong>Nudge</strong> and <strong>Reassign</strong>
          buttons in the right-most column (admin.jsx 356-357). v1 ships sweep-only:
          one administrative action that scans all stale assignments, fires the appropriate
          reminder, and escalates anything past threshold. Row-level affordances were design
          drift and aren't carried forward.
        </div>
      </div>

      {/* Toast on done */}
      {ss === 'done' && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:10,
          display:'flex', alignItems:'stretch',
          background:'var(--bg-raised)', border:'1px solid var(--line-strong)',
          boxShadow:'var(--shadow-2)', width:380,
        }}>
          <div style={{width:3, background:'var(--ok)', flexShrink:0}}/>
          <div style={{padding:'12px 14px', flex:1}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
              <span style={{
                fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.14em',
                color:'var(--ok)', fontWeight:600,
              }}>SWEEP COMPLETE</span>
            </div>
            <div style={{fontWeight:600, fontSize:13.5, marginBottom:2}}>Swept 38 stale assignments</div>
            <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>
              31 first reminders · 5 second reminders · 2 escalated to you.
            </div>
          </div>
          <button style={{padding:'10px 12px', color:'var(--ink-4)', alignSelf:'flex-start'}}>
            <window.Icon name="x" size={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

function SweepButton({ state }) {
  if (state === 'running') {
    return (
      <button className="btn btn-primary" disabled style={{opacity:0.92}}>
        <span className="pulse-dot" style={{width:8, height:8, background:'currentColor'}}/>
        Sweeping 38 assignments…
      </button>
    );
  }
  if (state === 'done') {
    return (
      <button className="btn">
        <window.Icon name="check" size={12} stroke={2}/> Sweep complete · run again
      </button>
    );
  }
  return (
    <button className="btn btn-primary">
      <window.Icon name="play" size={12}/> Run sweep <span className="arrow">→</span>
    </button>
  );
}

// ============================================================
// #25 — SYSTEM PAGE
// ============================================================
const SYSTEM_OPS = [
  {
    id:'bootstrap',
    eyebrow:'AC-D2 · once per tenant · idempotent',
    title:'Bootstrap',
    desc:'Generates the foundational pill set, anchor questions, and Drive index for a new tenant. Re-runnable; idempotent.',
    stat:[
      ['Last run', '12 May 2026'],
      ['Pills',    '137'],
      ['Anchors',  '2,740'],
      ['Drive index', '412 docs'],
    ],
    cta:'Run bootstrap',
  },
  {
    id:'drive-ingest',
    eyebrow:'AC-D14 · scheduled every 6 hours · manual override',
    title:'Drive ingest',
    desc:'Pulls new and changed documents from the configured Google Drive folders. Embeds them with text-embedding-3-small and writes to the vector index.',
    stat:[
      ['Last ingest', '2 hours ago'],
      ['New docs',    '7'],
      ['Updated',     '3'],
      ['Removed',     '0'],
    ],
    cta:'Ingest now',
    recent:[
      { when:'2h ago', new:7, upd:3, ok:true },
      { when:'8h ago', new:2, upd:0, ok:true },
      { when:'14h ago', new:0, upd:1, ok:true },
      { when:'20h ago', new:11, upd:5, ok:true },
    ],
  },
  {
    id:'drive-index',
    eyebrow:'derived · read-only',
    title:'Drive index status',
    desc:'Current state of the vector index. Freshness is the median time since each indexed document was last verified against Drive.',
    stat:[
      ['Indexed docs', '412'],
      ['Freshness',    '4 hours median'],
      ['Drift',        '0 docs'],
      ['Embeddings',   '1.2M tokens'],
    ],
    cta:null,
  },
  {
    id:'realism',
    eyebrow:'AC-D24 · daily aggregate · 23:00 SAST',
    title:'Realism aggregate',
    desc:'Aggregates testee realism flags into question-level quality scores. Questions below threshold are routed to AdminCatalogue for review.',
    stat:[
      ['Last run',         '14 hours ago'],
      ['Flags processed',  '47'],
      ['Below threshold',  '3'],
      ['Auto-suppressed',  '0'],
    ],
    cta:'Aggregate now',
  },
  {
    id:'safety-check',
    eyebrow:'AC-D21 · monthly · safety-pill curated links',
    title:'Safety-link check',
    desc:'Verifies that every URL in every safety-pill curated-links list still resolves and matches its expected source. Flagged drifts route to AdminCatalogue → Safety tab.',
    stat:[
      ['Last check',      '8 days ago'],
      ['Links checked',   '92'],
      ['Flagged drift',   '1'],
      ['Broken',          '0'],
    ],
    cta:'Run check',
  },
];

function SystemPageMock() {
  const subStates = [
    { id:'idle',    label:'Idle' },
    { id:'running', label:'Drive ingest running' },
    { id:'done',    label:'Run complete + toast' },
    { id:'error',   label:'Run failed + toast' },
  ];
  const [ss, setSs] = aoUseState('idle');

  return (
    <div>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>

      <window.PageHeader
        eyebrow="/admin/system · consolidated operational controls"
        title={<><span className="serif-it">System</span> operations.</>}
        subtitle="Five admin actions previously scattered across the codebase, now grouped on one surface. Each has its own status, recent runs, and a manual trigger."
      />

      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {SYSTEM_OPS.map(op => (
          <SystemOpCard key={op.id} op={op}
            running={ss === 'running' && op.id === 'drive-ingest'}/>
        ))}
      </div>

      {(ss === 'done' || ss === 'error') && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:10,
          display:'flex', alignItems:'stretch',
          background:'var(--bg-raised)', border:'1px solid var(--line-strong)',
          boxShadow:'var(--shadow-2)', width:380,
        }}>
          <div style={{width:3, background: ss === 'done' ? 'var(--ok)' : 'var(--danger)', flexShrink:0}}/>
          <div style={{padding:'12px 14px', flex:1}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
              <span style={{
                fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.14em',
                color: ss === 'done' ? 'var(--ok)' : 'var(--danger)', fontWeight:600,
              }}>{ss === 'done' ? 'DRIVE INGEST COMPLETE' : 'DRIVE INGEST FAILED'}</span>
            </div>
            <div style={{fontWeight:600, fontSize:13.5, marginBottom:2}}>
              {ss === 'done' ? '7 new · 3 updated · 0 removed' : "Couldn't reach Drive — auth expired?"}
            </div>
            <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>
              {ss === 'done' ? '12.4s · 1,847 tokens embedded' : 'Trace 7f8a1c · check the integration page.'}
            </div>
          </div>
          <button style={{padding:'10px 12px', color:'var(--ink-4)', alignSelf:'flex-start'}}>
            <window.Icon name="x" size={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

function SystemOpCard({ op, running }) {
  return (
    <div className="card" style={{padding:'22px 24px'}}>
      <div className="row jc-b ai-c" style={{flexWrap:'wrap', gap:14}}>
        <div style={{flex:1, minWidth:260}}>
          <div className="eyebrow mb-1">{op.eyebrow}</div>
          <h3 className="h-3" style={{marginBottom:6}}>{op.title}</h3>
          <div className="muted" style={{fontSize:13, lineHeight:1.55, maxWidth:'68ch'}}>{op.desc}</div>
        </div>
        {op.cta && (
          running ? (
            <button className="btn btn-primary" disabled style={{opacity:0.92}}>
              <span className="pulse-dot" style={{width:8, height:8, background:'currentColor'}}/>
              Running…
            </button>
          ) : (
            <button className="btn">
              <window.Icon name="play" size={12}/> {op.cta} <span className="arrow">→</span>
            </button>
          )
        )}
      </div>

      <div style={{
        marginTop:18, paddingTop:14, borderTop:'1px solid var(--line)',
        display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:18,
      }}>
        {op.stat.map(([k,v]) => (
          <div key={k}>
            <div className="t-meta" style={{marginBottom:4}}>{k.toUpperCase()}</div>
            <div style={{fontSize:15, fontWeight:600, fontFamily:'var(--font-mono)'}}>{v}</div>
          </div>
        ))}
      </div>

      {op.recent && (
        <div style={{marginTop:18, paddingTop:14, borderTop:'1px solid var(--line)'}}>
          <div className="eyebrow mb-3">Recent runs</div>
          <div style={{display:'flex', gap:1}}>
            {op.recent.map((r,i) => (
              <div key={i} style={{
                flex:1, padding:'8px 10px',
                background:'var(--bg-sunk)',
                borderLeft:'2px solid ' + (r.ok ? 'var(--ok)' : 'var(--danger)'),
              }}>
                <div className="t-meta" style={{marginBottom:2}}>{r.when}</div>
                <div style={{fontSize:11.5, fontFamily:'var(--font-mono)', color:'var(--ink-2)'}}>
                  +{r.new} new · ~{r.upd} upd
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// #26 — CALIBRATION
// ============================================================
const FLAGGED_ANCHORS = [
  {
    id:'a-7e21',
    pill:'Antifouling Systems',
    band:'D7',
    reason:'p-value 0.91 — too easy. 19/20 testees scoring at this anchor answered correctly; expected pass rate at D7 is 0.55-0.70.',
    expected:'D5',
    n:20,
    sample:"Which property of SPC chemistry justifies its use at high service speed?",
    severity:'high',
  },
  {
    id:'a-9c44',
    pill:'Corrosion Mechanisms',
    band:'D4',
    reason:'p-value 0.18 — too hard. Only 4/22 testees got this right; expected pass rate at D4 is 0.70-0.85. May be miscategorised.',
    expected:'D6 or higher',
    n:22,
    sample:"Compute the Pourbaix-diagram boundary between Fe²⁺ and Fe(OH)₂…",
    severity:'high',
  },
  {
    id:'a-4f02',
    pill:'BoQ Preparation',
    band:'D5',
    reason:'biserial correlation 0.04 — discrimination too low. The anchor doesn\'t distinguish strong from weak testees; consider replacement.',
    expected:'discriminator pool',
    n:31,
    sample:"Identify the WBS code that maps to bilge-coating works.",
    severity:'medium',
  },
  {
    id:'a-5d18',
    pill:'Adhesion Testing',
    band:'D8',
    reason:'p-value 0.84 — too easy for D8. Distribution suggests this should sit at D6.',
    expected:'D6',
    n:18,
    sample:"Pull-off test minimum acceptance per ISO 4624.",
    severity:'medium',
  },
];

function CalibrationMock() {
  const subStates = [
    { id:'idle',     label:'Idle' },
    { id:'running',  label:'Calibration running' },
    { id:'modal',    label:'Resolve modal · open' },
  ];
  const [ss, setSs] = aoUseState('idle');

  return (
    <div style={{position:'relative'}}>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>

      <window.PageHeader
        eyebrow="AC-D27 · /admin/calibration · psychometric integrity"
        title={<><span className="serif-it">Anchor</span> calibration.</>}
        subtitle="Calibration runs the anchor pool against historical attempts and flags items whose difficulty rating no longer matches observed testee performance. Resolve flagged anchors one at a time — accept, reject, or override the suggested re-band."
        actions={<CalibrationButton state={ss}/>}
      />

      {/* Top summary */}
      <div className="grid grid-12 gap-4" style={{marginBottom:24}}>
        <div className="col-span-3">
          <div className="card center" style={{padding:'22px 18px'}}>
            <div className="stat-big" style={{fontSize:36}}>2,740</div>
            <div className="t-meta">ANCHORS ANALYSED</div>
            <div className="muted mt-2" style={{fontSize:11.5}}>across 137 pills</div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{padding:'22px 18px'}}>
            <div className="stat-big" style={{fontSize:36, color:'var(--warn)'}}>14</div>
            <div className="t-meta">FLAGGED</div>
            <div className="muted mt-2" style={{fontSize:11.5}}>~0.5% of pool</div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{padding:'22px 18px'}}>
            <div className="stat-big" style={{fontSize:36, color:'var(--ok)'}}>96.8</div>
            <div className="t-meta">% IN-BAND</div>
            <div className="muted mt-2" style={{fontSize:11.5}}>p-value within tolerance</div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="card center" style={{padding:'22px 18px'}}>
            <div className="stat-big" style={{fontSize:36}}>14<span style={{fontSize:18}}>d</span></div>
            <div className="t-meta">SINCE LAST RUN</div>
            <div className="muted mt-2" style={{fontSize:11.5}}>monthly default</div>
          </div>
        </div>
      </div>

      {/* Per-pill summary chart-strip */}
      <div className="card mb-4">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">By pill · 8 pills with flagged anchors</div>
            <h3 className="h-3">Calibration drift</h3>
          </div>
          <div className="seg">
            <button data-active="true">Flagged only</button>
            <button>All 137 pills</button>
          </div>
        </div>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(8, 1fr)',
          gap:8, marginTop:8,
        }}>
          {[
            { pill:'Antifouling Systems', flags:3 },
            { pill:'Corrosion Mechanisms', flags:3 },
            { pill:'BoQ Preparation', flags:2 },
            { pill:'Adhesion Testing', flags:2 },
            { pill:'Cathodic Protection', flags:1 },
            { pill:'Inspection Tools', flags:1 },
            { pill:'Confined Space Entry', flags:1 },
            { pill:'Passivation', flags:1 },
          ].map(p => (
            <div key={p.pill} style={{
              padding:'12px 12px 14px',
              background:'var(--bg-sunk)',
              borderLeft:'2px solid var(--warn)',
            }}>
              <div className="t-meta" style={{color:'var(--ink-3)', marginBottom:6}}>{p.pill.toUpperCase()}</div>
              <div style={{fontSize:20, fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--warn)'}}>
                {p.flags}<span style={{fontSize:11, color:'var(--ink-3)', marginLeft:4}}>flagged</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flagged-anchors table */}
      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">Flagged anchors · awaiting resolution</div>
            <h3 className="h-3">{FLAGGED_ANCHORS.length} of 14 in current view</h3>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Pill</th>
              <th>Anchor</th>
              <th>Current band</th>
              <th>Flag</th>
              <th className="num">n</th>
              <th>Suggestion</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {FLAGGED_ANCHORS.map(a => (
              <tr key={a.id}>
                <td>{a.pill}</td>
                <td><span className="mono" style={{fontSize:11.5, color:'var(--ink-3)'}}>{a.id}</span></td>
                <td><window.BandTag band={a.band === 'D7' ? 'advanced' : a.band === 'D4' ? 'junior' : a.band === 'D5' ? 'working' : 'expert'}/></td>
                <td>
                  <window.Pill tone={a.severity === 'high' ? 'danger' : 'warn'} mono>{a.severity}</window.Pill>
                  <div className="muted mt-2" style={{fontSize:11.5, maxWidth:'42ch'}}>{a.reason}</div>
                </td>
                <td className="num">{a.n}</td>
                <td className="mono" style={{fontSize:12}}>{a.expected}</td>
                <td className="right">
                  <button className="btn btn-sm">Resolve</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ss === 'modal' && <ResolveAnchorModal anchor={FLAGGED_ANCHORS[0]}/>}
    </div>
  );
}

function CalibrationButton({ state }) {
  if (state === 'running') {
    return (
      <button className="btn btn-primary" disabled style={{opacity:0.92}}>
        <span className="pulse-dot" style={{width:8, height:8, background:'currentColor'}}/>
        Calibrating 2,740 anchors…
      </button>
    );
  }
  return (
    <button className="btn btn-primary">
      <window.Icon name="play" size={12}/> Run calibration <span className="arrow">→</span>
    </button>
  );
}

function ResolveAnchorModal({ anchor }) {
  const [verdict, setVerdict] = aoUseState('override');
  return (
    <Modal width={620}>
      <div className="eyebrow mb-2">Resolve flagged anchor</div>
      <div className="serif" style={{fontSize:24, lineHeight:1.25, letterSpacing:'-0.01em', marginBottom:6}}>
        <span className="serif-it">{anchor.pill}</span> · <span className="mono" style={{fontSize:18, color:'var(--ink-3)'}}>{anchor.id}</span>
      </div>
      <div className="muted" style={{fontSize:12.5, marginBottom:18}}>
        Currently at <strong style={{color:'var(--ink)'}}>{anchor.band}</strong> · {anchor.n} testees in calibration sample
      </div>

      <div className="card sunk tight" style={{padding:'12px 14px', marginBottom:16, background:'var(--bg-sunk)'}}>
        <div className="eyebrow mb-2">Anchor</div>
        <div className="serif" style={{fontSize:15, lineHeight:1.5, color:'var(--ink-2)'}}>
          "{anchor.sample}"
        </div>
      </div>

      <div style={{
        padding:'12px 14px', marginBottom:18,
        background:'var(--warn-soft)',
        borderLeft:'2px solid var(--warn)',
      }}>
        <div style={{fontSize:12.5, color:'var(--warn)', fontWeight:600, marginBottom:4}}>Why it was flagged</div>
        <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.55}}>{anchor.reason}</div>
        <div style={{fontSize:12, color:'var(--ink-2)', marginTop:6}}>
          Suggested re-band: <strong>{anchor.expected}</strong>
        </div>
      </div>

      <label style={modalLabelStyle}>YOUR DECISION</label>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:18}}>
        <VerdictChoice id="accept" active={verdict === 'accept'} onClick={() => setVerdict('accept')}
          title="Accept" body="Re-band to suggested. Anchor stays in the pool."/>
        <VerdictChoice id="reject" active={verdict === 'reject'} onClick={() => setVerdict('reject')}
          title="Reject" body="Remove from pool. Anchor won't appear in future tests."/>
        <VerdictChoice id="override" active={verdict === 'override'} onClick={() => setVerdict('override')}
          title="Override" body="Keep current band. Calibration won't re-flag it for 90 days."/>
      </div>

      <label style={modalLabelStyle}>REASON (optional, logged in calibration ledger)</label>
      <textarea className="input" rows={3}
        placeholder="e.g. Item is correctly D7 in scope, but our test pool is biased toward more experienced testees this quarter. Re-run after October cohort."/>

      <ModalActions>
        <button className="btn">Cancel</button>
        <div className="row gap-2" style={{justifyContent:'flex-end'}}>
          <button className="btn">Skip · resolve later</button>
          <button className="btn btn-primary">Apply & next <span className="arrow">→</span></button>
        </div>
      </ModalActions>
    </Modal>
  );
}

function VerdictChoice({ active, title, body, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign:'left', padding:'12px 14px',
      background: active ? 'var(--ink)' : 'var(--bg-sunk)',
      color: active ? 'var(--bg-raised)' : 'var(--ink)',
      border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
    }}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{title}</div>
      <div style={{fontSize:11.5, lineHeight:1.5, color: active ? 'var(--bg-sunk)' : 'var(--ink-3)'}}>{body}</div>
    </button>
  );
}

// ============================================================
// SHARED — modal chrome, sub-state strip
// ============================================================
function Modal({ children, width = 520 }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:20,
      background:'color-mix(in oklab, var(--bg-deep) 60%, transparent)',
      display:'grid', placeItems:'center', padding:24,
      backdropFilter:'blur(2px)',
    }}>
      <div className="card" style={{
        maxWidth: width, width:'100%',
        padding:'28px 30px',
        boxShadow:'var(--shadow-2)',
        maxHeight:'88vh', overflowY:'auto',
      }}>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ children }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:10, marginTop:22, paddingTop:18, borderTop:'1px solid var(--line)',
      flexWrap:'wrap',
    }}>
      {children}
    </div>
  );
}

const modalLabelStyle = {
  display:'block', fontSize:10.5, fontFamily:'var(--font-mono)',
  letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)',
  marginBottom:6,
};

function SubStateStrip({ options, value, onChange }) {
  return (
    <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginBottom:18}}>
      <span className="t-meta" style={{marginRight:10, letterSpacing:'0.14em'}}>SUB-STATE</span>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding:'3px 9px',
            fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.04em',
            textTransform:'uppercase',
            color: active ? 'var(--bg-raised)' : 'var(--ink-3)',
            background: active ? 'var(--ink)' : 'transparent',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

window.AdminOpsMock = AdminOpsMock;
