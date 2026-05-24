// constellation.jsx — competency profile as a constellation.
// Each pill is a star; brightness = competence, size = engagement,
// ring = calibration confidence. Edges connect related pills.
// Clusters by subject. Click a star to see history & related pills.

const { useState: cUseState, useEffect: cUseEffect, useMemo: cUseMemo, useRef: cUseRef } = React;

// pre-computed layout in subject clusters within a polar-ish field.
// Returns {x,y} per pill in [0..1] space; we scale to viewport on render.
function layoutConstellation(pills, subjects) {
  // place each subject as a cluster centre on a ring
  const N = subjects.length;
  const subjCentres = {};
  subjects.forEach((s, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const r = 0.32;
    subjCentres[s.id] = { cx: 0.5 + r * Math.cos(angle), cy: 0.5 + r * Math.sin(angle) };
  });
  // place pills around their subject centre, jittered deterministically.
  const out = {};
  const bySub = {};
  pills.forEach(p => { (bySub[p.subject] = bySub[p.subject] || []).push(p); });
  Object.entries(bySub).forEach(([sid, list]) => {
    const c = subjCentres[sid];
    list.forEach((p, i) => {
      // distribute in a circle around the cluster centre
      const a = (i / list.length) * Math.PI * 2 + (sid.charCodeAt(0) * 0.13);
      const rr = 0.06 + (((p.competence + p.n / 80) * 13) % 5) * 0.012;
      out[p.id] = { x: c.cx + rr * Math.cos(a), y: c.cy + rr * Math.sin(a) };
    });
  });
  return { subjCentres, positions: out };
}

