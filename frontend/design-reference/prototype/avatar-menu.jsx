// avatar-menu.jsx — v6 · FE-1 · Shell extension mock
// Mocks the avatar dropdown that would extend shell.jsx's TopBar avatar.
// Renders the closed / open / logging-out states side-by-side so the
// dropdown can be reviewed without firing any actual hover/click state.

const { useState: amUseState } = React;

function AvatarMenuMock() {
  return (
    <div style={{
      width:'100%', minHeight:'100%',
      padding:'40px 32px 64px',
      background:'var(--bg)',
    }}>
      <div className="eyebrow mb-3" style={{letterSpacing:'0.18em'}}>v6 · FE-1 · #6  ·  AVATAR-MENU DROPDOWN</div>
      <div className="serif" style={{fontSize:30, lineHeight:1.18, letterSpacing:'-0.012em', marginBottom:6}}>
        <span className="serif-it">From the</span> TopBar avatar.
      </div>
      <div className="muted" style={{fontSize:13.5, maxWidth:'62ch', lineHeight:1.6, marginBottom:32}}>
        Extension to <code style={{fontFamily:'var(--font-mono)', fontSize:12.5, color:'var(--ink-2)'}}>shell.jsx</code> &middot; line 97
        &mdash; the avatar circle becomes a button that opens this menu. All three states shown
        side-by-side for visual review. Logout is the only menu item for v1.
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',
        gap:24,
      }}>
        <StateColumn label="Closed (rest)" sub="The default state. Just the circle.">
          <FakeTopBar variant="closed"/>
        </StateColumn>

        <StateColumn label="Open" sub="Clicked. Menu anchored to the avatar.">
          <FakeTopBar variant="open"/>
        </StateColumn>

        <StateColumn label="Logging out" sub="After 'Log out' clicked; menu stays open with spinner.">
          <FakeTopBar variant="loggingOut"/>
        </StateColumn>
      </div>

      <div style={{marginTop:42, padding:'20px 22px', background:'var(--bg-sunk)', borderLeft:'2px solid var(--accent)'}}>
        <div className="eyebrow" style={{letterSpacing:'0.14em', marginBottom:8}}>IMPLEMENTATION NOTE</div>
        <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>
          The dropdown anchors top-right of the avatar with an 8px gap. Click-outside or
          <kbd style={kbdStyle}>Esc</kbd> closes it. While "Logging out…" is showing, the
          menu items become non-interactive but the menu itself remains anchored to avoid
          a perceived layout shift before the redirect.
        </div>
      </div>
    </div>
  );
}

const kbdStyle = {
  display:'inline-block', padding:'1px 5px',
  margin:'0 2px',
  fontFamily:'var(--font-mono)', fontSize:11,
  border:'1px solid var(--line-strong)',
  background:'var(--bg-raised)',
  color:'var(--ink-2)',
};

function StateColumn({ label, sub, children }) {
  return (
    <div>
      <div style={{marginBottom:14}}>
        <div className="t-meta" style={{letterSpacing:'0.14em', color:'var(--ink-2)'}}>{label.toUpperCase()}</div>
        <div className="muted" style={{fontSize:12, marginTop:2}}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

function FakeTopBar({ variant }) {
  return (
    <div style={{
      position:'relative',
      background:'var(--bg-raised)',
      border:'1px solid var(--line)',
      minHeight: variant === 'closed' ? 280 : 340,
    }}>
      {/* The faux topbar */}
      <header style={{
        display:'flex', alignItems:'center', gap:14,
        padding:'14px 18px',
        borderBottom:'1px solid var(--line)',
      }}>
        <span className="t-meta" style={{color:'var(--ink-4)'}}>SiteMesh</span>
        <span style={{color:'var(--ink-4)'}}>/</span>
        <span className="t-meta" style={{color:'var(--ink-4)'}}>Acumen</span>
        <span style={{color:'var(--ink-4)'}}>/</span>
        <span style={{fontWeight:600, fontSize:13}}>Dashboard</span>
        <span style={{flex:1}}/>
        <Avatar variant={variant}/>
      </header>

      {/* Body — kept faint so attention is on the avatar */}
      <div style={{padding:'20px 18px', opacity:0.5}}>
        <div style={{height:14, background:'var(--bg-sunk)', width:'40%', marginBottom:10}}/>
        <div style={{height:8, background:'var(--bg-sunk)', width:'72%', marginBottom:6}}/>
        <div style={{height:8, background:'var(--bg-sunk)', width:'58%', marginBottom:24}}/>
        <div style={{height:80, background:'var(--bg-sunk)'}}/>
      </div>

      {/* Open or LoggingOut dropdown */}
      {(variant === 'open' || variant === 'loggingOut') && (
        <Dropdown variant={variant}/>
      )}
    </div>
  );
}

function Avatar({ variant }) {
  const active = variant === 'open' || variant === 'loggingOut';
  return (
    <button style={{
      width:32, height:32, borderRadius:'50%',
      background: active ? 'var(--ink)' : 'var(--bg-deep)',
      color: active ? 'var(--bg-raised)' : 'var(--ink-2)',
      fontWeight:600, fontSize:12,
      display:'grid', placeItems:'center',
      border: active ? '1px solid var(--ink)' : '1px solid var(--line-strong)',
      cursor:'pointer',
      transition:'background .15s ease',
    }}>JV</button>
  );
}

function Dropdown({ variant }) {
  return (
    <div style={{
      position:'absolute',
      top:54, right:14,
      width:240,
      background:'var(--bg-raised)',
      border:'1px solid var(--line-strong)',
      boxShadow:'var(--shadow-2)',
      zIndex:5,
    }}>
      {/* Identity block */}
      <div style={{padding:'14px 14px 12px'}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:2}}>
          Jay van der Merwe
        </div>
        <div className="t-meta" style={{fontSize:11.5, color:'var(--ink-3)', letterSpacing:'0.02em', textTransform:'none', fontFamily:'var(--font-mono)'}}>
          jay@sitemesh.co
        </div>
        <div style={{display:'flex', gap:6, marginTop:8, alignItems:'center'}}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em',
            textTransform:'uppercase', color:'var(--ink-3)',
            padding:'1px 6px', background:'var(--bg-sunk)',
          }}>TESTEE</span>
          <span className="muted" style={{fontSize:11.5}}>· SiteMesh</span>
        </div>
      </div>

      <div style={{height:1, background:'var(--line)'}}/>

      {/* Logout item */}
      <button style={{
        display:'flex', width:'100%', alignItems:'center', gap:10,
        padding:'11px 14px',
        color: variant === 'loggingOut' ? 'var(--ink-3)' : 'var(--ink-2)',
        fontSize:13,
        cursor: variant === 'loggingOut' ? 'default' : 'pointer',
        pointerEvents: variant === 'loggingOut' ? 'none' : 'auto',
      }}>
        {variant === 'loggingOut' ? (
          <>
            <span className="pulse-dot" style={{width:8,height:8,background:'var(--ink-3)'}}/>
            <span>Logging out…</span>
          </>
        ) : (
          <>
            <window.Icon name="logout" size={14}/>
            <span>Log out</span>
            <span style={{flex:1}}/>
            <span className="t-meta" style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-4)'}}>⌘⇧Q</span>
          </>
        )}
      </button>
    </div>
  );
}

window.AvatarMenuMock = AvatarMenuMock;
