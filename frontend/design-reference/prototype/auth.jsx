// auth.jsx — v6 · FE-1 · Unauthenticated surfaces
// Mounts when Tweaks role === 'unauth'. Contains the five card pages
// (login / forgot / reset / setup / privacy). The avatar-menu and
// error-patterns mocks live in their own files and slot in here too.
//
// Convention: each page renders its own STATE strip at the top so a
// reviewer can click through every state without code edits.

const { useState: auUseState, useEffect: auUseEffect } = React;

// ============================================================
// ROOT FRAME — picks which page to show; offers a sub-nav
// ============================================================
function AuthFrame() {
  const [page, setPage] = auUseState('login');
  const AuthNav = window.AuthNav;
  const Comp =
    page === 'login'   ? LoginPage   :
    page === 'forgot'  ? ForgotPage  :
    page === 'reset'   ? ResetPage   :
    page === 'setup'   ? SetupPage   :
    page === 'privacy' ? PrivacyPage :
    page === 'avatar'  ? window.AvatarMenuMock :
    page === 'errors'  ? window.ErrorPatternsMock :
    LoginPage;
  return (
    <div style={{minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column'}}>
      <AuthNav page={page} onPage={setPage}/>
      <div style={{flex:1, display:'flex'}}>
        <Comp/>
      </div>
    </div>
  );
}

function AuthNav({ page, onPage }) {
  const pages = [
    { id:'login',   label:'Login',       group:'auth' },
    { id:'forgot',  label:'Forgot',      group:'auth' },
    { id:'reset',   label:'Reset',       group:'auth' },
    { id:'setup',   label:'Setup',       group:'auth' },
    { id:'privacy', label:'Privacy',     group:'auth' },
    { id:'avatar',  label:'Avatar menu', group:'shell' },
    { id:'errors',  label:'Errors',      group:'shell' },
  ];
  const btn = (active) => ({
    padding:'4px 2px',
    color: active ? 'var(--ink)' : 'var(--ink-3)',
    borderBottom: '1px solid ' + (active ? 'var(--ink)' : 'transparent'),
    fontFamily:'inherit', fontSize:'inherit', letterSpacing:'inherit', textTransform:'inherit',
  });
  return (
    <div style={{
      borderBottom:'1px solid var(--line)',
      background:'var(--bg-sunk)',
      padding:'10px 24px',
      display:'flex', gap:18, alignItems:'center', flexWrap:'wrap',
      fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.08em',
      textTransform:'uppercase', color:'var(--ink-3)',
    }}>
      <span style={{color:'var(--ink-2)', fontWeight:600}}>v6 · FE-1</span>
      <span style={{color:'var(--ink-4)'}}>/</span>
      <span style={{color:'var(--ink-4)'}}>auth</span>
      {pages.filter(p => p.group === 'auth').map(p => (
        <button key={p.id} onClick={() => onPage(p.id)} style={btn(page === p.id)}>{p.label}</button>
      ))}
      <span style={{color:'var(--ink-4)', marginLeft:8}}>· shell</span>
      {pages.filter(p => p.group === 'shell').map(p => (
        <button key={p.id} onClick={() => onPage(p.id)} style={btn(page === p.id)}>{p.label}</button>
      ))}
      <span style={{flex:1}}/>
      <span style={{color:'var(--ink-4)'}}>role = unauth · no rail · no topbar</span>
    </div>
  );
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================
function AuthLogo() {
  return (
    <div style={{textAlign:'center', marginBottom:28}}>
      <div style={{display:'inline-flex', color:'var(--ink)'}}>
        <window.AcumenMark size={36}/>
      </div>
      <div className="serif" style={{fontSize:30, letterSpacing:'-0.022em', lineHeight:1, marginTop:8}}>Acumen</div>
      <div className="t-meta" style={{marginTop:6, letterSpacing:'0.18em'}}>SITEMESH</div>
    </div>
  );
}

function AuthPageShell({ children, wide }) {
  return (
    <div style={{
      width:'100%', minHeight:'100%',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'40px 24px 64px',
    }}>
      <div style={{width:'100%', maxWidth: wide ? 620 : 400}}>
        {children}
      </div>
    </div>
  );
}

function StateStrip({ options, value, onChange }) {
  return (
    <div style={{
      display:'flex', flexWrap:'wrap', gap:4, alignItems:'center',
      borderTop:'1px dashed var(--line-strong)',
      borderBottom:'1px dashed var(--line-strong)',
      padding:'8px 10px', marginBottom:28,
    }}>
      <span className="t-meta" style={{marginRight:10, letterSpacing:'0.14em'}}>STATE</span>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding:'3px 9px',
            fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.04em',
            textTransform:'uppercase',
            color: active ? 'var(--bg-raised)' : 'var(--ink-3)',
            background: active ? 'var(--ink)' : 'transparent',
            whiteSpace:'nowrap',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function AuthField({ label, type='text', value, onChange, error, hint, readOnly, autoFocus, placeholder, mono }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{
        display:'block', fontSize:10.5, fontFamily:'var(--font-mono)',
        letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)',
        marginBottom:6,
      }}>{label}</label>
      <input
        className="input"
        type={type}
        value={value || ''}
        onChange={onChange}
        readOnly={readOnly}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{
          borderColor: error ? 'var(--danger)' : undefined,
          background: readOnly ? 'var(--bg-sunk)' : undefined,
          color: readOnly ? 'var(--ink-2)' : undefined,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}/>
      {error && (
        <div style={{display:'flex',gap:6,alignItems:'flex-start',marginTop:6,fontSize:12.5, color:'var(--danger)'}}>
          <window.Icon name="x" size={11} stroke={2} style={{marginTop:3, flexShrink:0}}/>
          <span>{error}</span>
        </div>
      )}
      {hint && !error && <div className="muted" style={{fontSize:11.5, marginTop:6, lineHeight:1.5}}>{hint}</div>}
    </div>
  );
}

function AuthNotice({ tone='warn', title, body }) {
  const colorMap = { warn:'var(--warn)', danger:'var(--danger)', info:'var(--info)', ok:'var(--ok)' };
  const bar = colorMap[tone];
  return (
    <div style={{
      display:'flex', gap:10, alignItems:'flex-start',
      padding:'12px 14px', marginBottom:16,
      background:'var(--bg-sunk)',
      borderLeft:'2px solid ' + bar,
    }}>
      <div style={{flex:1}}>
        <div style={{fontWeight:600, color:bar, fontSize:13, marginBottom:2}}>{title}</div>
        <div style={{color:'var(--ink-2)', fontSize:12.5, lineHeight:1.55}}>{body}</div>
      </div>
    </div>
  );
}

function SubmitButton({ submitting, success, disabled, idleLabel, submittingLabel='Working…', successLabel='Done' }) {
  return (
    <button className="btn btn-primary btn-block btn-lg" disabled={disabled || submitting || success}
      style={{justifyContent:'center', opacity: (disabled || success) ? 0.85 : 1}}>
      {submitting ? (
        <><span className="pulse-dot" style={{width:8,height:8,background:'currentColor'}}/> {submittingLabel}</>
      ) : success ? (
        <><window.Icon name="check" size={14} stroke={2}/> {successLabel}</>
      ) : (
        <>{idleLabel} <span className="arrow">→</span></>
      )}
    </button>
  );
}

function BackLink({ children='Back to sign in' }) {
  return (
    <div style={{textAlign:'center', marginTop:18}}>
      <a style={{
        fontSize:12, color:'var(--ink-3)',
        borderBottom:'1px dotted var(--ink-3)', paddingBottom:1, cursor:'pointer',
      }}>← {children}</a>
    </div>
  );
}

function PasswordRules({ password = '' }) {
  const rules = [
    { id:'len',   label:'At least 12 characters',          test: p => p.length >= 12 },
    { id:'case',  label:'Upper and lowercase letters',     test: p => /[a-z]/.test(p) && /[A-Z]/.test(p) },
    { id:'num',   label:'At least one number',             test: p => /\d/.test(p) },
    { id:'sym',   label:'At least one symbol',             test: p => /[^A-Za-z0-9]/.test(p) },
  ];
  return (
    <ul style={{margin:'2px 0 18px', padding:0, listStyle:'none'}}>
      {rules.map(r => {
        const ok = r.test(password);
        return (
          <li key={r.id} style={{
            display:'flex', gap:8, alignItems:'center',
            fontSize:12, padding:'3px 0',
            color: ok ? 'var(--ok)' : 'var(--ink-3)',
            transition:'color .15s ease',
          }}>
            <span style={{
              width:14, height:14, display:'grid', placeItems:'center',
              borderRadius:'50%',
              background: ok ? 'var(--ok-soft)' : 'transparent',
              border: ok ? 'none' : '1px solid var(--line)',
              flexShrink:0,
            }}>
              {ok && <window.Icon name="check" size={9} stroke={2.4}/>}
            </span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

function AuthCardTitle({ small, big, sub }) {
  return (
    <>
      <div className="serif" style={{fontSize:26, lineHeight:1.18, letterSpacing:'-0.01em', marginBottom:6}}>
        <span className="serif-it">{small}</span> {big}
      </div>
      {sub && <div className="muted" style={{fontSize:13, marginBottom:22, lineHeight:1.55}}>{sub}</div>}
    </>
  );
}

// ============================================================
// 1. LOGIN — /login
// ============================================================
function LoginPage() {
  const states = [
    { id:'idle',         label:'Idle' },
    { id:'submitting',   label:'Submitting' },
    { id:'invalid',      label:'Invalid creds' },
    { id:'deactivated',  label:'Deactivated' },
    { id:'locked',       label:'Locked' },
  ];
  const [s, setS] = auUseState('idle');
  const emailVal    = s === 'idle' ? '' : 'jay@sitemesh.co';
  const passwordVal = s === 'idle' ? '' : '••••••••••';
  return (
    <AuthPageShell>
      <StateStrip options={states} value={s} onChange={setS}/>
      <AuthLogo/>
      <div className="card" style={{padding:'30px 28px'}}>
        <AuthCardTitle small="Welcome" big="back." sub="Sign in to continue your practice."/>

        {s === 'deactivated' && (
          <AuthNotice tone="warn"
            title="This account has been deactivated"
            body="Your access was paused by an administrator. Reach out to them if this looks wrong — we can have you back in shortly."/>
        )}
        {s === 'locked' && (
          <AuthNotice tone="warn"
            title="Too many tries"
            body="For your safety, sign-in is paused for 10 minutes. Take a breath — your account is fine."/>
        )}

        <AuthField label="Email" type="email" value={emailVal} onChange={()=>{}}
          error={s === 'invalid' ? "We couldn't sign you in with that email and password." : null}/>
        <AuthField label="Password" type="password" value={passwordVal} onChange={()=>{}}/>

        <div style={{display:'flex', justifyContent:'flex-end', marginTop:4, marginBottom:18}}>
          <a style={{fontSize:12, color:'var(--ink-3)', borderBottom:'1px dotted var(--ink-3)', cursor:'pointer'}}>
            Forgot your password?
          </a>
        </div>

        <SubmitButton
          submitting={s === 'submitting'}
          disabled={s === 'deactivated' || s === 'locked'}
          idleLabel="Sign in"
          submittingLabel="Signing in…"/>
      </div>
    </AuthPageShell>
  );
}

// ============================================================
// 2. FORGOT — /forgot
// ============================================================
function ForgotPage() {
  const states = [
    { id:'idle',       label:'Idle' },
    { id:'submitting', label:'Submitting' },
    { id:'success',    label:'Success' },
    { id:'error',      label:'Send failed' },
  ];
  const [s, setS] = auUseState('idle');

  if (s === 'success') {
    return (
      <AuthPageShell>
        <StateStrip options={states} value={s} onChange={setS}/>
        <AuthLogo/>
        <div className="card" style={{padding:'34px 28px', textAlign:'center'}}>
          <div style={{
            width:46, height:46, borderRadius:'50%',
            background:'var(--ok-soft)', color:'var(--ok)',
            display:'grid', placeItems:'center',
            margin:'0 auto 16px',
          }}>
            <window.Icon name="check" size={20} stroke={2}/>
          </div>
          <div className="serif" style={{fontSize:24, marginBottom:8, lineHeight:1.18, letterSpacing:'-0.01em'}}>
            <span className="serif-it">Check</span> your inbox.
          </div>
          <div className="muted" style={{fontSize:13, lineHeight:1.6, marginBottom:6}}>
            If <strong style={{color:'var(--ink)'}}>jay@sitemesh.co</strong> is on Acumen, a reset link
            is on its way. The link works for 30 minutes.
          </div>
          <BackLink/>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <StateStrip options={states} value={s} onChange={setS}/>
      <AuthLogo/>
      <div className="card" style={{padding:'30px 28px'}}>
        <AuthCardTitle small="Reset" big="your password."
          sub="Tell us your email and we'll send a link to set a new one."/>

        <AuthField label="Email" type="email"
          value={s === 'idle' ? '' : 'jay@sitemesh.co'} onChange={()=>{}}
          hint="For privacy, we send the same response whether or not the address is on Acumen."/>

        {s === 'error' && (
          <AuthNotice tone="danger"
            title="We couldn't send the link"
            body="Something went wrong on our side. Try again in a moment — if it keeps happening, ask your administrator for a fresh link."/>
        )}

        <SubmitButton
          submitting={s === 'submitting'}
          idleLabel="Send reset link"
          submittingLabel="Sending…"/>
        <BackLink/>
      </div>
    </AuthPageShell>
  );
}

// ============================================================
// 3. RESET CONSUME — /reset/[token]
// ============================================================
function ResetPage() {
  const states = [
    { id:'idle',          label:'Idle' },
    { id:'submitting',    label:'Submitting' },
    { id:'mismatch',      label:'Mismatch' },
    { id:'weak',          label:'Weak' },
    { id:'success',       label:'Success' },
    { id:'token-expired', label:'Token expired' },
    { id:'token-invalid', label:'Token invalid' },
  ];
  const [s, setS] = auUseState('idle');
  const [pw, setPw] = auUseState('');
  auUseEffect(() => {
    if (s === 'idle' || s === 'token-expired' || s === 'token-invalid') setPw('');
    else if (s === 'weak') setPw('hello');
    else setPw('TideRumour42!');
  }, [s]);

  if (s === 'token-expired' || s === 'token-invalid') {
    return <TokenErrorCard kind={s} states={states} state={s} onState={setS} flow="reset"/>;
  }

  return (
    <AuthPageShell>
      <StateStrip options={states} value={s} onChange={setS}/>
      <AuthLogo/>
      <div className="card" style={{padding:'30px 28px'}}>
        <AuthCardTitle small="Set" big="a new password." sub="Choose something only you'll remember."/>

        <AuthField label="New password" type="password" autoFocus
          value={pw} onChange={e => setPw(e.target.value)}/>
        <PasswordRules password={pw}/>
        <AuthField label="Confirm password" type="password"
          value={s === 'mismatch' ? 'TideRumour43!' : pw} onChange={()=>{}}
          error={s === 'mismatch' ? "Passwords don't match — re-type the new one." : null}/>

        {s === 'weak' && (
          <AuthNotice tone="warn"
            title="Almost there"
            body="The password needs to meet all of the requirements above before we'll accept it."/>
        )}
        {s === 'success' && (
          <AuthNotice tone="ok"
            title="Password updated"
            body="Redirecting you to sign in…"/>
        )}

        <SubmitButton
          submitting={s === 'submitting'}
          success={s === 'success'}
          idleLabel="Update password"
          submittingLabel="Updating…"
          successLabel="Updated"/>
        <BackLink/>
      </div>
    </AuthPageShell>
  );
}

function TokenErrorCard({ kind, states, state, onState, flow }) {
  const isReset = flow === 'reset';
  const m = kind === 'token-expired' ? {
    small: isReset ? 'This link' : 'This invitation',
    big: 'has expired.',
    body: isReset
      ? "Password-reset links work for 30 minutes — yours was opened a bit later than that. Request a new one and we'll send it straight away."
      : "Setup links work for 7 days. Ask your administrator to send a fresh invitation — they can do it in a click.",
    cta: isReset ? 'Request a new link' : 'Ask for a new invitation',
  } : {
    small: isReset ? 'This link' : 'This invitation',
    big: "doesn't look right.",
    body: isReset
      ? "It may have been copied incorrectly, or it's already been used. Try requesting a fresh one — they only take a second."
      : "It may have been copied incorrectly, or it's already been used. Ask your administrator to send a new one.",
    cta: isReset ? 'Request a new link' : 'Ask for a new invitation',
  };
  return (
    <AuthPageShell>
      <StateStrip options={states} value={state} onChange={onState}/>
      <AuthLogo/>
      <div className="card" style={{padding:'32px 28px'}}>
        <AuthCardTitle small={m.small} big={m.big} sub={m.body}/>
        <button className="btn btn-primary btn-block btn-lg" style={{justifyContent:'center'}}>
          {m.cta} <span className="arrow">→</span>
        </button>
        {isReset && <BackLink/>}
      </div>
    </AuthPageShell>
  );
}

// ============================================================
// 4. SETUP CONSUME — /setup/[token]  (first-ever exposure)
// ============================================================
function SetupPage() {
  const states = [
    { id:'idle',          label:'Idle' },
    { id:'submitting',    label:'Submitting' },
    { id:'mismatch',      label:'Mismatch' },
    { id:'weak',          label:'Weak' },
    { id:'success',       label:'Success' },
    { id:'token-expired', label:'Token expired' },
    { id:'token-invalid', label:'Token invalid' },
  ];
  const [s, setS] = auUseState('idle');
  const [pw, setPw] = auUseState('');
  auUseEffect(() => {
    if (s === 'idle' || s === 'token-expired' || s === 'token-invalid') setPw('');
    else if (s === 'weak') setPw('hello');
    else setPw('SeaSparrow88!');
  }, [s]);

  if (s === 'token-expired' || s === 'token-invalid') {
    return <TokenErrorCard kind={s} states={states} state={s} onState={setS} flow="setup"/>;
  }

  return (
    <AuthPageShell>
      <StateStrip options={states} value={s} onChange={setS}/>
      <AuthLogo/>
      <div className="card" style={{padding:'32px 28px'}}>
        <div className="eyebrow" style={{marginBottom:6, color:'var(--accent-ink)', letterSpacing:'0.16em'}}>FIRST TIME HERE</div>
        <div className="serif" style={{fontSize:28, lineHeight:1.15, letterSpacing:'-0.012em', marginBottom:10}}>
          <span className="serif-it">Welcome to</span> Acumen.
        </div>
        <div className="muted" style={{fontSize:13.5, lineHeight:1.6, marginBottom:22}}>
          Acumen helps you build deep competency in your field through adaptive
          practice and thoughtful assessment. Set a password and we'll get you started.
        </div>

        <AuthField label="Your email" type="email" value="themba.nkosi@sitemesh.co" readOnly mono onChange={()=>{}}
          hint="This is the address your administrator invited."/>
        <AuthField label="Choose a password" type="password" autoFocus
          value={pw} onChange={e => setPw(e.target.value)}/>
        <PasswordRules password={pw}/>
        <AuthField label="Confirm password" type="password"
          value={s === 'mismatch' ? 'SeaSparrow89!' : pw} onChange={()=>{}}
          error={s === 'mismatch' ? "Passwords don't match — re-type the new one." : null}/>

        {s === 'weak' && (
          <AuthNotice tone="warn"
            title="Almost there"
            body="The password needs to meet all of the requirements above before we'll accept it."/>
        )}
        {s === 'success' && (
          <AuthNotice tone="ok"
            title="You're all set"
            body="Taking you in…"/>
        )}

        <SubmitButton
          submitting={s === 'submitting'}
          success={s === 'success'}
          idleLabel="Get started"
          submittingLabel="Setting up…"
          successLabel="Ready"/>
      </div>
    </AuthPageShell>
  );
}

// ============================================================
// 5. PRIVACY GATE — /privacy
// ============================================================
function PrivacyPage() {
  const states = [
    { id:'idle',       label:'Idle' },
    { id:'submitting', label:'Acknowledging' },
    { id:'declined',   label:'Decline confirmed' },
  ];
  const [s, setS] = auUseState('idle');

  if (s === 'declined') {
    return (
      <AuthPageShell>
        <StateStrip options={states} value={s} onChange={setS}/>
        <AuthLogo/>
        <div className="card" style={{padding:'34px 28px', textAlign:'center'}}>
          <div style={{
            width:46, height:46, borderRadius:'50%',
            background:'var(--bg-sunk)', color:'var(--ink-3)',
            display:'grid', placeItems:'center',
            margin:'0 auto 16px',
            border:'1px solid var(--line)',
          }}>
            <window.Icon name="logout" size={18}/>
          </div>
          <div className="serif" style={{fontSize:22, marginBottom:10, lineHeight:1.18}}>
            <span className="serif-it">You've been</span> signed out.
          </div>
          <div className="muted" style={{fontSize:13, lineHeight:1.6, marginBottom:18}}>
            We can't give you access to Acumen until you acknowledge how your work is handled.
            Talk to your administrator if you have questions, then sign back in to try again.
          </div>
          <button className="btn btn-block">Return to sign in <span className="arrow">→</span></button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell wide>
      <StateStrip options={states} value={s} onChange={setS}/>
      <AuthLogo/>
      <div className="card" style={{padding:'34px 36px'}}>
        <div className="eyebrow" style={{marginBottom:6, letterSpacing:'0.16em'}}>ACUMEN · PRIVACY</div>
        <div className="serif" style={{fontSize:28, lineHeight:1.18, letterSpacing:'-0.012em', marginBottom:18}}>
          <span className="serif-it">Before you</span> continue.
        </div>

        <div style={{
          fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65,
          paddingTop:14, borderTop:'1px solid var(--line)',
          maxHeight: 320, overflowY:'auto', paddingRight:8,
        }}>
          <p style={{marginTop:0}}>
            <strong style={{color:'var(--ink)'}}>What we collect.</strong> Acumen records the responses
            you give during practice and assessment, the time you spend on each question,
            and the difficulty bands the loop assigns to you. We do not record keystrokes,
            screen content outside Acumen, or activity on other applications.
          </p>
          <p>
            <strong style={{color:'var(--ink)'}}>How it's used.</strong> Your administrator can see
            your competency profile and attempt history to plan training and review your progress.
            We use aggregated, de-identified data to improve question quality across SiteMesh —
            never with your name or identifiers attached.
          </p>
          <p>
            <strong style={{color:'var(--ink)'}}>Your rights.</strong> You can request a copy of your
            Acumen data, ask for corrections, or ask us to delete your account at any time by
            writing to your administrator or to <a style={{color:'var(--accent-ink)', borderBottom:'1px dotted'}}>privacy@sitemesh.co</a>.
            We'll act on the request within 30 days.
          </p>
          <p style={{marginBottom:0}}>
            <strong style={{color:'var(--ink)'}}>Acknowledging.</strong> By continuing you confirm
            that you've read and understood the above. You can revisit this notice at any
            time from your profile.
          </p>
        </div>

        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          gap:14, marginTop:24, flexWrap:'wrap',
        }}>
          <a style={{fontSize:12.5, color:'var(--ink-3)', borderBottom:'1px dotted var(--ink-3)', cursor:'pointer'}}>
            Decline and log out
          </a>
          <button className="btn btn-primary btn-lg" disabled={s === 'submitting'}
            style={{minWidth:200, justifyContent:'center'}}>
            {s === 'submitting' ? (
              <><span className="pulse-dot" style={{width:8,height:8,background:'currentColor'}}/> Acknowledging…</>
            ) : (
              <>I acknowledge <span className="arrow">→</span></>
            )}
          </button>
        </div>
      </div>
    </AuthPageShell>
  );
}

Object.assign(window, {
  AuthFrame, AuthNav, AuthLogo, AuthPageShell, StateStrip,
  AuthField, AuthNotice, SubmitButton, BackLink, PasswordRules, AuthCardTitle,
  LoginPage, ForgotPage, ResetPage, SetupPage, PrivacyPage,
});
