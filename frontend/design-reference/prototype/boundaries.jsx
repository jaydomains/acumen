// boundaries.jsx — v6 · FE-2 · #8
// 404 / 500 / 403 / loading-skeleton — all within the app shell.
// Selectable via the STATE strip at the top.

const { useState: bUseState } = React;

function BoundariesMock() {
  const states = [
    { id: '404',      label: '404 · Not found' },
    { id: '500',      label: '500 · Crashed' },
    { id: '403',      label: '403 · Forbidden' },
    { id: 'skeleton', label: 'Route loading' },
  ];
  const [s, setS] = bUseState('404');

  return (
    <div className="content">
      <V6MockHeader id="FE-2 · #8" title="Boundary pages"
        sub="Inside the app shell — rail + topbar present. All four sit at the same horizontal rhythm so a refresh on any boundary doesn't shift layout."
        states={states} state={s} onState={setS}/>

      <div style={{paddingTop:24}}>
        {s === '404'      && <NotFound/>}
        {s === '500'      && <ServerError/>}
        {s === '403'      && <Forbidden/>}
        {s === 'skeleton' && <RouteSkeleton/>}
      </div>
    </div>
  );
}

// ============================================================
// SHARED LAYOUT — a centred message with consistent vertical rhythm
// ============================================================
function BoundaryFrame({ glyph, eyebrow, title, body, actions, footer }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      textAlign:'center', padding:'40px 24px 60px',
    }}>
      <div style={{
        width:64, height:64, borderRadius:'50%',
        background:'var(--bg-sunk)', color:'var(--ink-3)',
        display:'grid', placeItems:'center',
        border:'1px solid var(--line)',
        marginBottom:22,
      }}>{glyph}</div>

      <div className="eyebrow mb-2" style={{letterSpacing:'0.14em'}}>{eyebrow}</div>
      <h1 className="h-1" style={{maxWidth:'18ch', marginBottom:14}}>{title}</h1>
      <div className="muted" style={{maxWidth:'48ch', fontSize:14, lineHeight:1.6, marginBottom:24}}>
        {body}
      </div>
      <div style={{display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center'}}>
        {actions}
      </div>
      {footer && (
        <div style={{
          marginTop:36, paddingTop:18, borderTop:'1px solid var(--line)',
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)',
          letterSpacing:'0.04em', maxWidth:380, width:'100%',
        }}>{footer}</div>
      )}
    </div>
  );
}

