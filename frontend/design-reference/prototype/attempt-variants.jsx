// attempt-variants.jsx — v6 · FE-4 · #11 + #12
// #11 Benchmark mode attempt screen — same chrome as the standard
//     attempt, but no JIT queue, simplified progress dots, sequential
//     prev/next navigation in the footer.
// #12 Autosave indicator — small component that lives in the attempt
//     screen's topbar. Shown here as a component sheet across states.
//
// Both rendered inside an in-shell "focus preview" frame so the
// reviewer can compare them against the existing AttemptScreen without
// leaving the shell.

const { useState: avUseState, useEffect: avUseEffect } = React;

function AttemptVariantsMock() {
  const states = [
    { id: 'bench-progress', label: 'Benchmark · In progress' },
    { id: 'bench-paused',   label: 'Benchmark · Paused' },
    { id: 'bench-submit',   label: 'Benchmark · Submit confirm' },
    { id: 'bench-grading',  label: 'Benchmark · Grading' },
    { id: 'autosave',       label: 'Autosave indicator' },
  ];
  const [s, setS] = avUseState('bench-progress');

  return (
    <div className="content" style={{paddingBottom:60}}>
      <window.V6MockHeader
        id={s === 'autosave' ? 'FE-4 · #12' : 'FE-4 · #11'}
        title={s === 'autosave' ? 'Autosave indicator' : 'Benchmark mode attempt'}
        sub={s === 'autosave'
          ? "A small status atom that lives in the attempt screen's topbar. Four states — idle, saving, saved-recent, save-failed — shown side-by-side. The component is positional: it slots into the topbar at the same x-coordinate regardless of state, so layout stays still as it changes."
          : "Benchmarks walk a fixed sequence — no JIT, no streaming. The chrome stays close to the standard AttemptScreen so testees don't have to relearn anything; only the side queue disappears and the footer gains Previous / Next."}
        states={states} state={s} onState={setS}/>

      <div style={{marginTop:24}}>
        {s === 'bench-progress' && <BenchmarkPreview variant="progress"/>}
        {s === 'bench-paused'   && <BenchmarkPreview variant="paused"/>}
        {s === 'bench-submit'   && <BenchmarkPreview variant="submit"/>}
        {s === 'bench-grading'  && <BenchmarkPreview variant="grading"/>}
        {s === 'autosave'       && <AutosaveSheet/>}
      </div>
    </div>
  );
}

// ============================================================
// BENCHMARK PREVIEW — focus-mode attempt rendered in a framed box
// ============================================================
function BenchmarkPreview({ variant }) {
  return (
    <div>
      <PreviewFrameLabel
        label="FOCUS MODE PREVIEW"
        sub="Rendered at desktop scale inside the design-reference shell so it can be compared to the standard AttemptScreen. In the real app this fills the viewport."/>
      <div style={{
        background:'var(--bg)',
        border:'1px solid var(--line-strong)',
        position:'relative',
        overflow:'hidden',
        minHeight: 720,
      }}>
        <BenchmarkAttemptScreen variant={variant}/>
      </div>
    </div>
  );
}

function PreviewFrameLabel({ label, sub }) {
  return (
    <div style={{
      display:'flex', alignItems:'baseline', gap:14,
      padding:'8px 0', marginBottom:8,
    }}>
      <span className="t-meta" style={{color:'var(--ink-3)'}}>{label}</span>
      <span className="muted" style={{fontSize:11.5}}>{sub}</span>
    </div>
  );
}

// ============================================================
// THE BENCHMARK ATTEMPT SCREEN ITSELF
// ============================================================
const BENCH_QUESTIONS = [
  { id:'b1', n:1, type:'MC',  status:'answered',   prompt:'Identify the correct stress-strain regime for cold-drawn steel.', diff:'D3' },
  { id:'b2', n:2, type:'MC',  status:'answered',   prompt:'Which inspection sequence applies before refloat?',                diff:'D4' },
  { id:'b3', n:3, type:'T/F', status:'answered',   prompt:'Higher DFT than spec always improves protection.',                 diff:'D3' },
  { id:'b4', n:4, type:'MC',  status:'current',    prompt:'A self-polishing copolymer (SPC) is specified for a vessel scheduled to operate at 14 knots average service speed. Which property of SPC chemistry most directly justifies this choice over a controlled-depletion-polymer (CDP) system?', diff:'D5' },
  { id:'b5', n:5, type:'SA',  status:'unanswered', prompt:'Two service-side factors for boot-top blistering.', diff:'D5' },
  { id:'b6', n:6, type:'Match', status:'unanswered', prompt:'Match fouling organism to environmental driver.', diff:'D5' },
  { id:'b7', n:7, type:'MC',  status:'unanswered', prompt:'Excessive cathodic protection failure mechanism.',  diff:'D6' },
  { id:'b8', n:8, type:'SC',  status:'unanswered', prompt:'Coastal patrol vessel recoat scenario.',            diff:'D7' },
  { id:'b9', n:9, type:'MC',  status:'unanswered', prompt:'Edge protection detail for shear conditions.',      diff:'D7' },
  { id:'b10', n:10, type:'SA', status:'unanswered', prompt:'Post-dry-dock inspection — two checks.',           diff:'D7' },
  { id:'b11', n:11, type:'MC', status:'unanswered', prompt:'Galvanic series ordering for Zn vs Mg anodes.',    diff:'D8' },
  { id:'b12', n:12, type:'SC', status:'unanswered', prompt:'Hybrid antifouling system trade-off.',             diff:'D8' },
];

