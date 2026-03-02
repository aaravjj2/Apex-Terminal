#!/usr/bin/env python3
"""Builds the comprehensive Apex Terminal demo HTML file."""
import os, sys

TARGET = os.path.join(os.path.dirname(__file__), 'index.html')

# ── helpers ──────────────────────────────────────────────────────────────────
def svg(path, size=14):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{path}</svg>'

IC = {
    'chart':    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'grid':     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    'brief':    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'shield':   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'layers':   '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    'clock':    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'random':   '<polyline points="21 16 21 21 16 21"/><path d="M3 3l9.39 9.39"/><polyline points="21 3 21 8 16 8"/><path d="M3 21l9-9"/>',
    'dice':     '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="16" cy="16" r="1.5"/>',
    'code':     '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    'search':   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    'bell':     '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'book':     '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'zap':      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'check':    '<polyline points="20 6 9 17 4 12"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'globe':    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'server':   '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
    'cpu':      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'xcirc':    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    'filter':   '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'plus':     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'dl':       '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'play':     '<polygon points="5 3 19 12 5 21 5 3"/>',
    'pause':    '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    'skip':     '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    'rewind':   '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
    'trend':    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    'robot':    '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/>',
    'news':     '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/>',
    'list':     '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    'eye':      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
}

def ni(view, icon_key, label, extra=''):
    return f'<div class="nav-item" data-view="{view}" onclick="switchView(\'{view}\')" {extra}>{svg(IC[icon_key],16)}<span class="nav-tip">{label}</span></div>\n'

def ndiv():
    return '<div class="nav-grp-line"></div>\n'

