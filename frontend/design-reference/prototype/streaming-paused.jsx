// streaming-paused.jsx — v6 · FE-5 · #13
// Variant of the user-paused overlay (attempt.jsx 155-171) for the
// case where the streaming queue itself fails — a system glitch
// rather than a deliberate testee pause. Both variants mocked
// side-by-side in this file for visual contrast.

const { useState: spUseState } = React;

function StreamingPausedMock() {
  const states = [
    { id: 'sidebyside',     label: 'Both side-by-side' },
    { id: 'user',           label: 'User-paused only' },
    { id: 'glitch',         label: 'System-glitch only' },
    { id: 'glitch-details', label: 'System-glitch · details expanded' },
  ];
  const [s, setS] = spUseState('sidebyside');

  return (
    <div className="content" style={{paddingBottom:80}}>
      <window.V6MockHeader id="FE-5 · #13"
        title="Paused states"
        sub="The existing user-paused overlay (left) and the new system-glitch overlay (right) share the same resume affordance but use different lexicon, iconography, and detail. The glitch case adds an optional collapsible for support diagnosis — collapsed by default so the testee doesn't have to confront an error code unless they want to."
        states={states} state={s} onState={setS}/>

      {s === 'sidebyside' && (
        <div style={{
          display:'grid',
          gridTemplateColumns:'1fr 1fr',
          gap:24, marginTop:24,
        }}>
          <PausedSlot label="USER-PAUSED — EXISTING (attempt.jsx 155–171)">
            <UserPausedOverlay/>
          </PausedSlot>
          <PausedSlot label="SYSTEM-GLITCH — NEW">
            <SystemGlitchOverlay expanded={false}/>
          </PausedSlot>
        </div>
      )}
      {s === 'user' && (
        <PausedSlot label="USER-PAUSED — EXISTING (attempt.jsx 155–171)">
          <UserPausedOverlay/>
        </PausedSlot>
      )}
      {s === 'glitch' && (
        <PausedSlot label="SYSTEM-GLITCH — NEW">
          <SystemGlitchOverlay expanded={false}/>
        </PausedSlot>
      )}
      {s === 'glitch-details' && (
        <PausedSlot label="SYSTEM-GLITCH · DETAILS EXPANDED">
          <SystemGlitchOverlay expanded={true}/>
        </PausedSlot>
      )}

      <ComparisonNote/>
    </div>
  );
}

