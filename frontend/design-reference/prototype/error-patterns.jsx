// error-patterns.jsx — v6 · FE-1 · #7
// Component sheet showing the three error display patterns Acumen uses
// app-wide. All three rendered in one view so design + eng can align on
// copy tone and visual hierarchy.
//
// API envelope: { error: { code, message, fields?: { name: 'message' } } }

const { useState: epUseState } = React;

function ErrorPatternsMock() {
  return (
    <div style={{width:'100%', minHeight:'100%', padding:'40px 32px 80px', background:'var(--bg)'}}>
      <div className="eyebrow mb-3" style={{letterSpacing:'0.18em'}}>v6 · FE-1 · #7  ·  ERROR DISPLAY PATTERNS</div>
      <div className="serif" style={{fontSize:30, lineHeight:1.18, letterSpacing:'-0.012em', marginBottom:6}}>
        <span className="serif-it">Three ways to</span> say something went wrong.
      </div>
      <div className="muted" style={{fontSize:13.5, maxWidth:'62ch', lineHeight:1.6, marginBottom:32}}>
        Inline for form fields, toasts for transient feedback, full-page boundary
        when nothing else can rescue the route. Mapped from the API error envelope:
        <code style={inlineCodeStyle}>{`{ error: { code, message, fields?: { name: 'message' } } }`}</code>.
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr', gap:34}}>
        <Section
          n="A"
          label="Inline form-field error"
          sub="Mapped from error.fields[name]. Sits below the affected field; never block-level."
        ><InlineFieldDemo/></Section>

        <Section
          n="B"
          label="Toast"
          sub="Bottom-right. Auto-dismisses (3s info, 5s warning, 7s error). One severity colour bar."
        ><ToastDemo/></Section>

        <Section
          n="C"
          label="Full-page error boundary"
          sub="Inside the app shell, replaces the route body when an unhandled error escapes."
        ><BoundaryDemo/></Section>
      </div>
    </div>
  );
}

const inlineCodeStyle = {
  fontFamily:'var(--font-mono)', fontSize:11.5,
  background:'var(--bg-sunk)', padding:'2px 5px',
  color:'var(--ink-2)', marginLeft:6,
};

function Section({ n, label, sub, children }) {
  return (
    <div>
      <div style={{
        display:'flex', alignItems:'baseline', gap:14,
        paddingBottom:10, marginBottom:18,
        borderBottom:'1px solid var(--line)',
      }}>
        <span className="serif" style={{
          fontSize:24, color:'var(--ink-3)',
        }}>{n}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:2}}>{label}</div>
          <div className="muted" style={{fontSize:12.5, lineHeight:1.5}}>{sub}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// A. INLINE FIELD ERROR
// ============================================================
function InlineFieldDemo() {
  return (
    <div style={{display:'grid', gridTemplateColumns:'minmax(320px,420px) 1fr', gap:32, alignItems:'start'}}>
      <div className="card" style={{padding:'24px 22px'}}>
        <div className="eyebrow mb-3">PRACTICE FORM</div>

        <div style={{marginBottom:14}}>
          <label style={fieldLabelStyle}>EMAIL</label>
          <input className="input" defaultValue="jay@sitemesh" style={{borderColor:'var(--danger)'}}/>
          <div style={errorRowStyle}>
            <window.Icon name="x" size={11} stroke={2.2} style={{marginTop:3, flexShrink:0}}/>
            <span>That doesn't look like a complete email address.</span>
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={fieldLabelStyle}>DIFFICULTY</label>
          <input className="input" defaultValue="D14"
            style={{borderColor:'var(--danger)', fontFamily:'var(--font-mono)'}}/>
          <div style={errorRowStyle}>
            <window.Icon name="x" size={11} stroke={2.2} style={{marginTop:3, flexShrink:0}}/>
            <span>Difficulty has to be between D1 and D10.</span>
          </div>
        </div>

        <button className="btn btn-primary btn-block btn-lg" style={{justifyContent:'center', marginTop:4}}>
          Save changes <span className="arrow">→</span>
        </button>
      </div>

      <EnvelopeNote
        title="Envelope mapping"
        body={`error.fields = {
  email: "That doesn't look like a complete email address.",
  difficulty: "Difficulty has to be between D1 and D10."
}`}
        notes={[
          'Inline copy ships from the server in <strong>fields[name]</strong>.',
          'If a field error and a top-level <strong>error.message</strong> both arrive, the inline copy wins for that field; the message becomes a toast.',
          'Errors clear as soon as the field is touched again.',
        ]}
      />
    </div>
  );
}

