// admin-authoring.jsx — v6 · FE-8 · #17 + #18 + #19 + #21 + #22
// Five CRUD surfaces from the admin authoring suite. Test authoring is
// large enough to live in its own file (admin-test-authoring.jsx · #20).
//
// Each surface has its own STATE strip; modals render in-position over
// the relevant list so the placement vs the list table can be evaluated.

const { useState: aaUseState, useEffect: aaUseEffect } = React;

function AdminAuthoringMock() {
  const states = [
    { id: 'pills',       label: '#17 · Pills' },
    { id: 'users',       label: '#18 · Users' },
    { id: 'groups',      label: '#19 · Groups' },
    { id: 'paths',       label: '#21 · Learning paths' },
    { id: 'assignments', label: '#22 · Assignments' },
  ];
  const [s, setS] = aaUseState('pills');

  const meta = {
    pills:       ['Pill authoring',        "Add or edit a pill. Most fields free to edit until the pill has been used in a published test — after that, safety-override and difficulty range lock to preserve historical comparability."],
    users:       ['User management',       "Invite a user, edit their profile, or deactivate. Reactivation is one-click from the row (no modal needed). Roles: testee or admin — system rule."],
    groups:      ['Group management',      "Groups are how assignments scale beyond one testee. System groups (like 'All testees') are visually locked — their lock icon marks AC-D5 immutability."],
    paths:       ['Learning paths',        "An ordered sequence of pills with a name and description. Order matters — paths are how testees navigate progression. Pills reorder via drag handles."],
    assignments: ['Assignments',           "Bind a test (or path) to one or more testees, with a deadline and a loop mode. Loop mode is the only field that can't be edited once the assignment has been started by any testee."],
  };

  return (
    <div className="content" style={{paddingBottom:80}}>
      <window.V6MockHeader id="FE-8 · authoring"
        title={meta[s][0]}
        sub={meta[s][1]}
        states={states} state={s} onState={setS}/>

      <div style={{marginTop:24}}>
        {s === 'pills'       && <PillCrudMock/>}
        {s === 'users'       && <UsersCrudMock/>}
        {s === 'groups'      && <GroupsCrudMock/>}
        {s === 'paths'       && <PathsCrudMock/>}
        {s === 'assignments' && <AssignmentsCrudMock/>}
      </div>
    </div>
  );
}

// ============================================================
// SHARED — Modal, sub-state strip, field primitives
// ============================================================
function Modal({ children, width = 560 }) {
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

function ModalHeader({ eyebrow, title }) {
  return (
    <>
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="serif" style={{fontSize:24, lineHeight:1.25, letterSpacing:'-0.01em', marginBottom:18}}>
        {title}
      </div>
    </>
  );
}

function ModalActions({ children }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:10, marginTop:22, paddingTop:18, borderTop:'1px solid var(--line)',
      flexWrap:'wrap',
    }}>{children}</div>
  );
}

function SubStateStrip({ options, value, onChange }) {
  return (
    <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginBottom:18}}>
      <span className="t-meta" style={{marginRight:10}}>SUB-STATE</span>
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

const fieldLabel = {
  display:'block', fontSize:10.5, fontFamily:'var(--font-mono)',
  letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)',
  marginBottom:6,
};
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{display:'flex',gap:6,alignItems:'flex-start',marginTop:6,fontSize:12.5, color:'var(--danger)'}}>
      <window.Icon name="x" size={11} stroke={2}/>
      <span>{msg}</span>
    </div>
  );
}
function FieldRow({ children, cols }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns: cols || '1fr 1fr',
      gap: 14, marginBottom:14,
    }}>{children}</div>
  );
}
function Field({ label, hint, error, children, locked }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={fieldLabel}>
        {label} {locked && <window.Icon name="lock" size={9} style={{marginLeft:6, color:'var(--ink-4)'}}/>}
      </label>
      {children}
      <FieldError msg={error}/>
      {hint && !error && <div className="muted" style={{fontSize:11.5, marginTop:6, lineHeight:1.5}}>{hint}</div>}
    </div>
  );
}

// ============================================================
// #17 — PILL CRUD
// ============================================================
function PillCrudMock() {
  const subStates = [
    { id: 'list',       label: 'List · idle' },
    { id: 'create',     label: 'Create modal · empty' },
    { id: 'edit',       label: 'Edit modal · pre-filled' },
    { id: 'submitting', label: 'Submitting' },
    { id: 'errors',     label: 'Validation errors' },
    { id: 'locked',     label: 'Locked · pill in use' },
  ];
  const [ss, setSs] = aaUseState('create');

  return (
    <div>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>
      <PillListBehind/>
      {ss !== 'list' && <PillModal variant={ss}/>}
    </div>
  );
}

