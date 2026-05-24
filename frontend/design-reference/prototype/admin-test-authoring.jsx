// admin-test-authoring.jsx — v6 · FE-8 · #20
// Test authoring — the largest single admin authoring surface.
//
// State strip walks through:
//  - list:    test list page (table view)
//  - create:  new test editor, empty, mode picker focused
//  - editor-per-testee:    in-progress editor, per_testee mode
//  - editor-frozen:        in-progress editor, frozen mode + question editor open
//  - editor-hand-authored: in-progress editor, hand_authored mode
//  - editor-benchmark:     in-progress editor, benchmark mode with difficulty curve
//  - published-locked:     editor for a published test (most fields locked)
//  - locked:               editor for a fully-locked test
//  - question-editor:      isolated focus on the question sub-editor

const { useState: atUseState, useEffect: atUseEffect } = React;

const TEST_AUTHORING_STATES = [
  { id: 'list',                 label: 'List · idle' },
  { id: 'create',                label: 'Create · mode picker' },
  { id: 'editor-per-testee',     label: 'Editor · per-testee' },
  { id: 'editor-frozen',         label: 'Editor · frozen + Q editor' },
  { id: 'editor-hand-authored',  label: 'Editor · hand-authored' },
  { id: 'editor-benchmark',      label: 'Editor · benchmark' },
  { id: 'published-locked',      label: 'Published · mostly locked' },
  { id: 'question-editor',       label: 'Question sub-editor' },
];

function AdminTestAuthoringMock() {
  const [s, setS] = atUseState('list');
  return (
    <div className="content" style={{paddingBottom:80}}>
      <window.V6MockHeader id="FE-8 · #20"
        title="Test authoring"
        sub="The biggest single admin authoring surface. One editor with mode-conditional middle sections, an embedded question sub-editor for question-pool modes, and state-conditional publish controls. Lock state preserves historical comparability of in-flight attempts."
        states={TEST_AUTHORING_STATES} state={s} onState={setS}/>

      <div style={{marginTop:24}}>
        {s === 'list'                && <TestListPage/>}
        {s === 'question-editor'     && <QuestionEditorIsolated/>}
        {s !== 'list' && s !== 'question-editor' && (
          <TestEditor mode={modeFor(s)} status={statusFor(s)} showQEditor={s === 'editor-frozen'}/>
        )}
      </div>
    </div>
  );
}

function modeFor(s) {
  if (s === 'create')                 return null;
  if (s === 'editor-per-testee')      return 'per_testee';
  if (s === 'editor-frozen')          return 'frozen';
  if (s === 'editor-hand-authored')   return 'hand_authored';
  if (s === 'editor-benchmark')       return 'benchmark';
  if (s === 'published-locked')       return 'per_testee';
  return null;
}
function statusFor(s) {
  if (s === 'published-locked') return 'published';
  if (s === 'create')           return 'new';
  return 'draft';
}

// ============================================================
// LIST PAGE
// ============================================================
const TESTS = [
  { id:'antifouling-focus', title:'Antifouling — focus',      mode:'per_testee',   status:'published', pills:1, edited:'2d ago' },
  { id:'q2-annual',         title:'Q2 Annual Competency',     mode:'frozen',       status:'locked',    pills:7, edited:'27d ago' },
  { id:'safety-refresh',    title:'Confined Space refresher', mode:'frozen',       status:'published', pills:1, edited:'12d ago' },
  { id:'hand-authored-001', title:'Cathodic Protection · ENG-2401', mode:'hand_authored', status:'draft', pills:1, edited:'4h ago' },
  { id:'benchmark-2026',    title:'SiteMesh Annual Benchmark · 2026', mode:'benchmark', status:'published', pills:8, edited:'6 weeks ago' },
  { id:'paint-sample',      title:'Paint specification · skill-check', mode:'per_testee', status:'draft', pills:2, edited:'1h ago' },
];

