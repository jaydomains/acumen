// results-additions.jsx — v6 · FE-6 · #14 + #15 + #16
// Three additions to testee.jsx TesteeResults. Each is a small surface
// mocked in isolation with the surrounding stat-card row so the visual
// rhythm can be evaluated against the existing results page.

const { useState: rxUseState, useEffect: rxUseEffect } = React;

function ResultsAdditionsMock() {
  const states = [
    { id: 'review',  label: '#14 · Review pending vs complete' },
    { id: 'pdf',     label: '#15 · PDF export UX' },
    { id: 'realism', label: '#16 · Realism feedback summary' },
  ];
  const [s, setS] = rxUseState('review');

  return (
    <div className="content" style={{paddingBottom:80}}>
      <window.V6MockHeader id="FE-6"
        title={s === 'pdf'     ? 'PDF export UX'
              : s === 'realism' ? 'Realism feedback summary'
              : 'AI grading review states'}
        sub="Three additions to the post-attempt results page. Each is shown in context — with the rest of the results page faded behind it so the visual rhythm of the existing stat row, by-pill card, and loop plan is preserved."
        states={states} state={s} onState={setS}/>

      <div style={{marginTop:24}}>
        {s === 'review'  && <ReviewPendingVsComplete/>}
        {s === 'pdf'     && <PdfExportSheet/>}
        {s === 'realism' && <RealismFeedbackSheet/>}
      </div>
    </div>
  );
}

// ============================================================
// #14 — REVIEW PENDING vs RESOLVED (the existing card)
// ============================================================
function ReviewPendingVsComplete() {
  return (
    <div>
      <SubLabel>Both states side-by-side — pending implicitly polls every 2s, swaps to resolved when the cross-family review batch returns.</SubLabel>

      <div className="grid grid-12 gap-4" style={{marginBottom:24}}>
        <div className="col-span-6">
          <CardLabel>PENDING — NEW (#14)</CardLabel>
          <StatRowMini variant="pending"/>
        </div>
        <div className="col-span-6">
          <CardLabel>RESOLVED — EXISTING (testee.jsx 342-351)</CardLabel>
          <StatRowMini variant="resolved"/>
        </div>
      </div>

      <ReviewMechanicsNote/>
    </div>
  );
}

function StatRowMini({ variant }) {
  return (
    <div className="grid grid-12 gap-3">
      <div className="col-span-3">
        <div className="card center" style={{padding:'22px 12px'}}>
          <div className="stat-big" style={{fontSize:36}}>58<span style={{fontSize:18}}>%</span></div>
          <window.BandTag band="junior"/>
        </div>
      </div>
      <div className="col-span-3">
        <div className="card center" style={{padding:'22px 12px'}}>
          <div className="stat-big" style={{fontSize:36, color:'var(--accent)'}}>5.4</div>
          <div className="t-meta">COMPETENCE</div>
        </div>
      </div>
      <div className="col-span-3">
        <div className="card center" style={{padding:'22px 12px'}}>
          <div className="stat-big" style={{fontSize:36}}>23<span style={{fontSize:18}}>m</span></div>
          <div className="t-meta">ON TEST</div>
        </div>
      </div>
      <div className="col-span-3">
        {variant === 'pending' ? <ReviewPendingCard/> : <ReviewCompleteCard/>}
      </div>
    </div>
  );
}

function ReviewPendingCard() {
  return (
    <div className="card center" style={{
      padding:'22px 12px',
      background:'var(--bg-sunk)',
      borderColor:'transparent',
    }}>
      <div className="row gap-2 jc-c ai-c" style={{justifyContent:'center'}}>
        <span className="pulse-dot" style={{background:'var(--ink-3)'}}/>
        <span className="t-meta" style={{color:'var(--ink-3)'}}>REVIEW PENDING</span>
      </div>
      <div className="mt-3" style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5}}>
        Checking your AI-graded responses…
      </div>
      <div className="t-meta mt-2" style={{color:'var(--ink-4)', fontSize:10}}>
        usually 4–8 seconds
      </div>
    </div>
  );
}

function ReviewCompleteCard() {
  return (
    <div className="card center" style={{
      padding:'22px 12px',
      background:'var(--ok-soft)',
      borderColor:'transparent',
    }}>
      <div className="row gap-2 jc-c ai-c" style={{justifyContent:'center'}}>
        <div className="pulse-dot" style={{background:'var(--ok)'}}/>
        <span className="t-meta" style={{color:'var(--ok)'}}>REVIEW COMPLETE</span>
      </div>
      <div className="mt-3" style={{fontSize:13, color:'var(--ok)', lineHeight:1.5}}>
        All 6 AI grades cross-checked by OpenAI in 4.2s
      </div>
    </div>
  );
}