function BenchmarkAttemptScreen({ variant }) {
  const current = BENCH_QUESTIONS[3]; // Q4
  const totalAnswered = 3;
  const total = BENCH_QUESTIONS.length;

  return (
    <div style={{position:'relative', minHeight:720, background:'var(--bg)'}}>
      {/* TOP BAR */}
      <div style={{
        borderBottom:'1px solid var(--line)',
        background:'var(--bg-raised)',
      }}>
        <div style={{
          maxWidth:1280, margin:'0 auto',
          padding:'14px 24px 0',
          display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
        }}>
          <button className="btn btn-ghost btn-sm">← Exit</button>
          <span className="t-meta">BENCHMARK</span>
          <span style={{fontWeight:600, fontSize:14}}>SiteMesh Annual Competency · Antifouling</span>
          <window.Pill tone="soft" mono>12 questions</window.Pill>
          <span className="muted t-meta">D3 – D8 · timed · sequential</span>
          <div style={{flex:1}}/>
          <BenchmarkTimer remainingSec={1240} paused={variant === 'paused'}/>
          <button className="btn btn-sm">
            {variant === 'paused'
              ? <><window.Icon name="arrowRight" size={12}/> Resume</>
              : <><window.Icon name="pause" size={12}/> Pause</>}
          </button>
        </div>

        {/* SIMPLIFIED PROGRESS — answered / current / unanswered. No streaming. */}
        <div style={{
          maxWidth:1280, margin:'0 auto',
          padding:'10px 24px 14px',
          display:'flex', alignItems:'center', gap:5,
        }}>
          {BENCH_QUESTIONS.map((q, i) => {
            const status = i < totalAnswered ? 'answered' : i === totalAnswered ? 'current' : 'unanswered';
            return (
              <button key={q.id} style={{
                flex:1, height:5,
                background: status === 'current' ? 'var(--ink)'
                          : status === 'answered' ? 'var(--ok)'
                          : 'var(--bg-deep)',
                border:'none',
              }}/>
            );
          })}
          <span className="mono" style={{marginLeft:8, fontSize:11, color:'var(--ink-3)'}}>
            {totalAnswered+1} / {total}
          </span>
        </div>
      </div>

      {/* SINGLE-COLUMN BODY (no JIT side queue) */}
      <div style={{
        maxWidth: 820,
        margin:'0 auto',
        padding:'36px 24px 120px',
        position:'relative',
        opacity: (variant === 'paused' || variant === 'submit' || variant === 'grading') ? 0.4 : 1,
        filter: (variant === 'paused' || variant === 'submit' || variant === 'grading') ? 'blur(1.5px)' : 'none',
        transition:'opacity .2s, filter .2s',
      }}>
        <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap'}}>
          <span className="t-meta">QUESTION 4 OF 12</span>
          <span className="t-meta">·</span>
          <span className="t-meta">MULTIPLE CHOICE</span>
          <span className="t-meta">·</span>
          <span className="t-meta">D5</span>
        </div>

        <h2 className="serif" style={{
          fontSize:26, lineHeight:1.35, letterSpacing:'-0.005em',
          fontWeight:500, marginBottom:24,
        }}>
          A self-polishing copolymer (SPC) antifouling is specified for a vessel
          scheduled to operate at <strong>14 knots average service speed</strong>.
          Which property of SPC chemistry most directly justifies this choice over
          a controlled-depletion-polymer (CDP) system?
        </h2>

        <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:36}}>
          {[
            {id:'A', t:'The biocide release rate is fixed independent of vessel speed', sel:false},
            {id:'B', t:'The polymer hydrolyses at a rate proportional to water flow across the hull', sel:true},
            {id:'C', t:'SPC contains no soluble pigment, so leaching is uniform', sel:false},
            {id:'D', t:'SPC develops a higher dry-film hardness, reducing mechanical erosion', sel:false},
          ].map(opt => (
            <button key={opt.id} style={{
              display:'flex', gap:14, alignItems:'flex-start',
              padding:'14px 18px',
              background: opt.sel ? 'var(--ink)' : 'var(--bg-raised)',
              color: opt.sel ? 'var(--bg-raised)' : 'var(--ink)',
              border:'1px solid ' + (opt.sel ? 'var(--ink)' : 'var(--line)'),
              textAlign:'left',
            }}>
              <span className="mono" style={{
                width:24, fontSize:12, fontWeight:600,
                color: opt.sel ? 'var(--bg-raised)' : 'var(--ink-3)',
              }}>{opt.id}</span>
              <span style={{flex:1, fontSize:14.5, lineHeight:1.5}}>{opt.t}</span>
            </button>
          ))}
        </div>

        {/* FOOTER — Previous + Next (sequential walk). This is the v1 spec. */}
        <div style={{
          display:'flex', gap:12, flexWrap:'wrap', alignItems:'center',
          paddingTop:24, borderTop:'1px solid var(--line)',
        }}>
          <button className="btn">← Previous</button>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm">
            <window.Icon name="flag" size={12}/> Flag as unrealistic
          </button>
          <button className="btn btn-primary">Next question <span className="arrow">→</span></button>
        </div>
      </div>

      {/* OVERLAYS */}
      {variant === 'paused' && (
        <div style={overlayStyle}>
          <div className="card" style={{maxWidth:420, textAlign:'center', padding:'40px 32px'}}>
            <div className="serif-it" style={{fontSize:42, lineHeight:1, color:'var(--ink-3)'}}>paused</div>
            <div className="muted mt-4" style={{fontSize:13}}>
              Per AC-D11, question content is blanked while paused.
              Your timer is held.
            </div>
            <div className="mt-6">
              <button className="btn btn-primary">Resume <span className="arrow">→</span></button>
            </div>
            <div className="t-meta mt-4">28 of 30 pause minutes remaining today</div>
          </div>
        </div>
      )}

      {variant === 'submit' && (
        <div style={overlayStyle}>
          <div className="card" style={{maxWidth:500, padding:32, width:'100%'}}>
            <div className="eyebrow">Submit benchmark</div>
            <h2 className="h-2 mt-2"><span className="serif-it">Ready to</span> hand this in?</h2>
            <div className="mt-4" style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>
              You've answered <strong>3</strong> of 12 questions. Benchmarks can't be re-taken —
              once submitted, your result is locked into the SiteMesh Annual Competency record.
            </div>
            <div style={{display:'flex', gap:8, marginTop:24, flexWrap:'wrap'}}>
              <button className="btn">Keep going</button>
              <div style={{flex:1}}/>
              <button className="btn btn-primary">Submit benchmark <span className="arrow">→</span></button>
            </div>
          </div>
        </div>
      )}

      {variant === 'grading' && <BenchmarkGradingOverlay/>}
    </div>
  );
}