const fieldLabelStyle = {
  display:'block', fontSize:10.5, fontFamily:'var(--font-mono)',
  letterSpacing:'0.12em', textTransform:'uppercase',
  color:'var(--ink-3)', marginBottom:6,
};
const errorRowStyle = {
  display:'flex', gap:6, alignItems:'flex-start',
  marginTop:6, fontSize:12.5, color:'var(--danger)',
};

// ============================================================
// B. TOAST
// ============================================================
function ToastDemo() {
  return (
    <div style={{display:'grid', gridTemplateColumns:'minmax(320px, 420px) 1fr', gap:32, alignItems:'start'}}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <Toast severity="info"
          title="Saved"
          body="Your changes to Antifouling Systems are live."/>
        <Toast severity="warning"
          title="Heads up"
          body="3 testees haven't started this assignment yet — the deadline is Friday."/>
        <Toast severity="error"
          title="Couldn't export the PDF"
          body="Something went wrong on our side. Try again in a moment."
          action="Try again"/>
      </div>
      <EnvelopeNote
        title="Envelope mapping"
        body={`error.code = "EXPORT_FAILED"
error.message = "Couldn't export the PDF"`}
        notes={[
          '<strong>error.message</strong> becomes the toast title.',
          'Severity is derived from <strong>error.code</strong> via a small map — unknown codes default to <em>error</em>.',
          'Toasts stack bottom-right with 8px gaps; max three on screen, older ones dismiss to make room.',
          'An action button is added when the failure is retryable (network, transient).',
        ]}
      />
    </div>
  );
}

function Toast({ severity, title, body, action }) {
  const colorMap = {
    info:    { bar:'var(--info)',    soft:'var(--info-soft)',    label:'INFO' },
    warning: { bar:'var(--warn)',    soft:'var(--warn-soft)',    label:'WARNING' },
    error:   { bar:'var(--danger)',  soft:'var(--danger-soft)',  label:'ERROR' },
  };
  const c = colorMap[severity];
  return (
    <div style={{
      display:'flex', gap:0, alignItems:'stretch',
      background:'var(--bg-raised)', border:'1px solid var(--line-strong)',
      boxShadow:'var(--shadow-2)',
    }}>
      <div style={{width:3, background:c.bar, flexShrink:0}}/>
      <div style={{padding:'12px 14px', flex:1}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.14em',
            color:c.bar, fontWeight:600,
          }}>{c.label}</span>
        </div>
        <div style={{fontWeight:600, fontSize:13.5, marginBottom:2}}>{title}</div>
        <div className="muted" style={{fontSize:12.5, lineHeight:1.55}}>{body}</div>
        {action && (
          <button style={{
            marginTop:8, fontSize:12, color:c.bar,
            borderBottom:'1px solid '+c.bar, padding:0, paddingBottom:1,
          }}>{action} →</button>
        )}
      </div>
      <button style={{
        padding:'10px 12px', color:'var(--ink-4)',
        alignSelf:'flex-start',
      }}>
        <window.Icon name="x" size={14}/>
      </button>
    </div>
  );
}