function ReviewMechanicsNote() {
  return (
    <div style={{
      padding:'16px 18px', background:'var(--bg-sunk)',
      borderLeft:'2px solid var(--accent)',
    }}>
      <div className="eyebrow mb-2">Polling mechanics</div>
      <ul style={{margin:0, paddingLeft:16, fontSize:12.5, lineHeight:1.7, color:'var(--ink-2)'}}>
        <li>Pending state is the initial render — every results page starts here unless the review batch already resolved.</li>
        <li>Polling is implicit — no manual refresh affordance. Client polls <code style={inlineCode}>/attempts/&#123;id&#125;/review</code> on a 2s interval.</li>
        <li>Card swaps to resolved as soon as <code style={inlineCode}>review_status === 'complete'</code>; no transition or shimmer — it's a clean cross-fade per AC-D19.</li>
        <li>If review exceeds the 60s ceiling, the card swaps to <strong>REVIEW SKIPPED</strong> with a quiet note that admin will be notified — that case isn't in v1 scope but the slot stays the same size.</li>
      </ul>
    </div>
  );
}

const inlineCode = {
  fontFamily:'var(--font-mono)', fontSize:11.5,
  background:'var(--bg-raised)', padding:'1px 5px',
  color:'var(--ink-2)',
};

// ============================================================
// #15 — PDF EXPORT UX
// ============================================================
function PdfExportSheet() {
  const states = [
    { key:'idle',     label:'Idle',         body:'Default. Same affordance as today.' },
    { key:'clicking', label:'Generating',   body:'Backend is synchronous-blocking. Button shows a spinner; usually 3–10 seconds.' },
    { key:'success',  label:'Success',      body:'Blob download triggered. Button returns to idle; a confirming toast appears bottom-right.' },
    { key:'error',    label:'Error',        body:'Button returns to idle; error toast surfaces with a retry affordance.' },
  ];
  const [active, setActive] = rxUseState('idle');

  return (
    <div>
      <SubLabel>Button lives in the by-question card header (testee.jsx ~394). Same anchor across all states so the row layout stays still.</SubLabel>

      {/* The header strip — clickable buttons rendered in each state */}
      <div className="card" style={{padding:0}}>
        {states.map((st, i) => (
          <div key={st.key} style={{
            display:'grid',
            gridTemplateColumns:'minmax(0, 1fr) 1fr',
            gap:0,
            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
            background: active === st.key ? 'var(--bg-sunk)' : 'transparent',
            cursor:'pointer',
          }} onClick={() => setActive(st.key)}>
            <div style={{padding:'18px 22px', borderRight:'1px solid var(--line)'}}>
              <div className="card-hd" style={{marginBottom:8, paddingBottom:0, borderBottom:'none'}}>
                <div className="title">
                  <div className="eyebrow">Question by question</div>
                  <h3 className="h-3" style={{margin:0, fontSize:18}}>Your answers</h3>
                </div>
                <PdfExportButton state={st.key}/>
              </div>
            </div>
            <div style={{padding:'18px 22px', display:'flex', flexDirection:'column', justifyContent:'center'}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4}}>
                <span style={{
                  fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.1em',
                  textTransform:'uppercase', color:'var(--ink-3)',
                }}>{st.key}</span>
                <span style={{fontSize:13, fontWeight:600}}>{st.label}</span>
              </div>
              <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'52ch'}}>{st.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toasts shown for success + error */}
      {(active === 'success' || active === 'error') && (
        <div style={{
          position:'relative', marginTop:18, padding:'14px 16px',
          background:'var(--bg-sunk)', borderLeft:'2px solid var(--accent)',
        }}>
          <div className="eyebrow mb-2">Toast — bottom-right of viewport</div>
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <PdfToast variant={active}/>
          </div>
        </div>
      )}
    </div>
  );
}

function PdfExportButton({ state }) {
  if (state === 'idle') {
    return <button className="btn btn-ghost btn-sm">Download PDF <span className="arrow">→</span></button>;
  }
  if (state === 'clicking') {
    return (
      <button className="btn btn-sm" disabled style={{opacity:0.85}}>
        <span className="pulse-dot" style={{width:7, height:7, background:'currentColor'}}/>
        Generating…
      </button>
    );
  }
  if (state === 'success') {
    return (
      <button className="btn btn-ghost btn-sm" style={{color:'var(--ok)'}}>
        <window.Icon name="check" size={11} stroke={2.2}/> Downloaded
      </button>
    );
  }
  if (state === 'error') {
    return (
      <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>
        <window.Icon name="x" size={11} stroke={2}/> Export failed
      </button>
    );
  }
  return null;
}