// ============================================================
// 404
// ============================================================
function NotFound() {
  return (
    <BoundaryFrame
      glyph={<span className="serif" style={{fontSize:34, color:'var(--ink-3)'}}>404</span>}
      eyebrow="NOT FOUND"
      title={<><span className="serif-it">That page</span> doesn't exist.</>}
      body={<>
        The link you followed may be old, mistyped, or pointing at something we've
        since renamed. Your administrator can re-share if you need it.
      </>}
      actions={<>
        <button className="btn btn-primary">Go to dashboard <span className="arrow">→</span></button>
        <button className="btn">Back</button>
      </>}
      footer={<>path · /pills/cathodic-prtection</>}/>
  );
}

// ============================================================
// 500
// ============================================================
function ServerError() {
  const [expanded, setExpanded] = bUseState(false);
  return (
    <BoundaryFrame
      glyph={<window.Icon name="wave" size={26}/>}
      eyebrow="SOMETHING WENT WRONG"
      title={<><span className="serif-it">We hit</span> a snag on our side.</>}
      body={<>
        The error has been logged for engineering. Usually a second attempt is enough —
        if it keeps happening, your administrator can quote the trace ID below to support.
      </>}
      actions={<>
        <button className="btn btn-primary">Try again <span className="arrow">→</span></button>
        <button className="btn">Contact support</button>
      </>}
      footer={<>
        <button onClick={() => setExpanded(e => !e)} style={{
          color:'var(--ink-3)', fontFamily:'inherit', fontSize:'inherit',
          borderBottom:'1px dotted var(--ink-3)', paddingBottom:1,
        }}>
          {expanded ? '— hide details' : '+ show details'}
        </button>
        {expanded && (
          <div style={{
            marginTop:12, padding:'12px 14px',
            background:'var(--bg-sunk)', textAlign:'left',
            lineHeight:1.7, color:'var(--ink-2)',
          }}>
            <div><span style={{color:'var(--ink-4)'}}>code   </span>RESULTS_LOAD_FAILED</div>
            <div><span style={{color:'var(--ink-4)'}}>trace  </span>7f8a1c · 2026-05-24T14:18:03Z</div>
          </div>
        )}
      </>}/>
  );
}

// ============================================================
// 403
// ============================================================
function Forbidden() {
  return (
    <BoundaryFrame
      glyph={<window.Icon name="lock" size={24}/>}
      eyebrow="NO ACCESS"
      title={<><span className="serif-it">This area is</span> for administrators.</>}
      body={<>
        Your account is set up as a <strong style={{color:'var(--ink)'}}>testee</strong> — and
        the page you tried to open is part of the administrator surface. If you think your
        role is wrong, ask whoever invited you to Acumen to check.
      </>}
      actions={<>
        <button className="btn btn-primary">Go to dashboard <span className="arrow">→</span></button>
      </>}
      footer={<>route · /admin/users · required role · admin</>}/>
  );
}

// ============================================================
// LOADING SKELETON — matches QuestionSkeleton rhythm but page-frame scale
// ============================================================
function RouteSkeleton() {
  return (
    <div>
      {/* PageHeader skeleton */}
      <div style={{marginBottom:36}}>
        <div className="skel" style={{width:200, height:11, marginBottom:14}}/>
        <div className="skel" style={{width:'58%', height:42, marginBottom:14}}/>
        <div className="skel" style={{width:'38%', height:14, marginBottom:6}}/>
        <div className="skel" style={{width:'30%', height:14}}/>
      </div>

      {/* 4-stat row skeleton */}
      <div className="grid grid-12 gap-4" style={{marginBottom:24}}>
        {[3,3,3,3].map((span,i) => (
          <div key={i} className={'col-span-'+span} style={{
            background:'var(--bg-raised)', border:'1px solid var(--line)',
            padding:'28px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:12,
          }}>
            <div className="skel" style={{width:64, height:36}}/>
            <div className="skel" style={{width:96, height:9}}/>
            <div className="skel" style={{width:72, height:9}}/>
          </div>
        ))}
      </div>

      {/* Two-column main */}
      <div className="grid grid-12 gap-4">
        <div className="col-span-7">
          <div style={{background:'var(--bg-raised)', border:'1px solid var(--line)', padding:22}}>
            <div className="skel" style={{width:120, height:11, marginBottom:10}}/>
            <div className="skel" style={{width:'48%', height:22, marginBottom:18}}/>
            {[1,2,3,4].map(i => (
              <div key={i} style={{marginBottom:14}}>
                <div className="row jc-b mb-2">
                  <div className="skel" style={{width:'40%', height:12}}/>
                  <div className="skel" style={{width:48, height:12}}/>
                </div>
                <div className="skel" style={{width:'100%', height:4}}/>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-5">
          <div style={{background:'var(--bg-raised)', border:'1px solid var(--line)', padding:22}}>
            <div className="skel" style={{width:120, height:11, marginBottom:10}}/>
            <div className="skel" style={{width:'72%', height:22, marginBottom:24}}/>
            {[1,2,3].map(i => (
              <div key={i} className="row gap-3" style={{marginBottom:18, alignItems:'flex-start'}}>
                <div className="skel" style={{width:32, height:32, borderRadius:'50%', flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div className="skel" style={{width:'60%', height:12, marginBottom:6}}/>
                  <div className="skel" style={{width:'90%', height:10, marginBottom:4}}/>
                  <div className="skel" style={{width:'72%', height:10}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{textAlign:'center', marginTop:32}}>
        <div className="t-meta" style={{color:'var(--ink-4)'}}>
          <span className="pulse-dot" style={{width:6, height:6, marginRight:8}}/>
          Loading
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HEADER — shared with other v6 mocks
// ============================================================
function V6MockHeader({ id, title, sub, states, state, onState }) {
  return (
    <div style={{borderBottom:'1px solid var(--line)', paddingBottom:18, marginBottom:8}}>
      <div className="eyebrow mb-2" style={{letterSpacing:'0.16em'}}>v6 · {id}</div>
      <h1 className="h-1" style={{marginBottom:6, fontSize:36}}>
        <span className="serif-it">{title.split(' ')[0]}</span> {title.split(' ').slice(1).join(' ')}
      </h1>
      <div className="muted" style={{fontSize:13.5, maxWidth:'64ch', lineHeight:1.55, marginBottom:18}}>{sub}</div>
      {states && (
        <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center'}}>
          <span className="t-meta" style={{marginRight:8, letterSpacing:'0.14em'}}>STATE</span>
          {states.map(o => {
            const active = state === o.id;
            return (
              <button key={o.id} onClick={() => onState(o.id)} style={{
                padding:'3px 9px',
                fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.04em',
                textTransform:'uppercase',
                color: active ? 'var(--bg-raised)' : 'var(--ink-3)',
                background: active ? 'var(--ink)' : 'transparent',
              }}>{o.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { BoundariesMock, V6MockHeader });