function PillListBehind() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">Pills · 137 total</div>
          <h3 className="h-3">Catalogue</h3>
        </div>
        <button className="btn btn-primary"><window.Icon name="plus" size={12}/> Add pill</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Pill</th><th>Subject</th><th>Difficulty</th><th>Safety</th><th>Used in</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {[
            { name:'Antifouling Systems',     subj:'Paint & coatings',   diff:'D2–D8', safety:false, used:14, status:'published' },
            { name:'Confined Space Entry',    subj:'Safety',             diff:'D3–D9', safety:true,  used:6,  status:'published' },
            { name:'Corrosion Mechanisms',    subj:'Materials',          diff:'D1–D7', safety:false, used:11, status:'published' },
            { name:'BoQ Preparation',         subj:'Commercial',         diff:'D2–D6', safety:false, used:8,  status:'draft' },
            { name:'Adhesion Testing',        subj:'Paint & coatings',   diff:'D3–D8', safety:false, used:5,  status:'published' },
          ].map(p => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.subj}</td>
              <td className="mono" style={{fontSize:12}}>{p.diff}</td>
              <td>{p.safety ? <window.Pill tone="danger" mono>Safety</window.Pill> : <span className="muted" style={{fontSize:11.5}}>—</span>}</td>
              <td className="num">{p.used} tests</td>
              <td>{p.status === 'draft' ? <window.Pill tone="warn" mono>Draft</window.Pill> : <window.Pill tone="ok" mono>Published</window.Pill>}</td>
              <td className="right"><button className="btn btn-ghost btn-sm">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PillModal({ variant }) {
  const isEdit = variant !== 'create';
  const isErrors = variant === 'errors';
  const isLocked = variant === 'locked';
  const isSubmitting = variant === 'submitting';
  const safety = isLocked ? true : isEdit;

  return (
    <Modal width={640}>
      <ModalHeader
        eyebrow={isEdit ? 'EDIT PILL' : 'NEW PILL'}
        title={isEdit
          ? <><span className="serif-it">Edit</span> Antifouling Systems</>
          : <><span className="serif-it">Add a</span> new pill</>}/>

      {isLocked && (
        <div style={{padding:'12px 14px', marginBottom:18,
          background:'var(--warn-soft)', borderLeft:'2px solid var(--warn)'}}>
          <div style={{fontSize:12.5, color:'var(--warn)', fontWeight:600, marginBottom:4}}>
            This pill is used in 14 published tests
          </div>
          <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.55}}>
            Most fields are locked to preserve historical comparability. To change a
            locked field, you'll need to clone this pill and migrate assignments to the new one.
          </div>
        </div>
      )}

      <Field label="Title" error={isErrors ? 'Title is required.' : null}>
        <input className="input" defaultValue={isEdit ? 'Antifouling Systems' : ''}
          placeholder="e.g. Cathodic Protection"
          style={{borderColor: isErrors ? 'var(--danger)' : undefined}}/>
      </Field>

      <Field label="Description" hint="Visible to testees on the pill detail page.">
        <textarea className="input" rows={3}
          defaultValue={isEdit ? "Self-polishing copolymer (SPC), controlled-depletion polymer (CDP), hybrid, and fouling-release systems. Specification, application, and post-dry-dock inspection." : ''}
          placeholder="What this pill covers."/>
      </Field>

      <FieldRow>
        <Field label="Subject" error={isErrors ? 'Pick a subject.' : null}>
          <select className="input" defaultValue={isEdit ? 'paint-qa' : ''}
            style={{borderColor: isErrors ? 'var(--danger)' : undefined}}>
            <option value="" disabled>Pick a subject…</option>
            <option value="paint-qa">Paint & coatings</option>
            <option value="safety">Safety</option>
            <option value="materials">Materials</option>
            <option value="commercial">Commercial</option>
            <option value="inspection">Inspection</option>
          </select>
        </Field>
        <Field label="Status" locked={isLocked}>
          <select className="input" disabled={isLocked} defaultValue={isEdit ? 'published' : 'draft'}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>
      </FieldRow>

      <Field label="Difficulty range" locked={isLocked}
        hint="The bounds Acumen will sample questions from for this pill. The full D1–D10 scale is global; pills declare a usable sub-range.">
        <DifficultyRangeSlider min={2} max={8} disabled={isLocked}/>
      </Field>

      <Field label="Safety-relevant override" locked={isLocked}
        hint="When on, Acumen never generates teaching material — only curated industry sources are served (AC-D21). Auto-derived for some subjects; this is a manual override.">
        <SafetyToggle on={safety} disabled={isLocked}/>
      </Field>

      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary" disabled={isSubmitting || isLocked}>
          {isSubmitting ? (
            <><span className="pulse-dot" style={{width:7, height:7, background:'currentColor'}}/> Saving…</>
          ) : (
            <>{isEdit ? 'Save changes' : 'Create pill'} <span className="arrow">→</span></>
          )}
        </button>
      </ModalActions>
    </Modal>
  );
}

function DifficultyRangeSlider({ min, max, disabled }) {
  return (
    <div style={{padding:'4px 0'}}>
      <div style={{display:'flex', gap:0, marginBottom:8}}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => {
          const inRange = n >= min && n <= max;
          return (
            <div key={n} style={{
              flex:1,
              padding:'8px 0',
              textAlign:'center',
              background: inRange ? 'var(--ink)' : 'var(--bg-sunk)',
              color: inRange ? 'var(--bg-raised)' : 'var(--ink-3)',
              border:'1px solid ' + (inRange ? 'var(--ink)' : 'var(--line)'),
              marginLeft: n === 1 ? 0 : -1,
              fontFamily:'var(--font-mono)', fontSize:11.5, fontWeight:600,
              opacity: disabled ? 0.6 : 1,
            }}>D{n}</div>
          );
        })}
      </div>
      <div style={{
        display:'flex', justifyContent:'space-between',
        fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)',
      }}>
        <span>min D{min}</span>
        <span>max D{max}</span>
      </div>
    </div>
  );
}

