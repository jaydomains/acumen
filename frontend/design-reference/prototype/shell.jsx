// shell.jsx — outer chrome: rail, topbar, role switch.
// Expects window.Icon to be loaded.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const TESTEE_NAV = [
{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
{ id: 'attempt', label: 'In Progress', icon: 'attempt', badge: '1' },
{ id: 'catalogue', label: 'Discover', icon: 'compass' },
{ id: 'results', label: 'Latest Result', icon: 'graph' },
{ id: 'profile', label: 'Competency', icon: 'constellation' },
{ id: 'history', label: 'History', icon: 'history' }];


const ADMIN_NAV = [
{ id: 'ops', label: 'Operations', icon: 'dashboard' },
{ id: 'review', label: 'Grade Review', icon: 'review', badge: '4' },
{ id: 'engagement', label: 'Engagement', icon: 'inbox', badge: '4' },
{ id: 'catalogue-admin', label: 'Catalogue', icon: 'catalogue' },
{ id: 'users', label: 'Users & Groups', icon: 'users' },
{ id: 'cost', label: 'AI Cost', icon: 'cost' },
{ id: 'loop', label: 'Loops', icon: 'loop' }];


function AcumenMark({ size = 28, accent = false }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-label="Acumen">
      {/* Two ascending diagonals — the legs of an A, stopping short of the apex */}
      <path d="M 5 28 L 14 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M 18 9 L 27 28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      {/* The apex — a focal dot where the legs would converge. The "moment of acumen". */}
      <circle cx="16" cy="6.4" r="2.4" fill={accent ? 'var(--accent)' : 'currentColor'}/>
      {/* The crossbar — a faint dot at the conventional bar position */}
      <circle cx="16" cy="21" r="1.4" fill="currentColor" opacity="0.45"/>
    </svg>
  );
}

function Rail({ role, route, onRoute }) {
  const I = window.Icon;
  const nav = role === 'admin' ? ADMIN_NAV : TESTEE_NAV;
  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="logo"><AcumenMark size={30}/></div>
        <div>
          <div className="name">Acumen</div>
          <div className="tag">{role === 'admin' ? 'Administrator' : 'Testee'}</div>
        </div>
      </div>
      <div className="rail-section hide-mobile">{role === 'admin' ? 'Operate' : 'Learn'}</div>
      {nav.map((n) =>
      <button
        key={n.id}
        className="rail-link"
        data-active={route === n.id}
        onClick={() => onRoute(n.id)}>
        
          <I name={n.icon} size={16} />
          <span className="hide-mobile" style={{ flex: 1 }}>{n.label}</span>
          {n.badge && <span className="badge hide-mobile">{n.badge}</span>}
          <span className="show-mobile" style={{ fontSize: '10px' }}>{n.label.split(' ')[0]}</span>
        </button>
      )}
      <div className="rail-footer hide-mobile">
        <div className="rail-link" style={{ cursor: 'default', pointerEvents: 'none' }}>
          <I name="settings" size={16} />
          <span style={{ flex: 1 }}>SiteMesh · v1.8</span>
        </div>
      </div>
    </aside>);

}

function TopBar({ role, route, onRole, user, crumb, rightSlot }) {
  const I = window.Icon;
  const title = (role === 'admin' ? ADMIN_NAV : TESTEE_NAV).find((n) => n.id === route)?.label || '';
  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="muted home hide-mobile">SiteMesh</span>
        <span className="sep hide-mobile">/</span>
        <span className="muted hide-mobile">Acumen</span>
        <span className="sep hide-mobile">/</span>
        <span className="here">{crumb || title}</span>
      </div>
      <div className="search hide-mobile">
        <I name="search" size={14} />
        <input placeholder={role === 'admin' ? 'Search pills, testees, attempts…' : 'Search pills…'} readOnly />
        <kbd>⌘K</kbd>
      </div>
      <div className="role-switch">
        <button data-active={role === 'testee'} onClick={() => onRole('testee')}>Testee</button>
        <button data-active={role === 'admin'} onClick={() => onRole('admin')}>Admin</button>
      </div>
      {rightSlot}
      <div className="avatar">{user[0]}</div>
    </header>);

}

// Generic page header used in screens.
function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="row jc-b ai-b mb-6 page-hd" style={{ flexWrap: 'wrap', gap: '16px' }}>
      <div className="page-hd-text">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="h-1">{title}</h1>
        {subtitle && <div className="muted mt-2" style={{ maxWidth: '52ch', fontSize: '14px' }}>{subtitle}</div>}
      </div>
      {actions && <div className="row gap-2 page-hd-actions" style={{ flexWrap: 'wrap' }}>{actions}</div>}
    </div>);

}

// Small reusable bits
function Stat({ value, label, hint, tone }) {
  return (
    <div style={{ fontFamily: "Quicksand" }}>
      <div className="stat-big" style={{ color: tone === 'accent' ? 'var(--accent)' : 'var(--ink)' }}>{value}</div>
      <div className="stat-sub mt-2">{label}</div>
      {hint && <div className="muted mt-2" style={{ fontSize: '12px' }}>{hint}</div>}
    </div>);

}

function BandTag({ band, withLabel = true, withPips = false }) {
  const label = (window.BAND_LABEL || {})[band] || band;
  return (
    <span className="band-tag" data-band={band}>
      {withLabel && label}
      {withPips &&
      <span className="pips" style={{ marginLeft: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => <span className="pip" key={i} />)}
        </span>
      }
    </span>);

}

function BandPips({ band }) {
  return (
    <span className="band" data-band={band}>
      <span className="pips">{[1, 2, 3, 4, 5].map((i) => <span className="pip" key={i} />)}</span>
    </span>);

}

function Pill({ tone, children, mono }) {
  return <span className={`chip ${tone ? 'chip-' + tone : ''} ${mono ? 'chip-mono' : ''}`}>{children}</span>;
}

Object.assign(window, { AcumenMark, Rail, TopBar, PageHeader, Stat, BandTag, BandPips, Pill, TESTEE_NAV, ADMIN_NAV });