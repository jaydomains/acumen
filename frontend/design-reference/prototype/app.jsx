// app.jsx — main App, router, tweaks wiring.

const { useState: appUseState, useEffect: appUseEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "role": "testee",
  "theme": "paper",
  "streamingSpeed": "realistic",
  "integrityVisible": true,
  "density": "comfortable",
  "constellationLabels": "selected",
  "v6Mock": "off"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRoleState] = appUseState(t.role || 'testee');
  const [route, setRoute] = appUseState(t.role === 'admin' ? 'ops' : 'dashboard');
  const [attemptCtx, setAttemptCtx] = appUseState(null); // when not null = focus attempt screen

  // sync role from tweak
  appUseEffect(() => {
    if (t.role !== role) {
      setRoleState(t.role);
      setRoute(t.role === 'admin' ? 'ops' : 'dashboard');
      setAttemptCtx(null);
    }
  }, [t.role]);

  // theme attr on root
  appUseEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme || 'paper');
  }, [t.theme]);

  function changeRole(r) {
    setTweak('role', r);
  }

  function startAttempt(ctx) {
    setAttemptCtx(ctx || { pill: 'antifouling', diff: 5 });
  }

  function exitAttempt(reason) {
    setAttemptCtx(null);
    if (reason === 'submitted') setRoute('results');
  }

  // v6 · FE-1 — unauth surfaces take over the whole viewport (no rail, no topbar)
  if (role === 'unauth') {
    return (
      <>
        <window.AuthFrame/>
        <AcumenTweaks t={t} setTweak={setTweak}/>
      </>
    );
  }

  // attempt focus mode takes over
  if (attemptCtx && role === 'testee') {
    return (
      <>
        <AttemptScreen
          context={attemptCtx}
          onExit={exitAttempt}
          speed={t.streamingSpeed}
          integrityVisible={t.integrityVisible}
        />
        <AcumenTweaks t={t} setTweak={setTweak}/>
      </>
    );
  }

  return (
    <div className="app">
      <Rail role={role} route={route} onRoute={setRoute}/>
      <main className="main">
        <TopBar role={role} route={route} onRole={changeRole} user="Jay V."/>

        {/* v6 mock router — overrides route body when active */}
        {t.v6Mock && t.v6Mock !== 'off' ? (
          <V6Router mock={t.v6Mock}/>
        ) : (
          <>
        {role === 'testee' && route === 'dashboard' && <TesteeDashboard onStartAttempt={startAttempt} onRoute={setRoute}/>}
        {role === 'testee' && route === 'catalogue' && <TesteeCatalogue onStartAttempt={startAttempt}/>}
        {role === 'testee' && route === 'attempt'   && <ResumePrompt onResume={() => startAttempt({pill:'antifouling',diff:5})}/>}
        {role === 'testee' && route === 'results'   && <TesteeResults onRoute={setRoute}/>}
        {role === 'testee' && route === 'profile'   && <TesteeProfile/>}
        {role === 'testee' && route === 'history'   && <TesteeHistory/>}

        {role === 'admin'  && route === 'ops'             && <AdminOps onRoute={setRoute}/>}
        {role === 'admin'  && route === 'review'          && <AdminReview/>}
        {role === 'admin'  && route === 'engagement'      && <AdminEngagement/>}
        {role === 'admin'  && route === 'catalogue-admin' && <AdminCatalogue/>}
        {role === 'admin'  && route === 'users'           && <AdminUsers/>}
        {role === 'admin'  && route === 'cost'            && <AdminCost/>}
        {role === 'admin'  && route === 'loop'            && <AdminLoops/>}
          </>
        )}
      </main>

      <AcumenTweaks t={t} setTweak={setTweak}/>
    </div>
  );
}

function V6Router({ mock }) {
  if (mock === 'boundaries')         return <window.BoundariesMock/>;
  if (mock === 'pill-detail')        return <window.PillDetailMock/>;
  if (mock === 'attempt-variants')   return <window.AttemptVariantsMock/>;
  if (mock === 'streaming-paused')   return <window.StreamingPausedMock/>;
  if (mock === 'results-additions')  return <window.ResultsAdditionsMock/>;
  if (mock === 'admin-ops')          return <window.AdminOpsMock/>;
  if (mock === 'admin-authoring')    return <window.AdminAuthoringMock/>;
  if (mock === 'admin-test')         return <window.AdminTestAuthoringMock/>;
  return (
    <div className="content">
      <window.PageHeader
        eyebrow="V6 PREVIEW"
        title={<><span className="serif-it">Unknown</span> mock: {mock}</>}
      />
    </div>
  );
}

function ResumePrompt({ onResume }) {
  return (
    <div className="content">
      <PageHeader
        eyebrow="In progress · Antifouling Systems · D5 · started 8 min ago"
        title={<><span className="serif-it">You have an</span> attempt to finish.</>}
        subtitle="3 of 8 answered. The remaining questions are still streaming in. Resume to enter focus mode."
      />
      <div className="row gap-2">
        <button className="btn btn-primary btn-lg" onClick={onResume}>Resume attempt <span className="arrow">→</span></button>
        <button className="btn btn-lg">Abandon</button>
      </div>
    </div>
  );
}

function AcumenTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Demo"/>
      <TweakRadio label="Role" value={t.role} options={['testee','admin','unauth']} onChange={v => setTweak('role', v)}/>
      <TweakSection label="Theme"/>
      <TweakRadio label="Theme" value={t.theme}
        options={[
          {value:'paper',  label:'Paper'},
          {value:'carbon', label:'Carbon'},
          {value:'steel',  label:'Steel'},
        ]}
        onChange={v => setTweak('theme', v)}/>
      <TweakSection label="Attempt flow"/>
      <TweakRadio label="JIT streaming speed" value={t.streamingSpeed}
        options={[
          {value:'instant',   label:'Instant'},
          {value:'realistic', label:'Realistic'},
          {value:'slow',      label:'Slow demo'},
        ]}
        onChange={v => setTweak('streamingSpeed', v)}/>
      <TweakToggle label="Integrity badge" value={t.integrityVisible} onChange={v => setTweak('integrityVisible', v)}/>
      <TweakSection label="v6 Mock preview"/>
      <TweakSelect label="Mock" value={t.v6Mock || 'off'}
        options={[
          {value:'off',                label:'— Live prototype —'},
          {value:'boundaries',         label:'FE-2 · Boundary pages'},
          {value:'pill-detail',        label:'FE-3 · Pill detail + safety'},
          {value:'attempt-variants',   label:'FE-4 · Benchmark + autosave'},
          {value:'streaming-paused',   label:'FE-5 · Paused states'},
          {value:'results-additions',  label:'FE-6 · Results additions'},
          {value:'admin-ops',          label:'FE-9 · Admin operations'},
          {value:'admin-authoring',    label:'FE-8 · Admin authoring (5 forms)'},
          {value:'admin-test',         label:'FE-8 · Test authoring (#20)'},
        ]}
        onChange={v => setTweak('v6Mock', v)}/>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