function PdfToast({ variant }) {
  if (variant === 'success') {
    return (
      <div style={toastStyle('var(--info)')}>
        <div style={{width:3, background:'var(--info)', flexShrink:0}}/>
        <div style={{padding:'12px 14px', flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
            <span style={{
              fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.14em',
              color:'var(--info)', fontWeight:600,
            }}>INFO</span>
          </div>
          <div style={{fontWeight:600, fontSize:13.5, marginBottom:2}}>Download started</div>
          <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>
            attempt-12c20-antifouling.pdf · check your downloads
          </div>
        </div>
        <button style={{padding:'10px 12px', color:'var(--ink-4)', alignSelf:'flex-start'}}>
          <window.Icon name="x" size={14}/>
        </button>
      </div>
    );
  }
  return (
    <div style={toastStyle('var(--danger)')}>
      <div style={{width:3, background:'var(--danger)', flexShrink:0}}/>
      <div style={{padding:'12px 14px', flex:1}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.14em',
            color:'var(--danger)', fontWeight:600,
          }}>ERROR</span>
        </div>
        <div style={{fontWeight:600, fontSize:13.5, marginBottom:2}}>Couldn't export the PDF</div>
        <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>
          Something went wrong on our side. Try again in a moment.
        </div>
        <button style={{
          marginTop:8, fontSize:12, color:'var(--danger)',
          borderBottom:'1px solid var(--danger)', padding:0, paddingBottom:1,
        }}>Try again →</button>
      </div>
      <button style={{padding:'10px 12px', color:'var(--ink-4)', alignSelf:'flex-start'}}>
        <window.Icon name="x" size={14}/>
      </button>
    </div>
  );
}

const toastStyle = (bar) => ({
  display:'flex', alignItems:'stretch',
  background:'var(--bg-raised)', border:'1px solid var(--line-strong)',
  boxShadow:'var(--shadow-2)',
  width:360,
});

// ============================================================
// #16 — REALISM FEEDBACK SUMMARY CARD
// ============================================================
function RealismFeedbackSheet() {
  const states = [
    { id:'flags', label:'Flags present' },
    { id:'none',  label:'No flags raised' },
    { id:'submitting', label:'Flag submitting (during attempt)' },
  ];
  const [s, setS] = rxUseState('flags');

  return (
    <div>
      <SubLabel>
        New card on the results page. Surfaces every question the testee flagged as unrealistic during the attempt, with a brief excerpt. Sits in the right-hand column, below the cross-family transparency note.
      </SubLabel>

      <div style={{display:'flex', gap:6, marginBottom:18, flexWrap:'wrap'}}>
        <span className="t-meta" style={{marginRight:10}}>SUB-STATE</span>
        {states.map(o => (
          <button key={o.id} onClick={() => setS(o.id)} style={{
            padding:'3px 9px',
            fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.04em',
            textTransform:'uppercase',
            color: s === o.id ? 'var(--bg-raised)' : 'var(--ink-3)',
            background: s === o.id ? 'var(--ink)' : 'transparent',
          }}>{o.label}</button>
        ))}
      </div>

      <div className="grid grid-12 gap-4">
        {/* Faint left column to show the card's place in the results layout */}
        <div className="col-span-7" style={{opacity:0.35, filter:'blur(1.2px)'}}>
          <FauxLoopPlan/>
        </div>
        <div className="col-span-5">
          {s === 'flags'      && <RealismCardWithFlags/>}
          {s === 'none'       && <RealismCardEmpty/>}
          {s === 'submitting' && <RealismFlagToast/>}
        </div>
      </div>
    </div>
  );
}

function FauxLoopPlan() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">By pill</div>
          <h3 className="h-3">Where you struggled</h3>
        </div>
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{padding:'14px 0', borderBottom:'1px solid var(--line)'}}>
          <div className="row jc-b mb-2">
            <div className="skel" style={{width:'40%', height:14}}/>
            <div className="skel" style={{width:48, height:14}}/>
          </div>
          <div className="skel" style={{width:'100%', height:4}}/>
        </div>
      ))}
    </div>
  );
}

const FLAGGED_QS = [
  {
    n: 4,
    excerpt: "A coastal patrol vessel is dry-docked in Port Elizabeth in 2027. The previous SPC system, which was applied in… hours within the previous 18 months. Recommend a recoat approach.",
    reason: "Too specific — names a port, year, and operator. Felt like a real-world advisory question, not a competency check.",
    age: "12 min ago",
  },
  {
    n: 7,
    excerpt: "After a recent dry-docking, your inspector reports that 4.7% of the coated area shows osmotic blistering at 0.3mm…",
    reason: "Numbers don't reflect anything I'd see in practice.",
    age: "8 min ago",
  },
  {
    n: 11,
    excerpt: "Calculate the expected SPC service life for a vessel operating at average 14kn with 30% static days, using…",
    reason: "Math problem, not a competency question. Feels generated, not authored.",
    age: "3 min ago",
  },
];

