import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const JUDGE_URL = "http://localhost:7474";

const WEEK_NAMES = {
  1:"Terminal shell refactor", 2:"Command palette v2", 3:"Market data pipeline",
  4:"Order management system", 5:"Risk engine v1", 6:"Portfolio analytics",
  7:"Research entity graph", 8:"Strategy config + backtest stub",
  9:"Alert & notification system", 10:"Account & auth hardening",
  11:"Performance & SLO dashboard", 12:"Accessibility & keyboard mastery",
  13:"Runbook & game-day hardening", 14:"[W14] Dataset snapshot baseline",
};

const SECTION_LABELS = {
  processes:"PROCESS CHECK", pytest:"PYTEST SUITE", vitest:"VITEST",
  http:"HTTP PROBES", idempotency:"IDEMPOTENCY", auth:"AUTH ENFORCEMENT",
  playwright:"PLAYWRIGHT UI", source:"SOURCE AUDIT", db:"DB SCHEMA",
  loc:"LOC COUNT", backtest_w14:"W14 BACKTEST", bloomberg:"BLOOMBERG PARITY",
  verdict:"LLM VERDICT",
};

const SECTION_ORDER = [
  "processes","pytest","vitest","http","idempotency","auth",
  "playwright","source","db","loc","backtest_w14","bloomberg","verdict"
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const passColor  = "#00ff88";
const failColor  = "#ff3355";
const runColor   = "#ffcc00";
const dimColor   = "#334";
const bgMain     = "#080b12";
const bgPanel    = "#0d1220";
const bgCard     = "#111827";
const borderCol  = "#1e293b";
const textPrimary= "#e2e8f0";
const textDim    = "#64748b";
const accentBlue = "#3b82f6";

function statusColor(s) {
  if (s === "PASS") return passColor;
  if (s === "FAIL") return failColor;
  if (s === "RUNNING") return runColor;
  return dimColor;
}

function ValuationMeter({ score }) {
  const pct = Math.min(score || 0, 100);
  // $1M is at 85%+, $500k at 60%, $100k at 35%
  let dollarVal = "$0";
  let meterColor = failColor;
  if (pct >= 85)      { dollarVal = "$1,000,000+"; meterColor = passColor; }
  else if (pct >= 70) { dollarVal = `$${Math.round((pct-70)/15 * 500 + 500)}K`; meterColor = "#f59e0b"; }
  else if (pct >= 50) { dollarVal = `$${Math.round((pct-50)/20 * 400 + 100)}K`; meterColor = "#f97316"; }
  else if (pct >= 30) { dollarVal = `$${Math.round((pct-30)/20 * 100)}K`; meterColor = failColor; }

  const radius = 70; const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <svg width={180} height={180} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={90} cy={90} r={radius} fill="none" stroke="#1e293b" strokeWidth={12}/>
        <circle cx={90} cy={90} r={radius} fill="none" stroke={meterColor} strokeWidth={12}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 1s ease, stroke 0.5s ease", filter:`drop-shadow(0 0 8px ${meterColor})` }}/>
      </svg>
      <div style={{ marginTop:-150, marginBottom:70, textAlign:"center" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:textDim, letterSpacing:2 }}>SCORE</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, color:textPrimary, fontWeight:700, lineHeight:1.1 }}>{pct}%</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:meterColor, fontWeight:700, letterSpacing:1, marginTop:2 }}>{dollarVal}</div>
      </div>
    </div>
  );
}