function TestListPage() {
  return (
    <div>
      <div className="grid grid-4 gap-4 mb-6">
        <window.Stat value="22" label="TESTS" hint="across all modes"/>
        <window.Stat value="14" label="PUBLISHED" hint="bound to assignments"/>
        <window.Stat value="6"  label="DRAFT"/>
        <window.Stat value="2"  label="LOCKED" hint="historical preservation"/>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">Tests · all modes</div>
            <h3 className="h-3">Authored tests</h3>
          </div>
          <div className="row gap-2">
            <div className="seg">
              <button data-active="true">All</button>
              <button>per_testee</button>
              <button>frozen</button>
              <button>hand_authored</button>
              <button>benchmark</button>
            </div>
            <button className="btn btn-primary">
              <window.Icon name="plus" size={12}/> New test
            </button>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Title</th><th>Mode</th><th>Status</th><th>Pills</th><th>Last edited</th><th></th></tr></thead>
          <tbody>
            {TESTS.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{display:'flex', flexDirection:'column'}}>
                    <span style={{fontWeight:600}}>{t.title}</span>
                    <span className="t-meta" style={{marginTop:2}}>
                      {t.id} · {t.mode === 'per_testee' && '4 to 12 questions sampled per testee'}
                      {t.mode === 'frozen'        && 'fixed pool · everyone sees the same questions'}
                      {t.mode === 'hand_authored' && 'manually written · no generation'}
                      {t.mode === 'benchmark'     && 'sequential walk · cohort comparison'}
                    </span>
                  </div>
                </td>
                <td><window.Pill tone={modePillTone(t.mode)} mono>{t.mode}</window.Pill></td>
                <td>
                  {t.status === 'published' && <window.Pill tone="ok"   mono>Published</window.Pill>}
                  {t.status === 'draft'     && <window.Pill tone="warn" mono>Draft</window.Pill>}
                  {t.status === 'locked'    && (
                    <div className="row gap-2 ai-c">
                      <window.Icon name="lock" size={11} style={{color:'var(--ink-3)'}}/>
                      <window.Pill tone="soft" mono>Locked</window.Pill>
                    </div>
                  )}
                </td>
                <td className="num">{t.pills}</td>
                <td className="t-meta">{t.edited}</td>
                <td className="right">
                  <button className="btn btn-ghost btn-sm">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function modePillTone(mode) {
  if (mode === 'per_testee')    return 'accent';
  if (mode === 'frozen')        return 'soft';
  if (mode === 'hand_authored') return 'warn';
  if (mode === 'benchmark')     return 'info';
  return 'soft';
}

// ============================================================
// TEST EDITOR
// ============================================================
function TestEditor({ mode, status, showQEditor }) {
  const locked = status === 'published' || status === 'locked';
  const isCreate = status === 'new';

  return (
    <div style={{position:'relative'}}>
      <window.PageHeader
        eyebrow={isCreate ? 'NEW TEST' : (locked ? `EDIT TEST · ${status.toUpperCase()}` : 'EDIT TEST · DRAFT')}
        title={isCreate
          ? <><span className="serif-it">Author a</span> new test.</>
          : <><span className="serif-it">Edit</span> {titleFor(mode)}</>}
        subtitle={isCreate
          ? "Pick a mode first — the rest of the editor adapts. You can change a draft test's mode any time before it's published; once published, the mode is locked."
          : null}
        actions={isCreate ? null : <StatusBar status={status} mode={mode}/>}/>

      {locked && (
        <div style={{
          padding:'12px 16px', marginBottom:20,
          background:'var(--warn-soft)',
          borderLeft:'2px solid var(--warn)',
          display:'flex', gap:12, alignItems:'flex-start',
        }}>
          <window.Icon name="lock" size={14} style={{color:'var(--warn)', marginTop:2}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:600, color:'var(--warn)', marginBottom:4}}>
              This test is {status === 'published' ? 'published' : 'locked'} — most fields are read-only
            </div>
            <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.55}}>
              {status === 'published'
                ? "Mode, pills, difficulty target, and question pool are locked to keep historical attempts comparable. Title, description, and the loop mode can still be tuned. Use 'Lock' to fully freeze the test, or 'Unlock' to return to draft (only allowed if no attempts exist yet)."
                : "All fields are immutable. Unlock to edit (in-flight attempts may end up with different results from re-runs)."}
            </div>
          </div>
        </div>
      )}

      {/* Top — title, mode, description */}
      <div className="card" style={{padding:24, marginBottom:18}}>
        <div className="eyebrow mb-3">Identity</div>
        <Field label="Title" locked={locked}>
          <input className="input" defaultValue={isCreate ? '' : titleFor(mode)}
            placeholder="e.g. Q3 Annual Competency"
            readOnly={locked}
            style={{background: locked ? 'var(--bg-sunk)' : undefined}}/>
        </Field>

        <Field label="Mode" locked={!isCreate}
          hint={isCreate ? "Determines how questions are sourced and presented. Mode is locked once the test is published." : null}>
          <ModePicker selected={mode} disabled={!isCreate}/>
        </Field>

        <Field label="Description"
          hint="Visible to testees on the assignment card and the attempt confirmation screen.">
          <textarea className="input" rows={2}
            defaultValue={isCreate ? '' : descriptionFor(mode)}
            placeholder="What this test assesses, in 1-2 sentences."/>
        </Field>
      </div>

      {/* Middle — mode-conditional */}
      {mode && (
        <div className="card" style={{padding:24, marginBottom:18}}>
          {mode === 'per_testee'    && <PerTesteeSection locked={locked}/>}
          {mode === 'frozen'        && <FrozenSection showQEditor={showQEditor} locked={locked}/>}
          {mode === 'hand_authored' && <HandAuthoredSection locked={locked}/>}
          {mode === 'benchmark'     && <BenchmarkSection locked={locked}/>}
        </div>
      )}

      {/* Bottom — publish controls */}
      <div className="card" style={{padding:'18px 24px', background:'var(--bg-sunk)', borderColor:'transparent'}}>
        <PublishControls status={status} mode={mode}/>
      </div>

      {showQEditor && <QuestionEditorModal/>}
    </div>
  );
}