function PausedSlot({ label, children }) {
  return (
    <div>
      <div className="t-meta" style={{marginBottom:8, color:'var(--ink-3)'}}>{label}</div>
      <div style={{
        position:'relative',
        background:'var(--bg)',
        border:'1px solid var(--line-strong)',
        overflow:'hidden',
      }}>
        <BlurredAttemptBackdrop/>
        <div style={{
          position:'absolute', inset:0,
          background:'color-mix(in oklab, var(--bg) 92%, transparent)',
          display:'grid', placeItems:'center', padding:24,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// A faked, blurred attempt-screen behind the overlay so the comparison feels real.
function BlurredAttemptBackdrop() {
  return (
    <div style={{padding:'24px 28px', minHeight:520, filter:'blur(2.5px)', opacity:0.6}}>
      <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:14}}>
        <div style={{height:20, width:80, background:'var(--bg-sunk)'}}/>
        <div style={{height:20, width:140, background:'var(--bg-sunk)'}}/>
        <div style={{flex:1}}/>
        <div style={{height:24, width:80, background:'var(--bg-sunk)'}}/>
      </div>
      <div style={{display:'flex', gap:4, marginBottom:24}}>
        {Array.from({length:8}).map((_,i) => (
          <div key={i} style={{flex:1, height:5, background: i < 3 ? 'var(--ok)' : i === 3 ? 'var(--ink)' : 'var(--bg-deep)'}}/>
        ))}
      </div>
      <div style={{height:14, width:'30%', background:'var(--bg-sunk)', marginBottom:14}}/>
      <div style={{height:36, width:'90%', background:'var(--bg-sunk)', marginBottom:8}}/>
      <div style={{height:36, width:'80%', background:'var(--bg-sunk)', marginBottom:24}}/>
      {[1,2,3,4].map(i => (
        <div key={i} style={{height:42, background:'var(--bg-sunk)', marginBottom:8}}/>
      ))}
    </div>
  );
}

// ============================================================
// USER-PAUSED (existing — copy of attempt.jsx 155–171)
// ============================================================
function UserPausedOverlay() {
  return (
    <div className="card" style={{maxWidth:420, textAlign:'center', padding:'40px 32px'}}>
      <div className="serif-it" style={{fontSize:42, lineHeight:1, color:'var(--ink-3)'}}>paused</div>
      <div className="muted mt-4" style={{fontSize:13}}>
        Per AC-D11, question content is blanked while paused so the pause window isn't usable for lookup.
        Your timer is held.
      </div>
      <div className="mt-6">
        <button className="btn btn-primary">
          Resume <span className="arrow">→</span>
        </button>
      </div>
      <div className="t-meta mt-4">28 of 30 pause minutes remaining today</div>
    </div>
  );
}

// ============================================================
// SYSTEM-GLITCH (new variant)
// ============================================================
function SystemGlitchOverlay({ expanded: defaultExpanded }) {
  const [expanded, setExpanded] = spUseState(defaultExpanded);
  return (
    <div className="card" style={{maxWidth:460, textAlign:'center', padding:'36px 32px'}}>
      {/* Glyph — quiet, not alarming */}
      <div style={{
        width:42, height:42, borderRadius:'50%',
        background:'var(--bg-sunk)', color:'var(--ink-3)',
        display:'grid', placeItems:'center',
        margin:'0 auto 14px',
        border:'1px solid var(--line)',
      }}>
        <window.Icon name="wave" size={18}/>
      </div>

      {/* Headline matches the user-pause's serif-italic rhythm but in a complete phrase */}
      <div className="serif" style={{fontSize:28, lineHeight:1.18, letterSpacing:'-0.012em', marginBottom:8}}>
        <span className="serif-it">Connection</span> issue.
      </div>
      <div className="muted" style={{fontSize:13.5, lineHeight:1.55, marginBottom:6}}>
        We hit a glitch generating your next questions. Try resuming in a minute —
        your progress is saved and your timer is held.
      </div>

      <div className="mt-6">
        <button className="btn btn-primary">
          Try resuming <span className="arrow">→</span>
        </button>
      </div>

      {/* Collapsible details for support */}
      <div style={{marginTop:24, paddingTop:18, borderTop:'1px solid var(--line)'}}>
        <button onClick={() => setExpanded(e => !e)} style={{
          fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.06em',
          textTransform:'uppercase', color:'var(--ink-3)',
          borderBottom:'1px dotted var(--ink-3)', paddingBottom:1,
        }}>
          {expanded ? '— hide technical details' : '+ show technical details'}
        </button>

        {expanded && (
          <div style={{
            marginTop:14, textAlign:'left',
            background:'var(--bg-sunk)',
            padding:'12px 14px',
            fontFamily:'var(--font-mono)', fontSize:11.5,
            color:'var(--ink-2)', lineHeight:1.7,
          }}>
            <div><span style={{color:'var(--ink-4)'}}>code   </span>STREAM_TIMEOUT</div>
            <div><span style={{color:'var(--ink-4)'}}>trace  </span>9e1d7c · 2026-05-24T14:18:03Z</div>
            <div><span style={{color:'var(--ink-4)'}}>buffer </span>0 questions ahead (Q5–Q8 generating)</div>
            <div style={{color:'var(--ink-3)', marginTop:8}}>
              Send this trace to support if it happens again.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPARISON NOTE
// ============================================================
function ComparisonNote() {
  const rows = [
    ['Trigger',          'Testee clicked Pause',           'asyncio.gather timed out · stream worker crashed'],
    ['Headline glyph',   'serif italic "paused"',          'wave icon · neutral'],
    ['Headline word',    'paused',                         'Connection issue.'],
    ['Body tone',        'integrity reminder (AC-D11)',    'reassurance + try again'],
    ['Resume action',    '"Resume"',                       '"Try resuming"  (gentle nuance — not certain)'],
    ['Timer behaviour',  'held',                           'held'],
    ['Technical details','none',                           'collapsible · code · trace · buffer state'],
    ['Pause budget',     '"28 of 30 pause minutes left"',  'not consumed — this isn\'t a user pause'],
  ];
  return (
    <div style={{
      marginTop:32, padding:'18px 20px',
      background:'var(--bg-sunk)',
      borderLeft:'2px solid var(--accent)',
    }}>
      <div className="eyebrow mb-3">Where they diverge</div>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12.5}}>
        <thead>
          <tr>
            <th style={cellHeadStyle}></th>
            <th style={cellHeadStyle}>USER-PAUSED</th>
            <th style={cellHeadStyle}>SYSTEM-GLITCH</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i}>
              <td style={cellLabelStyle}>{r[0]}</td>
              <td style={cellStyle}>{r[1]}</td>
              <td style={cellStyle}>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellHeadStyle = {
  textAlign:'left', padding:'6px 12px 10px 0',
  fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.1em',
  textTransform:'uppercase', color:'var(--ink-3)', fontWeight:500,
};
const cellLabelStyle = {
  padding:'7px 12px 7px 0',
  color:'var(--ink-3)', fontSize:12,
  borderTop:'1px solid var(--line)',
  width:160,
};
const cellStyle = {
  padding:'7px 12px 7px 0',
  color:'var(--ink-2)',
  borderTop:'1px solid var(--line)',
  lineHeight:1.55,
};

window.StreamingPausedMock = StreamingPausedMock;