function SafetyToggle({ on, disabled }) {
  return (
    <div style={{display:'flex', gap:14, alignItems:'center', padding:'10px 0'}}>
      <button disabled={disabled} style={{
        width:42, height:24, borderRadius:12,
        background: on ? 'var(--danger)' : 'var(--bg-deep)',
        border:'1px solid ' + (on ? 'var(--danger)' : 'var(--line-strong)'),
        position:'relative',
        opacity: disabled ? 0.6 : 1,
      }}>
        <span style={{
          position:'absolute',
          top:2, left: on ? 19 : 2,
          width:18, height:18, borderRadius:'50%',
          background:'var(--bg-raised)',
          transition:'left .15s ease',
          boxShadow:'0 1px 2px rgba(0,0,0,.2)',
        }}/>
      </button>
      <div style={{flex:1}}>
        <div style={{fontSize:13, fontWeight:600, color: on ? 'var(--danger)' : 'var(--ink)'}}>
          {on ? 'Safety-relevant — no AI teaching material' : 'Standard — AI explainer enabled'}
        </div>
        <div className="muted" style={{fontSize:11.5, marginTop:2, lineHeight:1.5}}>
          {on ? 'Curated industry links served via the safety-pill viewer (AC-D21).'
              : 'Acumen generates a learning material on demand for this pill.'}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// #18 — USERS CRUD
// ============================================================
function UsersCrudMock() {
  const subStates = [
    { id: 'list',         label: 'List · idle' },
    { id: 'add',          label: 'Add modal' },
    { id: 'edit',         label: 'Edit modal' },
    { id: 'deactivate',   label: 'Deactivate confirm' },
    { id: 'errors',       label: 'Validation errors' },
  ];
  const [ss, setSs] = aaUseState('add');

  return (
    <div>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>
      <UserListBehind/>
      {ss === 'add'        && <UserModal mode="add"/>}
      {ss === 'edit'       && <UserModal mode="edit"/>}
      {ss === 'errors'     && <UserModal mode="add" errors/>}
      {ss === 'deactivate' && <DeactivateModal/>}
    </div>
  );
}

function UserListBehind() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">Users · 42 active · 3 inactive</div>
          <h3 className="h-3">Directory</h3>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm">Bulk invite</button>
          <button className="btn btn-primary"><window.Icon name="plus" size={12}/> Add user</button>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last active</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {[
            { name:'Jay van der Merwe', email:'jay@sitemesh.co',    role:'admin',  last:'now',   status:'active' },
            { name:'Lerato Dlamini',    email:'lerato@sitemesh.co', role:'testee', last:'2h ago', status:'active' },
            { name:'Themba Nkosi',      email:'themba@sitemesh.co', role:'testee', last:'1d ago', status:'active' },
            { name:'Sipho Mthembu',     email:'sipho@sitemesh.co',  role:'testee', last:'3d ago', status:'active' },
            { name:'(invited)',         email:'kabelo@sitemesh.co', role:'testee', last:'—',       status:'invited' },
            { name:'Gys Maritz',        email:'gys@sitemesh.co',    role:'admin',  last:'14d ago', status:'inactive' },
          ].map(u => (
            <tr key={u.email}>
              <td>{u.status === 'invited' ? <span className="muted" style={{fontSize:12.5}}>{u.name}</span> : u.name}</td>
              <td className="mono" style={{fontSize:12}}>{u.email}</td>
              <td><window.Pill tone={u.role === 'admin' ? 'accent' : 'soft'} mono>{u.role}</window.Pill></td>
              <td className="t-meta">{u.last}</td>
              <td>
                {u.status === 'active'   && <window.Pill tone="ok"   mono>Active</window.Pill>}
                {u.status === 'invited'  && <window.Pill tone="warn" mono>Invited · not set up</window.Pill>}
                {u.status === 'inactive' && <window.Pill tone="soft" mono>Inactive</window.Pill>}
              </td>
              <td className="right">
                {u.status === 'inactive'
                  ? <button className="btn btn-ghost btn-sm">Reactivate</button>
                  : <div className="row gap-2" style={{justifyContent:'flex-end'}}>
                      <button className="btn btn-ghost btn-sm">Edit</button>
                      {u.status === 'invited' && <button className="btn btn-ghost btn-sm">Resend</button>}
                    </div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserModal({ mode, errors }) {
  return (
    <Modal width={520}>
      <ModalHeader
        eyebrow={mode === 'add' ? 'ADD USER' : 'EDIT USER'}
        title={mode === 'add'
          ? <><span className="serif-it">Invite someone</span> new.</>
          : <><span className="serif-it">Edit</span> Lerato Dlamini</>}/>

      <Field label="Email" error={errors ? "We need a working email — that's how the setup link gets there." : null}>
        <input className="input mono" type="email"
          defaultValue={mode === 'edit' ? 'lerato@sitemesh.co' : (errors ? 'lerato@sitemesh' : '')}
          placeholder="lerato@sitemesh.co"
          readOnly={mode === 'edit'}
          style={{
            borderColor: errors ? 'var(--danger)' : undefined,
            background: mode === 'edit' ? 'var(--bg-sunk)' : undefined,
            color: mode === 'edit' ? 'var(--ink-2)' : undefined,
          }}/>
      </Field>

      <FieldRow>
        <Field label="First name (optional)">
          <input className="input" defaultValue={mode === 'edit' ? 'Lerato' : ''}/>
        </Field>
        <Field label="Last name (optional)">
          <input className="input" defaultValue={mode === 'edit' ? 'Dlamini' : ''}/>
        </Field>
      </FieldRow>

      <Field label="Role" error={errors ? 'Pick a role.' : null}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <RoleChoice id="testee" title="Testee" body="Takes assignments. Sees their own results and competency profile only." active={mode === 'edit' || !errors}/>
          <RoleChoice id="admin"  title="Administrator" body="Authors tests, manages users, reviews loops. Has access to all admin surfaces." active={false}/>
        </div>
      </Field>

      {mode === 'add' && (
        <div style={{
          padding:'10px 14px', marginTop:8, marginBottom:6,
          background:'var(--bg-sunk)',
          borderLeft:'2px solid var(--accent)',
        }}>
          <div className="row gap-2 ai-c">
            <window.Icon name="mail" size={12} stroke={1.8}/>
            <span style={{fontSize:12.5, color:'var(--ink-2)'}}>
              We'll send a setup link to this email. It works for <strong>7 days</strong>.
            </span>
          </div>
        </div>
      )}

      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary">
          {mode === 'add' ? 'Send setup email' : 'Save changes'} <span className="arrow">→</span>
        </button>
      </ModalActions>
    </Modal>
  );
}

function RoleChoice({ title, body, active }) {
  return (
    <button style={{
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

function DeactivateModal() {
  return (
    <Modal width={500}>
      <ModalHeader
        eyebrow="DEACTIVATE USER"
        title={<><span className="serif-it">Deactivate</span> Themba Nkosi?</>}/>
      <div style={{
        padding:'12px 14px', marginBottom:18,
        background:'var(--danger-soft)',
        borderLeft:'2px solid var(--danger)',
      }}>
        <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6}}>
          <strong style={{color:'var(--danger)'}}>themba@sitemesh.co</strong> will lose access immediately —
          their current attempt (if any) will be paused, and they won't be able to sign in until
          you reactivate them. Their data and competency history are preserved.
        </div>
      </div>
      <Field label="Reason (optional, internal note)" hint="Visible only to administrators on the user's profile.">
        <textarea className="input" rows={2} placeholder="e.g. left SiteMesh, parental leave, etc."/>
      </Field>
      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary" style={{background:'var(--danger)', borderColor:'var(--danger)'}}>
          Deactivate <span className="arrow">→</span>
        </button>
      </ModalActions>
    </Modal>
  );
}

// ============================================================
// #19 — GROUPS CRUD + MEMBERSHIP
// ============================================================
function GroupsCrudMock() {
  const subStates = [
    { id: 'list',     label: 'List · idle' },
    { id: 'add',      label: 'Add modal' },
    { id: 'members',  label: 'Membership view' },
    { id: 'picker',   label: 'Add member picker' },
    { id: 'system',   label: 'System group · immutable' },
  ];
  const [ss, setSs] = aaUseState('members');

  if (ss === 'list')    return <><SubStateStrip options={subStates} value={ss} onChange={setSs}/><GroupListBehind/></>;
  if (ss === 'add')     return <><SubStateStrip options={subStates} value={ss} onChange={setSs}/><GroupListBehind/><GroupModal/></>;
  if (ss === 'system')  return <><SubStateStrip options={subStates} value={ss} onChange={setSs}/><GroupListBehind highlight="system"/></>;
  return (
    <>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>
      <GroupMembershipView showPicker={ss === 'picker'}/>
    </>
  );
}

function GroupListBehind({ highlight }) {
  const groups = [
    { name:'All testees',          system:true,  members:42, desc:'Every active testee. Membership maintained automatically.' },
    { name:'Coatings inspectors',  system:false, members:14, desc:'NACE Level II and III field inspectors.' },
    { name:'Senior engineers',     system:false, members:8,  desc:'Engineers signing off on specifications.' },
    { name:'Site supervisors',     system:false, members:11, desc:'Hands-on site leads.' },
    { name:'Trainees Q3 2026',     system:false, members:9,  desc:'Q3 induction cohort.' },
  ];
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">Groups · 5 active</div>
          <h3 className="h-3">Cohorts</h3>
        </div>
        <button className="btn btn-primary"><window.Icon name="plus" size={12}/> Add group</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Group</th><th>Members</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {groups.map(g => {
            const isHi = highlight === 'system' && g.system;
            return (
              <tr key={g.name} style={isHi ? {background:'var(--warn-soft)'} : null}>
                <td>
                  <div className="row gap-2 ai-c">
                    {g.system && <window.Icon name="lock" size={12} style={{color:'var(--ink-3)'}}/>}
                    <span>{g.name}</span>
                    {g.system && <window.Pill tone="warn" mono>System</window.Pill>}
                  </div>
                </td>
                <td className="num">{g.members}</td>
                <td className="muted" style={{fontSize:12.5}}>{g.desc}</td>
                <td className="right">
                  {g.system ? (
                    <div className="row gap-2" style={{justifyContent:'flex-end'}}>
                      <button className="btn btn-ghost btn-sm" disabled style={{opacity:0.4}}>Edit</button>
                      <button className="btn btn-ghost btn-sm" disabled style={{opacity:0.4}}>Delete</button>
                    </div>
                  ) : (
                    <div className="row gap-2" style={{justifyContent:'flex-end'}}>
                      <button className="btn btn-ghost btn-sm">Edit</button>
                      <button className="btn btn-ghost btn-sm">Members</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {highlight === 'system' && (
        <div style={{padding:'14px 16px', borderTop:'1px solid var(--line)',
          background:'var(--bg-sunk)', display:'flex', gap:10, alignItems:'flex-start'}}>
          <window.Icon name="lock" size={14} style={{color:'var(--ink-3)', marginTop:2}}/>
          <div>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>System groups are immutable</div>
            <div className="muted" style={{fontSize:12, lineHeight:1.55, maxWidth:'68ch'}}>
              The "All testees" group is maintained by Acumen — its membership is derived from
              user status, and its name and description can't be edited (AC-D5). Use a custom
              group to bind assignments to a specific cohort.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupModal() {
  return (
    <Modal width={520}>
      <ModalHeader eyebrow="ADD GROUP" title={<><span className="serif-it">Create a</span> new group.</>}/>
      <Field label="Name">
        <input className="input" placeholder="e.g. NACE inspectors"/>
      </Field>
      <Field label="Description (optional)" hint="A short note for other administrators about who's in this group.">
        <textarea className="input" rows={3} placeholder="What this cohort has in common."/>
      </Field>
      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary">Create group <span className="arrow">→</span></button>
      </ModalActions>
    </Modal>
  );
}

function GroupMembershipView({ showPicker }) {
  return (
    <div style={{position:'relative'}}>
      <window.PageHeader
        eyebrow="GROUP · Coatings inspectors"
        title={<><span className="serif-it">Coatings</span> inspectors</>}
        subtitle="NACE Level II and III field inspectors. Bind assignments to this group to reach everyone in one action."
        actions={
          <div className="row gap-2">
            <button className="btn btn-ghost btn-sm">Edit group</button>
            <button className="btn"><window.Icon name="plus" size={12}/> Add member</button>
          </div>
        }/>

      <div className="grid grid-4 gap-4 mb-6">
        <window.Stat value="14" label="MEMBERS"/>
        <window.Stat value="6"  label="ASSIGNMENTS BOUND"/>
        <window.Stat value="73%" label="AVG ENGAGEMENT" hint="active in last 14d"/>
        <window.Stat value="5.2" label="AVG COMPETENCE" hint="across bound pills"/>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">Members</div>
            <h3 className="h-3">14 testees</h3>
          </div>
          <input className="input" placeholder="Filter members…" style={{maxWidth:220, padding:'6px 10px', fontSize:13}}/>
        </div>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Last active</th><th></th></tr></thead>
          <tbody>
            {[
              ['Lerato Dlamini', 'lerato@sitemesh.co',   '12 Jan 2026', '2h ago'],
              ['Themba Nkosi',   'themba@sitemesh.co',   '12 Jan 2026', '1d ago'],
              ['Sipho Mthembu',  'sipho@sitemesh.co',    '14 Jan 2026', '3d ago'],
              ['Naledi Phiri',   'naledi@sitemesh.co',   '02 Feb 2026', '12d ago'],
              ['Bongani Khumalo','bongani@sitemesh.co',  '02 Feb 2026', '4d ago'],
              ['Kabelo Radebe',  'kabelo@sitemesh.co',   '17 Feb 2026', '6h ago'],
            ].map(([n, e, j, l]) => (
              <tr key={e}>
                <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{n[0]}</div>{n}</div></td>
                <td className="mono" style={{fontSize:12}}>{e}</td>
                <td className="t-meta">{j}</td>
                <td className="t-meta">{l}</td>
                <td className="right"><button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPicker && <MemberPickerModal/>}
    </div>
  );
}

function MemberPickerModal() {
  const candidates = [
    { name:'Jay van der Merwe', email:'jay@sitemesh.co', role:'admin', already:false, role_warn:true },
    { name:'Lerato Dlamini',    email:'lerato@sitemesh.co', role:'testee', already:true },
    { name:'Themba Nkosi',      email:'themba@sitemesh.co', role:'testee', already:true },
    { name:'Tshepo Mokoena',    email:'tshepo@sitemesh.co', role:'testee', already:false, selected:true },
    { name:'Naledi Phiri',      email:'naledi@sitemesh.co', role:'testee', already:true },
    { name:'Zinhle Khanyile',   email:'zinhle@sitemesh.co', role:'testee', already:false, selected:true },
    { name:'Gys Maritz',        email:'gys@sitemesh.co', role:'admin', already:false, role_warn:true },
  ];
  return (
    <Modal width={620}>
      <ModalHeader eyebrow="ADD MEMBERS · COATINGS INSPECTORS" title={<><span className="serif-it">Pick from</span> all testees.</>}/>
      <Field label="Search" hint="Filter the directory by name, email, or role.">
        <input className="input" placeholder="Search 45 users…" autoFocus/>
      </Field>
      <div style={{
        maxHeight:300, overflowY:'auto', border:'1px solid var(--line)',
        marginBottom:14,
      }}>
        {candidates.map(c => (
          <div key={c.email} style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'10px 12px',
            borderBottom:'1px solid var(--line)',
            background: c.selected ? 'var(--accent-soft)' : 'transparent',
            opacity: c.already ? 0.45 : 1,
          }}>
            <input type="checkbox" defaultChecked={c.selected} disabled={c.already}/>
            <div className="avatar" style={{width:26, height:26, fontSize:11}}>{c.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:600}}>{c.name}</div>
              <div className="muted mono" style={{fontSize:11}}>{c.email}</div>
            </div>
            <window.Pill tone={c.role === 'admin' ? 'accent' : 'soft'} mono>{c.role}</window.Pill>
            {c.already && <span className="muted" style={{fontSize:11.5}}>already in group</span>}
          </div>
        ))}
      </div>
      <div className="muted" style={{fontSize:12, marginBottom:14}}>
        <strong style={{color:'var(--ink)'}}>2 selected</strong> · existing members are dimmed.
        Adding an administrator to a group is allowed but unusual — most groups are testee-only.
      </div>
      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary">Add 2 members <span className="arrow">→</span></button>
      </ModalActions>
    </Modal>
  );
}

// ============================================================
// #21 — LEARNING PATHS
// ============================================================
function PathsCrudMock() {
  const subStates = [
    { id: 'list',   label: 'List · idle' },
    { id: 'edit',   label: 'Edit path' },
    { id: 'drag',   label: 'Drag-reorder · in progress' },
  ];
  const [ss, setSs] = aaUseState('edit');
  if (ss === 'list') return <><SubStateStrip options={subStates} value={ss} onChange={setSs}/><PathListView/></>;
  return <><SubStateStrip options={subStates} value={ss} onChange={setSs}/><PathEditor dragging={ss === 'drag'}/></>;
}

function PathListView() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">Learning paths · ordered progressions</div>
          <h3 className="h-3">Paths</h3>
        </div>
        <button className="btn btn-primary"><window.Icon name="plus" size={12}/> Add path</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Pills</th><th>Assigned to</th><th>Last edited</th><th></th></tr></thead>
        <tbody>
          {[
            { name:'New inspector — foundations',    pills:6, assigned:'14 testees',   edited:'12d ago' },
            { name:'NACE Level III prep',            pills:9, assigned:'8 testees',    edited:'21d ago' },
            { name:'Senior engineer · annual',       pills:7, assigned:'Seniors group', edited:'2 months ago' },
            { name:'Q3 2026 induction',              pills:5, assigned:'9 testees',    edited:'8d ago' },
          ].map(p => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td className="num">{p.pills}</td>
              <td className="muted" style={{fontSize:12.5}}>{p.assigned}</td>
              <td className="t-meta">{p.edited}</td>
              <td className="right">
                <div className="row gap-2" style={{justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-sm">Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PathEditor({ dragging }) {
  return (
    <div>
      <window.PageHeader
        eyebrow="EDIT LEARNING PATH"
        title={<><span className="serif-it">New inspector</span> — foundations</>}
        subtitle="An ordered progression for newly-onboarded coatings inspectors. Order matters — testees move from pill 1 to pill 6 in sequence; downstream pills unlock as upstream ones pass."
        actions={
          <div className="row gap-2">
            <button className="btn">Cancel</button>
            <button className="btn btn-primary">Save path <span className="arrow">→</span></button>
          </div>
        }/>

      <div className="grid grid-12 gap-4">
        <div className="col-span-7">
          <div className="card" style={{padding:24}}>
            <div className="eyebrow mb-3">Path details</div>
            <Field label="Name">
              <input className="input" defaultValue="New inspector — foundations"/>
            </Field>
            <Field label="Description" hint="Visible to testees on the dashboard.">
              <textarea className="input" rows={3}
                defaultValue="The fundamentals for a NACE Level I inspector — substrate prep, paint chemistry, application, and inspection methodology."/>
            </Field>

            <div className="eyebrow mt-4 mb-3">Pills in this path · 6</div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {[
                { id:1, name:'Substrate Preparation',     subject:'Paint & coatings', d:'D1–D5' },
                { id:2, name:'Paint Chemistry Basics',    subject:'Paint & coatings', d:'D2–D5' },
                { id:3, name:'Application Techniques',    subject:'Paint & coatings', d:'D2–D6' },
                { id:4, name:'Adhesion Testing',          subject:'Paint & coatings', d:'D3–D6', floating:dragging },
                { id:5, name:'Corrosion Mechanisms',      subject:'Materials',        d:'D1–D5' },
                { id:6, name:'Inspection Documentation',  subject:'Commercial',       d:'D2–D5' },
              ].map(p => (
                <PathPillRow key={p.id} p={p} dragging={dragging && p.floating}/>
              ))}
            </div>
            <button className="btn btn-ghost mt-4" style={{width:'100%', justifyContent:'center'}}>
              <window.Icon name="plus" size={12}/> Add pill to this path
            </button>
          </div>
        </div>

        <div className="col-span-5">
          <div className="card sunk" style={{padding:18}}>
            <div className="eyebrow mb-2">Assigned to</div>
            <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6, marginBottom:14}}>
              This path is currently bound to <strong style={{color:'var(--ink)'}}>14 testees</strong> through
              4 assignments. Changes to the path apply to in-progress testees on their next pill.
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:-2, marginLeft:6}}>
              {['L','T','S','N','B','K','J','P','M','R','Z','+','+','+'].map((c, i) => (
                <div key={i} className="avatar" style={{
                  width:28, height:28, fontSize:11, marginLeft:-6,
                  border:'2px solid var(--bg-raised)',
                  background: c === '+' ? 'var(--bg-sunk)' : undefined,
                  color: c === '+' ? 'var(--ink-3)' : undefined,
                }}>{c}</div>
              ))}
            </div>
          </div>

          <div className="card mt-4" style={{padding:18}}>
            <div className="eyebrow mb-2">Path mechanics</div>
            <ul style={{margin:0, paddingLeft:16, fontSize:12.5, lineHeight:1.7, color:'var(--ink-2)'}}>
              <li>Pills unlock sequentially — pill N+1 unlocks when N is passed at the testee's working band.</li>
              <li>Re-ordering a path applies retroactively to anyone who hasn't yet passed the moved pill.</li>
              <li>Removing a pill from the path doesn't delete the pill — it just exits this progression.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathPillRow({ p, dragging }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'12px 14px',
      background:'var(--bg-sunk)',
      border:'1px solid var(--line)',
      cursor:'grab',
      boxShadow: dragging ? 'var(--shadow-2)' : 'none',
      transform: dragging ? 'translateY(-6px) rotate(-0.5deg)' : 'none',
      transition:'transform .15s ease',
      zIndex: dragging ? 5 : 1,
      position: 'relative',
    }}>
      <span style={{color:'var(--ink-4)', cursor:'grab', flexShrink:0}}>
        <svg width="14" height="14" viewBox="0 0 14 14"><g fill="currentColor">
          <circle cx="5" cy="3" r="1"/><circle cx="9" cy="3" r="1"/>
          <circle cx="5" cy="7" r="1"/><circle cx="9" cy="7" r="1"/>
          <circle cx="5" cy="11" r="1"/><circle cx="9" cy="11" r="1"/>
        </g></svg>
      </span>
      <span className="serif" style={{fontSize:22, color:'var(--ink-3)', minWidth:24, lineHeight:1}}>
        {String(p.id).padStart(2,'0')}
      </span>
      <div style={{flex:1}}>
        <div style={{fontSize:14, fontWeight:600}}>{p.name}</div>
        <div className="muted" style={{fontSize:11.5, marginTop:2}}>
          {p.subject} · <span className="mono">{p.d}</span>
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)', flexShrink:0}}>Remove</button>
    </div>
  );
}

// ============================================================
// #22 — ASSIGNMENTS
// ============================================================
function AssignmentsCrudMock() {
  const subStates = [
    { id: 'list',   label: 'List · idle' },
    { id: 'create', label: 'Create assignment' },
    { id: 'edit',   label: 'Edit assignment' },
    { id: 'delete', label: 'Delete confirm' },
  ];
  const [ss, setSs] = aaUseState('create');

  return (
    <div>
      <SubStateStrip options={subStates} value={ss} onChange={setSs}/>
      <AssignmentListBehind/>
      {ss === 'create' && <AssignmentEditor mode="create"/>}
      {ss === 'edit'   && <AssignmentEditor mode="edit"/>}
      {ss === 'delete' && <DeleteAssignmentModal/>}
    </div>
  );
}

function AssignmentListBehind() {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="title">
          <div className="eyebrow">Assignments · 17 active</div>
          <h3 className="h-3">Active bindings</h3>
        </div>
        <button className="btn btn-primary"><window.Icon name="plus" size={12}/> New assignment</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Bound to</th><th>Test / Path</th><th>Mode</th><th>Loop</th><th>Deadline</th><th>Progress</th></tr></thead>
        <tbody>
          {[
            { who:'Coatings inspectors (14)', what:'NACE Level III prep · path', mode:'path',  loop:'admin-reviewed', deadline:'30 Jun', prog:'8/14 started' },
            { who:'Senior engineers (8)',     what:'Q2 Annual Competency',       mode:'test',  loop:'autonomous',     deadline:'15 May', prog:'8/8 complete' },
            { who:'Lerato Dlamini',           what:'Antifouling — focus',        mode:'test',  loop:'autonomous',     deadline:'12 Jun', prog:'in progress' },
            { who:'Trainees Q3 2026 (9)',     what:'Foundations · path',         mode:'path',  loop:'admin-reviewed', deadline:'31 Aug', prog:'2/9 started' },
          ].map((a,i) => (
            <tr key={i}>
              <td>{a.who}</td>
              <td>{a.what}</td>
              <td><window.Pill tone="soft" mono>{a.mode}</window.Pill></td>
              <td><window.Pill tone={a.loop === 'autonomous' ? 'soft' : 'accent'} mono>{a.loop}</window.Pill></td>
              <td className="t-meta">{a.deadline}</td>
              <td className="muted" style={{fontSize:12.5}}>{a.prog}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentEditor({ mode }) {
  const isEdit = mode === 'edit';
  return (
    <Modal width={680}>
      <ModalHeader
        eyebrow={isEdit ? 'EDIT ASSIGNMENT' : 'NEW ASSIGNMENT'}
        title={isEdit
          ? <><span className="serif-it">Edit</span> Antifouling for Coatings inspectors</>
          : <><span className="serif-it">Bind a test or path</span> to testees.</>}/>

      {/* Bound to: tabs */}
      <Field label="Bound to" hint="Testees, groups, or any mix. Groups expand to their members at attempt-start.">
        <div style={{
          display:'flex', borderBottom:'1px solid var(--line)',
          marginBottom:10, fontFamily:'var(--font-mono)', fontSize:11,
          letterSpacing:'0.06em', textTransform:'uppercase',
        }}>
          <PickerTab active={false} label="Groups · 2"/>
          <PickerTab active={true}  label="Testees · 5"/>
          <PickerTab active={false} label="Search all"/>
        </div>
        <div style={{
          padding:'10px 12px', background:'var(--bg-sunk)',
          minHeight: 64, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center',
        }}>
          {['Coatings inspectors · 14', 'Senior engineers · 8'].map(g => (
            <PickerChip key={g} type="group" label={g}/>
          ))}
          {['Lerato Dlamini', 'Themba Nkosi', 'Kabelo Radebe', 'Naledi Phiri', 'Sipho Mthembu'].map(t => (
            <PickerChip key={t} type="testee" label={t}/>
          ))}
          <input style={{
            flex:1, minWidth:120, padding:'6px 8px',
            background:'transparent', border:'none', outline:'none',
            fontSize:13,
          }} placeholder="+ add testee or group…"/>
        </div>
        <div className="muted t-meta" style={{marginTop:6}}>
          27 testees total · 22 unique after de-duplication
        </div>
      </Field>

      <Field label="Test or learning path">
        <select className="input" defaultValue={isEdit ? 'antifouling-focus' : ''}>
          <option value="" disabled>Pick a test or path…</option>
          <optgroup label="Tests">
            <option value="antifouling-focus">Antifouling — focus (test, per_testee)</option>
            <option value="q2-annual">Q2 Annual Competency (test, frozen)</option>
            <option value="benchmark-2026">SiteMesh Annual Benchmark (test, benchmark)</option>
          </optgroup>
          <optgroup label="Learning paths">
            <option value="path-foundations">New inspector — foundations (6 pills)</option>
            <option value="path-nace">NACE Level III prep (9 pills)</option>
          </optgroup>
        </select>
      </Field>

      <FieldRow cols="1fr 1fr">
        <Field label="Deadline date">
          <input className="input mono" type="date" defaultValue={isEdit ? '2026-06-12' : ''}/>
        </Field>
        <Field label="Deadline time" hint="Local timezone.">
          <input className="input mono" type="time" defaultValue="17:00"/>
        </Field>
      </FieldRow>

      <Field label="Loop mode"
        hint="Whether follow-ups generated by the adaptive loop run automatically or wait for your review."
        locked={isEdit}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <LoopChoice id="autonomous"    title="Autonomous"     body="Acumen runs follow-ups automatically until the testee reaches their working band." active={true} disabled={isEdit}/>
          <LoopChoice id="admin-reviewed" title="Admin-reviewed" body="Every follow-up needs your approval before it's served to the testee." active={false} disabled={isEdit}/>
        </div>
      </Field>

      {!isEdit && (
        <div style={{
          padding:'10px 14px', marginTop:8, marginBottom:6,
          background:'var(--bg-sunk)', borderLeft:'2px solid var(--accent)',
        }}>
          <div className="row gap-2 ai-c">
            <window.Icon name="mail" size={12}/>
            <span style={{fontSize:12.5, color:'var(--ink-2)'}}>
              22 testees will receive a notification at the next reminder window.
            </span>
          </div>
        </div>
      )}

      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary">
          {isEdit ? 'Save changes' : 'Create assignment'} <span className="arrow">→</span>
        </button>
      </ModalActions>
    </Modal>
  );
}

function PickerTab({ active, label }) {
  return (
    <button style={{
      padding:'8px 14px',
      color: active ? 'var(--ink)' : 'var(--ink-3)',
      borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
      marginBottom: -1,
      fontFamily:'inherit', fontSize:'inherit', letterSpacing:'inherit', textTransform:'inherit',
    }}>{label}</button>
  );
}
function PickerChip({ type, label }) {
  const bg = type === 'group' ? 'var(--accent-soft)' : 'var(--bg-raised)';
  const fg = type === 'group' ? 'var(--accent-ink)' : 'var(--ink)';
  const ico = type === 'group' ? 'users' : 'user';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'4px 8px',
      background: bg, color: fg,
      border:'1px solid var(--line)',
      fontSize:12,
    }}>
      <window.Icon name={ico} size={11}/> {label}
      <button style={{color:'currentColor', opacity:0.6, marginLeft:2}}><window.Icon name="x" size={10}/></button>
    </span>
  );
}
function LoopChoice({ active, disabled, title, body }) {
  return (
    <button disabled={disabled} style={{
      textAlign:'left', padding:'12px 14px',
      background: active ? 'var(--ink)' : 'var(--bg-sunk)',
      color: active ? 'var(--bg-raised)' : 'var(--ink)',
      border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
      opacity: disabled ? 0.7 : 1,
    }}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{title}</div>
      <div style={{fontSize:11.5, lineHeight:1.5, color: active ? 'var(--bg-sunk)' : 'var(--ink-3)'}}>{body}</div>
    </button>
  );
}

function DeleteAssignmentModal() {
  return (
    <Modal width={500}>
      <ModalHeader
        eyebrow="DELETE ASSIGNMENT"
        title={<><span className="serif-it">Delete this</span> assignment?</>}/>
      <div className="card sunk tight" style={{padding:14, marginBottom:16, background:'var(--bg-sunk)'}}>
        <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:'8px 14px', fontSize:13}}>
          <span className="t-meta">BOUND TO</span> <span>Coatings inspectors · 14 testees</span>
          <span className="t-meta">TEST</span>     <span>Antifouling — focus</span>
          <span className="t-meta">DEADLINE</span> <span>12 Jun 2026 · 17:00 SAST</span>
          <span className="t-meta">PROGRESS</span> <span>8 of 14 started · 3 completed</span>
        </div>
      </div>
      <div style={{padding:'12px 14px', marginBottom:18,
        background:'var(--danger-soft)', borderLeft:'2px solid var(--danger)'}}>
        <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.6}}>
          Testees will lose access to the test immediately. <strong style={{color:'var(--danger)'}}>Completed attempts
          are preserved</strong> in each testee's history, but in-progress attempts are paused and can't be resumed.
          To pause without losing access, edit the deadline instead.
        </div>
      </div>
      <ModalActions>
        <button className="btn">Cancel</button>
        <button className="btn btn-primary" style={{background:'var(--danger)', borderColor:'var(--danger)'}}>
          Delete assignment <span className="arrow">→</span>
        </button>
      </ModalActions>
    </Modal>
  );
}

window.AdminAuthoringMock = AdminAuthoringMock;