function titleFor(mode) {
  return {
    per_testee:    'Antifouling — focus',
    frozen:        'Q3 Annual Competency',
    hand_authored: 'Cathodic Protection · ENG-2401',
    benchmark:     'SiteMesh Annual Benchmark · 2026',
  }[mode] || 'Untitled test';
}
function descriptionFor(mode) {
  return {
    per_testee:    'Targeted at a testee\'s current band on a single pill. Used for catalogue practice and admin-set focused review.',
    frozen:        'Quarterly competency check across the seven core inspector pills. Same question pool for every testee in the cohort.',
    hand_authored: 'Bespoke check for the Cathodic Protection certification — questions authored by Gys for the ENG-2401 audit.',
    benchmark:     'Annual cross-cohort benchmark. Sequential walk through pre-calibrated anchors at D3–D8. Locked once a cohort starts.',
  }[mode] || '';
}

function StatusBar({ status, mode }) {
  return (
    <div className="row gap-2 ai-c">
      <span className="t-meta">STATUS</span>
      {status === 'draft'     && <window.Pill tone="warn" mono>Draft</window.Pill>}
      {status === 'published' && <window.Pill tone="ok"   mono>Published</window.Pill>}
      {status === 'locked'    && <window.Pill tone="soft" mono>Locked</window.Pill>}
      <span className="muted t-meta">· mode</span>
      <window.Pill tone={modePillTone(mode)} mono>{mode}</window.Pill>
      <span className="muted t-meta">· last edited 4h ago by Gys M.</span>
    </div>
  );
}

// ============================================================
// MODE PICKER
// ============================================================
const MODES = [
  {
    id:'per_testee',
    title:'Per-testee',
    body:'Adaptive sample sized to the testee\'s current band on the chosen pill. Different questions for each testee.',
    use:'Catalogue practice · admin-set focus reviews',
  },
  {
    id:'frozen',
    title:'Frozen pool',
    body:'A fixed question pool. Every testee in the cohort sees the same questions. Comparable across testees.',
    use:'Quarterly competency · annual checks',
  },
  {
    id:'hand_authored',
    title:'Hand-authored',
    body:'You write every question by hand. No generation, no sampling. Same editor as Frozen but explicit manual posture.',
    use:'Audit-grade · cert-grade · bespoke',
  },
  {
    id:'benchmark',
    title:'Benchmark',
    body:'Sequential walk through pre-calibrated anchors at a configured difficulty curve. Locked once a cohort starts.',
    use:'Cross-cohort comparison · annual benchmark',
  },
];

