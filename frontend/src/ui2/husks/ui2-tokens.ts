import type { CSSProperties } from 'react';

// Bloomberg Terminal design tokens shared by all husk components
export const BG     = '#040407';
export const PANEL  = '#0c0c14';
export const BORDER = '#1e1e2e';
export const AMBER  = '#ff9900';
export const GREEN  = '#00d88a';
export const RED    = '#ff3b5c';
export const SUBTLE = '#5d5d7d';
export const TEXT   = '#e8e8ee';
export const MONO   = "'IBM Plex Mono','Roboto Mono','Courier New',monospace";

export const panelStyle: CSSProperties = {
  background:    PANEL,
  border:        `1px solid ${BORDER}`,
  borderTop:     `2px solid ${AMBER}`,
  borderRadius:  0,
  overflow:      'hidden',
  display:       'flex',
  flexDirection: 'column',
};

export const panelHdr: CSSProperties = {
  padding:        '4px 10px',
  background:     'rgba(255,153,0,0.06)',
  borderBottom:   `1px solid ${BORDER}`,
  fontSize:       9,
  color:          AMBER,
  fontWeight:     700,
  letterSpacing:  '0.12em',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  textTransform:  'uppercase',
  fontFamily:     MONO,
};