const overlayStyle = {
  position:'absolute', inset:0, zIndex:5,
  background:'color-mix(in oklab, var(--bg) 92%, transparent)',
  display:'grid', placeItems:'center', padding:16,
};

function BenchmarkTimer({ remainingSec, paused }) {
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return (
    <div className="chip" style={{
      background: paused ? 'var(--bg-deep)' : 'var(--bg-deep)',
      color: paused ? 'var(--ink-3)' : 'var(--ink)',
      fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, letterSpacing:'0.04em',
    }}>
      <window.Icon name="clock" size={11}/>
      {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      {paused && <span style={{opacity:.7, marginLeft:4, fontSize:10}}>HELD</span>}
    </div>
  );
}

function BenchmarkGradingOverlay() {
  return (
    <div style={{
      ...overlayStyle,
      background:'color-mix(in oklab, var(--bg) 94%, transparent)',
      backdropFilter:'blur(4px)',
    }}>
      <div style={{maxWidth:480, textAlign:'center', padding:32}}>
        <div className="serif-it" style={{fontSize:42, lineHeight:1, color:'var(--ink-3)', marginBottom:32}}>
          checking your answers…
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:14, textAlign:'left'}}>
          {[
            { ok:true,  label:'Auto-grading deterministic responses', sub:'8 of 12 · MCQ + T/F + matching' },
            { ok:true,  label:'AI grading short-answer + scenario',   sub:'4 of 12 · claude-sonnet-4-5' },
            { current:true, label:'Cross-family review pass',         sub:'OpenAI gpt-4o-mini · 60s ceiling' },
            { label:'Computing benchmark score + bands',              sub:'no recency weighting (single sitting)' },
          ].map((p, i) => (
            <div key={i} style={{display:'flex', gap:14, alignItems:'center', opacity: p.ok ? 1 : p.current ? 1 : 0.35}}>
              <span style={{width:18, display:'grid', placeItems:'center'}}>
                {p.ok ? <window.Icon name="check" size={14} style={{color:'var(--ok)'}}/>
                 : p.current ? <span className="pulse-dot"/>
                 : <span style={{width:8, height:8, borderRadius:'50%', background:'var(--bg-deep)'}}/>}
              </span>
              <div>
                <div style={{fontSize:13, fontWeight: p.current ? 600 : 500}}>{p.label}</div>
                <div className="t-meta">{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUTOSAVE INDICATOR SHEET
// ============================================================
function AutosaveSheet() {
  const states = [
    { key:'idle',     label:'Idle',         sub:'Nothing visible. The component reserves no space when there is no message to show — the topbar around it stays still.' },
    { key:'saving',   label:'Saving',       sub:'Active while a save request is in flight. Spinner is the same atom used by primary buttons.' },
    { key:'saved',    label:'Saved · 3s',   sub:'Shown after a successful save, with a relative timestamp. Fades after 5 seconds back to idle.' },
    { key:'failed',   label:'Save failed',  sub:'Retry is automatic with exponential back-off. The retry attempt number is shown so testees can see something is happening.' },
  ];
  return (
    <div>
      <PreviewFrameLabel label="ATTEMPT TOPBAR — RIGHT SIDE" sub="Slot is between the Integrity badge and the Timer pill. Width: ~140px reserved when active."/>
      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {states.map(s => (
          <div key={s.key} style={{
            display:'grid', gridTemplateColumns:'minmax(0,1fr) 1fr', gap:24, alignItems:'center',
            border:'1px solid var(--line)',
            background:'var(--bg-raised)',
          }}>
            {/* Fake topbar with autosave atom embedded */}
            <div style={{
              borderRight:'1px solid var(--line)',
              padding:'14px 18px',
              display:'flex', alignItems:'center', gap:12,
              background:'var(--bg)',
            }}>
              <span className="t-meta">ATTEMPT</span>
              <span style={{fontSize:13, fontWeight:600}}>Antifouling Systems</span>
              <window.Pill tone="soft" mono>D5</window.Pill>
              <div style={{flex:1}}/>
              <div className="chip chip-soft" style={{padding:'3px 8px'}}>
                <window.Icon name="shield" size={11}/>
                <span>Integrity</span>
              </div>
              <AutosaveAtom state={s.key}/>
              <div className="chip" style={{
                background:'var(--bg-deep)', fontFamily:'var(--font-mono)',
                fontSize:12, fontWeight:600,
              }}>
                <window.Icon name="clock" size={11}/>14:22
              </div>
            </div>

            {/* Description */}
            <div style={{padding:'14px 22px 14px 4px'}}>
              <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:4}}>
                <span style={{
                  fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.1em',
                  textTransform:'uppercase', color:'var(--ink-3)',
                }}>{s.key}</span>
                <span style={{fontSize:13, fontWeight:600}}>{s.label}</span>
              </div>
              <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'46ch'}}>
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop:24, padding:'14px 16px',
        background:'var(--bg-sunk)',
        borderLeft:'2px solid var(--accent)',
      }}>
        <div className="eyebrow mb-2">Behaviour</div>
        <ul style={{margin:0, paddingLeft:16, fontSize:12.5, lineHeight:1.7, color:'var(--ink-2)'}}>
          <li>Saves trigger on every answer change, with a 600ms debounce.</li>
          <li>The "Saved · Ns ago" timestamp updates client-side every second; the value is anchored to the actual server-acknowledged save time.</li>
          <li>If a save fails three times in a row, the message escalates from <em>retrying</em> to <em>contact support</em> and surfaces a toast (see error-patterns).</li>
          <li>The atom is omitted entirely in benchmark mode — that flow saves on submit only.</li>
        </ul>
      </div>
    </div>
  );
}

function AutosaveAtom({ state }) {
  if (state === 'idle') {
    return <span style={{width:120, display:'inline-block'}}/>;
  }
  if (state === 'saving') {
    return (
      <div style={atomStyle('var(--ink-3)')}>
        <span className="pulse-dot" style={{width:6, height:6, marginRight:2, background:'var(--ink-3)'}}/>
        <span>Saving…</span>
      </div>
    );
  }
  if (state === 'saved') {
    return (
      <div style={atomStyle('var(--ok)')}>
        <window.Icon name="check" size={11} stroke={2.2}/>
        <span>Saved 3s ago</span>
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div style={atomStyle('var(--danger)')}>
        <window.Icon name="x" size={11} stroke={2}/>
        <span>Save failed · retry 2</span>
      </div>
    );
  }
  return null;
}

function atomStyle(color) {
  return {
    display:'inline-flex', gap:6, alignItems:'center',
    fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.02em',
    color, minWidth:120,
  };
}

window.AttemptVariantsMock = AttemptVariantsMock;