function ModePicker({ selected, disabled }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
      gap:10,
    }}>
      {MODES.map(m => {
        const active = m.id === selected;
        return (
          <button key={m.id} disabled={disabled} style={{
            textAlign:'left', padding:'14px 16px',
            background: active ? 'var(--ink)' : 'var(--bg-sunk)',
            color: active ? 'var(--bg-raised)' : 'var(--ink)',
            border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
            opacity: disabled && !active ? 0.5 : 1,
          }}>
            <div style={{fontSize:14, fontWeight:600, marginBottom:6}}>{m.title}</div>
            <div style={{fontSize:12, lineHeight:1.55, marginBottom:8,
              color: active ? 'var(--bg-sunk)' : 'var(--ink-2)'}}>{m.body}</div>
            <div style={{
              fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.06em',
              color: active ? 'var(--bg-deep)' : 'var(--ink-3)',
              borderTop:'1px solid ' + (active ? 'var(--ink-3)' : 'var(--line)'),
              paddingTop:6,
            }}>USE · {m.use.toUpperCase()}</div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// MODE-CONDITIONAL SECTIONS
// ============================================================
function PerTesteeSection({ locked }) {
  return (
    <>
      <div className="eyebrow mb-3">Per-testee configuration</div>
      <Field label="Pill" locked={locked} hint="Per_testee tests target a single pill at a time.">
        <select className="input" defaultValue="antifouling" disabled={locked}>
          <option value="">Pick a pill…</option>
          <option value="antifouling">Antifouling Systems</option>
          <option value="corrosion">Corrosion Mechanisms</option>
          <option value="boq">BoQ Preparation</option>
        </select>
      </Field>

      <FieldRow cols="1fr 1fr">
        <Field label="Difficulty target" locked={locked}
          hint="The band Acumen aims for. Questions sampled ±1 around this point.">
          <DifficultyPicker selected={5} disabled={locked}/>
        </Field>
        <Field label="Question count target" locked={locked}
          hint="Default 8. Adjustable 4–12.">
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <input className="input mono" type="number" min={4} max={12} defaultValue={8} readOnly={locked}
              style={{width:80, background: locked ? 'var(--bg-sunk)' : undefined, color: locked ? 'var(--ink-2)' : undefined}}/>
            <span className="muted" style={{fontSize:12}}>4–12 questions</span>
          </div>
        </Field>
      </FieldRow>

      <Field label="Time ceiling (optional)" locked={locked}
        hint="If set, the attempt auto-submits at the ceiling. Leave blank for untimed.">
        <input className="input mono" defaultValue="30 min" readOnly={locked}
          style={{maxWidth:140, background: locked ? 'var(--bg-sunk)' : undefined}}/>
      </Field>
    </>
  );
}

function FrozenSection({ showQEditor, locked }) {
  const questions = [
    { id:1, type:'MCQ',   pill:'Antifouling', diff:'D4', body:'Which property of SPC chemistry…' },
    { id:2, type:'T/F',   pill:'Antifouling', diff:'D3', body:'Higher DFT than spec always improves protection.' },
    { id:3, type:'Match', pill:'Corrosion',   diff:'D5', body:'Match the corrosion mechanism to the visible morphology.' },
    { id:4, type:'SA',    pill:'Corrosion',   diff:'D5', body:'Two service-side factors for crevice corrosion.' },
    { id:5, type:'SC',    pill:'BoQ',         diff:'D6', body:'Coastal patrol vessel recoat scenario…' },
    { id:6, type:'MCQ',   pill:'Adhesion',    diff:'D4', body:'Pull-off test minimum acceptance per ISO 4624.' },
  ];
  return (
    <>
      <div className="row jc-b ai-c mb-3">
        <div className="eyebrow">Question pool · 6 questions · target 8 to 12</div>
        <button className="btn btn-sm" disabled={locked}><window.Icon name="plus" size={12}/> Add question</button>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {questions.map(q => (
          <div key={q.id} style={{
            display:'grid',
            gridTemplateColumns:'auto 80px 130px 70px 1fr auto',
            gap:14, alignItems:'center',
            padding:'10px 14px',
            background:'var(--bg-sunk)',
            border:'1px solid var(--line)',
            opacity: locked ? 0.7 : 1,
          }}>
            <span className="serif" style={{fontSize:18, color:'var(--ink-3)', lineHeight:1, minWidth:24}}>
              {String(q.id).padStart(2,'0')}
            </span>
            <window.Pill tone="soft" mono>{q.type}</window.Pill>
            <span className="muted" style={{fontSize:12}}>{q.pill}</span>
            <span className="mono" style={{fontSize:11.5, color:'var(--ink-3)'}}>{q.diff}</span>
            <span style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.5,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              "{q.body}"
            </span>
            <button className="btn btn-ghost btn-sm" disabled={locked}>Edit</button>
          </div>
        ))}
      </div>
      <div className="t-meta mt-3" style={{color:'var(--ink-3)'}}>
        Add at least 2 more questions to reach the recommended pool size of 8.
      </div>
    </>
  );
}

function HandAuthoredSection({ locked }) {
  return (
    <>
      <div className="eyebrow mb-3">Hand-authored configuration</div>
      <div style={{padding:'12px 14px', marginBottom:18,
        background:'var(--bg-sunk)', borderLeft:'2px solid var(--accent)'}}>
        <div className="row gap-2 ai-c mb-1">
          <window.Icon name="pencil" size={12}/>
          <span style={{fontSize:13, fontWeight:600}}>You're writing every question by hand</span>
        </div>
        <div className="muted" style={{fontSize:12, lineHeight:1.55}}>
          No generation, no sampling, no calibration drift. The questions you author here
          appear exactly as you wrote them. Useful for audit-grade and certification-grade tests.
        </div>
      </div>
      <FrozenSection locked={locked}/>
    </>
  );
}

function BenchmarkSection({ locked }) {
  return (
    <>
      <div className="eyebrow mb-3">Benchmark configuration</div>
      <Field label="Pills" locked={locked} hint="Anchors are drawn from these pills, in the difficulty curve below.">
        <div style={{display:'flex', flexWrap:'wrap', gap:6, padding:'8px 10px',
          background: locked ? 'var(--bg-sunk)' : 'var(--bg)', border:'1px solid var(--line)'}}>
          {['Antifouling','Corrosion','BoQ','Adhesion','Cathodic','Inspection','Substrate prep','Spec writing'].map(p => (
            <span key={p} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'4px 8px',
              background:'var(--accent-soft)', color:'var(--accent-ink)',
              border:'1px solid var(--line)', fontSize:12,
            }}>
              {p}
              {!locked && <button style={{color:'currentColor', opacity:0.6, marginLeft:2}}><window.Icon name="x" size={10}/></button>}
            </span>
          ))}
          {!locked && (
            <input style={{flex:1, minWidth:120, padding:'4px 8px',
              background:'transparent', border:'none', outline:'none', fontSize:13}}
              placeholder="+ add pill"/>
          )}
        </div>
      </Field>

      <Field label="Difficulty curve" locked={locked}
        hint="How many questions to sample at each band. Sum is the total benchmark length.">
        <DifficultyCurve locked={locked}/>
      </Field>

      <FieldRow cols="1fr 1fr">
        <Field label="Time ceiling" locked={locked}>
          <input className="input mono" defaultValue="60 min" readOnly={locked}
            style={{maxWidth:140, background: locked ? 'var(--bg-sunk)' : undefined}}/>
        </Field>
        <Field label="Cohort window" locked={locked}
          hint="The window during which a cohort can take the benchmark. Locked once any testee starts.">
          <input className="input mono" defaultValue="01 Jun 2026 – 31 Jul 2026" readOnly={locked}
            style={{background: locked ? 'var(--bg-sunk)' : undefined}}/>
        </Field>
      </FieldRow>
    </>
  );
}

function DifficultyPicker({ selected, disabled }) {
  return (
    <div style={{display:'flex', gap:1}}>
      {[1,2,3,4,5,6,7,8,9,10].map(n => {
        const active = n === selected;
        return (
          <button key={n} disabled={disabled} style={{
            width:32, height:32,
            fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:600,
            color: active ? 'var(--bg-raised)' : 'var(--ink-2)',
            background: active ? 'var(--ink)' : 'var(--bg-sunk)',
            border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
            marginLeft: n===1 ? 0 : -1,
            opacity: disabled ? 0.7 : 1,
          }}>D{n}</button>
        );
      })}
    </div>
  );
}

function DifficultyCurve({ locked }) {
  const curve = [
    { d:'D3', n:2 }, { d:'D4', n:3 }, { d:'D5', n:4 },
    { d:'D6', n:4 }, { d:'D7', n:3 }, { d:'D8', n:2 },
  ];
  const total = curve.reduce((a,b) => a + b.n, 0);
  const max = 5;
  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:6, alignItems:'end',
        height:120, padding:'8px 0'}}>
        {curve.map(c => (
          <div key={c.d} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
            <div style={{
              width:'100%', maxWidth:42,
              height: (c.n / max * 80) + 'px',
              background:'var(--ink)',
              minHeight: 4,
              position:'relative',
            }}>
              <span style={{
                position:'absolute', top:-18, left:'50%', transform:'translateX(-50%)',
                fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-2)',
              }}>{c.n}</span>
            </div>
            <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{c.d}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop:8, paddingTop:8, borderTop:'1px solid var(--line)',
        display:'flex', justifyContent:'space-between',
        fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)',
      }}>
        <span>{total} questions total</span>
        <span>centred at D5.5</span>
        {!locked && <button style={{color:'var(--accent-ink)', borderBottom:'1px dotted'}}>edit distribution</button>}
      </div>
    </div>
  );
}

