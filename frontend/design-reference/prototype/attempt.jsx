// attempt.jsx — the hero screen: focus-mode attempt with JIT streaming queue.
// Streaming is part of the UX: questions visibly arrive in a side queue
// with state (generating → ready → current → done).

const { useState: aUseState, useEffect: aUseEffect, useMemo: aUseMemo, useRef: aUseRef } = React;

function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = aUseState(Date.now());
  aUseEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [enabled, intervalMs]);
  return now;
}

// Streaming hook: simulates Q1 arriving instantly, Q2..N arriving over time.
// Speed: 'instant' | 'realistic' | 'slow'
function useStreamingQueue(questions, speed) {
  const [arrivedIdx, setArrivedIdx] = aUseState(1); // Q1 already there
  const baseDelay = { instant: 80, realistic: 1400, slow: 3000 }[speed] || 1400;
  const variance = baseDelay * 0.5;
  aUseEffect(() => {
    setArrivedIdx(1);
    if (questions.length <= 1) return;
    let i = 1;
    let cancelled = false;
    function next() {
      if (cancelled || i >= questions.length) return;
      const d = baseDelay + (Math.random() - 0.5) * variance;
      setTimeout(() => {
        if (cancelled) return;
        i++;
        setArrivedIdx(i);
        next();
      }, d);
    }
    next();
    return () => { cancelled = true; };
  }, [questions, speed]);
  return arrivedIdx;
}

