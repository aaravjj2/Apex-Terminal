/**
 * DataTable — Bloomberg Terminal Edition
 * Dense tabular data display with Bloomberg styling
 */
// ─── Bloomberg palette ───────────────────────────────────────────────────────
const PANEL='#0c0c14',BORDER='#1e1e2e'
const GREEN='#00d88a',RED='#ff3b5c'
const SUBTLE='#5d5d7d',TEXT='#e8e8ee'
const MONO="'IBM Plex Mono','Roboto Mono','Courier New',monospace"

import React from 'react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode;
  className?: string;
  format?: 'number' | 'currency' | 'percent' | 'date' | 'time' | 'datetime';
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: string;
  onRowClick?: (row: T, index: number) => void;
  selectedRowKey?: string | number;
  highlightRowKey?: string | number | null;
  density?: 'compact' | 'normal';
  testId?: string;
  striped?: boolean;
}

/* ─── Formatting Utilities ──────────────────────────────────────────────── */
export function formatValue(value: unknown, format?: string): string {
  if(value===null||value===undefined||(typeof value==='number'&&isNaN(value as number))) return '—';
  if(format==='number') return Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  if(format==='currency') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
  if(format==='percent') return `${(Number(value)*100).toFixed(2)}%`;
  if(format==='date') return new Date(value as string).toLocaleDateString();
  if(format==='time') return new Date(value as string).toLocaleTimeString();
  if(format==='datetime') return new Date(value as string).toLocaleString();
  return String(value);
}

export function formatPnL(value: number|null|undefined): {text:string;color:string} {
  if(value===null||value===undefined||isNaN(value)) return {text:'—',color:SUBTLE};
  const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  if(value>0) return {text:`+${fmt}`,color:GREEN};
  if(value<0) return {text:fmt,color:RED};
  return {text:fmt,color:SUBTLE};
}

export function formatPercent(value: number|null|undefined): {text:string;color:string} {
  if(value===null||value===undefined||isNaN(value)) return {text:'—',color:SUBTLE};
  const p=(value*100).toFixed(2);
  const text=value>0?`+${p}%`:`${p}%`;
  if(value>0) return {text,color:GREEN};
  if(value<0) return {text,color:RED};
  return {text:'0.00%',color:SUBTLE};
}

/* ─── DataTable Component ───────────────────────────────────────────────── */
export function DataTable<T extends Record<string, unknown>>({
  columns,data,keyField='id',onRowClick,selectedRowKey,highlightRowKey,
  density='compact',testId,striped=false,
}: DataTableProps<T>) {
  const rh = density==='compact'?'30px':'38px';

  return (
    <div data-testid={testId}
      style={{width:'100%',overflow:'auto',border:`1px solid ${BORDER}`,borderRadius:2,fontFamily:MONO}}>
      <table style={{width:'100%',borderCollapse:'collapse' as const}}>
        <thead>
          <tr style={{background:PANEL,borderBottom:`1px solid ${BORDER}`,
            position:'sticky' as const,top:0,zIndex:10}}>
            {columns.map(col=>(
              <th key={col.key} className={col.className}
                style={{padding:'5px 10px',textAlign:(col.align||'left') as React.CSSProperties['textAlign'],
                  fontSize:9,fontWeight:600,color:SUBTLE,textTransform:'uppercase' as const,
                  letterSpacing:'0.1em',width:col.width,borderBottom:`1px solid ${BORDER}`,
                  whiteSpace:'nowrap' as const,background:PANEL}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length===0?(
            <tr><td colSpan={columns.length}
              style={{padding:'32px 20px',textAlign:'center' as const,color:SUBTLE,fontSize:11}}>
              No data available
            </td></tr>
          ):(
            data.map((row,rowIndex)=>{
              const rowKey=(row[keyField]??rowIndex) as string|number;
              const isSel=selectedRowKey===rowKey;
              const isHL=highlightRowKey!=null&&String(highlightRowKey)===String(rowKey);
              const isEven=rowIndex%2===0;
              let bg=isHL?`${GREEN}18`:isSel?`${GREEN}22`:striped&&!isEven?`${BORDER}44`:'transparent';

              return (
                <tr key={rowKey} data-testid={`${testId}-row-${rowIndex}`}
                  data-row-key={String(rowKey)} data-highlighted={isHL?'true':undefined}
                  onClick={()=>onRowClick?.(row,rowIndex)}
                  style={{height:rh,background:bg,borderBottom:`1px solid ${BORDER}`,
                    cursor:onRowClick?'pointer':'default',transition:'background 0.08s'}}
                  onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLTableRowElement).style.background=`${BORDER}88`;}}
                  onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLTableRowElement).style.background=bg;}}>
                  {columns.map(col=>{
                    const value=row[col.key];
                    let rendered:React.ReactNode;
                    if(col.render) rendered=col.render(value,row,rowIndex);
                    else if(col.format) rendered=formatValue(value,col.format);
                    else rendered=value===null||value===undefined||(typeof value==='number'&&isNaN(value as number))
                      ?'—':String(value);
                    return (
                      <td key={col.key} className={col.className}
                        style={{padding:'5px 10px',textAlign:(col.align||'left') as React.CSSProperties['textAlign'],
                          fontSize:11,color:TEXT,borderBottom:`1px solid ${BORDER}`,
                          whiteSpace:'nowrap' as const,overflow:'hidden' as const,
                          textOverflow:'ellipsis' as const}}>
                        {rendered}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