// ============================================================
// PUBLISH CONTROLS
// ============================================================
function PublishControls({ status, mode }) {
  if (status === 'new' || status === 'draft') {
    return (
      <div style={{display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:200}}>
          <div className="row gap-2 ai-c mb-1">
            <window.Pill tone="warn" mono>Draft</window.Pill>
            <span className="t-meta">unpublished · not yet bindable to assignments</span>
          </div>
          <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'58ch'}}>
            Publishing makes this test bindable to assignments and locks {mode === 'benchmark' ? 'all configuration' : 'the mode'}.
            You can return to draft as long as no attempts exist.
          </div>
        </div>
        <button className="btn">Save draft</button>
        <button className="btn btn-primary">Publish <span className="arrow">→</span></button>
      </div>
    );
  }
  if (status === 'published') {
    return (
      <div style={{display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:200}}>
          <div className="row gap-2 ai-c mb-1">
            <window.Pill tone="ok" mono>Published</window.Pill>
            <span className="t-meta">bound to 2 assignments · 14 testees · 8 attempts started</span>
          </div>
          <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'58ch'}}>
            Locking the test fully freezes it — even reversible fields. Unlocking only works if there are zero in-flight attempts.
          </div>
        </div>
        <button className="btn">Save changes</button>
        <button className="btn"><window.Icon name="lock" size={12}/> Lock</button>
      </div>
    );
  }
  if (status === 'locked') {
    return (
      <div style={{display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:200}}>
          <div className="row gap-2 ai-c mb-1">
            <window.Icon name="lock" size={12}/>
            <window.Pill tone="soft" mono>Locked</window.Pill>
            <span className="t-meta">fully immutable</span>
          </div>
          <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'58ch'}}>
            Unlocking returns the test to published state. Requires no in-flight attempts.
          </div>
        </div>
        <button className="btn"><window.Icon name="lock" size={12}/> Unlock</button>
      </div>
    );
  }
  return null;
}

