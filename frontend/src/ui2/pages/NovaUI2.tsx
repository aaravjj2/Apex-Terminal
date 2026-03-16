/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Nova AI Hub  (live-wired to Amazon Nova via Bedrock)   │
 * │  Chat · Chart Vision · Voice · Agentic Research · Nova Act              │
 * │  Demo mode active by default; set NOVA_ENABLED=1 for live inference.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Nova from '../services/novaService';
import type { NovaStatus, ChatMessage, AgentResearchResponse, ActAutomateResponse, ChartAnalysisResponse, PatternSearchResponse } from '../services/novaService';

/* ── Design tokens ──────────────────────────────────────────────────────── */
const T = {
  bg0:'#0C0E12', bg1:'#131722', bg2:'#1E222D', bg3:'#2A2E39',
  bd:'#1E222D', bd2:'#2A2E39',
  tx0:'#FFF', tx1:'#D1D4DC', tx2:'#787B86', tx3:'#50535E',
  brand:'#2962FF', up:'#26A69A', dn:'#EF5350',
  warn:'#FF9800', info:'#42A5F5', purple:'#AB47BC',
  mono:"'JetBrains Mono','Fira Code',monospace",
  sans:"'Inter','Segoe UI',system-ui,sans-serif",
  r:'4px',
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const uid = () => Math.random().toString(36).slice(2, 9);

/* ── Sub-components ─────────────────────────────────────────────────────── */
function DemoBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span style={{ fontSize:'7px', background:'#FF980025', color:T.warn, border:`1px solid ${T.warn}40`,
      borderRadius:'3px', padding:'1px 5px', fontFamily:T.mono, fontWeight:700 }}>
      DEMO
    </span>
  );
}

function ModelPill({ model, demo }: { model: string; demo: boolean }) {
  return (
    <span style={{ fontSize:'7px', background:T.bg3, color: demo ? T.warn : T.up,
      borderRadius:'3px', padding:'1px 6px', fontFamily:T.mono }}>
      {demo ? 'demo-nova' : model}
    </span>
  );
}

function Spinner() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 400);
    return () => clearInterval(iv);
  }, []);
  return <span style={{ color:T.brand, fontFamily:T.mono }}>{dots}</span>;
}