function Constellation({ pills, subjects, selectedId, onSelect, width = 880, height = 620 }) {
  const { subjCentres, positions } = cUseMemo(() => layoutConstellation(pills, subjects), [pills, subjects]);

  // edges via related pill ids
  const edges = [];
  pills.forEach(p => {
    p.related.forEach(rid => {
      if (positions[rid] && p.id < rid) edges.push({ a: p.id, b: rid });
    });
  });

  const bandColor = (b) => ({
    novice:'var(--band-novice)',
    junior:'var(--band-junior)',
    working:'var(--band-working)',
    advanced:'var(--band-advanced)',
    expert:'var(--band-expert)',
  })[b];

  const px = (x) => x * width;
  const py = (y) => y * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style={{display:'block',maxHeight:'80vh'}}>
      <defs>
        <radialGradient id="haze" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="var(--ink)" stopOpacity="0.04"/>
          <stop offset="80%" stopColor="var(--ink)" stopOpacity="0"/>
        </radialGradient>
        <filter id="soft-glow"><feGaussianBlur stdDeviation="1.4"/></filter>
      </defs>

      {/* faint subject halos */}
      {subjects.map(s => {
        const c = subjCentres[s.id];
        return (
          <g key={s.id}>
            <circle cx={px(c.cx)} cy={py(c.cy)} r={110} fill={s.color} opacity={0.045}/>
            <text x={px(c.cx)} y={py(c.cy)-92} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize="10" letterSpacing="2"
                  fill="var(--ink-3)" style={{textTransform:'uppercase'}}>
              {s.name}
            </text>
          </g>
        );
      })}

      {/* connecting edges (faint) */}
      {edges.map((e, i) => {
        const A = positions[e.a], B = positions[e.b];
        return (
          <line key={i}
            x1={px(A.x)} y1={py(A.y)} x2={px(B.x)} y2={py(B.y)}
            stroke="var(--ink-2)" strokeWidth="0.7" opacity="0.18"/>
        );
      })}

      {/* stars */}
      {pills.map(p => {
        const pos = positions[p.id];
        const sub = subjects.find(s => s.id === p.subject);
        const radius = 4 + (p.competence / 10) * 14;          // size = competence
        const conf = Math.min(1, p.n / 30);                    // n=30 = full confidence ring
        const opacity = 0.35 + (p.competence / 10) * 0.55;
        const isSel = p.id === selectedId;
        return (
          <g key={p.id} style={{cursor:'pointer'}} onClick={() => onSelect(p.id)}>
            {/* glow */}
            <circle cx={px(pos.x)} cy={py(pos.y)} r={radius*1.8} fill={bandColor(p.band)} opacity={opacity*0.18} filter="url(#soft-glow)"/>
            {/* confidence ring */}
            <circle cx={px(pos.x)} cy={py(pos.y)} r={radius+5}
                    fill="none" stroke={bandColor(p.band)}
                    strokeOpacity={conf}
                    strokeDasharray={`${conf*100} 100`}
                    strokeWidth="1.5" strokeLinecap="round"
                    transform={`rotate(-90 ${px(pos.x)} ${py(pos.y)})`}/>
            {/* star body */}
            <circle cx={px(pos.x)} cy={py(pos.y)} r={radius} fill={bandColor(p.band)} opacity={opacity}/>
            {/* core */}
            <circle cx={px(pos.x)} cy={py(pos.y)} r={radius*0.4} fill="var(--bg)" opacity={0.9}/>
            {/* safety mark */}
            {p.safety && (
              <circle cx={px(pos.x) + radius*0.8} cy={py(pos.y) - radius*0.8} r="3"
                      fill="var(--danger)" stroke="var(--bg)" strokeWidth="1"/>
            )}
            {/* selected ring */}
            {isSel && (
              <circle cx={px(pos.x)} cy={py(pos.y)} r={radius+10} fill="none"
                      stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="2 3"/>
            )}
            {/* label on hover/selected, or for highest competence */}
            {(isSel || p.competence > 7.5) && (
              <text x={px(pos.x)} y={py(pos.y) + radius + 14} textAnchor="middle"
                    fontFamily="var(--font-sans)" fontSize="11" fontWeight={isSel?600:500}
                    fill="var(--ink)">
                {p.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// FULL CONSTELLATION PAGE
// ============================================================
function TesteeProfile() {
  const { PILLS, SUBJECTS, BAND_LABEL } = window;
  const [selectedId, setSelectedId] = cUseState('antifouling');
  const [view, setView] = cUseState('constellation'); // constellation | matrix
  const selected = PILLS.find(p => p.id === selectedId);
  const selectedSub = SUBJECTS.find(s => s.id === selected?.subject);

  // counts per band
  const byBand = {};
  window.BANDS.forEach(b => byBand[b] = 0);
  PILLS.forEach(p => byBand[p.band]++);

  return (
    <div className="content wide" style={{padding:'36px 32px 64px'}}>
      <div className="row jc-b ai-b mb-6" style={{flexWrap:'wrap',gap:'24px'}}>
        <div>
          <div className="eyebrow mb-2">Your competency · 20 pills · calibrated</div>
          <h1 className="h-display"><span className="serif-it">A map of</span> what you know.</h1>
          <div className="muted mt-3" style={{fontSize:14,maxWidth:'52ch'}}>
            Each star is a pill. Brightness is your competence. The ring around it is calibration confidence —
            faded rings mean we haven't seen enough attempts to be sure yet. Lines connect related pills.
          </div>
        </div>
        <div className="seg">
          <button data-active={view==='constellation'} onClick={()=>setView('constellation')}>Constellation</button>
          <button data-active={view==='matrix'} onClick={()=>setView('matrix')}>Matrix</button>
        </div>
      </div>

      <div className="row gap-4 mb-6" style={{flexWrap:'wrap'}}>
        {window.BANDS.map(b => (
          <div key={b} className="row gap-2 ai-c">
            <span style={{width:10,height:10,borderRadius:'50%',background:`var(--band-${b})`}}/>
            <span className="t-meta" style={{color:'var(--ink-2)'}}>{BAND_LABEL[b]}</span>
            <span className="mono dim" style={{fontSize:11}}>{byBand[b]}</span>
          </div>
        ))}
        <div className="row gap-2 ai-c" style={{marginLeft:16}}>
          <span style={{display:'inline-block',width:14,height:14,border:'1.5px solid var(--ink-3)',borderRadius:'50%'}}/>
          <span className="t-meta">Confidence ring</span>
        </div>
        <div className="row gap-2 ai-c">
          <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'var(--danger)'}}/>
          <span className="t-meta">Safety-tagged</span>
        </div>
      </div>

      {view === 'constellation' ? (
        <div className="grid grid-12 gap-4">
          <div className="col-span-8">
            <div className="card" style={{padding:0,overflow:'hidden',background:'var(--bg-sunk)',position:'relative'}}>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center, transparent 0%, var(--bg-sunk) 80%), repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 50px, rgba(120,100,60,0.04) 50px, rgba(120,100,60,0.04) 51px)',pointerEvents:'none'}}/>
              <Constellation pills={PILLS} subjects={SUBJECTS} selectedId={selectedId} onSelect={setSelectedId}/>
            </div>
          </div>

          <div className="col-span-4 col gap-4">
            {selected && (
              <div className="card">
                <div className="t-meta" style={{color:selectedSub?.color}}>{selectedSub?.name.toUpperCase()}</div>
                <h3 className="h-2 mt-2" style={{fontSize:24}}>{selected.name}</h3>
                {selected.safety && <Pill tone="danger" mono>Safety · external links only</Pill>}

                <div className="grid grid-2 gap-3 mt-4">
                  <div>
                    <div className="stat-med" style={{color:'var(--band-'+selected.band+')'}}>{selected.competence.toFixed(1)}</div>
                    <div className="t-meta">COMPETENCE · 1–10</div>
                  </div>
                  <div>
                    <div className="stat-med">{selected.n}</div>
                    <div className="t-meta">ATTEMPTS · {selected.n >= 20 ? 'confident' : 'preliminary'}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <BandPips band={selected.band}/>
                  <div className="mt-2"><BandTag band={selected.band}/></div>
                </div>

                <div className="divider"/>
                <div className="eyebrow mb-2">Trend · last 6 attempts</div>
                <Sparkline values={[4.1,4.5,5.2,5.8,5.9,selected.competence]} band={selected.band}/>

                <div className="divider"/>
                <div className="eyebrow mb-2">Related</div>
                <div className="row gap-2" style={{flexWrap:'wrap'}}>
                  {selected.related.length === 0 && <span className="muted t-meta">No related pills yet.</span>}
                  {selected.related.map(rid => {
                    const p = window.PILLS.find(x => x.id === rid);
                    return (
                      <button key={rid} className="chip" onClick={()=>setSelectedId(rid)}>
                        {p?.name}
                      </button>
                    );
                  })}
                </div>

                <div className="row gap-2 mt-4">
                  <button className="btn btn-primary btn-sm">Practice at D{Math.round(selected.competence)} <span className="arrow">→</span></button>
                  <button className="btn btn-sm">Step up to D{Math.min(10, Math.round(selected.competence)+1)}</button>
                </div>
              </div>
            )}

            <div className="card sunk">
              <div className="eyebrow mb-2">How to read this</div>
              <ul style={{margin:0,paddingLeft:18,fontSize:12.5,lineHeight:1.7,color:'var(--ink-2)'}}>
                <li><strong style={{color:'var(--ink)'}}>Size</strong> = your competence on that pill</li>
                <li><strong style={{color:'var(--ink)'}}>Colour</strong> = band (Novice → Expert)</li>
                <li><strong style={{color:'var(--ink)'}}>Ring length</strong> = calibration confidence (full ring = 30+ attempts)</li>
                <li><strong style={{color:'var(--ink)'}}>Lines</strong> = related pills as tagged by your administrator</li>
                <li><strong style={{color:'var(--ink)'}}>Red dot</strong> = safety-tagged (external links instead of AI explainers)</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <MatrixView pills={PILLS} subjects={SUBJECTS} selectedId={selectedId} onSelect={setSelectedId}/>
      )}
    </div>
  );
}

function Sparkline({ values, band }) {
  const w = 240, h = 50, pad = 6;
  const min = 1, max = 10;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad*2);
    const y = h - pad - ((v - min) / (max - min)) * (h - pad*2);
    return [x, y];
  });
  const d = pts.map((p,i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]).join(' ');
  const colour = `var(--band-${band})`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <path d={d + ` L${w-pad} ${h-pad} L${pad} ${h-pad} Z`} fill={colour} opacity="0.12"/>
      <path d={d} fill="none" stroke={colour} strokeWidth="1.5"/>
      {pts.map((p,i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length-1 ? 3.5 : 2} fill={colour}/>
      ))}
    </svg>
  );
}