// ============================================================
// QUESTION SUB-EDITOR — modal opened from frozen / hand-authored
// ============================================================
const QUESTION_TYPES = [
  { id:'MCQ',   title:'Multiple choice', body:'4 options · one correct',                desc:'Auto-graded' },
  { id:'T/F',   title:'True / false',    body:'Two options · binary',                   desc:'Auto-graded' },
  { id:'Match', title:'Matching',        body:'Pair items in two columns',              desc:'Auto-graded · partial credit' },
  { id:'SA',    title:'Short answer',    body:'Free text · graded by AI',               desc:'AI-graded · cross-family review' },
  { id:'SC',    title:'Scenario',        body:'Multi-step prompt + free-text response', desc:'AI-graded · cross-family review' },
];

function QuestionEditorModal() {
  return (
    <Modal width={680}>
      <ModalHeader
        eyebrow="EDIT QUESTION · 04 OF 06"
        title={<><span className="serif-it">Edit</span> SA question</>}/>
      <QuestionEditorInner kind="SA"/>
      <ModalActions>
        <button className="btn">Cancel</button>
        <div className="row gap-2">
          <button className="btn">Save & previous</button>
          <button className="btn btn-primary">Save & next <span className="arrow">→</span></button>
        </div>
      </ModalActions>
    </Modal>
  );
}

function QuestionEditorIsolated() {
  return (
    <div>
      <div className="t-meta mb-3" style={{color:'var(--ink-3)'}}>
        ISOLATED FOR REVIEW — IN PRACTICE THIS RENDERS AS A MODAL OVER THE FROZEN / HAND-AUTHORED EDITOR
      </div>
      <div className="card" style={{padding:'28px 30px', maxWidth:760, margin:'0 auto'}}>
        <ModalHeader
          eyebrow="EDIT QUESTION · 04 OF 06"
          title={<><span className="serif-it">Edit</span> MCQ question</>}/>
        <QuestionEditorInner kind="MCQ"/>
      </div>
    </div>
  );
}