function LatencyTag({ ms }: { ms: number }) {
  return <span style={{ fontSize:'6px', color:T.tx3, fontFamily:T.mono }}>{ms}ms</span>;
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 1 — CHAT
══════════════════════════════════════════════════════════════════════════ */
interface ConvMsg extends ChatMessage { id: string; ts: string; latency?: number; demo?: boolean; }

function ChatTab({ status }: { status: NovaStatus | null }) {
  const [history, setHistory] = useState<ConvMsg[]>([
    { id: uid(), role: 'assistant', content: "Hello! I'm Nova, your Amazon Nova–powered trading assistant. Ask me about chart patterns, portfolio risk, options strategies, or any market question.", ts: now(), demo: true },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [history]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ConvMsg = { id: uid(), role:'user', content:text, ts:now() };
    setHistory(h => [...h, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const apiHistory = [...history, userMsg].map(m => ({ role: m.role, content: m.content }));
      const resp = await Nova.chat(apiHistory, {
        systemPrompt: "You are Nova, an expert AI trading assistant in Apex Terminal. Be concise, data-driven, and cite specific numbers.",
      });
      setHistory(h => [...h, { id:uid(), role:'assistant', content:resp.reply, ts:now(), latency:resp.latency_ms, demo:resp.demo_mode }]);
    } catch (e) {
      setHistory(h => [...h, { id:uid(), role:'assistant', content:`Error: ${(e as Error).message}`, ts:now() }]);
    } finally { setLoading(false); }
  }, [input, loading, history]);

  const PROMPTS = ['Analyze my portfolio risk', 'NVDA options strategy for earnings', 'SPY market structure today', 'Best sectors in current regime', 'Explain iron condor Greeks'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Messages */}
      <div style={{ flex:1, overflow:'auto', padding:'10px' }}>
        {history.map(m => (
          <div key={m.id} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end':'flex-start', marginBottom:'8px' }}>
            <div style={{ maxWidth:'84%' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'2px', flexDirection: m.role==='user'?'row-reverse':'row' }}>
                <span style={{ fontSize:'7px', color:T.tx3 }}>{m.role==='user'?'You':'Nova'} · {m.ts}</span>
                {m.latency != null && <LatencyTag ms={m.latency} />}
                {m.demo && <DemoBadge visible />}
              </div>
              <div style={{ background: m.role==='user' ? T.brand : T.bg2,
                border: m.role==='user' ? 'none' : `1px solid ${T.bd}`,
                borderRadius:T.r, padding:'8px 10px',
                color:T.tx0, fontSize:'10px', lineHeight:1.55,
                whiteSpace:'pre-wrap', fontFamily:T.sans }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', marginBottom:'8px' }}>
            <div style={{ background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'8px 10px', fontSize:'10px', color:T.tx2 }}>
              Nova is thinking <Spinner />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {/* Quick prompts */}
      <div style={{ padding:'4px 10px', display:'flex', gap:'4px', flexWrap:'wrap', borderTop:`1px solid ${T.bd}` }}>
        {PROMPTS.map(p => (
          <button key={p} onClick={() => { setInput(p); }}
            style={{ background:T.bg3, color:T.tx2, border:`1px solid ${T.bd2}`, borderRadius:T.r,
              padding:'2px 7px', fontSize:'7px', cursor:'pointer' }}>
            {p}
          </button>
        ))}
      </div>
      {/* Input */}
      <div style={{ padding:'8px', display:'flex', gap:'6px', borderTop:`1px solid ${T.bd}`, background:T.bg1 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask Nova anything about markets, strategies, or your portfolio…"
          style={{ flex:1, background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
            borderRadius:T.r, padding:'8px 10px', fontSize:'10px', fontFamily:T.sans, outline:'none' }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ background: loading ? T.bg3 : T.brand, color:'#FFF', border:'none',
            borderRadius:T.r, padding:'6px 16px', fontSize:'9px', fontWeight:700, cursor:'pointer' }}>
          Send
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 2 — CHART VISION
══════════════════════════════════════════════════════════════════════════ */
function ChartVisionTab() {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [symbol, setSymbol]       = useState('SPY');
  const [tf, setTf]               = useState('1D');
  const [result, setResult]       = useState<ChartAnalysisResponse | null>(null);
  const [patterns, setPatterns]   = useState<PatternSearchResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File) => {
    setFile(f);
    setResult(null); setPatterns(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const analyse = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const b64  = await Nova.fileToBase64(file);
      const [res, pats] = await Promise.all([
        Nova.analyzeChart(file, { symbol, timeframe: tf }),
        Nova.patternSearch(b64, 3),
      ]);
      setResult(res);
      setPatterns(pats);
    } catch (e) {
      setResult({ analysis:`Error: ${(e as Error).message}`, patterns_detected:[], signals:[], confidence:0, model:'error', demo_mode:true, latency_ms:0 });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left: upload + controls */}
      <div style={{ width:'260px', borderRight:`1px solid ${T.bd}`, padding:'10px', display:'flex', flexDirection:'column', gap:'8px', overflow:'auto' }}>
        <div style={{ fontSize:'10px', fontWeight:700, color:T.tx0 }}>Chart Screenshot Analysis</div>
        <div style={{ fontSize:'8px', color:T.tx2, lineHeight:1.4 }}>
          Upload a chart screenshot. Nova Pro analyses patterns, S/R levels, and signals using multimodal vision.
        </div>

        {/* Upload zone */}
        <div onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          style={{ border:`2px dashed ${T.bd2}`, borderRadius:T.r, padding:'16px', textAlign:'center',
            cursor:'pointer', background:T.bg0, color:T.tx3, fontSize:'9px' }}>
          {preview
            ? <img src={preview} alt="chart" style={{ maxWidth:'100%', maxHeight:'120px', borderRadius:T.r }} />
            : <><div style={{ fontSize:'20px', marginBottom:'4px' }}>📊</div>Drop chart or click to upload</>
          }
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

        <div style={{ display:'flex', gap:'6px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Symbol</div>
            <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              style={{ width:'100%', background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
                borderRadius:T.r, padding:'4px 6px', fontSize:'9px', fontFamily:T.mono, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Timeframe</div>
            <select value={tf} onChange={e => setTf(e.target.value)}
              style={{ width:'100%', background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
                borderRadius:T.r, padding:'4px 6px', fontSize:'9px', outline:'none' }}>
              {['1m','5m','15m','1h','4h','1D','1W'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button onClick={analyse} disabled={!file || loading}
          style={{ background: !file || loading ? T.bg3 : T.brand, color: !file || loading ? T.tx3 : '#FFF',
            border:'none', borderRadius:T.r, padding:'8px', fontSize:'10px', fontWeight:700, cursor:'pointer' }}>
          {loading ? 'Analysing…' : 'Analyse with Nova'}
        </button>

        {/* Pattern matches */}
        {patterns && (
          <div>
            <div style={{ fontSize:'8px', fontWeight:700, color:T.tx0, marginBottom:'5px' }}>Similar Patterns</div>
            {patterns.matches.map((m, i) => (
              <div key={i} style={{ background:T.bg0, border:`1px solid ${T.bd}`, borderRadius:T.r,
                padding:'6px', marginBottom:'4px' }}>
                <div style={{ fontSize:'8px', color:T.tx0, fontWeight:600 }}>{m.pattern_name}</div>
                <div style={{ fontSize:'7px', color:T.up, fontFamily:T.mono }}>
                  Similarity: {(m.similarity*100).toFixed(0)}% · Avg 30d: +{m.avg_return_30d}%
                </div>
                <div style={{ fontSize:'7px', color:T.tx2, marginTop:'2px' }}>{m.historical_outcome}</div>
              </div>
            ))}
            <DemoBadge visible={patterns.demo_mode} />
          </div>
        )}
      </div>

      {/* Right: analysis result */}
      <div style={{ flex:1, overflow:'auto', padding:'12px' }}>
        {!result && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:T.tx3, fontSize:'11px', gap:'8px' }}>
            <span style={{ fontSize:'36px' }}>🔍</span>
            Upload a chart screenshot to see Nova's multimodal analysis
          </div>
        )}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', color:T.tx2, fontSize:'11px', marginTop:'20px' }}>
            <Spinner /> Nova Pro is analysing your chart…
          </div>
        )}
        {result && !loading && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ fontSize:'10px', fontWeight:700, color:T.tx0 }}>Nova Vision Analysis</span>
              <ModelPill model={result.model} demo={result.demo_mode} />
              <LatencyTag ms={result.latency_ms} />
              <span style={{ fontSize:'8px', color:T.up, fontFamily:T.mono }}>
                Confidence: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {result.patterns_detected.length > 0 && (
              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
                {result.patterns_detected.map((p, i) => (
                  <span key={i} style={{ fontSize:'7px', background:`${T.up}20`, color:T.up,
                    border:`1px solid ${T.up}40`, borderRadius:'3px', padding:'2px 6px' }}>{p}</span>
                ))}
              </div>
            )}

            <div style={{ background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r,
              padding:'12px', fontSize:'10px', lineHeight:1.6, color:T.tx1,
              whiteSpace:'pre-wrap', fontFamily:T.sans }}>
              {result.analysis}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 3 — VOICE  (Nova Sonic)
══════════════════════════════════════════════════════════════════════════ */
function VoiceTab() {
  const [recording, setRecording]     = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [response, setResponse]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [demoMode, setDemoMode]       = useState(true);
  const [latency, setLatency]         = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type:'audio/webm' });
        const b64  = await Nova.fileToBase64(blob);
        setLoading(true);
        try {
          const resp = await Nova.voiceTranscribe(b64);
          setTranscript(resp.transcript);
          setResponse(resp.response_text);
          setDemoMode(resp.demo_mode);
          setLatency(resp.latency_ms);
        } catch (e) {
          setResponse(`Error: ${(e as Error).message}`);
        } finally { setLoading(false); }
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setResponse('Microphone access denied. Please allow microphone to use Nova Voice.');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'20px', gap:'16px', height:'100%' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:T.tx0, marginBottom:'4px' }}>Nova Sonic Voice Assistant</div>
        <div style={{ fontSize:'9px', color:T.tx2 }}>Speech-to-speech AI powered by amazon.nova-sonic-v1:0 · Press to speak</div>
      </div>

      {/* Mic button */}
      <div onClick={recording ? stopRecording : startRecording}
        style={{ width:'80px', height:'80px', borderRadius:'50%',
          background: recording ? `${T.dn}30` : `${T.brand}20`,
          border: `3px solid ${recording ? T.dn : T.brand}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', fontSize:'32px',
          boxShadow: recording ? `0 0 20px ${T.dn}60` : 'none',
          transition:'all 0.2s' }}>
        {loading ? '⏳' : recording ? '🔴' : '🎙️'}
      </div>
      <div style={{ fontSize:'9px', color: recording ? T.dn : T.tx3 }}>
        {loading ? 'Processing with Nova Sonic…' : recording ? 'Recording — click to stop' : 'Click to speak to Nova'}
      </div>

      {/* Transcript */}
      {transcript && (
        <div style={{ width:'100%', maxWidth:'480px' }}>
          <div style={{ fontSize:'8px', color:T.tx3, marginBottom:'3px' }}>You said:</div>
          <div style={{ background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r,
            padding:'8px', fontSize:'10px', color:T.tx1 }}>{transcript}</div>
        </div>
      )}

      {/* Nova response */}
      {response && (
        <div style={{ width:'100%', maxWidth:'480px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
            <span style={{ fontSize:'8px', color:T.tx3 }}>Nova replied:</span>
            <DemoBadge visible={demoMode} />
            {latency > 0 && <LatencyTag ms={latency} />}
          </div>
          <div style={{ background:`${T.brand}15`, border:`1px solid ${T.brand}40`,
            borderRadius:T.r, padding:'10px', fontSize:'10px', color:T.tx1, lineHeight:1.5 }}>
            {response}
          </div>
        </div>
      )}

      <div style={{ fontSize:'8px', color:T.tx3, maxWidth:'400px', textAlign:'center', lineHeight:1.5 }}>
        Try: "What's my portfolio risk?" · "Buy 10 shares of AAPL" · "Explain iron condor Greeks" · "Best options strategy today"
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 4 — AGENTIC RESEARCH
══════════════════════════════════════════════════════════════════════════ */
function AgentResearchTab() {
  const [ticker, setTicker]       = useState('NVDA');
  const [depth, setDepth]         = useState<'quick'|'standard'|'deep'>('standard');
  const [options, setOptions]     = useState(false);
  const [macro, setMacro]         = useState(false);
  const [result, setResult]       = useState<AgentResearchResponse | null>(null);
  const [loading, setLoading]     = useState(false);

  const run = async () => {
    if (!ticker.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await Nova.agentResearch(ticker.trim().toUpperCase(), { depth, includeOptions:options, includeMacro:macro });
      setResult(r);
    } catch (e) {
      alert(`Agent error: ${(e as Error).message}`);
    } finally { setLoading(false); }
  };

  const recColor: Record<string,string> = { BUY:T.up, SELL:T.dn, HOLD:T.warn, WATCH:T.info };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Controls */}
      <div style={{ width:'220px', borderRight:`1px solid ${T.bd}`, padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
        <div style={{ fontSize:'10px', fontWeight:700, color:T.tx0 }}>Agentic Research</div>
        <div style={{ fontSize:'8px', color:T.tx2, lineHeight:1.4 }}>
          Nova runs a multi-step research pipeline: market data → technicals → sentiment → synthesis.
        </div>

        <div>
          <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Ticker</div>
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            style={{ width:'100%', background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
              borderRadius:T.r, padding:'5px 8px', fontSize:'11px', fontFamily:T.mono,
              outline:'none', boxSizing:'border-box' }} />
        </div>

        <div>
          <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Research Depth</div>
          {(['quick','standard','deep'] as const).map(d => (
            <label key={d} style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', marginBottom:'3px' }}>
              <input type="radio" name="depth" checked={depth===d} onChange={() => setDepth(d)} />
              <span style={{ fontSize:'9px', color:T.tx1, textTransform:'capitalize' }}>{d}</span>
            </label>
          ))}
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer' }}>
          <input type="checkbox" checked={options} onChange={e => setOptions(e.target.checked)} />
          <span style={{ fontSize:'9px', color:T.tx1 }}>Include options analysis</span>
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer' }}>
          <input type="checkbox" checked={macro} onChange={e => setMacro(e.target.checked)} />
          <span style={{ fontSize:'9px', color:T.tx1 }}>Include macro backdrop</span>
        </label>

        <button onClick={run} disabled={loading || !ticker.trim()}
          style={{ background: loading || !ticker.trim() ? T.bg3 : T.brand,
            color: loading || !ticker.trim() ? T.tx3 : '#FFF',
            border:'none', borderRadius:T.r, padding:'8px', fontSize:'10px', fontWeight:700, cursor:'pointer' }}>
          {loading ? 'Running…' : 'Run Nova Agent'}
        </button>
      </div>

      {/* Results */}
      <div style={{ flex:1, overflow:'auto', padding:'12px' }}>
        {!result && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:T.tx3, fontSize:'11px', gap:'8px' }}>
            <span style={{ fontSize:'36px' }}>🤖</span>
            Enter a ticker and click Run Nova Agent
          </div>
        )}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', color:T.tx2, fontSize:'11px', marginTop:'20px' }}>
            <Spinner /> Nova is running multi-step research…
          </div>
        )}
        {result && !loading && (
          <>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
              <span style={{ fontSize:'14px', fontWeight:800, color:T.tx0 }}>{result.ticker}</span>
              <span style={{ fontSize:'12px', fontWeight:700, color:recColor[result.recommendation] ?? T.tx0,
                background:`${recColor[result.recommendation]}20`, border:`1px solid ${recColor[result.recommendation]}40`,
                borderRadius:'4px', padding:'2px 8px' }}>{result.recommendation}</span>
              <span style={{ fontSize:'9px', color:T.tx2, fontFamily:T.mono }}>
                Conviction: {(result.conviction*100).toFixed(0)}%
              </span>
              <ModelPill model={result.model} demo={result.demo_mode} />
              <LatencyTag ms={result.total_latency_ms} />
            </div>

            {/* Steps */}
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'8px', fontWeight:700, color:T.tx3, marginBottom:'5px' }}>RESEARCH STEPS</div>
              {result.steps.map(s => (
                <div key={s.step} style={{ display:'flex', gap:'8px', marginBottom:'5px', alignItems:'flex-start' }}>
                  <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:T.brand,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'7px', fontWeight:700,
                    color:'#FFF', flexShrink:0, marginTop:'1px' }}>{s.step}</div>
                  <div style={{ flex:1, background:T.bg0, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'5px 8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'8px', color:T.brand, fontFamily:T.mono, fontWeight:700 }}>{s.tool}</span>
                      <span style={{ fontSize:'7px', color:T.tx3 }}>{s.description}</span>
                      <LatencyTag ms={s.latency_ms} />
                    </div>
                    <div style={{ fontSize:'8px', color:T.tx2, marginTop:'2px' }}>{s.result}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Thesis */}
            <div style={{ background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'12px',
              fontSize:'10px', lineHeight:1.6, color:T.tx1, whiteSpace:'pre-wrap', marginBottom:'10px' }}>
              {result.thesis}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <div style={{ flex:1, background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'8px' }}>
                <div style={{ fontSize:'8px', color:T.dn, fontWeight:700, marginBottom:'5px' }}>RISK FACTORS</div>
                {result.risk_factors.map((r,i) => (
                  <div key={i} style={{ fontSize:'8px', color:T.tx1, padding:'2px 0', borderBottom:`1px solid ${T.bd}` }}>⚠ {r}</div>
                ))}
              </div>
              <div style={{ flex:1, background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'8px' }}>
                <div style={{ fontSize:'8px', color:T.up, fontWeight:700, marginBottom:'5px' }}>CATALYSTS</div>
                {result.catalysts.map((c,i) => (
                  <div key={i} style={{ fontSize:'8px', color:T.tx1, padding:'2px 0', borderBottom:`1px solid ${T.bd}` }}>▲ {c}</div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 5 — NOVA ACT
══════════════════════════════════════════════════════════════════════════ */
function NovaActTab() {
  const [task, setTask]     = useState('');
  const [url, setUrl]       = useState('');
  const [result, setResult] = useState<ActAutomateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const PRESETS = [
    { label:'SEC 10-K Financials', task:'Fetch latest 10-K revenue, EPS, and risk factors from SEC EDGAR', url:'https://www.sec.gov/cgi-bin/browse-edgar' },
    { label:'Analyst Ratings',    task:'Scrape analyst consensus ratings and price targets from Yahoo Finance', url:'https://finance.yahoo.com' },
    { label:'Earnings Calendar',  task:'Get next 7 days of earnings announcements from Nasdaq earnings calendar', url:'https://www.nasdaq.com/market-activity/earnings' },
  ];

  const run = async () => {
    if (!task.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await Nova.actAutomate(task.trim(), { targetUrl: url || undefined });
      setResult(r);
    } catch (e) {
      alert(`Nova Act error: ${(e as Error).message}`);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:'260px', borderRight:`1px solid ${T.bd}`, padding:'12px', display:'flex', flexDirection:'column', gap:'8px', overflow:'auto' }}>
        <div style={{ fontSize:'10px', fontWeight:700, color:T.tx0 }}>Nova Act — Browser Automation</div>
        <div style={{ fontSize:'8px', color:T.tx2, lineHeight:1.4 }}>
          Nova Act navigates real web pages to extract financial data. Set NOVA_ACT_ENABLED=1 for live runs.
        </div>

        <div>
          <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Task Description</div>
          <textarea value={task} onChange={e => setTask(e.target.value)} rows={3}
            placeholder="e.g. Fetch AAPL 10-K revenue figures from SEC EDGAR"
            style={{ width:'100%', background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
              borderRadius:T.r, padding:'6px', fontSize:'9px', fontFamily:T.sans,
              outline:'none', resize:'vertical', boxSizing:'border-box' }} />
        </div>

        <div>
          <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Starting URL (optional)</div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
            style={{ width:'100%', background:T.bg2, color:T.tx0, border:`1px solid ${T.bd}`,
              borderRadius:T.r, padding:'5px 6px', fontSize:'9px', outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ fontSize:'7px', color:T.tx3, marginBottom:'2px' }}>Quick presets</div>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => { setTask(p.task); setUrl(p.url); }}
            style={{ background:T.bg3, color:T.tx2, border:`1px solid ${T.bd2}`,
              borderRadius:T.r, padding:'4px 8px', fontSize:'8px', cursor:'pointer', textAlign:'left' }}>
            {p.label}
          </button>
        ))}

        <button onClick={run} disabled={loading || !task.trim()}
          style={{ background: loading || !task.trim() ? T.bg3 : T.purple,
            color: loading || !task.trim() ? T.tx3 : '#FFF',
            border:'none', borderRadius:T.r, padding:'8px', fontSize:'10px', fontWeight:700, cursor:'pointer' }}>
          {loading ? 'Automating…' : 'Run Nova Act'}
        </button>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'12px' }}>
        {!result && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:T.tx3, fontSize:'11px', gap:'8px' }}>
            <span style={{ fontSize:'36px' }}>🌐</span>
            Configure a task and click Run Nova Act
          </div>
        )}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', color:T.tx2, fontSize:'11px', marginTop:'20px' }}>
            <Spinner /> Nova Act is browsing the web…
          </div>
        )}
        {result && !loading && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ fontSize:'9px', fontWeight:700, color: result.status==='completed' ? T.up : T.warn }}>
                ● {result.status.toUpperCase()}
              </span>
              <ModelPill model={result.model} demo={result.demo_mode} />
            </div>

            {result.steps.map(s => (
              <div key={s.step} style={{ display:'flex', gap:'8px', marginBottom:'5px' }}>
                <div style={{ width:'16px', height:'16px', borderRadius:'50%', background:T.purple,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'7px', color:'#FFF', fontWeight:700, flexShrink:0, marginTop:'2px' }}>{s.step}</div>
                <div style={{ flex:1, background:T.bg0, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'5px 8px' }}>
                  <span style={{ fontSize:'8px', color:T.purple, fontWeight:700 }}>{s.action}</span>
                  <span style={{ fontSize:'7px', color:T.tx3, marginLeft:'6px' }}>{s.target}</span>
                  <div style={{ fontSize:'8px', color:T.tx2, marginTop:'2px' }}>{s.result}</div>
                </div>
              </div>
            ))}

            <div style={{ background:T.bg2, border:`1px solid ${T.bd}`, borderRadius:T.r, padding:'10px', marginTop:'8px' }}>
              <div style={{ fontSize:'8px', color:T.tx3, fontWeight:700, marginBottom:'6px' }}>EXTRACTED DATA</div>
              <pre style={{ fontSize:'8px', color:T.up, fontFamily:T.mono, margin:0, whiteSpace:'pre-wrap' }}>
                {JSON.stringify(result.data_extracted, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STATUS SIDEBAR
══════════════════════════════════════════════════════════════════════════ */
function StatusSidebar({ status }: { status: NovaStatus | null }) {
  const items = [
    { label:'Nova Text',   value: status?.enabled      ? '● LIVE' : '○ DEMO', color: status?.enabled      ? T.up : T.warn },
    { label:'Nova Sonic',  value: status?.sonic_enabled ? '● LIVE' : '○ DEMO', color: status?.sonic_enabled ? T.up : T.warn },
    { label:'Nova Act',    value: status?.act_enabled   ? '● LIVE' : '○ DEMO', color: status?.act_enabled   ? T.up : T.warn },
    { label:'Region',      value: status?.region        ?? '—',                color: T.tx2 },
    { label:'Model',       value: status?.model_id?.replace('amazon.','') ?? '—', color:T.brand },
    { label:'Mode',        value: status?.demo_mode ? 'Demo' : 'Production',   color: status?.demo_mode ? T.warn : T.up },
  ];

  return (
    <div style={{ width:'180px', borderLeft:`1px solid ${T.bd}`, padding:'10px', background:T.bg1, overflow:'auto', display:'flex', flexDirection:'column', gap:'8px' }}>
      <div style={{ fontSize:'9px', fontWeight:700, color:T.tx0 }}>Nova Status</div>
      {items.map(i => (
        <div key={i.label} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:`1px solid ${T.bd}` }}>
          <span style={{ fontSize:'7px', color:T.tx3 }}>{i.label}</span>
          <span style={{ fontSize:'7px', color:i.color, fontFamily:T.mono, fontWeight:600 }}>{i.value}</span>
        </div>
      ))}
      {status?.demo_mode && (
        <div style={{ background:`${T.warn}15`, border:`1px solid ${T.warn}30`, borderRadius:T.r, padding:'6px', fontSize:'7px', color:T.warn, lineHeight:1.5 }}>
          Demo mode active. Set NOVA_ENABLED=1, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY for live inference.
        </div>
      )}
      <div style={{ fontSize:'8px', fontWeight:700, color:T.tx3, marginTop:'4px' }}>Quick Actions</div>
      {['Chat: SPY regime analysis','Chart: upload screenshot','Voice: portfolio overview','Agent: AAPL deep dive'].map(a => (
        <div key={a} style={{ fontSize:'7px', color:T.tx2, padding:'3px 0', borderBottom:`1px solid ${T.bd}`, lineHeight:1.4 }}>{a}</div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════ */
type Tab = 'chat' | 'vision' | 'voice' | 'agent' | 'act';

const TABS: { key: Tab; label: string }[] = [
  { key:'chat',   label:'💬 Chat' },
  { key:'vision', label:'📷 Chart Vision' },
  { key:'voice',  label:'🎙️ Voice' },
  { key:'agent',  label:'🤖 Agent Research' },
  { key:'act',    label:'🌐 Nova Act' },
];

export default function NovaUI2() {
  const [tab, setTab]           = useState<Tab>('chat');
  const [status, setStatus]     = useState<NovaStatus | null>(null);

  useEffect(() => {
    Nova.getNovaStatus().then(setStatus).catch(() => null);
  }, []);

  return (
    <div data-testid="nova-page" style={{ display:'flex', flexDirection:'column', height:'100%', background:T.bg0, fontFamily:T.sans, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', gap:'8px', background:T.bg1, borderBottom:`1px solid ${T.bd}`, flexShrink:0 }}>
        <div style={{ width:22, height:22, borderRadius:'50%',
          background:`linear-gradient(135deg, ${T.brand}, ${T.purple})`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'11px', fontWeight:800, color:'#FFF' }}>N</div>
        <span style={{ fontSize:'12px', fontWeight:800, color:T.tx0 }}>NOVA AI HUB</span>
        <div style={{ height:14, width:1, background:T.bd2 }} />
        <span style={{ fontSize:'8px', color: status?.demo_mode === false ? T.up : T.warn, fontFamily:T.mono }}>
          ● {status?.demo_mode === false ? 'BEDROCK LIVE' : 'DEMO MODE'}
        </span>
        <span style={{ fontSize:'7px', color:T.tx3, fontFamily:T.mono }}>amazon.nova-lite-v1:0</span>
        <div style={{ marginLeft:'auto', fontSize:'7px', color:T.tx3 }}>Apex Terminal × Amazon Nova Hackathon 2026</div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:`1px solid ${T.bd}`, background:T.bg1, flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background: tab===t.key ? T.bg3 : 'transparent', color: tab===t.key ? T.tx0 : T.tx3,
              border:'none', padding:'6px 14px', fontSize:'9px', fontWeight:600, cursor:'pointer',
              borderBottom: tab===t.key ? `2px solid ${T.brand}` : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex:1, overflow:'hidden' }}>
          {tab==='chat'   && <ChatTab status={status} />}
          {tab==='vision' && <ChartVisionTab />}
          {tab==='voice'  && <VoiceTab />}
          {tab==='agent'  && <AgentResearchTab />}
          {tab==='act'    && <NovaActTab />}
        </div>
        <StatusSidebar status={status} />
      </div>
    </div>
  );
}

export { NovaUI2 };