function MatrixView({ pills, subjects, selectedId, onSelect }) {
  return (
    <div className="card" style={{padding:8, overflowX:'auto'}}>
      <div className="grid matrix-grid" style={{gap:'2px',minWidth:680}}>
        <div className="t-meta" style={{padding:8}}>PILL · DIFFICULTY →</div>
        {Array.from({length:10}, (_,i) => (
          <div key={i} className="t-meta center" style={{padding:8}}>D{i+1}</div>
        ))}
        {subjects.map(s => {
          const subPills = pills.filter(p => p.subject === s.id);
          return subPills.map((p, idx) => (
            <React.Fragment key={p.id}>
              <div style={{padding:'10px 8px',display:'flex',alignItems:'center',gap:8,fontSize:12,fontWeight:500,background:selectedId===p.id?'var(--accent-soft)':'transparent',cursor:'pointer'}} onClick={()=>onSelect(p.id)}>
                <span style={{width:4,height:14,background:s.color,borderRadius:2}}/>
                <span className="ellipsis" style={{flex:1}}>{p.name}</span>
              </div>
              {Array.from({length:10}, (_, d) => {
                const diff = d + 1;
                const filled = diff <= Math.round(p.competence);
                const here = diff === Math.round(p.competence);
                return (
                  <div key={d} style={{
                    padding:'10px 0',
                    background: filled ? `var(--band-${p.band})` : 'var(--bg-deep)',
                    opacity: filled ? (here ? 1 : 0.55) : 1,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'var(--bg-raised)',fontSize:10,fontFamily:'var(--font-mono)',
                    cursor:'pointer',
                  }} onClick={()=>onSelect(p.id)}>
                    {here && p.competence.toFixed(1)}
                  </div>
                );
              })}
            </React.Fragment>
          ));
        })}
      </div>
    </div>
  );
}

window.TesteeProfile = TesteeProfile;