// ============================================================
// C. FULL-PAGE BOUNDARY
// ============================================================
function BoundaryDemo() {
  const [expanded, setExpanded] = epUseState(false);
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr', gap:18}}>
      <div style={{
        background:'var(--bg-raised)',
        border:'1px solid var(--line)',
        minHeight: 360,
        display:'grid',
        gridTemplateRows:'auto 1fr',
      }}>
        {/* Fake topbar to remind viewer the shell stays */}
        <div style={{
          padding:'12px 18px',
          borderBottom:'1px solid var(--line)',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <span className="t-meta" style={{color:'var(--ink-4)'}}>SiteMesh</span>
          <span style={{color:'var(--ink-4)'}}>/</span>
          <span className="t-meta" style={{color:'var(--ink-4)'}}>Acumen</span>
          <span style={{color:'var(--ink-4)'}}>/</span>
          <span style={{fontSize:13, fontWeight:600}}>Results</span>
          <span style={{flex:1}}/>
          <div style={{
            width:28, height:28, borderRadius:'50%',
            background:'var(--bg-deep)', color:'var(--ink-2)',
            display:'grid', placeItems:'center', fontSize:11, fontWeight:600,
          }}>JV</div>
        </div>

        {/* Boundary body */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'40px 24px',
        }}>
          <div style={{maxWidth:480, textAlign:'center'}}>
            <div style={{
              width:48, height:48, borderRadius:'50%',
              background:'var(--bg-sunk)', color:'var(--ink-3)',
              display:'grid', placeItems:'center',
              margin:'0 auto 18px',
              border:'1px solid var(--line)',
            }}>
              <window.Icon name="wave" size={22}/>
            </div>
            <div className="serif" style={{fontSize:26, lineHeight:1.2, letterSpacing:'-0.012em', marginBottom:8}}>
              <span className="serif-it">Something</span> went wrong.
            </div>
            <div className="muted" style={{fontSize:13.5, lineHeight:1.6, marginBottom:22}}>
              We couldn't load this page. The error has been logged — usually a
              second attempt is enough.
            </div>

            <div style={{display:'flex', gap:10, justifyContent:'center'}}>
              <button className="btn btn-primary">Try again <span className="arrow">→</span></button>
              <button className="btn">Go to dashboard</button>
            </div>

            <button onClick={() => setExpanded(e => !e)} style={{
              marginTop:24, fontSize:11.5, color:'var(--ink-3)',
              fontFamily:'var(--font-mono)', letterSpacing:'0.06em',
              textTransform:'uppercase',
              borderBottom:'1px dotted var(--ink-3)', paddingBottom:1,
            }}>
              {expanded ? '— Hide technical details' : '+ Show technical details'}
            </button>

            {expanded && (
              <div style={{
                marginTop:14, textAlign:'left',
                padding:'12px 14px',
                background:'var(--bg-sunk)',
                fontFamily:'var(--font-mono)', fontSize:11.5,
                color:'var(--ink-2)', lineHeight:1.6,
              }}>
                <div><span style={{color:'var(--ink-4)'}}>code   </span> RESULTS_LOAD_FAILED</div>
                <div><span style={{color:'var(--ink-4)'}}>trace  </span> 7f8a1c · 2026-05-22T14:18:03Z</div>
                <div style={{color:'var(--ink-3)', marginTop:4}}>
                  Quote this trace ID when contacting support.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <EnvelopeNote
        title="When this fires"
        body={`error.code = "RESULTS_LOAD_FAILED"
error.message = "Internal error fetching attempt summary"`}
        notes={[
          'Triggered by the route-level React error boundary when an unhandled exception escapes the route component.',
          '<strong>trace</strong> comes from the server response header <code>x-acumen-trace</code> and is always shown — it\'s the only thing support needs.',
          'Falls through to the OS-level error page only if React itself fails to render the boundary.',
        ]}
      />
    </div>
  );
}

// ============================================================
// SHARED — envelope note
// ============================================================
function EnvelopeNote({ title, body, notes }) {
  return (
    <div style={{
      background:'var(--bg-sunk)',
      borderLeft:'2px solid var(--accent)',
      padding:'14px 16px',
    }}>
      <div className="eyebrow" style={{letterSpacing:'0.14em', marginBottom:8}}>{title}</div>
      <pre style={{
        margin:'0 0 12px',
        fontFamily:'var(--font-mono)', fontSize:11.5,
        color:'var(--ink-2)', lineHeight:1.55,
        whiteSpace:'pre-wrap',
      }}>{body}</pre>
      <ul style={{margin:0, paddingLeft:16, color:'var(--ink-2)', fontSize:12.5, lineHeight:1.6}}>
        {notes.map((n,i) => <li key={i} style={{marginBottom:4}} dangerouslySetInnerHTML={{__html:n}}/>)}
      </ul>
    </div>
  );
}

window.ErrorPatternsMock = ErrorPatternsMock;