// ============================================================
// MAIN ATTEMPT — full-screen focus
// ============================================================
function AttemptScreen({ context, onExit, speed = 'realistic', integrityVisible = true }) {
  const { QUESTIONS, PILLS } = window;
  const pillId = context?.pill || 'antifouling';
  const pill = PILLS.find(p => p.id === pillId);
  const diff = context?.diff || 5;
  const questions = QUESTIONS; // 8 questions for this prototype

  const [idx, setIdx] = aUseState(0);
  const [answers, setAnswers] = aUseState({});
  const [paused, setPaused] = aUseState(false);
  const [showSubmit, setShowSubmit] = aUseState(false);
  const [grading, setGrading] = aUseState(false);
  const arrivedIdx = useStreamingQueue(questions, speed);
  const startTime = aUseRef(Date.now());

  const totalMs = 18 * 60 * 1000; // 18 min
  const now = useNow(1000, !paused && !grading);
  const elapsed = now - startTime.current;
  const remaining = Math.max(0, totalMs - elapsed);

  const current = questions[idx];
  const ready = idx < arrivedIdx;

  function setAnswer(qid, val) { setAnswers(a => ({ ...a, [qid]: val })); }
  function goNext() {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else setShowSubmit(true);
  }
  function goPrev() { if (idx > 0) setIdx(idx - 1); }

  function submit() {
    setGrading(true);
    setTimeout(() => {
      setGrading(false);
      onExit('submitted');
    }, 3800);
  }

  return (
    <div className="focus-mode" style={{position:'fixed'}}>
      {/* watermark */}
      <div aria-hidden="true" className="attempt-watermark">
        <div className="wm-text">
          {Array.from({length:12}).map((_,r) => (
            <div key={r}>{'JAY · ACUMEN · 22 May 2026 14:32 · ATTEMPT a-7c19f · '.repeat(6)}</div>
          ))}
        </div>
      </div>

      {/* top bar */}
      <div className="attempt-topbar">
        <div className="inner">
          <button className="btn btn-ghost btn-sm" onClick={() => onExit('abandon')}>← Exit</button>
          <div className="t-meta meta-hide-sm">ATTEMPT</div>
          <div className="pill-name">{pill?.name}</div>
          <Pill tone="soft" mono>D{diff}</Pill>
          <span className="muted t-meta hide-mobile">8 questions · timed</span>

          <div className="spacer"/>

          {integrityVisible && <IntegrityBadge/>}

          <TimerPill remainingMs={remaining} paused={paused}/>

          <button className="btn btn-sm" onClick={() => setPaused(p => !p)}>
            {paused
              ? <><window.Icon name="arrowRight" size={12}/> Resume</>
              : <><window.Icon name="pause" size={12}/> Pause</>}
          </button>
        </div>

        {/* per-question progress dots */}
        <div style={{maxWidth:1280,margin:'0 auto',padding:'0 24px 12px',display:'flex',gap:6,alignItems:'center'}}>
          {questions.map((q, i) => {
            const arrived = i < arrivedIdx;
            const isCurrent = i === idx;
            const isAnswered = answers[q.id] !== undefined;
            return (
              <button key={q.id}
                onClick={() => arrived && setIdx(i)}
                style={{
                  flex: 1, height: 5, borderRadius: 999,
                  background: isCurrent ? 'var(--ink)' :
                              isAnswered ? 'var(--ok)' :
                              arrived ? 'var(--bg-deep)' :
                              'transparent',
                  border: !arrived ? '1px dashed var(--line-strong)' : 'none',
                  cursor: arrived ? 'pointer' : 'not-allowed',
                  position:'relative',overflow:'hidden',
                }}>
                {!arrived && (
                  <div style={{
                    position:'absolute',inset:0,
                    background:'linear-gradient(90deg, transparent, var(--ink-3), transparent)',
                    width:'40%', opacity:0.4,
                    animation: 'streaming-bar 1.4s linear infinite',
                  }}/>
                )}
              </button>
            );
          })}
          <span className="mono dim" style={{marginLeft:8,fontSize:11}}>
            {idx+1} / {questions.length}
          </span>
        </div>
      </div>

      {/* paused overlay */}
      {paused && (
        <div style={{position:'fixed',inset:0,zIndex:30,background:'color-mix(in oklab, var(--bg) 92%, transparent)',display:'grid',placeItems:'center'}}>
          <div className="card" style={{maxWidth:420,textAlign:'center',padding:'40px 32px'}}>
            <div className="serif-it" style={{fontSize:42,lineHeight:1,color:'var(--ink-3)'}}>paused</div>
            <div className="muted mt-4" style={{fontSize:13}}>
              Per AC-D11, question content is blanked while paused so the pause window isn't usable for lookup.
              Your timer is held.
            </div>
            <div className="mt-6">
              <button className="btn btn-primary" onClick={() => setPaused(false)}>
                Resume <span className="arrow">→</span>
              </button>
            </div>
            <div className="t-meta mt-4">28 of 30 pause minutes remaining today</div>
          </div>
        </div>
      )}

      {/* grading overlay */}
      {grading && <GradingOverlay/>}

      {/* main two-column: question (left) + JIT queue (right) */}
      <div className="attempt-body">
        <div>
          {ready ? (
            <QuestionView
              q={current}
              n={idx + 1}
              total={questions.length}
              answer={answers[current.id]}
              onAnswer={(v) => setAnswer(current.id, v)}
            />
          ) : (
            <QuestionSkeleton/>
          )}

          <div className="row gap-3 mt-6" style={{flexWrap:'wrap'}}>
            <button className="btn" onClick={goPrev} disabled={idx===0} style={{opacity:idx===0?0.4:1}}>
              ← Previous
            </button>
            <div className="spacer"/>
            <button className="btn btn-ghost btn-sm">
              <window.Icon name="flag" size={12}/> Flag as unrealistic
            </button>
            {idx < questions.length - 1 ? (
              <button className="btn btn-primary" onClick={goNext} disabled={!ready}>
                Next question <span className="arrow">→</span>
              </button>
            ) : (
              <button className="btn btn-accent" onClick={() => setShowSubmit(true)}>
                Submit attempt <span className="arrow">→</span>
              </button>
            )}
          </div>
        </div>

        <aside style={{position:'sticky',top:120,alignSelf:'start'}} className="hide-mobile">
          <JITQueue questions={questions} idx={idx} arrivedIdx={arrivedIdx} answers={answers} onPick={setIdx}/>
        </aside>
      </div>

      {/* submit confirm */}
      {showSubmit && (
        <div style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,.4)',display:'grid',placeItems:'center',padding:16}} onClick={() => setShowSubmit(false)}>
          <div className="card" style={{maxWidth:500,padding:32,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div className="eyebrow">Submit attempt</div>
            <h2 className="h-2 mt-2"><span className="serif-it">Ready to</span> hand this in?</h2>
            <div className="mt-4" style={{fontSize:13,color:'var(--ink-2)'}}>
              You've answered <strong>{Object.keys(answers).length}</strong> of {questions.length} questions.
              Once submitted, your AI-graded responses run through OpenAI cross-family review before your
              result is shown — usually 3–6 seconds.
            </div>
            <div className="row gap-2 mt-6">
              <button className="btn" onClick={() => setShowSubmit(false)}>Keep going</button>
              <div className="spacer"/>
              <button className="btn btn-primary" onClick={submit}>Submit <span className="arrow">→</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INTEGRITY BADGE — discreet, hover for detail
// ============================================================
function IntegrityBadge() {
  const [open, setOpen] = aUseState(false);
  return (
    <div style={{position:'relative'}} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      <button className="chip chip-soft" style={{cursor:'help'}}>
        <window.Icon name="shield" size={12}/>
        <span className="hide-mobile">Integrity</span>
      </button>
      {open && (
        <div style={{
          position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:30,
          background:'var(--bg-raised)',border:'1px solid var(--line)',
          borderRadius:'var(--r-2)',padding:14,width:300,
          boxShadow:'var(--shadow-2)',
        }}>
          <div className="eyebrow mb-2">What we're tracking</div>
          <ul style={{margin:0,paddingLeft:16,fontSize:12,lineHeight:1.6,color:'var(--ink-2)'}}>
            <li>Name + timestamp watermark on every page</li>
            <li>Tab focus and time-per-question</li>
            <li>Copy and paste are disabled</li>
            <li>Content is blanked while paused</li>
            <li>Responses checked against material you've been served</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TIMER
// ============================================================
function TimerPill({ remainingMs, paused }) {
  const totalSec = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const low = totalSec < 180;
  return (
    <div className="chip" style={{
      background: paused ? 'var(--bg-deep)' : low ? 'var(--danger-soft)' : 'var(--bg-deep)',
      color: paused ? 'var(--ink-3)' : low ? 'var(--danger)' : 'var(--ink)',
      fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,letterSpacing:'0.04em',
    }}>
      <window.Icon name="clock" size={11}/>
      {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      {paused && <span style={{opacity:.7,marginLeft:4,fontSize:10}}>HELD</span>}
    </div>
  );
}

// ============================================================
// JIT STREAMING QUEUE — the feature
// ============================================================
function JITQueue({ questions, idx, arrivedIdx, answers, onPick }) {
  const buffer = arrivedIdx - idx; // questions ahead and ready
  return (
    <div>
      <div className="row jc-b ai-c mb-3">
        <div className="eyebrow">Queue · AC-D25</div>
        <div className="t-meta">
          <span className="pulse-dot" style={{width:6,height:6,marginRight:6}}/>
          streaming
        </div>
      </div>

      <div className="card sunk tight" style={{padding:14,marginBottom:14}}>
        <div className="row jc-b ai-c mb-2">
          <span className="t-meta">BUFFER</span>
          <span className="mono" style={{fontSize:13,fontWeight:600,color:buffer < 2 ? 'var(--warn)' : 'var(--ink)'}}>
            {Math.max(0, buffer - 1)} ready
          </span>
        </div>
        <div style={{display:'flex',gap:2,marginBottom:8}}>
          {questions.map((_,i) => (
            <div key={i} style={{
              flex:1,height:3,borderRadius:1,
              background: i < arrivedIdx
                ? (i === idx ? 'var(--ink)' : i < idx ? 'var(--ok)' : 'var(--accent)')
                : 'var(--bg-deep)',
            }}/>
          ))}
        </div>
        <div className="t-meta">
          {arrivedIdx} of {questions.length} arrived · Q1 took 2.4s · others stream in parallel
        </div>
      </div>

      <div className="col gap-1">
        {questions.map((q, i) => {
          const state = i < idx ? 'done'
                      : i === idx ? 'current'
                      : i < arrivedIdx ? 'ready'
                      : 'generating';
          const answered = answers[q.id] !== undefined;
          return (
            <QueueItem key={q.id} q={q} i={i} state={state} answered={answered} onPick={() => state !== 'generating' && onPick(i)}/>
          );
        })}
      </div>
    </div>
  );
}

function QueueItem({ q, i, state, answered, onPick }) {
  const stateStyles = {
    done:       { bg:'transparent',     fg:'var(--ink-3)',   border:'var(--line)',     dot:'var(--ok)' },
    current:    { bg:'var(--bg-raised)',fg:'var(--ink)',     border:'var(--ink)',      dot:'var(--accent)' },
    ready:      { bg:'transparent',     fg:'var(--ink-2)',   border:'var(--line)',     dot:'var(--accent)' },
    generating: { bg:'transparent',     fg:'var(--ink-4)',   border:'dashed var(--line)', dot:'var(--ink-4)' },
  }[state];
  const label = {
    'multiple-choice':'MC','true-false':'T/F','matching':'Match','short-answer':'Short','scenario':'Scenario',
  }[q.type] || '';
  return (
    <button onClick={onPick} style={{
      display:'flex',gap:10,alignItems:'flex-start',
      padding:'10px 12px',
      background: stateStyles.bg,
      border: '1px solid ' + (state === 'current' ? 'var(--ink)' : 'var(--line)'),
      borderStyle: state === 'generating' ? 'dashed' : 'solid',
      borderRadius:'var(--r-2)',
      cursor: state === 'generating' ? 'not-allowed' : 'pointer',
      textAlign:'left', width:'100%', position:'relative', overflow:'hidden',
    }}>
      {state === 'generating' && (
        <div style={{
          position:'absolute',inset:0,
          background:'linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 12%, transparent), transparent)',
          width:'50%',
          animation:'streaming-bar 1.6s linear infinite',
        }}/>
      )}
      <span className="mono" style={{
        fontSize:10,width:20,color:stateStyles.fg,paddingTop:2,zIndex:1,
      }}>Q{String(i+1).padStart(2,'0')}</span>
      <span style={{flex:1,zIndex:1}}>
        <span style={{fontSize:12,fontWeight:state==='current'?600:500,color:stateStyles.fg}}>
          {state === 'generating' ? 'Generating…' : label}
        </span>
        {state !== 'generating' && (
          <div className="t-meta mt-2" style={{color:'var(--ink-3)'}}>
            {state === 'done' && (answered ? 'answered' : 'skipped')}
            {state === 'current' && 'in progress'}
            {state === 'ready' && 'ready'}
          </div>
        )}
        {state === 'generating' && (
          <div className="t-meta mt-2" style={{color:'var(--ink-4)'}}>
            asyncio.gather · pos {i+1}
          </div>
        )}
      </span>
      <span style={{
        width:8,height:8,borderRadius:'50%',
        background:stateStyles.dot,
        opacity: state === 'generating' ? 0.5 : 1,
        marginTop:6,zIndex:1,
        animation: state === 'generating' ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
      }}/>
    </button>
  );
}

// ============================================================
// QUESTION SKELETON
// ============================================================
function QuestionSkeleton() {
  return (
    <div style={{maxWidth:720}}>
      <div className="row gap-3 mb-4">
        <div className="skel" style={{width:60,height:14}}/>
        <div className="skel" style={{width:80,height:14}}/>
      </div>
      <div className="skel" style={{width:'90%',height:34,marginBottom:14}}/>
      <div className="skel" style={{width:'70%',height:34,marginBottom:30}}/>
      <div className="col gap-3">
        {[1,2,3,4].map(i => <div key={i} className="skel" style={{width:'100%',height:48}}/>)}
      </div>
    </div>
  );
}

// ============================================================
// QUESTION RENDERERS
// ============================================================
// Inline figure marker: prompt may contain "[fig:N]" tokens; we split
// the prompt on those and inject an inline figure between fragments.
function renderPromptWithInlineFigures(html, inlineImages) {
  if (!inlineImages || inlineImages.length === 0) {
    return <span dangerouslySetInnerHTML={{__html: html}}/>;
  }
  // Split on [fig:N] markers preserving the indices.
  const parts = [];
  const re = /\[fig:(\d+)\]/g;
  let last = 0, m;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) parts.push({ kind: 'html', html: html.slice(last, m.index) });
    parts.push({ kind: 'fig', n: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ kind: 'html', html: html.slice(last) });
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === 'html') return <span key={i} dangerouslySetInnerHTML={{__html: part.html}}/>;
        const fig = inlineImages[part.n - 1];
        if (!fig) return null;
        return <window.InlineFigure key={i} {...fig} number={part.n}/>;
      })}
    </>
  );
}

function QuestionView({ q, n, total, answer, onAnswer }) {
  const I = window.Icon;
  const Figure = window.Figure;
  const ChoiceFigure = window.ChoiceFigure;
  const imageOnly = q.layout === 'image-only';

  return (
    <div style={{maxWidth:720,width:'100%',minWidth:0}}>
      <div className="row gap-3 mb-4" style={{flexWrap:'wrap'}}>
        <span className="t-meta">QUESTION {n} OF {total}</span>
        <span className="t-meta">·</span>
        <span className="t-meta" style={{textTransform:'uppercase'}}>
          {{
            'multiple-choice':'Multiple choice',
            'true-false':'True / false',
            'matching':'Matching',
            'short-answer':'Short answer · AI graded',
            'scenario':'Scenario · AI graded',
          }[q.type]}
        </span>
      </div>

      {q.referenceImage && (
        <Figure variant="reference" ratio={q.referenceImage.ratio || '16x9'} {...q.referenceImage}/>
      )}

      <h2 className="serif q-prompt">
        {renderPromptWithInlineFigures(q.prompt, q.inlineImages)}
      </h2>

      {q.type === 'multiple-choice' && (
        <div className={imageOnly ? 'mcq-grid' : 'mcq-list'}>
          {q.options.map(opt => {
            const hasImage = opt.image || opt.imageSrc;
            const layout = imageOnly ? 'image-only' : (hasImage ? 'split' : 'text-only');
            return (
              <button
                key={opt.id}
                className="mcq-opt"
                data-selected={answer === opt.id}
                data-layout={layout}
                onClick={() => onAnswer(opt.id)}
              >
                {imageOnly && hasImage && (
                  <div className="opt-figure">
                    <ChoiceFigure
                      src={opt.imageSrc}
                      placeholder={opt.placeholder}
                      seed={opt.id + (opt.placeholder || '')}
                      captionLabel={`OPTION ${opt.id}`}
                    />
                  </div>
                )}
                {imageOnly ? (
                  <div className="opt-row">
                    <span className="opt-letter">{opt.id}</span>
                    <span className="opt-body">{opt.text}</span>
                  </div>
                ) : (
                  <>
                    <span className="opt-letter">{opt.id}</span>
                    {hasImage && (
                      <div className="opt-figure">
                        <ChoiceFigure
                          src={opt.imageSrc}
                          placeholder={opt.placeholder}
                          seed={opt.id + (opt.placeholder || '')}
                          captionLabel={`OPT. ${opt.id}`}
                        />
                      </div>
                    )}
                    <span className="opt-body">{opt.text}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'true-false' && (
        <div className="row gap-3">
          {['true','false'].map(v => (
            <button key={v} onClick={() => onAnswer(v)} style={{
              flex:1,padding:'22px',textAlign:'center',
              background: answer === v ? 'var(--ink)' : 'var(--bg-raised)',
              color: answer === v ? 'var(--bg-raised)' : 'var(--ink)',
              border:'1px solid ' + (answer === v ? 'var(--ink)' : 'var(--line)'),
              borderRadius:'var(--r-2)',
              fontFamily:'var(--font-serif)',fontSize:22,
              textTransform:'capitalize',
            }}>{v}</button>
          ))}
        </div>
      )}

      {q.type === 'matching' && (
        <MatchingQ q={q} answer={answer} onAnswer={onAnswer}/>
      )}

      {(q.type === 'short-answer' || q.type === 'scenario') && (
        <div>
          <textarea
            className="input"
            placeholder="Type your answer…"
            value={answer || ''}
            onChange={e => onAnswer(e.target.value)}
            style={{minHeight: q.type === 'scenario' ? 220 : 140, fontFamily:'var(--font-serif)', fontSize:16, lineHeight:1.6}}/>
          <div className="row jc-b mt-3">
            <div className="t-meta">
              <I name="sparkles" size={11}/> AI graded · expected ~{q.expectedSeconds}s · then reviewed cross-family
            </div>
            <div className="t-meta mono">{(answer || '').length} chars</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchingQ({ q, answer, onAnswer }) {
  // answer is a map of leftIdx -> rightIdx
  const a = answer || {};
  const rightOptions = q.pairs.map((p,i) => ({i, text: p.right}));
  // shuffle right side deterministically
  const shuffled = [...rightOptions].sort((x,y) => ((x.text.length * 13 + 7) % 7) - ((y.text.length * 13 + 7) % 7));

  return (
    <div className="col gap-3">
      {q.pairs.map((p, leftI) => (
        <div key={leftI} className="row gap-3 ai-c">
          <div style={{
            flex:'0 0 200px',padding:'12px 16px',
            background:'var(--bg-deep)',borderRadius:'var(--r-2)',
            fontFamily:'var(--font-serif)',fontSize:18,
          }}>{p.left}</div>
          <span className="serif-rule">↔</span>
          <select className="input" value={a[leftI] ?? ''} onChange={e => onAnswer({...a, [leftI]: e.target.value})} style={{flex:1}}>
            <option value="">Choose a match…</option>
            {shuffled.map(r => (
              <option key={r.i} value={r.i}>{r.text}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// GRADING OVERLAY — cross-family review made visible
// ============================================================
function GradingOverlay() {
  const [phase, setPhase] = aUseState(0);
  aUseEffect(() => {
    const steps = [600, 1400, 2400, 3200];
    const timers = steps.map((t,i) => setTimeout(() => setPhase(i+1), t));
    return () => timers.forEach(clearTimeout);
  }, []);

  const phases = [
    { label:'Auto-grading deterministic responses', sub:'5 of 8 questions · MCQ + T/F + matching' },
    { label:'AI grading short-answer responses',     sub:'3 of 8 · claude-sonnet-4-5' },
    { label:'Cross-family review pass',             sub:'OpenAI gpt-4o-mini · 60s ceiling per AC-D19' },
    { label:'Computing competence + queueing loop', sub:'recency-weighted per AC-D9' },
  ];

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,background:'color-mix(in oklab, var(--bg) 94%, transparent)',display:'grid',placeItems:'center',backdropFilter:'blur(6px)'}}>
      <div style={{maxWidth:480,textAlign:'center',padding:32}}>
        <div className="serif-it" style={{fontSize:42,lineHeight:1,color:'var(--ink-3)',marginBottom:32}}>
          checking your answers…
        </div>
        <div className="col gap-3" style={{textAlign:'left'}}>
          {phases.map((p, i) => (
            <div key={i} className="row gap-3 ai-c" style={{opacity: i <= phase ? 1 : 0.35}}>
              <div style={{width:20,display:'grid',placeItems:'center'}}>
                {i < phase ? (
                  <window.Icon name="check" size={14} style={{color:'var(--ok)'}}/>
                ) : i === phase ? (
                  <span className="pulse-dot"/>
                ) : (
                  <span style={{width:8,height:8,borderRadius:'50%',background:'var(--bg-deep)'}}/>
                )}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:i===phase?600:500}}>{p.label}</div>
                <div className="t-meta">{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AttemptScreen });
