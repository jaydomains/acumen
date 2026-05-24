// admin.jsx — Administrator-facing screens.

const { useState: adUseState, useEffect: adUseEffect, useMemo: adUseMemo } = React;

// ============================================================
// OPS DASHBOARD — landing for Admins
// ============================================================
function AdminOps({ onRoute }) {
  const { COST_BREAKDOWN, GRADE_REVIEW_QUEUE, PENDING_ENGAGEMENT, PILLS } = window;
  const flagged = GRADE_REVIEW_QUEUE.filter(g => g.reviewVerdict === 'flagged').length;
  const escalated = PENDING_ENGAGEMENT.filter(e => e.escalated).length;
  const monthPct = COST_BREAKDOWN.monthSpend / COST_BREAKDOWN.monthBudget;

  return (
    <div className="content">
      <div className="row jc-b ai-b mb-6 dash-hero" style={{flexWrap:'wrap',gap:'24px'}}>
        <div className="dash-hero-text">
          <div className="eyebrow mb-2">22 May · SiteMesh · Acumen module</div>
          <h1 className="h-display"><span className="serif-it">Acumen,</span> at a glance.</h1>
          <div className="muted mt-3" style={{fontSize:15,maxWidth:'56ch'}}>
            <strong style={{color:'var(--ink)'}}>{flagged} grade reviews</strong> need your attention.{' '}
            <strong style={{color:'var(--ink)'}}>{escalated} mandatory assignments</strong> have escalated past 2nd reminder.
            AI spend is on pace within budget.
          </div>
        </div>
        <div className="dash-hero-stats">
          <Stat value="124" label="ACTIVE TESTEES" hint="of 138 total"/>
          <Stat value="412" label="ATTEMPTS THIS MONTH" hint="+18% on April"/>
          <Stat value={`$${COST_BREAKDOWN.monthSpend.toFixed(2)}`} label="AI SPEND" hint={`of $${COST_BREAKDOWN.monthBudget} budget · ${Math.round(monthPct*100)}%`} tone="accent"/>
        </div>
      </div>

      <div className="grid grid-12 gap-4">
        {/* GRADE REVIEW QUEUE */}
        <div className="col-span-8">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Needs your attention</div>
                <h3 className="h-3">Cross-family grade review · flagged</h3>
              </div>
              <button className="btn btn-sm" onClick={() => onRoute('review')}>Open queue <span className="arrow">→</span></button>
            </div>
            <div className="col gap-2">
              {GRADE_REVIEW_QUEUE.filter(g => g.reviewVerdict === 'flagged').slice(0,3).map(g => (
                <ReviewRowCompact key={g.id} g={g} onOpen={() => onRoute('review')}/>
              ))}
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Engagement</div>
                <h3 className="h-3">Pending mandatory assignments</h3>
              </div>
              <button className="btn btn-sm" onClick={() => onRoute('engagement')}>Open all <span className="arrow">→</span></button>
            </div>
            <table className="tbl">
              <thead><tr><th>Testee</th><th>Assignment</th><th>Stale</th><th>Reminders</th><th></th></tr></thead>
              <tbody>
                {PENDING_ENGAGEMENT.slice(0,4).map(e => (
                  <tr key={e.id}>
                    <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:24,height:24,fontSize:11}}>{e.testee[0]}</div>{e.testee}</div></td>
                    <td>{e.assignment}</td>
                    <td className="t-meta">{e.daysStale}d</td>
                    <td className="num">{e.remindersSent}/2 {e.escalated && <Pill tone="danger" mono>Escalated</Pill>}</td>
                    <td className="right"><button className="btn btn-ghost btn-sm">Open <span className="arrow">→</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-4 col gap-4">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">AI spend · this month</div>
                <h3 className="h-3">${COST_BREAKDOWN.monthSpend.toFixed(2)} <span className="muted" style={{fontSize:14,fontWeight:400}}>of ${COST_BREAKDOWN.monthBudget}</span></h3>
              </div>
            </div>
            <DailyBars values={COST_BREAKDOWN.daily} height={72}/>
            <div className="divider"/>
            <div className="col gap-2">
              {COST_BREAKDOWN.operations.slice(0,4).map(op => (
                <div key={op.op} className="row jc-b ai-c">
                  <div className="row gap-2 ai-c" style={{flex:1}}>
                    <span style={{width:8,height:8,borderRadius:2,background: op.provider === 'Anthropic' ? 'var(--accent)' : 'var(--info)'}}/>
                    <span style={{fontSize:12.5}}>{op.op}</span>
                  </div>
                  <span className="num" style={{fontSize:12}}>${op.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm mt-3 btn-block" onClick={() => onRoute('cost')}>Full breakdown <span className="arrow">→</span></button>
          </div>

          <div className="card">
            <div className="eyebrow mb-2">Bootstrap status</div>
            <div className="row gap-3 ai-c">
              <span className="chip chip-ok"><span className="dot"/>Complete</span>
              <span className="t-meta">Last run · 12 May</span>
            </div>
            <div className="mt-3" style={{fontSize:12.5,lineHeight:1.5,color:'var(--ink-2)'}}>
              137 pills · 2,740 anchor questions · 96.4% pass self-review. Drive index 412 docs.
            </div>
          </div>

          <div className="card sunk">
            <div className="eyebrow mb-2">Pill proposals · 3 awaiting review</div>
            {window.PILL_PROPOSALS.map(p => (
              <div key={p.id} style={{padding:'10px 0',borderTop:'1px solid var(--line)'}}>
                <div className="row jc-b ai-c">
                  <span style={{fontSize:13,fontWeight:500}}>{p.name}</span>
                  {p.safetyAuto && <Pill tone="danger" mono>Safety</Pill>}
                </div>
                <div className="muted mt-2" style={{fontSize:11.5,lineHeight:1.4}}>{p.rationale}</div>
              </div>
            ))}
            <button className="btn btn-sm mt-3 btn-block">Review proposals <span className="arrow">→</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRowCompact({ g, onOpen }) {
  return (
    <div className="row gap-3 ai-c" style={{padding:'12px 14px',background:'var(--bg-sunk)',borderRadius:'var(--r-2)',border:'1px solid var(--line)'}}>
      <Pill tone="warn" mono>Flagged</Pill>
      <div style={{flex:1}}>
        <div className="row gap-2 ai-b">
          <span style={{fontWeight:500,fontSize:13}}>{g.testee}</span>
          <span className="muted t-meta">· {g.pill}</span>
        </div>
        <div className="muted ellipsis mt-2" style={{fontSize:12,maxWidth:'56ch'}}>{g.reason}</div>
      </div>
      <span className="t-meta">{g.age} ago</span>
      <button className="btn btn-sm" onClick={onOpen}>Resolve</button>
    </div>
  );
}

function DailyBars({ values, height = 60 }) {
  const max = Math.max(...values);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:3,height}}>
      {values.map((v,i) => (
        <div key={i} style={{
          flex:1,
          height: `${(v/max)*100}%`,
          background: i === values.length - 1 ? 'var(--accent)' : 'var(--ink-3)',
          opacity: i === values.length - 1 ? 1 : 0.4,
          borderRadius:'2px 2px 0 0',
          minHeight:2,
        }}/>
      ))}
    </div>
  );
}

// ============================================================
// GRADE REVIEW — full queue with split detail
// ============================================================
function AdminReview() {
  const { GRADE_REVIEW_QUEUE } = window;
  const [selected, setSelected] = adUseState(GRADE_REVIEW_QUEUE[0].id);
  const [filter, setFilter] = adUseState('flagged');
  const item = GRADE_REVIEW_QUEUE.find(g => g.id === selected);

  const filtered = GRADE_REVIEW_QUEUE.filter(g => filter === 'all' ? true : g.reviewVerdict === filter);

  return (
    <div className="content wide">
      <PageHeader
        eyebrow={`Cross-family review · AC-D19 · batched per attempt · 60s ceiling`}
        title={<><span className="serif-it">Adjudicate</span> AI grades.</>}
        subtitle="Anthropic graded these responses. OpenAI reviewed them and disagrees. Your call decides what lands on the Testee's profile."
        actions={(
          <div className="seg">
            <button data-active={filter==='flagged'} onClick={()=>setFilter('flagged')}>Flagged · 3</button>
            <button data-active={filter==='confirmed'} onClick={()=>setFilter('confirmed')}>Confirmed · 1</button>
            <button data-active={filter==='all'} onClick={()=>setFilter('all')}>All · 4</button>
          </div>
        )}
      />

      <div className="grid gap-4 admin-review-split">
        {/* list */}
        <div className="col gap-2">
          {filtered.map(g => (
            <button key={g.id} onClick={() => setSelected(g.id)} style={{
              textAlign:'left',padding:14,
              background: g.id === selected ? 'var(--bg-raised)' : 'transparent',
              border:'1px solid ' + (g.id === selected ? 'var(--ink)' : 'var(--line)'),
              borderRadius:'var(--r-2)', display:'block',
            }}>
              <div className="row gap-2 ai-c mb-2">
                <Pill tone={g.reviewVerdict === 'flagged' ? 'warn' : 'ok'} mono>{g.reviewVerdict}</Pill>
                <span className="t-meta">{g.age} ago</span>
              </div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{g.testee}</div>
              <div className="muted" style={{fontSize:12}}>{g.question}</div>
              <div className="row gap-2 mt-2">
                <span className="t-meta">{g.pill}</span>
                <span className="t-meta">·</span>
                <span className="t-meta">{g.primaryGrade}</span>
              </div>
            </button>
          ))}
        </div>

        {/* detail */}
        {item && (
          <div className="card">
            <div className="row jc-b ai-c mb-4">
              <div className="row gap-3 ai-c">
                <div className="avatar">{item.testee[0]}</div>
                <div>
                  <div style={{fontWeight:600}}>{item.testee}</div>
                  <div className="t-meta">{item.pill} · D5 · attempt #at-9c20</div>
                </div>
              </div>
              <Pill tone={item.reviewVerdict === 'flagged' ? 'warn' : 'ok'} mono>{item.reviewVerdict} by reviewer</Pill>
            </div>

            <div className="card sunk tight mb-4">
              <div className="eyebrow mb-2">Question</div>
              <div className="serif" style={{fontSize:20,lineHeight:1.4}}>{item.question}</div>
            </div>

            <div className="grid grid-2 gap-4 mb-4">
              <div className="card tight" style={{background:'var(--bg-sunk)'}}>
                <div className="eyebrow mb-2">Testee response</div>
                <div className="serif" style={{fontSize:15,lineHeight:1.5,color:'var(--ink-2)'}}>
                  "The polymer wears away because it dissolves in seawater, releasing biocide as a function of time.
                  This makes it suitable for vessels with consistent operating profiles, since the leaching rate
                  is what protects the hull from fouling."
                </div>
              </div>
              <div className="card tight">
                <div className="eyebrow mb-2">Rubric extract</div>
                <div style={{fontSize:13,lineHeight:1.55}}>
                  Must explicitly connect <strong>polymer hydrolysis rate</strong> to <strong>water flow across the hull</strong>.
                  Partial credit if the candidate identifies dissolution but conflates rate-control mechanism with
                  biocide release independent of speed.
                </div>
              </div>
            </div>

            <div className="grid grid-2 gap-4 mb-6">
              <div className="card tight">
                <div className="row jc-b ai-c mb-2">
                  <span className="eyebrow">Primary grader</span>
                  <span className="t-meta mono">claude-sonnet-4-5</span>
                </div>
                <div className="row gap-2 mb-3">
                  <Pill tone="warn" mono>Partial · 0.6</Pill>
                </div>
                <div style={{fontSize:13,lineHeight:1.55,color:'var(--ink-2)'}}>
                  "Candidate identifies the dissolution mechanism correctly and mentions the role of leaching
                  in protection. They miss the explicit hydrolysis-rate-vs-flow link, so partial credit is
                  appropriate."
                </div>
              </div>
              <div className="card tight" style={{borderColor:'var(--warn)'}}>
                <div className="row jc-b ai-c mb-2">
                  <span className="eyebrow" style={{color:'var(--warn)'}}>Reviewer · flagged</span>
                  <span className="t-meta mono">openai gpt-4o-mini</span>
                </div>
                <div className="row gap-2 mb-3">
                  <Pill tone="danger" mono>Suggest: None · 0.2</Pill>
                </div>
                <div style={{fontSize:13,lineHeight:1.55,color:'var(--ink-2)'}}>
                  {item.reason}
                </div>
              </div>
            </div>

            <div className="card sunk tight mb-4">
              <div className="eyebrow mb-2">Your override</div>
              <div className="row gap-2 mb-3" style={{flexWrap:'wrap'}}>
                <button className="btn btn-sm">Full · 1.0</button>
                <button className="btn btn-sm">Partial · 0.6</button>
                <button className="btn btn-sm btn-primary">Partial · 0.4</button>
                <button className="btn btn-sm">None · 0.0</button>
                <span className="spacer"/>
                <button className="btn btn-ghost btn-sm">Confirm primary as-is</button>
              </div>
              <textarea className="input" placeholder="Optional reason (visible to Testee on result page)…" rows={2}/>
            </div>

            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm">Skip for now</button>
              <div className="spacer"/>
              <button className="btn">Save & next</button>
              <button className="btn btn-primary">Apply override <span className="arrow">→</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ENGAGEMENT
// ============================================================
function AdminEngagement() {
  const { PENDING_ENGAGEMENT } = window;
  return (
    <div className="content">
      <PageHeader
        eyebrow="AC-D26 · derived engagement_status · 7-day default threshold"
        title={<><span className="serif-it">Who's</span> not engaging.</>}
        subtitle="Mandatory assignments that have been pending past your configured threshold. Auto-reminders fire at the schedule below; non-engagement after the second escalates to you."
      />

      <div className="grid grid-4 gap-4 mb-6">
        <Stat value="4" label="ESCALATED" hint="past 2nd reminder"/>
        <Stat value="11" label="OVERDUE" hint="soft deadline lapsed"/>
        <Stat value="23" label="PENDING" hint="not started"/>
        <Stat value="34d" label="OLDEST STALE" hint="Confined Space · Naledi P."/>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">Pending mandatory</div>
            <h3 className="h-3">{PENDING_ENGAGEMENT.length} assignments</h3>
          </div>
          <div className="seg">
            <button data-active="true">Stale</button>
            <button>By assigner</button>
            <button>By pill</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Testee</th><th>Assignment</th><th>Assigned by</th><th>Stale</th><th>Reminders</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {PENDING_ENGAGEMENT.map(e => (
              <tr key={e.id}>
                <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{e.testee[0]}</div>{e.testee}</div></td>
                <td>{e.assignment}</td>
                <td>{e.assigner}</td>
                <td className="num">{e.daysStale}d</td>
                <td className="num">{e.remindersSent} of 2</td>
                <td>{e.escalated ? <Pill tone="danger" mono>Escalated</Pill> : <Pill tone="warn" mono>Pending</Pill>}</td>
                <td className="right">
                  <button className="btn btn-ghost btn-sm">Nudge</button>
                  <button className="btn btn-ghost btn-sm">Reassign</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CATALOGUE — admin view
// ============================================================
function AdminCatalogue() {
  const { PILLS, SUBJECTS, PILL_PROPOSALS } = window;
  const [tab, setTab] = adUseState('pills');
  return (
    <div className="content">
      <PageHeader
        eyebrow="Catalogue · 137 pills · 6 subjects"
        title={<><span className="serif-it">Manage</span> the taxonomy.</>}
        actions={(<button className="btn btn-primary"><window.Icon name="plus" size={12}/> New pill</button>)}
      />

      <div className="tabs">
        <button data-active={tab==='pills'} onClick={()=>setTab('pills')}>Pills</button>
        <button data-active={tab==='subjects'} onClick={()=>setTab('subjects')}>Subjects</button>
        <button data-active={tab==='proposals'} onClick={()=>setTab('proposals')}>AI proposals · 3</button>
        <button data-active={tab==='safety'} onClick={()=>setTab('safety')}>Safety links</button>
      </div>

      {tab === 'pills' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr><th>Pill</th><th>Subject</th><th>Difficulty</th><th>Anchor pool</th><th>Calibration</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {PILLS.map(p => {
                const s = SUBJECTS.find(x => x.id === p.subject);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="row gap-2 ai-c">
                        <span style={{width:6,height:18,background:s?.color,borderRadius:2}}/>
                        <span style={{fontWeight:500}}>{p.name}</span>
                        {p.safety && <Pill tone="danger" mono>Safety</Pill>}
                      </div>
                    </td>
                    <td className="muted">{s?.name}</td>
                    <td className="num">D1–D{Math.min(10, Math.round(p.competence)+3)}</td>
                    <td className="num">20 · 20 · 20 · 20 · 20</td>
                    <td className="t-meta">{p.n >= 20 ? <span style={{color:'var(--ok)'}}>● confident</span> : <span style={{color:'var(--warn)'}}>● preliminary</span>}</td>
                    <td>{p.safety ? <Pill tone="info" mono>External</Pill> : <Pill tone="ok" mono>AI-eligible</Pill>}</td>
                    <td className="right"><button className="btn btn-ghost btn-sm">Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'proposals' && (
        <div className="col gap-3">
          {PILL_PROPOSALS.map(p => {
            const s = SUBJECTS.find(x => x.id === p.subject);
            return (
              <div key={p.id} className="card">
                <div className="row jc-b ai-b">
                  <div>
                    <div className="t-meta" style={{color:s?.color}}>{s?.name.toUpperCase()}</div>
                    <h3 className="h-2 mt-2" style={{fontSize:24}}>{p.name}</h3>
                    {p.safetyAuto && <Pill tone="danger" mono>Auto-tagged safety</Pill>}
                  </div>
                  <div className="row gap-2">
                    <button className="btn">Edit & approve</button>
                    <button className="btn btn-primary">Approve <span className="arrow">→</span></button>
                    <button className="btn btn-ghost">Reject</button>
                  </div>
                </div>
                <div className="divider"/>
                <div className="eyebrow mb-2">Rationale</div>
                <div style={{fontSize:13,lineHeight:1.55,color:'var(--ink-2)'}}>{p.rationale}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="grid grid-3 gap-4">
          {SUBJECTS.map(s => {
            const n = PILLS.filter(p => p.subject === s.id).length;
            return (
              <div key={s.id} className="card">
                <div style={{width:36,height:6,background:s.color,borderRadius:3,marginBottom:14}}/>
                <h3 className="h-3">{s.name}</h3>
                <div className="t-meta mt-2">{n} pills</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'safety' && (
        <div className="card">
          <div className="eyebrow mb-3">AC-D21 · curated external links · 14 safety pills · monthly link-check cron</div>
          <table className="tbl">
            <thead><tr><th>Safety pill</th><th>Links</th><th>Last verified</th><th>Drift</th><th></th></tr></thead>
            <tbody>
              {PILLS.filter(p => p.safety).map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{4 + Math.floor(p.competence)}</td>
                  <td className="t-meta">3 days ago</td>
                  <td>{p.id === 'solvent-handling' ? <Pill tone="warn" mono>1 drifted</Pill> : <Pill tone="ok" mono>OK</Pill>}</td>
                  <td className="right"><button className="btn btn-ghost btn-sm">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// USERS
// ============================================================
function AdminUsers() {
  return (
    <div className="content">
      <PageHeader
        eyebrow="138 users · 6 administrators · 132 testees · single-tenant"
        title={<><span className="serif-it">People &</span> groups.</>}
        actions={(<><button className="btn"><window.Icon name="plus" size={12}/> New group</button><button className="btn btn-primary"><window.Icon name="plus" size={12}/> Add user</button></>)}
      />

      <div className="grid grid-12 gap-4">
        <div className="col-span-4">
          <div className="card">
            <h3 className="h-3 mb-4">Groups</h3>
            <div className="col gap-1">
              {[
                { name:'All Users',        n:138, system:true },
                { name:'All Testees',      n:132, system:true },
                { name:'All Administrators', n:6, system:true },
                { name:'Site QA Team',     n:18 },
                { name:'Marine Crew',      n:12 },
                { name:'New Hires 2026',   n:9  },
                { name:'NACE Cohort B',    n:6  },
              ].map(g => (
                <button key={g.name} className="rail-link" data-active={g.name === 'Site QA Team'}>
                  <window.Icon name="users" size={14}/>
                  <span style={{flex:1,fontSize:13}}>{g.name}</span>
                  <span className="mono dim" style={{fontSize:11}}>{g.n}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-8">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Site QA Team · 18 members</div>
                <h3 className="h-3">Members</h3>
              </div>
              <div className="row gap-2">
                <button className="btn btn-sm"><window.Icon name="plus" size={12}/> Add member</button>
                <button className="btn btn-sm btn-primary">Assign test to group</button>
              </div>
            </div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Role</th><th>Avg competence</th><th>Last attempt</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  { name:'Jay V.',        role:'Administrator', avg:6.4, last:'2h ago',  status:'active'},
                  { name:'Gys M.',        role:'Administrator', avg:7.1, last:'1d ago',  status:'active'},
                  { name:'Themba N.',     role:'Testee',        avg:5.8, last:'4m ago',  status:'active'},
                  { name:'Lerato D.',     role:'Testee',        avg:6.2, last:'11m ago', status:'active'},
                  { name:'Sipho M.',      role:'Testee',        avg:5.0, last:'3d ago',  status:'active'},
                  { name:'Kabelo R.',     role:'Testee',        avg:4.2, last:'32m ago', status:'active'},
                  { name:'Naledi P.',     role:'Testee',        avg:3.1, last:'14d ago', status:'stale'},
                  { name:'Bongani K.',    role:'Testee',        avg:5.5, last:'9d ago',  status:'stale'},
                ].map(u => (
                  <tr key={u.name}>
                    <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{u.name[0]}</div>{u.name}</div></td>
                    <td><Pill tone={u.role === 'Administrator' ? 'accent' : 'soft'} mono>{u.role}</Pill></td>
                    <td className="num">{u.avg.toFixed(1)}</td>
                    <td className="t-meta">{u.last}</td>
                    <td>{u.status === 'stale' ? <Pill tone="warn" mono>stale 14d+</Pill> : <Pill tone="ok" mono>active</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COST DASHBOARD
// ============================================================
function AdminCost() {
  const { COST_BREAKDOWN } = window;
  const monthPct = COST_BREAKDOWN.monthSpend / COST_BREAKDOWN.monthBudget;

  return (
    <div className="content">
      <PageHeader
        eyebrow="AC-D18 · cost visibility · alerts at 50/80/100% · no hard enforcement in v1"
        title={<><span className="serif-it">AI spend.</span></>}
        subtitle="Per-attempt ~23¢ typical · per pill journey ~50–70¢ · monthly run rate ~$15–20 at single-tenant scale."
        actions={(<div className="seg"><button>Last 7d</button><button data-active="true">This month</button><button>YTD</button></div>)}
      />

      <div className="grid grid-12 gap-4 mb-6">
        <div className="col-span-8">
          <div className="card">
            <div className="card-hd">
              <div className="title">
                <div className="eyebrow">Daily AI spend · last 28 days</div>
                <h3 className="h-display" style={{fontSize:48}}>
                  ${COST_BREAKDOWN.monthSpend.toFixed(2)} <span className="muted" style={{fontSize:18}}>/ ${COST_BREAKDOWN.monthBudget}</span>
                </h3>
              </div>
              <div className="row gap-2">
                <Pill tone="warn" mono>80% alert · 6 days ago</Pill>
              </div>
            </div>
            <DailyBars values={COST_BREAKDOWN.daily} height={160}/>
            <div className="row jc-b mt-3">
              <span className="t-meta">28 days ago</span>
              <span className="t-meta">avg $0.66/day · projected month-end $19.80</span>
              <span className="t-meta">today</span>
            </div>
          </div>
        </div>

        <div className="col-span-4 col gap-4">
          <div className="card">
            <div className="eyebrow mb-2">Budget · this month</div>
            <div className="row jc-b ai-b mb-3">
              <span className="stat-med">{Math.round(monthPct*100)}%</span>
              <span className="t-meta">${(COST_BREAKDOWN.monthBudget - COST_BREAKDOWN.monthSpend).toFixed(2)} left</span>
            </div>
            <div className="progress" style={{height:8}}>
              <div className="fill accent" style={{width:(monthPct*100)+'%'}}/>
            </div>
            <div className="row gap-2 mt-3" style={{flexWrap:'wrap'}}>
              <Pill tone="ok" mono>50%</Pill>
              <Pill tone="warn" mono>80%</Pill>
              <Pill tone="soft" mono>100% · not reached</Pill>
            </div>
          </div>

          <div className="card sunk">
            <div className="eyebrow mb-2">By provider</div>
            <div className="row jc-b ai-c">
              <div className="row gap-2 ai-c"><span style={{width:10,height:10,background:'var(--accent)',borderRadius:2}}/><span style={{fontSize:13}}>Anthropic</span></div>
              <span className="num">$15.04</span>
            </div>
            <div className="row jc-b ai-c mt-3">
              <div className="row gap-2 ai-c"><span style={{width:10,height:10,background:'var(--info)',borderRadius:2}}/><span style={{fontSize:13}}>OpenAI</span></div>
              <span className="num">$3.38</span>
            </div>
            <div className="muted mt-3" style={{fontSize:11.5,lineHeight:1.5}}>
              OpenAI: cross-family review + Drive embeddings (text-embedding-3-small).
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="title">
            <div className="eyebrow">By operation</div>
            <h3 className="h-3">All seven AI operations</h3>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Operation</th><th>Provider</th><th className="right">Calls</th><th className="right">Tokens</th><th className="right">Cost</th><th>Share</th></tr></thead>
          <tbody>
            {COST_BREAKDOWN.operations.map(op => (
              <tr key={op.op}>
                <td><strong>{op.op}</strong></td>
                <td><Pill tone={op.provider === 'Anthropic' ? 'accent' : 'info'} mono>{op.provider}</Pill></td>
                <td className="right num">{op.calls}</td>
                <td className="right num">{(op.tokens/1000).toFixed(0)}k</td>
                <td className="right num"><strong>${op.cost.toFixed(2)}</strong></td>
                <td style={{minWidth:160}}>
                  <div className="progress"><div className="fill accent" style={{width:(op.share*100)+'%'}}/></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// LOOPS — adaptive loop monitor
// ============================================================
function AdminLoops() {
  return (
    <div className="content">
      <PageHeader
        eyebrow="AC-D6 · adaptive learning loops · 2 modes per test"
        title={<><span className="serif-it">Active</span> loops.</>}
        subtitle="Autonomous loops self-progress; admin-reviewed loops route to you between weakness identification and follow-up generation."
      />
      <div className="grid grid-4 gap-4 mb-6">
        <Stat value="34" label="ACTIVE LOOPS"/>
        <Stat value="8" label="AWAITING YOUR REVIEW" tone="accent"/>
        <Stat value="73%" label="LOOP SUCCESS RATE" hint="closed within 2 follow-ups"/>
        <Stat value="2.1" label="AVG FOLLOW-UPS TO CLOSE"/>
      </div>

      <div className="card">
        <table className="tbl">
          <thead><tr><th>Testee</th><th>Pill</th><th>Mode</th><th>Iteration</th><th>Last attempt</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {[
              { name:'Themba N.', pill:'Antifouling Systems', mode:'autonomous', iter:'2 of ∞', last:'4m ago', status:'queued', note:'follow-up at D4 in 5d'},
              { name:'Lerato D.', pill:'Corrosion Mechanisms', mode:'admin-reviewed', iter:'1 of 1', last:'11m ago', status:'review', note:'weakness report ready for you'},
              { name:'Sipho M.',  pill:'BoQ Preparation', mode:'autonomous', iter:'3 of ∞', last:'21m ago', status:'step-down', note:'AC-D9: 3 failed at D5, suggesting D4'},
              { name:'Kabelo R.', pill:'Immersion Service', mode:'autonomous', iter:'2 of ∞', last:'32m ago', status:'material-served', note:'explainer + 2 TDSes served'},
              { name:'Naledi P.', pill:'Adhesion Testing', mode:'autonomous', iter:'1 of ∞', last:'2d ago', status:'closed', note:'passed at D5 · loop closed'},
            ].map((l,i) => (
              <tr key={i}>
                <td><div className="row gap-2 ai-c"><div className="avatar" style={{width:26,height:26,fontSize:11}}>{l.name[0]}</div>{l.name}</div></td>
                <td>{l.pill}</td>
                <td><Pill tone={l.mode === 'autonomous' ? 'soft' : 'accent'} mono>{l.mode}</Pill></td>
                <td className="num">{l.iter}</td>
                <td className="t-meta">{l.last}</td>
                <td>
                  {l.status === 'review' && <Pill tone="warn" mono>Your review</Pill>}
                  {l.status === 'queued' && <Pill tone="info" mono>Follow-up queued</Pill>}
                  {l.status === 'step-down' && <Pill tone="accent" mono>Step-down suggested</Pill>}
                  {l.status === 'material-served' && <Pill tone="ok" mono>Material served</Pill>}
                  {l.status === 'closed' && <Pill tone="soft" mono>Closed</Pill>}
                </td>
                <td className="muted" style={{fontSize:12}}>{l.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { AdminOps, AdminReview, AdminEngagement, AdminCatalogue, AdminUsers, AdminCost, AdminLoops });