function RealismCardWithFlags() {
  return (
    <div className="card" style={{padding:24}}>
      <div className="eyebrow mb-2" style={{letterSpacing:'0.14em'}}>YOU FLAGGED 3 QUESTIONS</div>
      <h3 className="h-3" style={{marginBottom:4}}>
        <span className="serif-it">Thanks for the</span> realism feedback.
      </h3>
      <div className="muted" style={{fontSize:12.5, lineHeight:1.55, marginBottom:16}}>
        Your flags help us improve question quality across SiteMesh. The administrator
        for this assignment will see them aggregated with everyone else's.
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {FLAGGED_QS.map(q => (
          <div key={q.n} style={{
            display:'flex', gap:14, padding:'12px 14px',
            background:'var(--bg-sunk)',
            borderLeft:'2px solid var(--warn)',
          }}>
            <span className="mono" style={{
              fontSize:11, fontWeight:600, color:'var(--ink-3)',
              minWidth:24,
            }}>Q{String(q.n).padStart(2,'0')}</span>
            <div style={{flex:1}}>
              <div className="serif" style={{
                fontSize:13.5, lineHeight:1.55, color:'var(--ink-2)',
                marginBottom:6,
              }}>
                "{q.excerpt}"
              </div>
              <div style={{fontSize:11.5, color:'var(--ink-3)', lineHeight:1.5, fontStyle:'italic'}}>
                Your note · {q.reason}
              </div>
              <div className="t-meta" style={{color:'var(--ink-4)', marginTop:4}}>
                flagged {q.age}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop:16, paddingTop:14, borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <window.Icon name="sparkles" size={11} style={{color:'var(--accent)'}}/>
        <span className="t-meta" style={{color:'var(--ink-3)'}}>
          These flags don't affect your grade.
        </span>
      </div>
    </div>
  );
}

function RealismCardEmpty() {
  return (
    <div className="card sunk" style={{padding:'22px 22px', textAlign:'left'}}>
      <div className="eyebrow mb-2">Realism feedback</div>
      <div className="serif" style={{fontSize:16, color:'var(--ink-2)', lineHeight:1.45, marginBottom:6}}>
        <span className="serif-it">No flags</span> raised this attempt.
      </div>
      <div className="muted" style={{fontSize:12, lineHeight:1.55}}>
        If a question doesn't feel realistic during practice, use the
        "Flag as unrealistic" affordance in the attempt footer. Your notes
        help us tune question quality.
      </div>
      <div className="t-meta mt-3" style={{color:'var(--ink-4)'}}>
        Card hides entirely in production when no flags exist — shown here for review purposes.
      </div>
    </div>
  );
}

function RealismFlagToast() {
  return (
    <div className="card" style={{padding:18, background:'var(--bg-sunk)', borderColor:'transparent'}}>
      <div className="eyebrow mb-3">DURING ATTEMPT — INLINE FEEDBACK</div>
      <div style={{
        background:'var(--bg-raised)', border:'1px solid var(--line-strong)',
        padding:'12px 14px', boxShadow:'var(--shadow-2)',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
          <span className="pulse-dot" style={{width:7, height:7, background:'var(--ink-3)'}}/>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.12em',
            color:'var(--ink-3)',
          }}>FLAGGING…</span>
        </div>
        <div style={{fontSize:13.5, fontWeight:600, marginBottom:2}}>Sending your note</div>
        <div className="muted" style={{fontSize:12, lineHeight:1.55}}>
          Q4 will be marked unrealistic on this attempt.
        </div>
      </div>
      <div className="t-meta mt-3" style={{color:'var(--ink-3)', lineHeight:1.55}}>
        After confirmation, the flag posts to <code style={inlineCode}>/attempts/&#123;id&#125;/realism-flag</code> and
        is included in the post-attempt summary above. Already mocked at attempt.jsx 196–198.
      </div>
    </div>
  );
}

// ============================================================
// SHARED — labels
// ============================================================
function CardLabel({ children }) {
  return (
    <div className="t-meta" style={{
      marginBottom:8, color:'var(--ink-3)', letterSpacing:'0.12em',
    }}>{children}</div>
  );
}

function SubLabel({ children }) {
  return (
    <div className="muted" style={{fontSize:12.5, lineHeight:1.55, marginBottom:20, maxWidth:'68ch'}}>
      {children}
    </div>
  );
}

window.ResultsAdditionsMock = ResultsAdditionsMock;
