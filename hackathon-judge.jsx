import { useState, useRef, useEffect } from "react";

const JUDGE_SYSTEM_PROMPT = `You are VERDICT — an elite AI judging panel specifically calibrated for the **Elasticsearch Agent Builder Hackathon**.

1. VANCE (Elastic Architect): Focuses strictly on the Technical Execution (30%). Did they actually use Elastic Agent Builder? Is Elasticsearch implemented correctly (kNN, dense_vector, ES|QL, hybrid search)? Or did they just slap an API call on a basic RAG script?

2. ELENA (Product / VC): Focuses strictly on Potential Impact & Wow Factor (30%). Is this a real, tangible problem? Does it natively embed into workflows (Slack, IDEs, ticketing tools)? Did they show measurable impact (time saved, steps removed)?

3. MARCUS (DevRel): Focuses strictly on Demo & Social (40% total). Is the demo video clear and ~3 minutes? Did they explain their Agent Builder usage? Is the code public with an open-source license? Did they share it socially?

## RESEARCH STEPS — EXECUTE ALL OF THESE:

STEP 1 — Fetch the GitHub repo page directly. Also try fetching the raw README.
- Replace "github.com" with "raw.githubusercontent.com" in the URL, then append "/main/README.md"
- Verify the repository is Public and contains an OSI Open Source License.

STEP 2 — Research the idea space:
- Analyze if the project is a "multi-agent" system, an internal workflow automator, or a time-series/geo-aware agent.
- Search for existing products/companies doing the same thing.

## SCORING RULES:
- Be HARSH but ACCURATE. If you found real code, score it on quality, not just existence.
- The project **MUST** use Elastic Agent Builder and Elasticsearch. If it doesn't, Technical Execution is a 0.

## OUTPUT FORMAT — FOLLOW THIS EXACTLY:

---
## RESEARCH SUMMARY
[Detail everything found: repo files, README contents, Elasticsearch integration evidence, project impact. Be specific.]

---
## JUDGE VERDICTS

### VANCE (Technical Execution - 30%)
[Full paragraph evaluating Elastic Agent Builder, ES|QL, Search integrations, and code quality.]
VANCE SCORE: X/30

### ELENA (Potential Impact & Wow Factor - 30%)
[Full paragraph evaluating the problem addressed, novelty, and workflow integration.]
ELENA SCORE: X/30

### MARCUS (Demo & Social - 40%)
[Full paragraph evaluating the documentation, architecture diagram, video demo clarity, and social presence.]
MARCUS SCORE: X/40

---
## FINAL SCORECARD

SCORES:
- Technical Execution: X/30
- Impact & Wow Factor: X/30
- Demo: X/30
- Social: X/10
- TOTAL: XX/100

## SHOULD THEY WIN?
[Yes or No, then one honest paragraph explaining why this fits/fails the Elastic Agent Builder Hackathon.]

## WHAT MUST BE FIXED
1. [Specific, actionable issue regarding their Elastic implementation or problem scope]
2. [Specific, actionable issue]
---

Do NOT soften feedback. Be the judge you'd want if you actually needed honest feedback.`;

const CRITERIA = [
  { name: "Technical Execution", max: 30 },
  { name: "Impact & Wow Factor", max: 30 },
  { name: "Demo", max: 30 },
  { name: "Social", max: 10 }
];

function parseScores(text) {
  const scores = {};
  CRITERIA.forEach(c => {
    const esc = c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/, "\\s+");
    const patterns = [
      new RegExp(`(?:-)?\\s*${esc}\\s*:\\s*(\\d{1,2})\\s*/\\s*${c.max}`, "i"),
      new RegExp(`${esc}[^\\n|]{0,10}\\|\\s*(\\d{1,2})\\s*/\\s*${c.max}`, "i"),
      new RegExp(`${esc}[^\\n\\d]{0,30}\\b(\\d{1,2})\\s*/\\s*${c.max}`, "i"),
    ];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) {
        const val = parseInt(m[1]);
        if (val >= 0 && val <= c.max) { scores[c.name] = val; return; }
      }
    }
  });
  return scores;
}

