import { useState, useEffect, useRef, useCallback } from "react";

const JUDGE_SERVER = "http://localhost:7474";

const SECTION_META = {
  A: { label: "UI / UX STRUCTURE",       color: "#00d4ff" },
  B: { label: "BACKEND API",             color: "#ff6b35" },
  C: { label: "DATA ARCHITECTURE",       color: "#a8ff3e" },
  D: { label: "BLOOMBERG FEATURES",      color: "#ffcc00" },
  E: { label: "TESTING & QUALITY",       color: "#ff3e9d" },
  F: { label: "SECURITY & COMPLIANCE",   color: "#b44fff" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;600;700;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080a0c;--surf:#0d1117;--surf2:#111820;
  --border:#1c2230;--border2:#243040;
  --pass:#00ff87;--fail:#ff2d55;--warn:#ffcc00;--info:#00d4ff;
  --muted:#3d4f6b;--text:#c8d8f0;--dim:#556070;
  --mono:'Share Tech Mono','Courier New',monospace;
  --ui:'Barlow Condensed',sans-serif;
}
html,body,#root{height:100%;background:var(--bg);color:var(--text)}
body{font-family:var(--ui);font-size:14px;
  background:var(--bg);
  background-image:radial-gradient(ellipse at 20% 0%,rgba(0,212,255,.03) 0%,transparent 60%),
    radial-gradient(ellipse at 80% 100%,rgba(255,45,85,.03) 0%,transparent 60%);}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--surf)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.scanline{position:fixed;inset:0;pointer-events:none;z-index:9999;
  background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.07) 3px,rgba(0,0,0,.07) 4px)}