function GateDot({ pass, label, value, threshold }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position:"relative", display:"flex", alignItems:"flex-start", gap:8, padding:"5px 0",
               cursor:"default", borderBottom:`1px solid ${borderCol}` }}>
      <span style={{ width:10, height:10, borderRadius:"50%", marginTop:3, flexShrink:0,
        background: pass === undefined ? dimColor : pass ? passColor : failColor,
        boxShadow: pass === true ? `0 0 6px ${passColor}` : pass === false ? `0 0 6px ${failColor}` : "none",
      }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: pass ? passColor : pass === false ? failColor : textDim,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {label}
        </div>
        {hover && (
          <div style={{ position:"absolute", left:20, top:-4, zIndex:99, background:"#1e293b",
                        border:`1px solid ${accentBlue}`, borderRadius:6, padding:"8px 12px",
                        fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:textPrimary,
                        whiteSpace:"nowrap", boxShadow:"0 8px 32px rgba(0,0,0,0.8)", minWidth:200 }}>
            <div style={{ color:textDim, marginBottom:4 }}>VALUE</div>
            <div style={{ color:textPrimary, marginBottom:6 }}>{String(value)}</div>
            <div style={{ color:textDim, marginBottom:4 }}>THRESHOLD</div>
            <div style={{ color:accentBlue }}>{threshold}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionPanel({ name, data, isActive, onClick }) {
  const label = SECTION_LABELS[name] || name.toUpperCase();
  const gates = data?.gates || {};
  const gateList = Object.entries(gates);
  const passCount = gateList.filter(([,g]) => g.pass).length;
  const total = gateList.length;
  const allPass = total > 0 && passCount === total;
  const anyFail = gateList.some(([,g]) => g.pass === false);
  const isRunning = data?.running;

  const headerColor = isRunning ? runColor : allPass ? passColor : anyFail ? failColor : textDim;

  return (
    <div onClick={onClick} style={{
      background: isActive ? "#131c2e" : bgCard,
      border: `1px solid ${isActive ? accentBlue : borderCol}`,
      borderRadius:8, padding:"10px 12px", cursor:"pointer",
      transition:"all 0.15s ease",
      boxShadow: isActive ? `0 0 16px rgba(59,130,246,0.15)` : "none",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isActive ? 8 : 0 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:2,
                       color:headerColor, fontWeight:700 }}>
          {isRunning ? "⟳ " : ""}{label}
        </span>
        {total > 0 && (
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                         color: allPass ? passColor : anyFail ? failColor : textDim,
                         background: allPass ? "rgba(0,255,136,0.1)" : anyFail ? "rgba(255,51,85,0.1)" : "rgba(100,116,139,0.1)",
                         padding:"2px 6px", borderRadius:3 }}>
            {passCount}/{total}
          </span>
        )}
      </div>
      {isActive && gateList.length > 0 && (
        <div style={{ marginTop:4 }}>
          {gateList.map(([k, g]) => (
            <GateDot key={k} label={k} pass={g.pass} value={g.value} threshold={g.threshold}/>
          ))}
        </div>
      )}
      {isActive && data?.error && (
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:failColor, marginTop:6 }}>
          ERROR: {data.error}
        </div>
      )}
    </div>
  );
}