function QuestionEditorInner({ kind: defaultKind }) {
  const [kind, setKind] = atUseState(defaultKind || 'MCQ');
  return (
    <>
      <Field label="Question type">
        <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6}}>
          {QUESTION_TYPES.map(qt => {
            const active = kind === qt.id;
            return (
              <button key={qt.id} onClick={() => setKind(qt.id)} style={{
                textAlign:'left', padding:'10px 10px',
                background: active ? 'var(--ink)' : 'var(--bg-sunk)',
                color: active ? 'var(--bg-raised)' : 'var(--ink)',
                border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
              }}>
                <div style={{fontSize:11.5, fontFamily:'var(--font-mono)', fontWeight:600, marginBottom:4}}>{qt.id}</div>
                <div style={{fontSize:11.5, lineHeight:1.4, color: active ? 'var(--bg-sunk)' : 'var(--ink-3)'}}>{qt.body}</div>
              </button>
            );
          })}
        </div>
        <div className="t-meta mt-2" style={{color:'var(--ink-3)'}}>
          {QUESTION_TYPES.find(q => q.id === kind)?.desc}
        </div>
      </Field>

      <FieldRow cols="1fr 1fr 1fr">
        <Field label="Pill">
          <select className="input" defaultValue="antifouling">
            <option value="antifouling">Antifouling Systems</option>
            <option value="corrosion">Corrosion Mechanisms</option>
            <option value="boq">BoQ Preparation</option>
          </select>
        </Field>
        <Field label="Difficulty">
          <DifficultyPicker selected={5}/>
        </Field>
        <Field label="Anchor status">
          <select className="input" defaultValue="anchor">
            <option value="anchor">Anchor · in calibration pool</option>
            <option value="non-anchor">Non-anchor · not calibrated</option>
          </select>
        </Field>
      </FieldRow>

      <Field label="Question body" hint="Markdown supported. Keep the stem under 60 words for clarity.">
        <textarea className="input" rows={5}
          defaultValue={kind === 'MCQ'
            ? "A self-polishing copolymer (SPC) antifouling is specified for a vessel scheduled to operate at 14 knots average service speed. Which property of SPC chemistry most directly justifies this choice over a controlled-depletion-polymer (CDP) system?"
            : kind === 'T/F'
            ? "Self-polishing copolymer antifoulings continue to release biocide at a steady rate when a vessel is stationary at a berth."
            : kind === 'SA'
            ? "Name two service-side factors that drive premature boot-top blistering on an SPC system, and explain how each contributes."
            : kind === 'SC'
            ? "A coastal patrol vessel returns from a 90-day patrol with extensive boot-top blistering. Walk through your inspection plan, including atmospheric considerations, substrate testing, and recoat recommendation."
            : "Match the corrosion mechanism on the left to the visible surface morphology on the right."}/>
      </Field>

      {/* Type-specific affordances */}
      {kind === 'MCQ'  && <MCQChoices/>}
      {kind === 'T/F'  && <TFChoices/>}
      {kind === 'SA'   && <SAGradingRubric/>}
      {kind === 'SC'   && <SAGradingRubric/>}
      {kind === 'Match'&& <MatchPairs/>}
    </>
  );
}