@keyframes pulse-pass{0%,100%{box-shadow:0 0 6px rgba(0,255,135,.4)}50%{box-shadow:0 0 18px rgba(0,255,135,.8)}}
@keyframes pulse-fail{0%,100%{box-shadow:0 0 6px rgba(255,45,85,.4)}50%{box-shadow:0 0 18px rgba(255,45,85,.8)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
`;

// ── SCORE RING ────────────────────────────────────────────────
function ScoreRing({ passed, total }) {
  const pct   = total > 0 ? passed / total : 0;
  const score = total > 0 ? Math.round(pct * 100) / 10 : 0;
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct >= 0.9 ? "var(--pass)" : pct >= 0.6 ? "var(--warn)" : "var(--fail)";
  return (
    <div style={{ position:"relative", width:88, height:88, flexShrink:0 }}>
      <svg width={88} height={88} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={44} cy={44} r={r} fill="none" stroke="var(--border)" strokeWidth={4}/>
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.8s ease" }}/>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center" }}>
        <div style={{ fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color,lineHeight:1 }}>
          {score.toFixed(1)}
        </div>
        <div style={{ fontFamily:"var(--mono)",fontSize:8,color:"var(--muted)",letterSpacing:1,marginTop:2 }}>
          /10
        </div>
      </div>
    </div>
  );
}

// ── GATE DOT ──────────────────────────────────────────────────
function GateDot({ gate, onClick, selected }) {
  const color = gate?.pass === true  ? "var(--pass)"
              : gate?.pass === false ? "var(--fail)"
              : "var(--muted)";
  const anim  = gate?.pass === true  ? "pulse-pass 2s infinite"
              : gate?.pass === false ? "pulse-fail 1.5s infinite"
              : "none";
  return (
    <div onClick={() => onClick(gate)} title={gate?.name}
      style={{ width:10, height:10, borderRadius:2, background:color,
               cursor:"pointer", animation:anim, flexShrink:0,
               outline: selected ? `2px solid ${color}` : "none", outlineOffset:2,
               transition:"transform .15s" }}
      onMouseEnter={e => e.target.style.transform="scale(1.6)"}
      onMouseLeave={e => e.target.style.transform="scale(1)"}
    />
  );
}

// ── SECTION PANEL ─────────────────────────────────────────────
function SectionPanel({ sid, gates, onSelect, selectedId }) {
  const meta = SECTION_META[sid];
  const arr  = Object.values(gates).filter(g => g.section === sid);
  const p = arr.filter(g => g.pass).length, t = arr.length;
  const pct = t > 0 ? p / t : 0, allPass = t > 0 && p === t;
  return (
    <div style={{ border:`1px solid ${allPass ? meta.color+"66" : "var(--border)"}`,
                  borderLeft:`3px solid ${meta.color}`, background:"var(--surf)",
                  padding:"10px 12px", borderRadius:3, transition:"border-color .3s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <span style={{ fontFamily:"var(--mono)",fontSize:11,letterSpacing:2,color:meta.color }}>[{sid}]</span>
        <span style={{ color:"var(--text)",fontWeight:700,fontSize:12,letterSpacing:1,flex:1 }}>{meta.label}</span>
        <span style={{ fontFamily:"var(--mono)",fontSize:11,
                       color:allPass?"var(--pass)":p>0?"var(--warn)":"var(--muted)" }}>
          {p}/{t}
        </span>
      </div>
      <div style={{ height:2,background:"var(--border)",borderRadius:1,marginBottom:7,overflow:"hidden" }}>
        <div style={{ height:"100%",background:meta.color,width:`${pct*100}%`,
                      transition:"width .5s ease",
                      boxShadow:allPass?`0 0 8px ${meta.color}`:"none" }}/>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
        {arr.map(g => (
          <GateDot key={g.id} gate={g} onClick={onSelect} selected={selectedId===g.id}/>
        ))}
      </div>
    </div>
  );
}

// ── TERMINAL LOG ──────────────────────────────────────────────
function TerminalLog({ lines, title }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  const lc = { error:"var(--fail)", pass:"var(--pass)", warn:"var(--warn)", info:"var(--info)" };
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"5px 12px", borderBottom:"1px solid var(--border)",
                    fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)",
                    letterSpacing:2, background:"var(--surf)", flexShrink:0 }}>
        {title}
      </div>
      <div ref={ref} style={{ flex:1, overflowY:"auto", padding:"8px 12px",
                               fontFamily:"var(--mono)", fontSize:10.5, lineHeight:1.7,
                               background:"var(--bg)" }}>
        {lines.length === 0
          ? <div style={{color:"var(--muted)"}}>awaiting pytest output...</div>
          : lines.map((l,i) => (
              <div key={i} style={{ color:lc[l.level]||"var(--dim)", wordBreak:"break-all",
                                    animation:i===lines.length-1?"scanin .15s ease-out":"none" }}>
                {l.text}
              </div>
            ))}
      </div>
    </div>
  );
}

// ── GATE DETAIL ───────────────────────────────────────────────
function GateDetail({ gate }) {
  if (!gate) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",
                  flexDirection:"column",gap:12,color:"var(--muted)" }}>
      <div style={{ fontSize:36 }}>◈</div>
      <div style={{ fontFamily:"var(--mono)",fontSize:11,letterSpacing:2 }}>SELECT A GATE DOT</div>
      <div style={{ fontFamily:"var(--mono)",fontSize:9,color:"var(--border2)" }}>
        click any dot in the section panels
      </div>
    </div>
  );
  const meta   = SECTION_META[gate.section] || {};
  const sc     = gate.pass ? "var(--pass)" : "var(--fail)";
  return (
    <div style={{ height:"100%", overflowY:"auto", padding:16 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
        <span style={{ fontFamily:"var(--mono)",fontSize:10,letterSpacing:2,color:meta.color,
                       padding:"2px 8px",border:`1px solid ${meta.color}44` }}>
          {gate.section} / {gate.id}
        </span>
        <span style={{ fontFamily:"var(--mono)",fontSize:10,letterSpacing:2,color:sc,
                       padding:"2px 8px",border:`1px solid ${sc}55`,background:`${sc}11` }}>
          {gate.pass ? "▲ PASS" : "▼ FAIL"}
        </span>
      </div>
      <div style={{ fontSize:14,fontWeight:700,color:"var(--text)",letterSpacing:.3,marginBottom:14 }}>
        {gate.name}
      </div>

      {/* Proof */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:5 }}>PROOF</div>
        <div style={{ background:"var(--bg)",border:`1px solid var(--border)`,
                      borderLeft:`3px solid ${sc}`,padding:"10px 12px",
                      fontFamily:"var(--mono)",fontSize:11,color:gate.pass?"var(--pass)":"var(--text)",
                      lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word" }}>
          {gate.proof}
        </div>
      </div>

      {/* Evidence */}
      {gate.evidence && Object.keys(gate.evidence).length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:5 }}>EVIDENCE</div>
          <div style={{ background:"var(--bg)",border:"1px solid var(--border)",
                        padding:"10px 12px",fontFamily:"var(--mono)",fontSize:10,color:"var(--dim)",
                        whiteSpace:"pre-wrap",wordBreak:"break-all",lineHeight:1.6,
                        maxHeight:180,overflowY:"auto" }}>
            {JSON.stringify(gate.evidence, null, 2)}
          </div>
        </div>
      )}

      {/* Screenshot */}
      {gate.screenshot_b64 && (
        <div>
          <div style={{ fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:5 }}>
            PLAYWRIGHT SCREENSHOT (localhost:5100)
          </div>
          <img src={`data:image/png;base64,${gate.screenshot_b64}`} alt="frontend"
            style={{ width:"100%",border:"1px solid var(--border)",borderRadius:2,display:"block" }}/>
        </div>
      )}
    </div>
  );
}

// ── VERDICT PANEL ─────────────────────────────────────────────
function VerdictPanel({ verdict, artifactPath }) {
  if (!verdict) return null;
  const promote = verdict.can_promote_to_week2;
  const score   = verdict.score || 0;
  return (
    <div style={{ border:`1px solid ${promote?"var(--pass)":"var(--fail)"}`,
                  background:"var(--surf)", padding:16, borderRadius:3,
                  animation:"fadein .5s ease" }}>
      <div style={{ fontFamily:"var(--mono)",fontSize:9,letterSpacing:3,
                    color:promote?"var(--pass)":"var(--fail)",marginBottom:12 }}>
        ◈ devstral:latest VERDICT
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
        {[
          {l:"SCORE",   v:`${score}/10`, c:score>=8?"var(--pass)":score>=5?"var(--warn)":"var(--fail)"},
          {l:"W2 PROMO",v:promote?"GO":"NO-GO", c:promote?"var(--pass)":"var(--fail)"},
          {l:"MATURITY",v:`${verdict.trading_platform_maturity||"?"}/10`, c:"var(--info)"},
        ].map(m => (
          <div key={m.l} style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--muted)",letterSpacing:1,marginTop:2}}>{m.l}</div>
          </div>
        ))}
      </div>

      {verdict.honest_assessment && (
        <div style={{ background:"var(--bg)",borderLeft:"3px solid var(--warn)",
                      padding:"10px 12px",marginBottom:12,fontFamily:"var(--mono)",
                      fontSize:11,color:"var(--text)",lineHeight:1.7 }}>
          {verdict.honest_assessment}
        </div>
      )}

      {verdict.critical_path && (
        <div style={{ marginBottom:12 }}>
          <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:4}}>
            CRITICAL PATH
          </div>
          <div style={{color:"var(--warn)",fontFamily:"var(--mono)",fontSize:11,
                       padding:"7px 10px",border:"1px solid var(--border)",background:"var(--bg)"}}>
            ▶ {verdict.critical_path}
          </div>
        </div>
      )}

      {/* ClawWork artifact download */}
      {artifactPath && (
        <div style={{ marginBottom:12,padding:"10px 12px",background:"rgba(0,212,255,.05)",
                      border:"1px solid rgba(0,212,255,.2)",borderLeft:"3px solid var(--info)" }}>
          <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--info)",marginBottom:4}}>
            CLAWWORK ARTIFACT
          </div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--dim)",lineHeight:1.6}}>
            {artifactPath}
          </div>
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",marginTop:4}}>
            {`submit_work(work_output="W1 judge done", artifact_file_paths=["${artifactPath}"])`}
          </div>
        </div>
      )}

      {verdict.blockers?.length > 0 && (
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--fail)",marginBottom:6}}>
            BLOCKERS ({verdict.blockers.length})
          </div>
          {verdict.blockers.slice(0,5).map((b,i) => (
            <div key={i} style={{display:"flex",gap:8,padding:"5px 0",
                                  borderBottom:"1px solid var(--border)",
                                  fontFamily:"var(--mono)",fontSize:10,color:"var(--fail)"}}>
              <span style={{flexShrink:0}}>×</span><span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {verdict.priority_fixes?.length > 0 && (
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:6}}>
            PRIORITY FIXES
          </div>
          {verdict.priority_fixes.slice(0,6).map((fix,i) => (
            <div key={i} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,
                                  alignItems:"center",padding:"6px 8px",background:"var(--bg)",
                                  border:"1px solid var(--border)",marginBottom:3,
                                  fontFamily:"var(--mono)",fontSize:10}}>
              <span style={{color:"var(--warn)",fontWeight:700}}>{i+1}</span>
              <span>
                <span style={{color:"var(--info)"}}>[{fix.gate}]</span>
                {" "}<span style={{color:"var(--text)"}}>{fix.action}</span>
              </span>
              <span style={{color:"var(--muted)"}}>~{fix.hours}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SERVICE DOTS ──────────────────────────────────────────────
function ServiceDot({ name, info }) {
  const color = !info ? "var(--muted)" : info.running ? "var(--pass)" : "var(--fail)";
  const label = { backend:"API :8000", frontend:"UI :5100", venv_python:"venv", sqlite_db:"SQLite" }[name] || name;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:4,
                  fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)" }}>
      <div style={{ width:6,height:6,borderRadius:"50%",background:color,
                    boxShadow:info?.running?`0 0 6px ${color}`:"none" }}/>
      {label}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function App() {
  const [status,       setStatus]       = useState("idle"); // idle|running|done
  const [gates,        setGates]        = useState({});
  const [services,     setServices]     = useState({});
  const [pytestLines,  setPytestLines]  = useState([]);
  const [pytestSum,    setPytestSum]    = useState(null);
  const [pwResult,     setPwResult]     = useState(null);
  const [verdict,      setVerdict]      = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [phase,        setPhase]        = useState("idle");
  const [meta,         setMeta]         = useState(null);
  const [artifactPath, setArtifactPath] = useState(null);
  const evtRef = useRef(null);

  const gateList = Object.values(gates);
  const passed   = gateList.filter(g => g.pass).length;
  const total    = gateList.length;

  const start = useCallback(() => {
    if (evtRef.current) evtRef.current.close();
    setStatus("running"); setGates({}); setServices({});
    setPytestLines([]); setPytestSum(null); setPwResult(null);
    setVerdict(null); setMeta(null); setArtifactPath(null);
    setPhase("preflight");

    const es = new EventSource(`${JUDGE_SERVER}/api/judge/run`);
    evtRef.current = es;
    const on = (ev, fn) => es.addEventListener(ev, e => fn(JSON.parse(e.data)));

    on("start",          d => { setMeta(d); setPhase("gates"); });
    on("service_check",  d => setServices(p => ({...p, [d.service]: d})));
    on("gate_result",    d => setGates(p => ({...p, [d.id]: d})));
    on("playwright_start",() => setPhase("playwright"));
    on("playwright_done", d => { setPwResult(d); setPhase("pytest"); });
    on("pytest_start",   () => setPhase("pytest"));
    on("pytest_count",   d => setPytestLines(p => [...p,
      {text:`COLLECTED: ${d.count.toLocaleString()} backend tests`, level:"info"}]));
    on("pytest_line",    d => setPytestLines(p => [...p.slice(-600), {text:d.line,level:d.level}]));
    on("pytest_done",    d => setPytestSum(d));
    on("llm_start",      () => setPhase("llm"));
    on("llm_verdict",    d => setVerdict(d));
    on("artifact_written",d => { if (d.path) setArtifactPath(d.path); });
    on("done",           d => { setStatus("done"); setPhase("done"); setMeta(p => ({...p,...d})); });
    es.onerror = () => { setStatus("done"); setPhase("done"); es.close(); };
  }, []);

  // Sync selected gate with latest data
  useEffect(() => {
    if (selected && gates[selected.id]) setSelected(gates[selected.id]);
  }, [gates]);

  const phaseLabel = {
    idle:"AWAITING RUN", preflight:"◈ PRE-FLIGHT",
    gates:"◈ EVALUATING GATES", playwright:"◈ PLAYWRIGHT AUDIT",
    pytest:"◈ RUNNING PYTEST", llm:`◈ CONSULTING ${meta?.model||"devstral:latest"}`,
    done:"◈ COMPLETE",
  }[phase] || phase;

  const failedGates = gateList.filter(g => !g.pass);
  const passedGates = gateList.filter(g => g.pass);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:css}}/>
      <div className="scanline"/>

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        {/* HEADER */}
        <header style={{ borderBottom:"1px solid var(--border)",background:"var(--surf)",
                          padding:"0 20px",display:"flex",alignItems:"center",gap:16,
                          height:54,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:26,height:26,background:"var(--fail)",flexShrink:0,
                          clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
                          boxShadow:"0 0 12px rgba(255,45,85,.5)" }}/>
            <div>
              <div style={{ fontFamily:"var(--ui)",fontWeight:900,fontSize:15,letterSpacing:3 }}>
                APEX JUDGE
              </div>
              <div style={{ fontFamily:"var(--mono)",fontSize:8,color:"var(--muted)",letterSpacing:2 }}>
                W01 · TRADING TERMINAL · devstral:latest
              </div>
            </div>
          </div>

          <div style={{ flex:1 }}/>

          {/* Phase */}
          <div style={{ fontFamily:"var(--mono)",fontSize:10,letterSpacing:2,
                        color:phase==="done"?"var(--pass)":status==="running"?"var(--warn)":"var(--muted)",
                        display:"flex",alignItems:"center",gap:6 }}>
            {status==="running" && (
              <span style={{ display:"inline-block",width:8,height:8,
                             border:"2px solid currentColor",borderTopColor:"transparent",
                             borderRadius:"50%",animation:"spin .8s linear infinite" }}/>
            )}
            {phaseLabel}
          </div>

          {/* Service dots */}
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            {["backend","frontend","venv_python","sqlite_db"].map(k => (
              <ServiceDot key={k} name={k} info={services[k]}/>
            ))}
          </div>

          {/* RUN button */}
          <button onClick={start} disabled={status==="running"}
            style={{ fontFamily:"var(--mono)",fontWeight:700,fontSize:11,letterSpacing:3,
                     padding:"8px 20px",cursor:status==="running"?"not-allowed":"pointer",
                     background:status==="running"?"transparent":"var(--fail)",
                     color:status==="running"?"var(--muted)":"#fff",
                     border:`1px solid ${status==="running"?"var(--border)":"var(--fail)"}`,
                     borderRadius:2,transition:"all .2s",
                     boxShadow:status!=="running"?"0 0 12px rgba(255,45,85,.3)":"none" }}>
            {status==="running" ? "RUNNING..." : "▶ RUN JUDGE"}
          </button>
        </header>

        {/* MAIN GRID */}
        <div style={{ flex:1,display:"grid",gridTemplateColumns:"280px 1fr 360px",
                       minHeight:0,height:"calc(100vh - 54px)" }}>

          {/* LEFT: sections + score */}
          <div style={{ borderRight:"1px solid var(--border)",overflowY:"auto",
                         padding:"14px 12px",display:"flex",flexDirection:"column",gap:9 }}>
            {/* Score */}
            <div style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 14px",
                           border:"1px solid var(--border2)",background:"var(--surf)",marginBottom:4 }}>
              <ScoreRing passed={passed} total={total}/>
              <div>
                <div style={{ fontFamily:"var(--mono)",fontSize:24,fontWeight:700,lineHeight:1,
                               color:passed===total&&total>0?"var(--pass)":"var(--text)" }}>
                  {passed}<span style={{color:"var(--muted)",fontSize:14}}>/{total}</span>
                </div>
                <div style={{ fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",
                               letterSpacing:2,marginTop:3 }}>GATES PASS</div>
                <div style={{ fontFamily:"var(--mono)",fontSize:9,letterSpacing:1,marginTop:3,
                               color:passed===total&&total>0?"var(--pass)":"var(--fail)" }}>
                  {passed===total&&total>0 ? "▲ W2 READY" : "▼ W2 BLOCKED"}
                </div>
              </div>
            </div>

            {Object.keys(SECTION_META).map(sid => (
              <SectionPanel key={sid} sid={sid} gates={gates}
                onSelect={setSelected} selectedId={selected?.id}/>
            ))}

            {/* Pytest mini */}
            {pytestSum && (
              <div style={{ border:"1px solid var(--border)",background:"var(--surf)",
                             padding:"10px 12px",borderRadius:3 }}>
                <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:8}}>
                  PYTEST (phase1/venv/)
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[
                    {l:"PASS",  v:pytestSum.passed,  c:"var(--pass)"},
                    {l:"FAIL",  v:pytestSum.failed,  c:pytestSum.failed>0?"var(--fail)":"var(--pass)"},
                    {l:"SKIP",  v:pytestSum.skipped, c:pytestSum.skipped>0?"var(--warn)":"var(--pass)"},
                    {l:"COV",   v:`${pytestSum.coverage}%`, c:pytestSum.coverage>=70?"var(--pass)":"var(--fail)"},
                    {l:"BE",    v:pytestSum.count,   c:"var(--info)"},
                    {l:"TOTAL", v:pytestSum.total_suite_est||"?", c:"var(--muted)"},
                  ].map(m => (
                    <div key={m.l} style={{textAlign:"center"}}>
                      <div style={{fontFamily:"var(--mono)",fontSize:14,color:m.c}}>{m.v}</div>
                      <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--muted)",letterSpacing:1}}>{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playwright mini */}
            {pwResult && !pwResult.error && (
              <div style={{ border:"1px solid var(--border)",background:"var(--surf)",
                             padding:"10px 12px",borderRadius:3 }}>
                <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,color:"var(--muted)",marginBottom:8}}>
                  PLAYWRIGHT (localhost:5100)
                </div>
                <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text)",marginBottom:5,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {pwResult.title || "no title"}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {[
                    {l:"canvas",   v:pwResult.comps?.canvas > 0},
                    {l:"ctrl+k",   v:pwResult.paletteOpened},
                    {l:"no-errors",v:pwResult.consoleErrors?.length===0},
                    {l:"screenshot",v:pwResult.hasScreenshot},
                  ].map(m => (
                    <span key={m.l} style={{ fontFamily:"var(--mono)",fontSize:9,
                                             padding:"2px 6px",
                                             background:m.v?"rgba(0,255,135,.1)":"rgba(255,45,85,.1)",
                                             color:m.v?"var(--pass)":"var(--fail)",
                                             border:`1px solid ${m.v?"var(--pass)":"var(--fail)"}44` }}>
                      {m.l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CENTER: gate detail + log */}
          <div style={{ borderRight:"1px solid var(--border)",display:"grid",
                         gridTemplateRows:pytestLines.length>0?"1fr 220px":"1fr",
                         minHeight:0 }}>
            <GateDetail gate={selected}/>
            {pytestLines.length > 0 && (
              <div style={{ borderTop:"1px solid var(--border)",minHeight:0 }}>
                <TerminalLog lines={pytestLines}
                  title={`PYTEST OUTPUT · phase1/venv/ · ${pytestLines.length} lines`}/>
              </div>
            )}
          </div>

          {/* RIGHT: verdict + gates */}
          <div style={{ overflowY:"auto",padding:"14px 14px",display:"flex",flexDirection:"column",gap:11 }}>

            {verdict
              ? <VerdictPanel verdict={verdict} artifactPath={artifactPath}/>
              : (
                <div style={{ border:"1px solid var(--border)",padding:20,textAlign:"center",
                               color:"var(--muted)",fontFamily:"var(--mono)",fontSize:11 }}>
                  {phase==="llm" ? `⟳ CONSULTING devstral:latest...` : "LLM VERDICT PENDING"}
                </div>
              )
            }

            {/* Failed gates */}
            {failedGates.length > 0 && (
              <div>
                <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,
                              color:"var(--fail)",marginBottom:7}}>
                  FAILED GATES ({failedGates.length})
                </div>
                {failedGates.map(g => (
                  <div key={g.id} onClick={() => setSelected(g)}
                    style={{ cursor:"pointer",padding:"6px 10px",marginBottom:3,
                              border:`1px solid var(--border)`,
                              borderLeft:`3px solid ${selected?.id===g.id?"var(--fail)":"var(--border2)"}`,
                              background:selected?.id===g.id?"rgba(255,45,85,.04)":"var(--surf)",
                              transition:"all .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderLeftColor="var(--fail)"}
                    onMouseLeave={e=>{if(selected?.id!==g.id)e.currentTarget.style.borderLeftColor="var(--border2)";}}>
                    <div style={{display:"flex",gap:7,alignItems:"center"}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--fail)",flexShrink:0}}>{g.id}</span>
                      <span style={{fontSize:11,color:"var(--text)",lineHeight:1.3}}>{g.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Passed gates */}
            {passedGates.length > 0 && (
              <div>
                <div style={{fontFamily:"var(--mono)",fontSize:8,letterSpacing:2,
                              color:"var(--pass)",marginBottom:7}}>
                  PASSED ({passedGates.length})
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {passedGates.map(g => (
                    <div key={g.id} onClick={() => setSelected(g)}
                      style={{ fontFamily:"var(--mono)",fontSize:9,letterSpacing:1,
                                padding:"3px 8px",cursor:"pointer",
                                background:selected?.id===g.id?"rgba(0,255,135,.2)":"rgba(0,255,135,.07)",
                                color:"var(--pass)",border:"1px solid rgba(0,255,135,.2)",
                                transition:"all .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,255,135,.15)"}
                      onMouseLeave={e=>{if(selected?.id!==g.id)e.currentTarget.style.background="rgba(0,255,135,.07)";}}>
                      {g.id}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timing */}
            {meta?.elapsed_s && (
              <div style={{ fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",
                             textAlign:"right",marginTop:"auto",paddingTop:8,
                             borderTop:"1px solid var(--border)" }}>
                runtime: {meta.elapsed_s}s · {meta.model}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