function TerminalLog({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      background:"#050810", border:`1px solid ${borderCol}`, borderRadius:8,
      padding:"12px 14px", height:260, overflowY:"auto",
      fontFamily:"'JetBrains Mono',monospace", fontSize:11, lineHeight:1.6,
    }}>
      {logs.length === 0 && (
        <div style={{ color:textDim }}>Awaiting judge execution...</div>
      )}
      {logs.map((log, i) => (
        <div key={i} style={{ color: log.status === "PASS" ? passColor : log.status === "FAIL" ? failColor :
                                      log.status === "RUNNING" ? runColor : textPrimary, marginBottom:1 }}>
          <span style={{ color:textDim }}>[{new Date(log.ts).toISOString().slice(11,19)}] </span>
          <span style={{ color:textDim }}>{log.gate?.padEnd(28,' ')} </span>
          <span>{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function WeekBadge({ week, current }) {
  const isBT = week === 14;
  return (
    <div style={{
      background: week === current ? "#1e293b" : "transparent",
      border: `1px solid ${week === current ? accentBlue : borderCol}`,
      borderRadius:4, padding:"3px 8px", cursor:"default",
      fontFamily:"'JetBrains Mono',monospace", fontSize:10,
      color: isBT ? accentBlue : week === current ? textPrimary : textDim,
      letterSpacing:1, transition:"all 0.15s",
      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:160
    }}>
      {isBT ? "W14↗ " : `W${String(week).padStart(2,"0")} `}
      <span style={{ color:textDim }}>{WEEK_NAMES[week]?.slice(0,20)}</span>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function NuclearJudge() {
  const [running, setRunning]         = useState(false);
  const [done, setDone]               = useState(false);
  const [logs, setLogs]               = useState([]);
  const [evidence, setEvidence]       = useState({});
  const [activeSection, setActive]    = useState(null);
  const [score, setScore]             = useState(null);
  const [verdictText, setVerdictText] = useState("");
  const [activeWeek, setActiveWeek]   = useState(1);
  const eventSourceRef = useRef(null);

  const addLog = useCallback((log) => {
    setLogs(prev => [...prev.slice(-200), log]);
  }, []);

  const startJudge = useCallback(() => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setLogs([]);
    setEvidence({});
    setScore(null);
    setVerdictText("");

    const es = new EventSource(`${JUDGE_URL}/judge/run`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "gate") {
          addLog(data);
          // Update evidence section status
          const section = data.gate?.split(":")?.[0]?.toLowerCase().replace(/[^a-z_]/g,"_");
          if (section) {
            setEvidence(prev => ({
              ...prev,
              [section]: { ...(prev[section] || {}), running: data.status === "RUNNING" }
            }));
          }
        } else if (data.type === "complete") {
          setScore(data.score_pct);
          setRunning(false);
          setDone(true);
          es.close();
          // Fetch full report
          fetch(`${JUDGE_URL}/judge/report`)
            .then(r => r.json())
            .then(report => {
              setEvidence(report);
              setVerdictText(report?.verdict?.verdict || "");
              setScore(report?.verdict?.score_pct || data.score_pct);
            });
        }
      } catch (_) {}
    };

    es.onerror = () => {
      setRunning(false);
      addLog({ type:"gate", status:"FAIL", gate:"SSE", message:"Connection failed — is judge_server_nuclear.py running on port 7474?", ts:Date.now() });
    };
  }, [running, addLog]);

  useEffect(() => () => eventSourceRef.current?.close(), []);

  // Compute per-section pass/fail
  const sectionStats = SECTION_ORDER.map(name => {
    const data = evidence[name] || {};
    const gates = data.gates || {};
    const gList = Object.values(gates);
    return { name, data, pass: gList.length > 0 && gList.every(g => g.pass),
             fail: gList.some(g => g.pass === false) };
  });

  const totalGates  = sectionStats.reduce((acc, s) => acc + Object.values(s.data?.gates||{}).length, 0);
  const passedGates = sectionStats.reduce((acc, s) => acc + Object.values(s.data?.gates||{}).filter(g => g.pass).length, 0);

  return (
    <div style={{ background:bgMain, minHeight:"100vh", color:textPrimary,
                  fontFamily:"'JetBrains Mono',monospace", display:"flex", flexDirection:"column" }}>
      {/* Inject fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Barlow+Condensed:wght@700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; height:4px; } 
        ::-webkit-scrollbar-track { background:#0d1220; }
        ::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
      `}</style>

      {/* HEADER */}
      <div style={{ background:"#080c18", borderBottom:`2px solid ${borderCol}`,
                    padding:"10px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:3, height:36, background: running ? runColor : done ? passColor : accentBlue,
                        boxShadow:`0 0 12px ${running ? runColor : done ? passColor : accentBlue}` }}/>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, letterSpacing:4,
                          color:textPrimary, fontWeight:900, lineHeight:1 }}>
              APEX TERMINAL — NUCLEAR JUDGE
            </div>
            <div style={{ fontSize:10, color:textDim, letterSpacing:3, marginTop:2 }}>
              W01-W13 FOUNDATION + W14 BACKTEST BASELINE · $1,000,000 VALUATION THRESHOLD
            </div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {running && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:runColor,
                             animation:"pulse 1s infinite", display:"inline-block" }}/>
              <span style={{ fontSize:11, color:runColor, letterSpacing:2 }}>EVALUATING</span>
            </div>
          )}
          {done && score !== null && (
            <div style={{ fontSize:11, color: score >= 70 ? passColor : failColor, letterSpacing:2,
                          fontWeight:700 }}>
              FINAL: {score}% {score >= 85 ? "— PROMOTE" : score >= 70 ? "— HOLD" : "— REJECT"}
            </div>
          )}
          <button onClick={startJudge} disabled={running} style={{
            background: running ? "#1e293b" : "#ff3355",
            border:"none", color:running ? textDim : "#fff",
            fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:3,
            fontWeight:700, padding:"10px 20px", borderRadius:4, cursor: running ? "not-allowed" : "pointer",
            textTransform:"uppercase", boxShadow: !running ? "0 0 20px rgba(255,51,85,0.4)" : "none",
            transition:"all 0.15s",
          }}>
            {running ? "⟳ RUNNING..." : "▶ EXECUTE JUDGE"}
          </button>
        </div>
      </div>

      {/* WEEK NAVIGATOR */}
      <div style={{ background:"#09111f", borderBottom:`1px solid ${borderCol}`,
                    padding:"8px 24px", display:"flex", gap:6, overflowX:"auto", flexWrap:"wrap" }}>
        {Object.keys(WEEK_NAMES).map(w => (
          <div key={w} onClick={() => setActiveWeek(Number(w))}>
            <WeekBadge week={Number(w)} current={activeWeek}/>
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"260px 1fr 320px",
                    gap:1, background:borderCol, overflow:"hidden" }}>

        {/* LEFT: Section panels */}
        <div style={{ background:bgMain, overflowY:"auto", padding:"14px 12px", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ fontSize:9, color:textDim, letterSpacing:3, marginBottom:6, padding:"0 2px" }}>EVALUATION SECTIONS</div>
          {sectionStats.map(({ name, data }) => (
            <SectionPanel key={name} name={name} data={data}
              isActive={activeSection === name}
              onClick={() => setActive(activeSection === name ? null : name)}/>
          ))}
        </div>

        {/* CENTER: Score + terminal + active section detail */}
        <div style={{ background:bgPanel, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Score row */}
          <div style={{ display:"flex", gap:1, borderBottom:`1px solid ${borderCol}`, background:bgMain }}>
            <div style={{ padding:"16px 24px", display:"flex", alignItems:"center", gap:32 }}>
              <ValuationMeter score={score ?? (running ? Math.round(passedGates/Math.max(totalGates,1)*100) : 0)}/>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ fontSize:9, color:textDim, letterSpacing:2 }}>GATES PASSED</div>
                  <div style={{ fontSize:28, fontWeight:700, color:passedGates > 0 ? passColor : textDim, lineHeight:1 }}>{passedGates}<span style={{ fontSize:14, color:textDim }}>/{totalGates}</span></div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:textDim, letterSpacing:2 }}>STATUS</div>
                  <div style={{ fontSize:13, fontWeight:700, letterSpacing:2,
                    color: running ? runColor : done ? (score >= 70 ? passColor : failColor) : textDim }}>
                    {running ? "EVALUATING" : done ? (score >= 85 ? "PROMOTE" : score >= 70 ? "HOLD" : "REJECT") : "IDLE"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:textDim, letterSpacing:2 }}>WEEK FOCUS</div>
                  <div style={{ fontSize:11, color:accentBlue }}>{WEEK_NAMES[activeWeek]}</div>
                </div>
              </div>
            </div>

            {/* Section breakdown */}
            <div style={{ flex:1, padding:"16px 20px", display:"flex", flexWrap:"wrap", gap:8, alignContent:"flex-start", overflowY:"auto" }}>
              {sectionStats.map(({ name, pass, fail, data }) => {
                const gates = Object.values(data?.gates||{});
                const p = gates.filter(g=>g.pass).length;
                const t = gates.length;
                return (
                  <div key={name} onClick={() => setActive(activeSection===name?null:name)}
                    style={{ background: activeSection===name ? "#131c2e" : bgCard,
                             border:`1px solid ${activeSection===name?accentBlue:fail?"rgba(255,51,85,0.3)":pass?"rgba(0,255,136,0.2)":borderCol}`,
                             borderRadius:6, padding:"6px 10px", cursor:"pointer", minWidth:120 }}>
                    <div style={{ fontSize:9, letterSpacing:2, color: fail?failColor:pass?passColor:textDim }}>
                      {SECTION_LABELS[name]||name.toUpperCase()}
                    </div>
                    {t > 0 && <div style={{ fontSize:16, fontWeight:700, marginTop:2,
                                  color: p===t?passColor:p>0?"#f59e0b":failColor }}>
                      {p}/{t}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal log */}
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${borderCol}` }}>
            <div style={{ fontSize:9, color:textDim, letterSpacing:3, marginBottom:8 }}>EXECUTION LOG</div>
            <TerminalLog logs={logs}/>
          </div>

          {/* Active section detail */}
          {activeSection && evidence[activeSection] && (
            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
              <div style={{ fontSize:9, color:textDim, letterSpacing:3, marginBottom:10 }}>
                SECTION DETAIL: {SECTION_LABELS[activeSection]||activeSection.toUpperCase()}
              </div>
              {/* Missing components */}
              {evidence[activeSection]?.missing_components?.length > 0 && (
                <div style={{ background:"rgba(255,51,85,0.08)", border:`1px solid rgba(255,51,85,0.3)`,
                               borderRadius:6, padding:"10px 12px", marginBottom:10 }}>
                  <div style={{ fontSize:10, color:failColor, letterSpacing:2, marginBottom:6 }}>MISSING COMPONENTS</div>
                  {evidence[activeSection].missing_components.map(c => (
                    <div key={c} style={{ fontSize:11, color:"#ff7799", paddingLeft:8 }}>✗ {c}</div>
                  ))}
                </div>
              )}
              {/* HTTP endpoint details */}
              {evidence[activeSection]?.endpoints && (
                <div>
                  {Object.entries(evidence[activeSection].endpoints).map(([ep, d]) => (
                    <div key={ep} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0",
                                           borderBottom:`1px solid ${borderCol}`,
                                           fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>
                      <span style={{ color:textDim }}>{ep}</span>
                      <span style={{ color: d.slo_pass ? passColor : failColor }}>
                        HTTP {d.status_code} · p95 {d.p95_ms}ms
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Raw JSON */}
              <details style={{ marginTop:10 }}>
                <summary style={{ fontSize:9, color:textDim, letterSpacing:2, cursor:"pointer" }}>RAW EVIDENCE JSON</summary>
                <pre style={{ fontSize:10, color:textDim, background:"#050810", padding:12,
                               borderRadius:6, overflowX:"auto", marginTop:8, maxHeight:300, overflowY:"auto" }}>
                  {JSON.stringify(evidence[activeSection], null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* RIGHT: LLM verdict + gate failures */}
        <div style={{ background:bgMain, overflowY:"auto", padding:"14px 12px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Verdict */}
          <div>
            <div style={{ fontSize:9, color:textDim, letterSpacing:3, marginBottom:8 }}>DEVSTRAL VERDICT</div>
            <div style={{ background:"#050810", border:`1px solid ${verdictText ? accentBlue : borderCol}`,
                           borderRadius:8, padding:"12px 14px", minHeight:180, maxHeight:360, overflowY:"auto" }}>
              {verdictText ? (
                <div style={{ fontSize:11, lineHeight:1.7, color:textPrimary, whiteSpace:"pre-wrap" }}>
                  {verdictText}
                </div>
              ) : (
                <div style={{ fontSize:11, color:textDim }}>
                  {running ? "Waiting for LLM verdict..." : "Run judge to generate verdict"}
                </div>
              )}
            </div>
          </div>

          {/* Failed gates */}
          {totalGates > 0 && (
            <div>
              <div style={{ fontSize:9, color:failColor, letterSpacing:3, marginBottom:8 }}>
                FAILED GATES ({totalGates - passedGates})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {sectionStats.flatMap(({ name, data }) =>
                  Object.entries(data?.gates||{})
                    .filter(([,g]) => g.pass === false)
                    .map(([k, g]) => (
                      <div key={k} style={{ background:"rgba(255,51,85,0.07)",
                                             border:`1px solid rgba(255,51,85,0.25)`,
                                             borderRadius:4, padding:"6px 10px" }}>
                        <div style={{ fontSize:10, color:failColor, fontWeight:700 }}>{k}</div>
                        <div style={{ fontSize:9, color:textDim, marginTop:2 }}>
                          got: {String(g.value)} · need: {g.threshold}
                        </div>
                      </div>
                    ))
                )}
                {totalGates - passedGates === 0 && done && (
                  <div style={{ fontSize:11, color:passColor, textAlign:"center", padding:12 }}>
                    ✓ ALL GATES PASSED
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ClawWork export */}
          {done && (
            <div>
              <div style={{ fontSize:9, color:textDim, letterSpacing:3, marginBottom:8 }}>CLAWWORK EXPORT</div>
              <div style={{ background:bgCard, border:`1px solid ${borderCol}`, borderRadius:6, padding:"10px 12px", fontSize:10 }}>
                <div style={{ color:textDim, marginBottom:8 }}>submit_work() artifact ready:</div>
                <code style={{ color:accentBlue, fontSize:9 }}>w01_w14_judge_report/clawwork_artifact.md</code>
                <div style={{ color:textDim, fontSize:9, marginTop:8, lineHeight:1.5 }}>
                  Pass to ClawWork agent via submit_work() call to complete W01-W14 evaluation cycle.
                </div>
              </div>
            </div>
          )}

          {/* Passed gates */}
          {passedGates > 0 && (
            <div>
              <div style={{ fontSize:9, color:passColor, letterSpacing:3, marginBottom:8 }}>
                PASSED GATES ({passedGates})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:2, maxHeight:200, overflowY:"auto" }}>
                {sectionStats.flatMap(({ name, data }) =>
                  Object.entries(data?.gates||{})
                    .filter(([,g]) => g.pass === true)
                    .map(([k, g]) => (
                      <div key={k} style={{ display:"flex", justifyContent:"space-between",
                                             padding:"3px 8px", fontFamily:"'JetBrains Mono',monospace" }}>
                        <span style={{ fontSize:9, color:passColor }}>✓ {k}</span>
                        <span style={{ fontSize:9, color:textDim }}>{String(g.value)?.slice(0,20)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop:`1px solid ${borderCol}`, padding:"6px 24px",
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    background:"#080c18", fontSize:9, color:textDim, letterSpacing:2 }}>
        <span>APEX NUCLEAR JUDGE v3.0 · W01-W14 · MODEL: devstral:latest</span>
        <span>$1,000,000 VALUATION THRESHOLD · ZERO TOLERANCE FOR BROKEN AUTH OR MISSING TESTS</span>
        <span>{new Date().toISOString().slice(0,10)}</span>
      </div>
    </div>
  );
}