# ── CSS ───────────────────────────────────────────────────────────────────────
CSS = r"""
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;user-select:none}
button{background:none;border:none;cursor:pointer;font:inherit;color:inherit}
input,select,textarea{font:inherit;color:inherit}
:root{
  --bg0:#0C0E12;--bg1:#131722;--bg2:#1E222D;--bg3:#181C27;--bg4:#242836;
  --bdr:#2A2E39;--bdr-a:#434651;--bdr-f:#2962FF;
  --brand:#2962FF;--brand-h:#1E53E4;--brand-m:rgba(41,98,255,.12);
  --up:#089981;--up-h:#0AAE8E;--dn:#F23645;--dn-h:#FF4757;
  --warn:#F7931A;--warn-bg:rgba(247,147,26,.1);
  --tx:#D1D4DC;--tx2:#787B86;--tx3:#5D606B;
  --replay:#9333EA;--replay-bg:rgba(147,51,234,.1);
  --bt:#06B6D4;--bt-bg:rgba(6,182,212,.1);
  --paper:#F59E0B;--paper-bg:rgba(245,158,11,.1);
  --live:#089981;--live-bg:rgba(8,153,129,.1);
  --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
  --r2:2px;--r4:4px;--r6:6px;--r8:8px;
  --sh2:0 4px 12px rgba(0,0,0,.5);--sh3:0 8px 24px rgba(0,0,0,.6);--sh4:0 16px 48px rgba(0,0,0,.7);
}
body{font-family:var(--sans);background:var(--bg0);color:var(--tx);font-size:13px;line-height:1.4;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--bg1)}
::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:3px}
#app{display:grid;grid-template-rows:40px 1fr 20px;height:100vh;overflow:hidden}
#topbar{background:var(--bg0);border-bottom:1px solid var(--bdr);display:flex;align-items:center;padding:0 10px;gap:6px;z-index:30;flex-shrink:0}
.tb-logo{display:flex;align-items:center;gap:5px;font-weight:800;font-size:14px;letter-spacing:-.5px;color:#fff;white-space:nowrap;flex-shrink:0}
.tb-sep{width:1px;height:20px;background:var(--bdr);margin:0 2px;flex-shrink:0}
.mode-badge{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:var(--r4);font-size:11px;font-weight:600;letter-spacing:.05em;white-space:nowrap;flex-shrink:0;cursor:pointer}
.mode-badge.live{background:var(--live-bg);color:var(--live)}.mode-badge.paper{background:var(--paper-bg);color:var(--paper)}
.mode-badge.bt{background:var(--bt-bg);color:var(--bt)}.mode-badge.replay{background:var(--replay-bg);color:var(--replay)}
.mode-dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.tb-search{flex:1;max-width:300px;min-width:140px;display:flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:0 10px;height:28px;cursor:text;font-size:12px;color:var(--tx2);transition:border-color .15s}
.tb-search:focus-within{border-color:var(--brand)}
.tb-search input{background:none;border:none;outline:none;flex:1;font-size:12px;color:var(--tx)}
.tb-search input::placeholder{color:var(--tx3)}
.tb-right{display:flex;align-items:center;gap:2px;margin-left:auto;flex-shrink:0}
.tb-clock{font-family:var(--mono);font-size:11px;color:var(--tx2);padding:0 8px;white-space:nowrap}
.tb-icon-btn{width:28px;height:28px;border-radius:var(--r4);display:flex;align-items:center;justify-content:center;color:var(--tx2);transition:background .15s,color .15s;position:relative;cursor:pointer}
.tb-icon-btn:hover{background:var(--bg2);color:var(--tx)}
.notif-dot{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--dn);border:1.5px solid var(--bg0)}
.tb-user{display:flex;align-items:center;gap:6px;padding:2px 8px 2px 4px;border-radius:var(--r4);cursor:pointer;transition:background .15s}
.tb-user:hover{background:var(--bg2)}
.avatar{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#2962FF,#9333EA);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}
.latency{display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:10px;color:var(--up);padding:0 6px}
.latency-dot{width:5px;height:5px;border-radius:50%;background:var(--up)}
#layout{display:grid;grid-template-columns:48px 1fr 290px;overflow:hidden;height:100%}
#leftnav{background:var(--bg0);border-right:1px solid var(--bdr);display:flex;flex-direction:column;align-items:center;padding:4px 0;gap:1px;overflow-y:auto;overflow-x:hidden;z-index:20}
#leftnav::-webkit-scrollbar{width:0}
.nav-grp-line{width:24px;height:1px;background:var(--bdr);margin:3px 0;flex-shrink:0}
.nav-item{width:40px;height:36px;border-radius:var(--r6);display:flex;align-items:center;justify-content:center;color:var(--tx3);cursor:pointer;transition:background .15s,color .15s;position:relative;flex-shrink:0}
.nav-item:hover{color:var(--tx);background:var(--bg2)}.nav-item.active{color:var(--brand);background:var(--brand-m)}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:2.5px;background:var(--brand);border-radius:0 2px 2px 0}
.nav-tip{position:absolute;left:100%;top:50%;transform:translateY(-50%);background:var(--bg4);border:1px solid var(--bdr-a);padding:4px 10px;border-radius:var(--r4);font-size:11px;font-weight:500;color:var(--tx);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:50;margin-left:8px;box-shadow:var(--sh2)}
.nav-item:hover .nav-tip{opacity:1}
.nav-spacer{flex:1}
#content{display:flex;flex-direction:column;overflow:hidden;background:var(--bg1);position:relative}
.view{display:none;flex-direction:column;height:100%;overflow:hidden}.view.active{display:flex}
/* CHART */
.chart-header{background:var(--bg1);border-bottom:1px solid var(--bdr);display:flex;align-items:center;padding:0 8px;height:34px;gap:6px;flex-shrink:0;overflow:hidden}
.ch-sym{font-size:14px;font-weight:700;color:#fff;letter-spacing:-.3px}
.ch-exch{font-size:10px;color:var(--tx3)}.ch-price{font-family:var(--mono);font-size:15px;font-weight:600}
.ch-price.flash-up{animation:fup .5s}.ch-price.flash-dn{animation:flash-dn .5s}
@keyframes fup{0%{color:var(--up);text-shadow:0 0 8px rgba(8,153,129,.6)}100%{color:inherit;text-shadow:none}}
@keyframes flash-dn{0%{color:var(--dn);text-shadow:0 0 8px rgba(242,54,69,.6)}100%{color:inherit;text-shadow:none}}
.ch-chg{font-family:var(--mono);font-size:11px;font-weight:500}.ch-chg.up{color:var(--up)}.ch-chg.dn{color:var(--dn)}
.ch-ohlcv{font-family:var(--mono);font-size:10px;color:var(--tx2);white-space:nowrap}.ch-ohlcv span{margin-right:5px}.ohlcv-v{color:var(--tx)}
.ch-sep{width:1px;height:18px;background:var(--bdr);flex-shrink:0}
.tf-grp{display:flex;gap:1px;flex-shrink:0}
.tf-btn{padding:2px 6px;border-radius:var(--r2);font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;transition:background .1s,color .1s}
.tf-btn:hover{color:var(--tx);background:var(--bg2)}.tf-btn.active{color:#fff;background:var(--bg2)}
.ch-ctrl{display:flex;align-items:center;gap:4px;padding:2px 6px;border-radius:var(--r2);font-size:11px;color:var(--tx2);cursor:pointer;transition:background .15s}
.ch-ctrl:hover{background:var(--bg2);color:var(--tx)}
.chart-body{flex:1;display:grid;grid-template-rows:1fr 100px;overflow:hidden;position:relative}
#cmw{position:relative;overflow:hidden}#chart-main{display:block;width:100%;height:100%}
#crw{position:relative;border-top:1px solid var(--bdr)}.rsi-lbl{position:absolute;top:4px;left:32px;font-size:10px;font-weight:600;color:var(--tx2);z-index:2;pointer-events:none}
#chart-rsi{display:block;width:100%;height:100%}
.ch-tooltip{position:absolute;top:8px;left:34px;background:rgba(19,23,34,.95);border:1px solid var(--bdr);padding:5px 8px;border-radius:var(--r4);font-family:var(--mono);font-size:10px;line-height:1.8;pointer-events:none;z-index:10;display:none;box-shadow:var(--sh2)}
.tt-lbl{color:var(--tx2)}.tt-v{color:var(--tx)}.tt-v.up{color:var(--up)}.tt-v.dn{color:var(--dn)}
.draw-strip{position:absolute;left:0;top:0;bottom:0;width:28px;background:var(--bg1);border-right:1px solid var(--bdr);display:flex;flex-direction:column;align-items:center;padding:4px 0;gap:1px;z-index:5}
.draw-btn{width:22px;height:22px;border-radius:var(--r2);display:flex;align-items:center;justify-content:center;color:var(--tx3);cursor:pointer;transition:background .1s,color .1s}
.draw-btn:hover,.draw-btn.active{background:var(--bg2);color:var(--tx)}.draw-btn.active{color:var(--brand)}
/* REPLAY */
.replay-bar{height:28px;background:var(--replay-bg);border-top:1px solid rgba(147,51,234,.3);display:flex;align-items:center;gap:8px;padding:0 12px;flex-shrink:0}
.rb-badge{font-size:10px;font-weight:600;color:var(--replay);letter-spacing:.05em}
.rb-btn{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:var(--r2);font-size:11px;color:var(--tx2);cursor:pointer;transition:background .1s}
.rb-btn:hover{background:rgba(147,51,234,.15);color:var(--tx)}
.rb-timeline{flex:1;height:4px;background:var(--bg2);border-radius:2px;cursor:pointer;position:relative}
.rb-fill{height:100%;width:35%;background:var(--replay);border-radius:2px}
.rb-speed{font-family:var(--mono);font-size:10px;color:var(--replay);background:var(--replay-bg);padding:2px 5px;border-radius:var(--r2)}
/* KPI */
.kpi-strip{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;overflow-x:auto}
.kpi-item{padding:8px 14px;border-right:1px solid var(--bdr);flex-shrink:0;min-width:105px}
.kpi-label{font-size:10px;color:var(--tx2);font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px}
.kpi-val{font-family:var(--mono);font-size:17px;font-weight:600;color:var(--tx)}.kpi-val.up{color:var(--up)}.kpi-val.dn{color:var(--dn)}.kpi-val.warn{color:var(--warn)}
.kpi-sub{font-family:var(--mono);font-size:10px;color:var(--tx3);margin-top:1px}.kpi-sub.up{color:var(--up)}.kpi-sub.dn{color:var(--dn)}
/* PANELS */
.ph{display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-bottom:1px solid var(--bdr);font-size:11px;font-weight:600;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase;flex-shrink:0}
.ph-title{display:flex;align-items:center;gap:6px}
.btn-g{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:var(--r4);font-size:11px;color:var(--tx2);cursor:pointer;transition:background .15s,color .15s}
.btn-g:hover{background:var(--bg2);color:var(--tx)}
.btn-pri{padding:5px 12px;border-radius:var(--r4);font-size:12px;font-weight:600;background:var(--brand);color:#fff;cursor:pointer;transition:background .15s;border:none}
.btn-pri:hover{background:var(--brand-h)}
.btn-sm{padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:500;cursor:pointer;transition:background .1s;border:none}
.btn-sm.up{background:var(--live-bg);color:var(--up)}.btn-sm.dn{background:rgba(242,54,69,.1);color:var(--dn)}.btn-sm.neutral{background:var(--bg2);color:var(--tx2)}
/* TABLES */
.tbl-wrap{overflow:auto;flex:1}
table{width:100%;border-collapse:collapse}
thead th{background:var(--bg2);font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.07em;text-transform:uppercase;padding:5px 10px;text-align:right;border-bottom:1px solid var(--bdr);white-space:nowrap;position:sticky;top:0;z-index:2}
thead th:first-child{text-align:left}
tbody tr{border-bottom:1px solid rgba(42,46,57,.5);cursor:pointer;transition:background .08s}
tbody tr:hover{background:var(--bg3)}
tbody td{padding:6px 10px;font-size:12px;text-align:right;white-space:nowrap}tbody td:first-child{text-align:left}
.td-sym{font-weight:600;color:var(--tx);font-size:13px}.td-name{font-size:10px;color:var(--tx3)}
.td-mono{font-family:var(--mono)}.td-up{font-family:var(--mono);color:var(--up)}.td-dn{font-family:var(--mono);color:var(--dn)}
.badge{display:inline-flex;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600}
.badge.up{background:var(--live-bg);color:var(--up)}.badge.dn{background:rgba(242,54,69,.1);color:var(--dn)}
.badge.warn{background:var(--warn-bg);color:var(--warn)}.badge.info{background:var(--brand-m);color:var(--brand)}
.badge.neutral{background:var(--bg2);color:var(--tx2)}.badge.bt{background:var(--bt-bg);color:var(--bt)}
.status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px}
.status-dot.ok{background:var(--up)}.status-dot.warn{background:var(--warn)}.status-dot.err{background:var(--dn)}
/* CARDS */
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;padding:10px}
.stat-card{background:var(--bg2);border-radius:var(--r4);padding:12px;border:1px solid var(--bdr)}
.sc-label{font-size:10px;font-weight:600;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px}
.sc-val{font-family:var(--mono);font-size:22px;font-weight:600;color:var(--tx);line-height:1}
.sc-sub{font-size:11px;color:var(--tx3);margin-top:4px;font-family:var(--mono)}
.sc-val.up{color:var(--up)}.sc-val.dn{color:var(--dn)}.sc-val.warn{color:var(--warn)}
/* ALLOC */
.alloc-row{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.alloc-lbl{font-size:11px;color:var(--tx2);width:64px;flex-shrink:0}
.alloc-track{flex:1;height:5px;background:var(--bg2);border-radius:3px;overflow:hidden}
.alloc-fill{height:100%;border-radius:3px;transition:width .5s}
.alloc-pct{font-family:var(--mono);font-size:10px;color:var(--tx3);width:32px;text-align:right;flex-shrink:0}
/* PORTFOLIO */
.port-grid{display:grid;grid-template-columns:1fr 260px;flex:1;min-height:0;overflow:hidden}
.port-side{border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
/* RISK */
.risk-3{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--bdr)}
.risk-card{padding:14px 16px;border-right:1px solid var(--bdr)}.risk-card:last-child{border-right:none}
.rc-lbl{font-size:10px;font-weight:600;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px}
.rc-val{font-family:var(--mono);font-size:26px;font-weight:600;color:var(--tx);line-height:1}
.rc-sub{font-size:11px;color:var(--tx3);margin-top:4px;font-family:var(--mono)}
.var-track{height:5px;background:var(--bg2);border-radius:3px;overflow:hidden;margin-top:8px}
.var-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--up),var(--warn) 60%,var(--dn))}
.stress-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--bdr)}
.stress-item{padding:12px 14px;border-bottom:1px solid var(--bdr);border-right:1px solid var(--bdr)}
.stress-item:nth-child(even){border-right:none}
.stress-name{font-size:12px;font-weight:600;color:var(--tx);margin-bottom:3px}
.stress-val{font-family:var(--mono);font-size:18px;font-weight:600}
.stress-desc{font-size:10px;color:var(--tx3);margin-top:3px}
/* OPTIONS */
.opt-header{padding:7px 12px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.exp-btn{padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;transition:background .1s}
.exp-btn:hover{background:var(--bg2);color:var(--tx)}.exp-btn.active{background:var(--bg2);color:var(--brand);font-weight:600}
.chain-hdr{display:grid;grid-template-columns:repeat(7,1fr) 76px repeat(7,1fr);background:var(--bg2);border-bottom:2px solid var(--bdr);position:sticky;top:0;z-index:2}
.ch-c{padding:4px 5px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.04em;text-transform:uppercase;text-align:center}
.ch-c.call{background:rgba(8,153,129,.07)}.ch-c.put{background:rgba(242,54,69,.07)}
.chain-row{display:grid;grid-template-columns:repeat(7,1fr) 76px repeat(7,1fr);border-bottom:1px solid rgba(42,46,57,.4);cursor:pointer;transition:background .08s}
.chain-row:hover{background:var(--bg2)}.chain-row.atm{background:rgba(41,98,255,.05)}
.cc{padding:4px 5px;font-family:var(--mono);font-size:11px;text-align:center;color:var(--tx2)}
.cc.cs{background:rgba(8,153,129,.04)}.cc.ps{background:rgba(242,54,69,.04)}
.cc.bid{color:var(--dn)}.cc.ask{color:var(--up)}.cc.iv{color:var(--warn)}
.strike-c{padding:4px 5px;font-family:var(--mono);font-size:12px;font-weight:700;text-align:center;color:var(--brand);background:var(--bg3)}
/* ORDERS */
.order-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0}
.o-tab{padding:7px 14px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;position:relative;transition:color .15s}
.o-tab:hover{color:var(--tx)}.o-tab.active{color:var(--tx)}
.o-tab.active::after{content:'';position:absolute;bottom:0;left:4px;right:4px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}
.order-tc{display:none;flex:1;flex-direction:column;overflow:hidden}.order-tc.active{display:flex}
/* BACKTEST */
.bt-layout{display:grid;grid-template-columns:240px 1fr;flex:1;min-height:0;overflow:hidden}
.bt-config{border-right:1px solid var(--bdr);overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.bt-results{overflow-y:auto}
.bt-metrics{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--bdr)}
.bt-m{padding:10px 12px;border-right:1px solid var(--bdr)}.bt-m:last-child{border-right:none}
.monthly-grid{display:grid;grid-template-columns:30px repeat(12,1fr);gap:2px;padding:10px}
.mg-lbl{color:var(--tx3);font-family:var(--mono);font-size:9px;display:flex;align-items:center;justify-content:flex-end;padding-right:3px}
.mg-cell{height:22px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9px;cursor:pointer;transition:opacity .1s}
.mg-cell:hover{opacity:.8}
.mg-mon{color:var(--tx3);font-family:var(--mono);font-size:9px;display:flex;align-items:center;justify-content:center}
/* WALK FORWARD */
.wf-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:12px}
.wf-card{background:var(--bg2);border-radius:var(--r4);padding:10px;border:1px solid var(--bdr)}
.wf-period{font-size:10px;color:var(--tx3);margin-bottom:4px;font-family:var(--mono)}
.wf-sharpe{font-family:var(--mono);font-size:20px;font-weight:600}
.wf-bar{height:4px;border-radius:2px;margin-top:6px;overflow:hidden;background:var(--bg3)}
.wf-bar-fill{height:100%;border-radius:2px}
/* MONTE CARLO */
.mc-stats{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid var(--bdr)}
.mc-s{padding:12px 14px;border-right:1px solid var(--bdr)}.mc-s:last-child{border-right:none}
/* STRATEGY */
.ss-layout{display:grid;grid-template-columns:1fr 300px;flex:1;min-height:0;overflow:hidden}
.ss-editor{border-right:1px solid var(--bdr);overflow:hidden;display:flex;flex-direction:column}
.ss-toolbar{padding:6px 10px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--bg0)}
.code-area{flex:1;background:var(--bg1);padding:12px 16px;font-family:var(--mono);font-size:12px;color:var(--tx);resize:none;border:none;outline:none;overflow:auto;line-height:1.7;tab-size:2}
.ss-results{overflow-y:auto;display:flex;flex-direction:column;background:var(--bg0)}
/* SCREENER */
.scr-filters{padding:7px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:5px;flex-wrap:wrap;flex-shrink:0;align-items:center}
.filter-pill{display:flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--bdr);border-radius:10px;font-size:11px;color:var(--tx2);cursor:pointer;transition:all .1s}
.filter-pill:hover,.filter-pill.active{border-color:var(--brand);color:var(--brand);background:var(--brand-m)}
.preset-btn{padding:3px 10px;border-radius:var(--r2);font-size:11px;font-weight:500;background:var(--bg2);color:var(--tx2);cursor:pointer;border:1px solid var(--bdr);transition:all .1s}
.preset-btn:hover,.preset-btn.active{background:var(--brand-m);color:var(--brand);border-color:var(--brand)}
/* ALERTS */
.alert-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--bdr);cursor:pointer;transition:background .08s}
.alert-row:hover{background:var(--bg2)}
.alert-ico{width:28px;height:28px;border-radius:var(--r4);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.alert-ico.price{background:var(--brand-m);color:var(--brand)}.alert-ico.vol{background:var(--warn-bg);color:var(--warn)}
.alert-ico.ind{background:var(--live-bg);color:var(--up)}.alert-ico.news{background:var(--replay-bg);color:var(--replay)}
.alert-sym{font-weight:600;font-size:12px;color:var(--tx)}.alert-cond{font-size:11px;color:var(--tx2)}
.alert-time{font-family:var(--mono);font-size:10px;color:var(--tx3);margin-left:auto;flex-shrink:0}
.alert-active{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.alert-active.on{background:var(--up);animation:pulse 2s infinite}.alert-active.off{background:var(--tx3)}
/* MACRO */
.eco-row{display:grid;grid-template-columns:60px 46px 70px 1fr 55px 80px 80px 80px;align-items:center;padding:5px 12px;border-bottom:1px solid rgba(42,46,57,.4);gap:6px;font-size:11px}
.eco-row:hover{background:var(--bg2);cursor:pointer}
.eco-hdr{background:var(--bg2);font-size:10px;color:var(--tx3);font-weight:600;letter-spacing:.04em;text-transform:uppercase;position:sticky;top:0;z-index:2;border-bottom:1px solid var(--bdr)}
.eco-impact{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.eco-impact.high{background:var(--dn)}.eco-impact.med{background:var(--warn)}.eco-impact.low{background:var(--tx3)}
.eco-val{font-family:var(--mono);font-size:11px;text-align:right}
.eco-actual.beat{color:var(--up)}.eco-actual.miss{color:var(--dn)}.eco-actual.tbd{color:var(--tx3)}
/* RESEARCH */
.research-layout{display:grid;grid-template-columns:200px 1fr 220px;flex:1;min-height:0;overflow:hidden}
.res-left{border-right:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
.res-main{overflow-y:auto;display:flex;flex-direction:column}
.res-right{border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
.fund-row{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid rgba(42,46,57,.4)}
.fund-lbl{font-size:11px;color:var(--tx2)}.fund-val{font-family:var(--mono);font-size:12px;color:var(--tx);font-weight:500}
/* AUTOPILOT */
.ap-layout{display:grid;grid-template-columns:200px 1fr 220px;flex:1;min-height:0;overflow:hidden}
.ap-left{border-right:1px solid var(--bdr);overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.ap-main{overflow-y:auto}
.ap-right{border-left:1px solid var(--bdr);overflow-y:auto}
.ap-toggle{display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:var(--r4)}
.toggle-sw{width:36px;height:20px;border-radius:10px;background:var(--up);position:relative;cursor:pointer;transition:background .2s}
.toggle-sw.off{background:var(--bg4)}
.toggle-knob{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
.toggle-sw.off .toggle-knob{transform:translateX(2px)}.toggle-sw:not(.off) .toggle-knob{transform:translateX(18px)}
.proposal-card{margin:8px 12px;background:var(--bg2);border-radius:var(--r4);padding:10px;border:1px solid var(--bdr);cursor:pointer;transition:border-color .15s}
.proposal-card:hover{border-color:var(--brand)}
.prop-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
.prop-sym{font-weight:700;font-size:13px;color:#fff}.prop-dir{font-size:11px;font-weight:600}
.prop-dir.buy{color:var(--up)}.prop-dir.sell{color:var(--dn)}
.prop-reason{font-size:11px;color:var(--tx2);line-height:1.5;margin-bottom:5px}
.prop-meta{display:flex;gap:8px;font-family:var(--mono);font-size:10px;color:var(--tx3)}
.think-entry{padding:6px 8px;margin:4px 8px;background:var(--bg2);border-radius:var(--r4);border-left:2px solid var(--brand)}
.think-time{font-family:var(--mono);font-size:9px;color:var(--tx3);margin-bottom:2px}
.think-text{font-size:11px;color:var(--tx2);line-height:1.5}
/* COMPLIANCE */
.comp-layout{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden}
.check-row{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(42,46,57,.4)}
.check-ico{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.check-ico.ok{background:var(--live-bg);color:var(--up)}.check-ico.fail{background:rgba(242,54,69,.1);color:var(--dn)}.check-ico.warn{background:var(--warn-bg);color:var(--warn)}
.check-title{font-size:12px;font-weight:600;color:var(--tx)}.check-desc{font-size:10px;color:var(--tx3);margin-top:1px}
.surv-row{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(42,46,57,.4);cursor:pointer;transition:background .08s}
.surv-row:hover{background:var(--bg2)}
/* PLATFORM */
.plat-layout{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden}
.svc-card{padding:12px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px}
.svc-ico{width:34px;height:34px;border-radius:var(--r6);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.svc-ico.ok{background:var(--live-bg);color:var(--up)}.svc-ico.warn{background:var(--warn-bg);color:var(--warn)}.svc-ico.err{background:rgba(242,54,69,.1);color:var(--dn)}
.svc-name{font-size:12px;font-weight:600;color:var(--tx)}.svc-status{font-size:10px;color:var(--tx3);margin-top:1px}
.svc-lat{font-family:var(--mono);font-size:11px;margin-left:auto;flex-shrink:0}
.run-row{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid rgba(42,46,57,.4)}
.run-name{font-size:12px;font-weight:500;color:var(--tx);flex:1}.run-time{font-family:var(--mono);font-size:10px;color:var(--tx3)}
/* SIDEBAR */
#rightsidebar{background:var(--bg0);border-left:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden}
.s-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;overflow-x:auto}
.s-tab{flex:1;min-width:36px;padding:6px 4px;text-align:center;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;transition:color .15s;position:relative;white-space:nowrap}
.s-tab:hover{color:var(--tx)}.s-tab.active{color:var(--tx)}
.s-tab.active::after{content:'';position:absolute;bottom:0;left:2px;right:2px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}
.s-content{display:none;flex:1;overflow:hidden;flex-direction:column}.s-content.active{display:flex}
/* ORDER TICKET */
.ot{padding:10px;display:flex;flex-direction:column;gap:7px;overflow-y:auto;flex:1}
.ot-sym-bar{display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:var(--r4);padding:7px 10px}
.ot-sym{font-weight:700;font-size:14px;color:#fff}.ot-exch{font-size:10px;color:var(--tx3)}
.ot-price{font-family:var(--mono);font-size:15px;font-weight:600}.ot-chg{font-family:var(--mono);font-size:11px}
.dir-grp{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.dir-btn{padding:7px;border-radius:var(--r4);font-size:13px;font-weight:700;cursor:pointer;text-align:center;border:1.5px solid transparent;transition:all .1s}
.dir-btn.buy{background:var(--live-bg);color:var(--up)}.dir-btn.buy.active,.dir-btn.buy:hover{background:var(--up);color:#fff}
.dir-btn.sell{background:rgba(242,54,69,.1);color:var(--dn)}.dir-btn.sell.active,.dir-btn.sell:hover{background:var(--dn);color:#fff}
.ot-lbl{font-size:10px;font-weight:600;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:3px}
.ot-sel,.ot-inp{background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:6px 10px;font-family:var(--mono);font-size:12px;color:var(--tx);width:100%;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none}
.ot-sel{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23787B86' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px;cursor:pointer}
.ot-inp:focus,.ot-sel:focus{border-color:var(--brand)}
.ot-summary{background:var(--bg2);border-radius:var(--r4);padding:7px 10px;display:flex;flex-direction:column;gap:3px}
.ot-sum-row{display:flex;justify-content:space-between;font-size:11px}.ot-sum-lbl{color:var(--tx2)}.ot-sum-val{font-family:var(--mono);color:var(--tx)}
.ot-risk{display:flex;align-items:center;gap:5px;font-size:11px;padding:5px 8px;border-radius:var(--r2);background:var(--live-bg);color:var(--up)}
.ot-submit{padding:9px;border-radius:var(--r4);font-size:13px;font-weight:700;cursor:pointer;text-align:center;width:100%;transition:background .15s;border:none}
.ot-submit.buy{background:var(--up);color:#fff}.ot-submit.buy:hover{background:var(--up-h)}
.ot-submit.sell{background:var(--dn);color:#fff}.ot-submit.sell:hover{background:var(--dn-h)}
/* WATCHLIST */
.wl-hdr{padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.07em;text-transform:uppercase;display:flex;justify-content:space-between;border-bottom:1px solid var(--bdr)}
.wl-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:5px 10px;border-bottom:1px solid var(--bdr);gap:4px;cursor:pointer;transition:background .08s}
.wl-row:hover{background:var(--bg2)}.wl-sym{font-weight:600;font-size:12px;color:var(--tx)}.wl-name{font-size:10px;color:var(--tx3)}
.wl-p{font-family:var(--mono);font-size:12px;text-align:right;transition:color .2s}
.wl-c{font-family:var(--mono);font-size:10px;text-align:right}.wl-c.up{color:var(--up)}.wl-c.dn{color:var(--dn)}
/* STATUS BAR */
#statusbar{background:var(--bg0);border-top:1px solid var(--bdr);display:flex;align-items:center;padding:0 10px;gap:10px;font-size:10px;color:var(--tx3);overflow:hidden}
.sb-item{display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0}
.sb-dot{width:5px;height:5px;border-radius:50%}.sb-dot.ok{background:var(--up)}.sb-dot.warn{background:var(--warn)}.sb-dot.err{background:var(--dn)}
.sb-ticker{flex:1;overflow:hidden}
.sb-tape{display:flex;gap:20px;animation:scrolll 50s linear infinite;width:max-content}
@keyframes scrolll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.tape-item{display:flex;gap:5px;font-family:var(--mono)}.tape-sym{color:var(--tx2);font-weight:600}.tape-val{color:var(--tx)}
.tape-chg.up{color:var(--up)}.tape-chg.dn{color:var(--dn)}
/* CMD */
#cmd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:60;display:none;align-items:flex-start;justify-content:center;padding-top:80px}
#cmd-overlay.open{display:flex}
#cmd-box{background:var(--bg4);border:1px solid var(--bdr-a);border-radius:var(--r8);width:560px;max-height:420px;box-shadow:var(--sh4);overflow:hidden;display:flex;flex-direction:column}
.cmd-in-wrap{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--bdr)}
.cmd-in{flex:1;background:none;border:none;outline:none;font-size:15px;color:var(--tx)}
.cmd-in::placeholder{color:var(--tx3)}
.cmd-hint{font-size:10px;color:var(--tx3);font-family:var(--mono);background:var(--bg2);padding:2px 6px;border-radius:var(--r2)}
.cmd-results{overflow-y:auto;max-height:340px}
.cmd-sec{padding:8px 16px 3px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.07em;text-transform:uppercase}
.cmd-item{display:flex;align-items:center;gap:10px;padding:8px 16px;cursor:pointer;transition:background .08s;border-left:2px solid transparent}
.cmd-item:hover,.cmd-item.sel{background:rgba(41,98,255,.1);border-left-color:var(--brand)}
.cmd-ico{width:28px;height:28px;border-radius:var(--r4);background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--tx2)}
.cmd-name{font-size:13px;color:var(--tx);font-weight:500}.cmd-desc{font-size:11px;color:var(--tx3);margin-left:auto}
.cmd-key{font-family:var(--mono);font-size:10px;color:var(--tx3);background:var(--bg2);padding:2px 5px;border-radius:var(--r2)}
/* TOAST */
#toast-wrap{position:fixed;bottom:30px;right:14px;display:flex;flex-direction:column;gap:7px;z-index:70}
.toast{background:var(--bg4);border:1px solid var(--bdr);border-radius:var(--r6);padding:9px 12px;min-width:270px;max-width:370px;box-shadow:var(--sh3);display:flex;align-items:flex-start;gap:8px;animation:tin .2s ease-out;border-left:3px solid var(--brand)}
.toast.success{border-left-color:var(--up)}.toast.error{border-left-color:var(--dn)}.toast.warn{border-left-color:var(--warn)}
.toast-body{flex:1}.toast-title{font-size:12px;font-weight:600;color:var(--tx);margin-bottom:1px}
.toast-msg{font-size:11px;color:var(--tx2);font-family:var(--mono)}
@keyframes tin{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
/* MISC */
.pill{display:inline-flex;align-items:center;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600}
.pill.up{background:var(--live-bg);color:var(--up)}.pill.dn{background:rgba(242,54,69,.1);color:var(--dn)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}.pill.info{background:var(--brand-m);color:var(--brand)}
.pill.bt{background:var(--bt-bg);color:var(--bt)}.pill.neutral{background:var(--bg2);color:var(--tx2)}
.pill.replay{background:var(--replay-bg);color:var(--replay)}
.field{display:flex;flex-direction:column;gap:3px}
.field input,.field select{background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:6px 10px;font-size:12px;color:var(--tx);outline:none;transition:border-color .15s;width:100%}
.field input:focus,.field select:focus{border-color:var(--brand)}
.field label{font-size:10px;font-weight:600;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase}
.progress-bar{height:5px;background:var(--bg2);border-radius:3px;overflow:hidden}
.progress-fill{height:100%;border-radius:3px;background:var(--brand);transition:width .5s}
canvas{display:block}
"""

print(f"CSS length: {len(CSS)} chars")

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write("PLACEHOLDER")

print(f"File created at {TARGET}")
print("Build script OK - will run full build next")