function ScoreBar({ score, max }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((score / max) * 100), 150);
    return () => clearTimeout(t);
  }, [score, max]);
  const color = width >= 70 ? "#39d98a" : width >= 40 ? "#f5c842" : "#f0534a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: "#0e0e28", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 3, transition: "width 1.2s cubic-bezier(.16,1,.3,1)" }} />
      </div>
      <span style={{ color, fontFamily: "monospace", fontSize: 12, minWidth: 36, textAlign: "right" }}>{score}/{max}</span>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #1a1a4e", borderTop: "2px solid #5577ff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

const PHASES = [
  "Fetching GitHub repository...",
  "Reading code & README...",
  "Analyzing hackathon page...",
  "Searching team history...",
  "Researching competitors...",
  "Convening judges...",
  "Writing verdict...",
];

function renderMd(text) {
  const els = [];
  let k = 0;
  text.split("\n").forEach(line => {
    if (!line.trim()) { els.push(<div key={k++} style={{ height: 8 }} />); return; }
    if (line.startsWith("## ")) {
      els.push(<h2 key={k++} style={{ color: "#4455bb", fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", margin: "26px 0 10px", borderBottom: "1px solid #0e0e28", paddingBottom: 7 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      const n = line.slice(4);
      const col = n.includes("VANCE") ? "#4f8ef7" : n.includes("ELENA") ? "#39d98a" : n.includes("MARCUS") ? "#f0534a" : "#8899cc";
      els.push(<h3 key={k++} style={{ color: col, fontFamily: "'Space Mono',monospace", fontSize: 11, margin: "20px 0 7px", letterSpacing: 1 }}>{n}</h3>);
    } else if (line.startsWith("---")) {
      els.push(<hr key={k++} style={{ border: "none", borderTop: "1px solid #0e0e28", margin: "14px 0" }} />);
    } else if (/^\d+\./.test(line)) {
      const [num, ...rest] = line.split(/\.\s/);
      const content = rest.join(". ");
      els.push(<div key={k++} style={{ color: "#8898c8", fontSize: 13, lineHeight: 1.75, paddingLeft: 14, marginBottom: 4, display: "flex", gap: 10 }}>
        <span style={{ color: "#333377", fontFamily: "monospace", minWidth: 16 }}>{num}.</span>
        <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#b0badf">$1</strong>').replace(/`(.*?)`/g, '<code style="background:#0a0a1e;padding:1px 5px;border-radius:3px;color:#5de8b8;font-size:12px">$1</code>') }} />
      </div>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      els.push(<div key={k++} style={{ color: "#8898c8", fontSize: 13, lineHeight: 1.75, paddingLeft: 14, marginBottom: 3, display: "flex", gap: 10 }}>
        <span style={{ color: "#2a2a77" }}>›</span>
        <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#b0badf">$1</strong>').replace(/`(.*?)`/g, '<code style="background:#0a0a1e;padding:1px 5px;border-radius:3px;color:#5de8b8;font-size:12px">$1</code>') }} />
      </div>);
    } else {
      const isBold = line.startsWith("**") || /^[A-Z\s]+SCORE:/.test(line);
      els.push(<p key={k++} style={{ color: isBold ? "#b0badf" : "#8898c8", fontSize: 13, lineHeight: 1.8, margin: "4px 0", fontWeight: isBold ? 600 : 400 }}
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#c0caef">$1</strong>').replace(/`(.*?)`/g, '<code style="background:#0a0a1e;padding:1px 5px;border-radius:3px;color:#5de8b8;font-size:12px">$1</code>') }} />);
    }
  });
  return els;
}

export default function HackathonJudge() {
  const [githubUrl, setGithubUrl] = useState("");
  const [hackathonUrl, setHackathonUrl] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(-1);
  const resultRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth" });
  }, [result]);

  const judge = async () => {
    if (!githubUrl.trim() || !hackathonUrl.trim()) {
      setError("Both URLs are required.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    setPhase(0);

    let pi = 0;
    timerRef.current = setInterval(() => {
      pi = Math.min(pi + 1, PHASES.length - 1);
      setPhase(pi);
    }, 4500);

    try {
      const msg = `Evaluate this hackathon submission. IMPORTANT: Use web_search to directly fetch both URLs below — do not just rely on cached knowledge.

GitHub Repository: ${githubUrl}
Hackathon: ${hackathonUrl}
${projectDesc ? `Submitter says: "${projectDesc}"` : ""}

Required research:
1. Fetch the GitHub repo page directly to see what's in it
2. Try fetching the raw README: convert the URL to raw.githubusercontent.com format + /main/README.md
3. Fetch the hackathon page to see theme, criteria, and prize structure
4. Search for this GitHub user's other projects and Devpost history
5. Search for similar/competing products that already exist

Give your complete brutal verdict in the required format.`;

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: JUDGE_SYSTEM_PROMPT,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: msg }],
        }),
      });

      clearInterval(timerRef.current);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error?.message || `HTTP ${r.status}`);
      }
      const d = await r.json();
      const text = d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      setResult(text);
    } catch (e) {
      clearInterval(timerRef.current);
      setError(e.message);
    } finally {
      setLoading(false);
      setPhase(-1);
    }
  };

  const scores = result ? parseScores(result) : {};
  const filled = CRITERIA.filter(c => c.name in scores);
  const total = filled.reduce((a, c) => a + scores[c.name], 0);
  const maxP = filled.reduce((a, c) => a + c.max, 0);
  const pct = maxP > 0 ? (total / maxP) * 100 : 0;
  const vColor = pct >= 80 ? "#39d98a" : pct >= 60 ? "#f5c842" : pct >= 40 ? "#f59542" : "#f0534a";
  const vLabel = pct >= 80 ? "EXCEPTIONAL" : pct >= 60 ? "SOLID SUBMISSION" : pct >= 40 ? "NEEDS WORK" : "BACK TO DRAWING BOARD";

  return (
    <div style={{ minHeight: "100vh", background: "#02020c", color: "#c0c8f0", fontFamily: "'IBM Plex Sans',system-ui,sans-serif", padding: "40px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box}
        .f{background:#06060e;border:1px solid #111128;border-radius:6px;padding:11px 15px;color:#c0c8f0;font-size:13px;font-family:'IBM Plex Sans',system-ui;outline:none;transition:border-color .2s;width:100%}
        .f:focus{border-color:#252560}
        .f::placeholder{color:#1e1e48}
        .f:disabled{opacity:.5}
        .b{background:#080820;border:1px solid #1e1e6e;color:#5566dd;padding:12px 26px;font-size:11px;font-family:'Space Mono',monospace;letter-spacing:2px;cursor:pointer;border-radius:6px;text-transform:uppercase;transition:all .2s;display:flex;align-items:center;gap:8px}
        .b:hover:not(:disabled){background:#10104a;border-color:#4455cc;color:#8899ff}
        .b:disabled{opacity:.3;cursor:not-allowed}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#04040c}::-webkit-scrollbar-thumb{background:#111128;border-radius:2px}
      `}</style>

      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: 5, color: "#1c1c50", marginBottom: 12, textTransform: "uppercase" }}>Anthropic-Powered · Web Search Enabled</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 42, fontWeight: 700, background: "linear-gradient(135deg,#6677dd 0%,#4488ff 45%,#55ddaa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VERDICT</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: 5, color: "#181848", marginTop: 4 }}>ELASTICSEARCH AGENT BUILDER EDITION</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 22 }}>
            {[["TECH", "VANCE", "#4f8ef7", "Elastic Architect"], ["IMP", "ELENA", "#39d98a", "Product & Impact"], ["DEMO", "MARCUS", "#f0534a", "DevRel & Social"]].map(([label, name, color, role]) => (
              <div key={name} style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${color}12`, border: `1px solid ${color}28`, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono',monospace", fontSize: 9, color, letterSpacing: 1 }}>{label}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color, letterSpacing: 1 }}>{name}</div>
                <div style={{ fontSize: 10, color: "#1c1c50", marginTop: 2 }}>{role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div style={{ background: "#040410", border: "1px solid #0d0d26", borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: 3, color: "#1c1c50", marginBottom: 16, textTransform: "uppercase" }}>Submit for Judgment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: "#1c1c50", fontFamily: "'Space Mono',monospace", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>GitHub Repo URL *</div>
              <input className="f" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/username/project-name" disabled={loading} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#1c1c50", fontFamily: "'Space Mono',monospace", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>Hackathon URL *</div>
              <input className="f" value={hackathonUrl} onChange={e => setHackathonUrl(e.target.value)} placeholder="https://devpost.com/hackathons/... or dorahacks.io/..." disabled={loading} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#1c1c50", fontFamily: "'Space Mono',monospace", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>Your Pitch — optional</div>
              <textarea className="f" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} placeholder="One sentence: what does your project do and what problem does it solve?" rows={2} style={{ resize: "vertical" }} disabled={loading} />
            </div>

            {error && <div style={{ background: "#0d0205", border: "1px solid #330a0a", borderRadius: 5, padding: "9px 13px", color: "#cc5555", fontSize: 12, fontFamily: "monospace" }}>⚠ {error}</div>}

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
              <button className="b" onClick={judge} disabled={loading}>
                {loading ? <><Spinner /> Judging</> : "⚖ Render Verdict"}
              </button>
            </div>

            {loading && phase >= 0 && (
              <div style={{ background: "#030309", border: "1px solid #0d0d22", borderRadius: 7, padding: "11px 14px", marginTop: 4 }}>
                {PHASES.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", fontFamily: "'Space Mono',monospace", fontSize: 10, color: i < phase ? "#1c2a5a" : i === phase ? "#5566cc" : "#12122a" }}>
                    {i < phase ? <span style={{ color: "#1c3a5a" }}>✓</span> : i === phase ? <Spinner /> : <span>·</span>}
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div ref={resultRef}>
            {filled.length > 0 && (
              <div style={{ background: "#040410", border: `1px solid ${vColor}28`, borderRadius: 10, padding: 22, marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ textAlign: "center", minWidth: 96 }}>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, letterSpacing: 3, color: "#1c1c50", marginBottom: 6, textTransform: "uppercase" }}>Score</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 44, fontWeight: 700, color: vColor, lineHeight: 1 }}>{total}<span style={{ fontSize: 16, color: "#1a1a40", fontWeight: 400 }}>/{maxP}</span></div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: vColor, letterSpacing: 2.5, marginTop: 5, textTransform: "uppercase" }}>{vLabel}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                    {CRITERIA.map(c => c.name in scores ? (
                      <div key={c.name} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: "#2a2a60", fontFamily: "'Space Mono',monospace", textAlign: "right", letterSpacing: .5, textTransform: "uppercase" }}>{c.name}</span>
                        <ScoreBar score={scores[c.name]} max={c.max} />
                      </div>
                    ) : null)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: "#040410", border: "1px solid #0d0d26", borderRadius: 10, padding: 24 }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: 3, color: "#1c1c50", marginBottom: 16, textTransform: "uppercase" }}>Full Panel Verdict</div>
              {renderMd(result)}
            </div>

            <div style={{ textAlign: "center", marginTop: 18, fontFamily: "'Space Mono',monospace", fontSize: 8, color: "#111130", letterSpacing: 2 }}>VERDICT v2 · CLAUDE SONNET · ELASTICSEARCH ENABLED</div>
          </div>
        )}
      </div>
    </div>
  );
}