function MCQChoices() {
  const choices = [
    { id:'A', text:'The biocide release rate is fixed independent of vessel speed', correct:false },
    { id:'B', text:'The polymer hydrolyses at a rate proportional to water flow across the hull', correct:true },
    { id:'C', text:'SPC contains no soluble pigment, so leaching is uniform', correct:false },
    { id:'D', text:'SPC develops a higher dry-film hardness, reducing mechanical erosion', correct:false },
  ];
  return (
    <Field label="Choices · mark the correct one" hint="Distractors should be plausible but unambiguously wrong to a competent testee.">
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {choices.map(c => (
          <div key={c.id} style={{
            display:'flex', gap:10, alignItems:'center',
            padding:'8px 10px',
            background: c.correct ? 'var(--ok-soft)' : 'var(--bg-sunk)',
            border:'1px solid ' + (c.correct ? 'var(--ok)' : 'var(--line)'),
          }}>
            <input type="radio" name="correct" defaultChecked={c.correct} style={{accentColor:'var(--ok)'}}/>
            <span className="mono" style={{fontSize:11, color: c.correct ? 'var(--ok)' : 'var(--ink-3)', minWidth:18, fontWeight:600}}>{c.id}</span>
            <input className="input" defaultValue={c.text}
              style={{flex:1, padding:'4px 8px', fontSize:13, background:'transparent', border:'none'}}/>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--ink-3)'}}><window.Icon name="x" size={11}/></button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-3" style={{width:'100%', justifyContent:'center'}}>
        <window.Icon name="plus" size={12}/> Add choice (max 6)
      </button>
    </Field>
  );
}

function TFChoices() {
  return (
    <Field label="Correct answer">
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <button style={{padding:'14px 16px', background:'var(--bg-sunk)', border:'1px solid var(--line)', fontSize:14, fontWeight:600}}>True</button>
        <button style={{padding:'14px 16px', background:'var(--danger-soft)', border:'1px solid var(--danger)', fontSize:14, fontWeight:600, color:'var(--danger)'}}>
          False ← correct
        </button>
      </div>
    </Field>
  );
}

function SAGradingRubric() {
  return (
    <Field label="AI grading rubric" hint="Used to guide claude-sonnet-4-5 grading. Cross-family review by gpt-4o-mini at submit time.">
      <textarea className="input" rows={4}
        defaultValue={`Full marks (2): identifies (a) static-berth time (no flow → no hydrolysis) AND (b) seawater chemistry / temperature variation, with mechanism for each.
Partial (1): identifies one factor with mechanism OR both factors without mechanism.
Zero (0): neither factor identified, or factors named without any mechanism.`}/>
      <div className="t-meta mt-2" style={{color:'var(--ink-3)'}}>
        Anchors graded with this rubric are routed to /admin/calibration if drift exceeds 12%.
      </div>
    </Field>
  );
}

function MatchPairs() {
  const pairs = [
    ['Pitting',         'Sharp-walled hemispheres'],
    ['Crevice',         'Linear discolouration at lap joint'],
    ['Galvanic',        'Localised attack near dissimilar-metal contact'],
    ['Stress corrosion','Intergranular cracking pattern'],
  ];
  return (
    <Field label="Match pairs · left ↔ right" hint="Both columns are shuffled at present-time.">
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {pairs.map((p, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 14px 1fr', gap:8, alignItems:'center'}}>
            <input className="input" defaultValue={p[0]} style={{padding:'6px 10px'}}/>
            <span className="muted" style={{textAlign:'center'}}>↔</span>
            <input className="input" defaultValue={p[1]} style={{padding:'6px 10px'}}/>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-3" style={{width:'100%', justifyContent:'center'}}>
        <window.Icon name="plus" size={12}/> Add pair (max 8)
      </button>
    </Field>
  );
}

// ============================================================
// SHARED — Modal, Field (re-declared for file independence)
// ============================================================
function Modal({ children, width = 560 }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:20,
      background:'color-mix(in oklab, var(--bg-deep) 60%, transparent)',
      display:'grid', placeItems:'center', padding:24, backdropFilter:'blur(2px)',
    }}>
      <div className="card" style={{
        maxWidth: width, width:'100%',
        padding:'28px 30px', boxShadow:'var(--shadow-2)',
        maxHeight:'88vh', overflowY:'auto',
      }}>{children}</div>
    </div>
  );
}
function ModalHeader({ eyebrow, title }) {
  return (
    <>
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="serif" style={{fontSize:24, lineHeight:1.25, letterSpacing:'-0.01em', marginBottom:18}}>{title}</div>
    </>
  );
}
function ModalActions({ children }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:10, marginTop:22, paddingTop:18, borderTop:'1px solid var(--line)', flexWrap:'wrap',
    }}>{children}</div>
  );
}
const fieldLabel = {
  display:'block', fontSize:10.5, fontFamily:'var(--font-mono)',
  letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:6,
};
function Field({ label, hint, error, children, locked }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={fieldLabel}>
        {label} {locked && <window.Icon name="lock" size={9} style={{marginLeft:6, color:'var(--ink-4)'}}/>}
      </label>
      {children}
      {error && (
        <div style={{display:'flex',gap:6,alignItems:'flex-start',marginTop:6,fontSize:12.5, color:'var(--danger)'}}>
          <window.Icon name="x" size={11} stroke={2}/><span>{error}</span>
        </div>
      )}
      {hint && !error && <div className="muted" style={{fontSize:11.5, marginTop:6, lineHeight:1.5}}>{hint}</div>}
    </div>
  );
}
function FieldRow({ children, cols }) {
  return <div style={{display:'grid', gridTemplateColumns: cols || '1fr 1fr', gap:14, marginBottom:14}}>{children}</div>;
}

window.AdminTestAuthoringMock = AdminTestAuthoringMock;
