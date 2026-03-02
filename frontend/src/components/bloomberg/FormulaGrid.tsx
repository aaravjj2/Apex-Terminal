import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type CellFormat = 'general' | 'number' | 'percentage' | 'currency' | 'date';
type SortDir = 'asc' | 'desc' | null;

interface CellData {
  raw: string;
  formula: string;
  computed: number | string | null;
  format: CellFormat;
  error?: string;
}

interface FormulaGridProps {
  initialRows?: number;
  initialCols?: number;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function colLabel(c: number): string {
  let label = '';
  let n = c;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function cellRef(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let col = 0;
  for (let i = 0; i < match[1].length; i++) {
    col = col * 26 + (match[1].charCodeAt(i) - 64);
  }
  return { row: parseInt(match[2]) - 1, col: col - 1 };
}

function parseRange(rangeStr: string): { row: number; col: number }[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];
  const cells: { row: number; col: number }[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

const FINANCIAL_DATA: Record<string, number> = {
  PX_LAST: 189.84, PX_OPEN: 187.50, PX_HIGH: 191.20, PX_LOW: 186.90,
  PX_VOLUME: 52340000, PE_RATIO: 29.5, MARKET_CAP: 3200000000000,
  PX_BID: 189.82, PX_ASK: 189.86, EPS: 6.43, DIVIDEND_YIELD: 0.52,
};

function evaluateFormula(
  formula: string,
  getCell: (r: number, c: number) => number | null,
): number | string | null {
  const f = formula.trim();

  if (FINANCIAL_DATA[f.toUpperCase()] !== undefined) {
    return FINANCIAL_DATA[f.toUpperCase()];
  }

  const ref = parseCellRef(f.toUpperCase());
  if (ref) return getCell(ref.row, ref.col);

  const fnMatch = f.match(/^(\w+)\((.+)\)$/i);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const argStr = fnMatch[2];

    const resolveArgs = (s: string): number[] => {
      const vals: number[] = [];
      s.split(',').forEach(part => {
        const trimmed = part.trim().toUpperCase();
        if (trimmed.includes(':')) {
          parseRange(trimmed).forEach(c => {
            const v = getCell(c.row, c.col);
            if (v !== null) vals.push(v);
          });
        } else {
          const cr = parseCellRef(trimmed);
          if (cr) {
            const v = getCell(cr.row, cr.col);
            if (v !== null) vals.push(v);
          } else {
            const n = parseFloat(trimmed);
            if (!isNaN(n)) vals.push(n);
          }
        }
      });
      return vals;
    };

    const nums = resolveArgs(argStr);

    switch (fnName) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0);
      case 'AVG':
      case 'AVERAGE': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      case 'MIN': return nums.length ? Math.min(...nums) : 0;
      case 'MAX': return nums.length ? Math.max(...nums) : 0;
      case 'COUNT': return nums.length;
      case 'STDEV': {
        if (nums.length < 2) return 0;
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1);
        return Math.sqrt(variance);
      }
      case 'IF': {
        const parts = argStr.split(',').map(s => s.trim());
        if (parts.length < 3) return '#ARG!';
        const condition = resolveArgs(parts[0]);
        const trueVal = resolveArgs(parts[1]);
        const falseVal = resolveArgs(parts[2]);
        return (condition[0] ?? 0) !== 0 ? (trueVal[0] ?? 0) : (falseVal[0] ?? 0);
      }
      case 'VLOOKUP': return '#N/A';
      case 'RANK': {
        const [val, ...rest] = nums;
        if (val === undefined) return '#VALUE!';
        const sorted = [...rest].sort((a, b) => b - a);
        return sorted.indexOf(val) + 1;
      }
      default:
        if (FINANCIAL_DATA[fnName] !== undefined) return FINANCIAL_DATA[fnName];
        return `#NAME?`;
    }
  }

  const num = parseFloat(f);
  if (!isNaN(num)) return num;

  if (f.length > 0) return f;
  return null;
}

function formatValue(val: number | string | null, fmt: CellFormat): string {
  if (val === null) return '';
  if (typeof val === 'string') return val;
  switch (fmt) {
    case 'number': return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'percentage': return (val * 100).toFixed(2) + '%';
    case 'currency': return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'date': return new Date(val).toLocaleDateString();
    default: return typeof val === 'number' ? (Number.isInteger(val) ? val.toString() : val.toFixed(4)) : String(val);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FormulaGrid({
  initialRows = 30,
  initialCols = 12,
  className = '',
}: FormulaGridProps) {
  const [numRows, setNumRows] = useState(initialRows);
  const [numCols, setNumCols] = useState(initialCols);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selection, setSelection] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [frozenRows, setFrozenRows] = useState(0);
  const [frozenCols, setFrozenCols] = useState(0);
  const [colWidths, setColWidths] = useState<number[]>(Array(initialCols).fill(100));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const resizingCol = useRef<{ col: number; startX: number; startWidth: number } | null>(null);

  const getCell = useCallback((r: number, c: number): number | null => {
    const key = cellRef(r, c);
    const cell = cells[key];
    if (!cell) return null;
    const val = cell.computed;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? null : n; }
    return null;
  }, [cells]);

  const recompute = useCallback((newCells: Record<string, CellData>) => {
    const updated = { ...newCells };
    Object.entries(updated).forEach(([key, cell]) => {
      if (cell.formula.startsWith('=')) {
        const result = evaluateFormula(cell.formula.substring(1), (r, c) => {
          const k = cellRef(r, c);
          const v = updated[k]?.computed;
          return typeof v === 'number' ? v : null;
        });
        updated[key] = { ...cell, computed: result, error: typeof result === 'string' && result.startsWith('#') ? result : undefined };
      }
    });
    return updated;
  }, []);

  const setCellValue = useCallback((row: number, col: number, raw: string) => {
    const key = cellRef(row, col);
    const isFormula = raw.startsWith('=');
    const formula = raw;
    let computed: number | string | null = null;
    if (!isFormula) {
      const n = parseFloat(raw);
      computed = !isNaN(n) ? n : (raw || null);
    }
    setCells(prev => {
      const existing = prev[key];
      const newCells = {
        ...prev,
        [key]: {
          raw,
          formula,
          computed,
          format: existing?.format ?? 'general',
        },
      };
      return recompute(newCells);
    });
  }, [recompute]);

  const startEdit = useCallback((row: number, col: number) => {
    const key = cellRef(row, col);
    setEditingCell({ row, col });
    setEditValue(cells[key]?.raw ?? '');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [cells]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    setCellValue(editingCell.row, editingCell.col, editValue);
    setEditingCell(null);
  }, [editingCell, editValue, setCellValue]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeCell) return;

    if (e.key === 'Enter') {
      if (editingCell) {
        commitEdit();
        setActiveCell({ row: activeCell.row + 1, col: activeCell.col });
      } else {
        startEdit(activeCell.row, activeCell.col);
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) commitEdit();
      setActiveCell({ row: activeCell.row, col: Math.min(activeCell.col + (e.shiftKey ? -1 : 1), numCols - 1) });
    } else if (!editingCell) {
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveCell(p => p ? { ...p, row: Math.max(0, p.row - 1) } : p); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveCell(p => p ? { ...p, row: Math.min(numRows - 1, p.row + 1) } : p); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveCell(p => p ? { ...p, col: Math.max(0, p.col - 1) } : p); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setActiveCell(p => p ? { ...p, col: Math.min(numCols - 1, p.col + 1) } : p); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const key = cellRef(activeCell.row, activeCell.col);
        setCells(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        startEdit(activeCell.row, activeCell.col);
        setEditValue(e.key);
      }
    }
  }, [activeCell, editingCell, commitEdit, startEdit, numRows, numCols]);

  const handleSort = useCallback((col: number) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }, [sortCol]);

  const handleContextMenu = useCallback((e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row, col });
  }, []);

  const setCellFormat = useCallback((row: number, col: number, format: CellFormat) => {
    const key = cellRef(row, col);
    setCells(prev => {
      const cell = prev[key];
      if (!cell) return prev;
      return { ...prev, [key]: { ...cell, format } };
    });
    setContextMenu(null);
  }, []);

  const exportCSV = useCallback(() => {
    let csv = '';
    csv += ['', ...Array.from({ length: numCols }, (_, c) => colLabel(c))].join(',') + '\n';
    for (let r = 0; r < numRows; r++) {
      const row = [String(r + 1)];
      for (let c = 0; c < numCols; c++) {
        const key = cellRef(r, c);
        const cell = cells[key];
        row.push(cell ? formatValue(cell.computed, cell.format) : '');
      }
      csv += row.join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bloomberg-grid.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [cells, numRows, numCols]);

  const handleCopy = useCallback(() => {
    if (!activeCell) return;
    const key = cellRef(activeCell.row, activeCell.col);
    const cell = cells[key];
    if (cell) navigator.clipboard.writeText(cell.raw);
  }, [activeCell, cells]);

  const handlePaste = useCallback(async () => {
    if (!activeCell) return;
    const text = await navigator.clipboard.readText();
    const lines = text.split('\n');
    lines.forEach((line, ri) => {
      line.split('\t').forEach((val, ci) => {
        setCellValue(activeCell.row + ri, activeCell.col + ci, val.trim());
      });
    });
  }, [activeCell, setCellValue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') handleCopy();
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') handlePaste();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCopy, handlePaste]);

  const handleColResize = useCallback((e: React.MouseEvent, col: number) => {
    e.preventDefault();
    resizingCol.current = { col, startX: e.clientX, startWidth: colWidths[col] };

    const onMove = (me: MouseEvent) => {
      if (!resizingCol.current) return;
      const diff = me.clientX - resizingCol.current.startX;
      setColWidths(prev => {
        const next = [...prev];
        next[resizingCol.current!.col] = Math.max(40, resizingCol.current!.startWidth + diff);
        return next;
      });
    };
    const onUp = () => {
      resizingCol.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [colWidths]);

  const sortedRows = useMemo(() => {
    const rows = Array.from({ length: numRows }, (_, i) => i);
    if (sortCol === null || sortDir === null) return rows;
    return rows.sort((a, b) => {
      const keyA = cellRef(a, sortCol);
      const keyB = cellRef(b, sortCol);
      const vA = cells[keyA]?.computed ?? '';
      const vB = cells[keyB]?.computed ?? '';
      const nA = typeof vA === 'number' ? vA : parseFloat(String(vA));
      const nB = typeof vB === 'number' ? vB : parseFloat(String(vB));
      if (!isNaN(nA) && !isNaN(nB)) return sortDir === 'asc' ? nA - nB : nB - nA;
      return sortDir === 'asc' ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    });
  }, [numRows, sortCol, sortDir, cells]);

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}
      onKeyDown={handleCellKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <span className="text-[#ff9900] font-bold text-xs tracking-wider">BQL GRID</span>
        <div className="flex-1 flex items-center gap-1">
          <span className="text-[10px] text-[#555]">
            {activeCell ? cellRef(activeCell.row, activeCell.col) : '—'}
          </span>
          <span className="text-[10px] text-[#333]">│</span>
          <span className="text-[10px] text-[#666] truncate">
            {activeCell ? (cells[cellRef(activeCell.row, activeCell.col)]?.formula ?? '') : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFrozenRows(frozenRows > 0 ? 0 : (activeCell?.row ?? 0) + 1)}
            className={`text-[10px] ${frozenRows > 0 ? 'text-[#ff9900]' : 'text-[#555]'} hover:text-[#ff9900]`}>
            ❄ FREEZE R{frozenRows}
          </button>
          <button onClick={() => setFrozenCols(frozenCols > 0 ? 0 : (activeCell?.col ?? 0) + 1)}
            className={`text-[10px] ${frozenCols > 0 ? 'text-[#ff9900]' : 'text-[#555]'} hover:text-[#ff9900]`}>
            ❄ FREEZE C{frozenCols}
          </button>
          <button onClick={exportCSV} className="text-[10px] text-[#555] hover:text-[#ff9900]">EXPORT CSV</button>
        </div>
      </div>

      {/* Formula Bar */}
      {editingCell && (
        <div className="flex items-center px-3 py-1 border-b border-[#1a1a2e] bg-[#0a0a14]">
          <span className="text-[#ff9900] text-xs mr-2 font-bold">
            {cellRef(editingCell.row, editingCell.col)}
          </span>
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { commitEdit(); e.preventDefault(); }
              if (e.key === 'Escape') setEditingCell(null);
            }}
            className="flex-1 bg-transparent text-[#ff9900] text-xs outline-none caret-[#ff9900]"
            spellCheck={false}
          />
        </div>
      )}

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto min-h-0">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-[#0f0f1e] border-b border-r border-[#1a1a2e] w-10 text-[10px] text-[#555]" />
              {Array.from({ length: numCols }, (_, c) => (
                <th
                  key={c}
                  className={`sticky top-0 z-10 bg-[#0f0f1e] border-b border-r border-[#1a1a2e] text-[10px] text-[#555] cursor-pointer hover:text-[#ff9900] relative select-none ${
                    c < frozenCols ? 'sticky left-10 z-20' : ''
                  }`}
                  style={{ width: colWidths[c], minWidth: colWidths[c] }}
                  onClick={() => handleSort(c)}
                >
                  <span>{colLabel(c)}</span>
                  {sortCol === c && sortDir && (
                    <span className="ml-0.5 text-[#ff9900]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#ff9900]/40"
                    onMouseDown={e => handleColResize(e, c)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr key={row} className={row < frozenRows ? 'sticky z-10' : ''}>
                <td className={`sticky left-0 z-10 bg-[#0f0f1e] border-b border-r border-[#1a1a2e] text-[10px] text-[#555] text-center w-10 ${
                  row < frozenRows ? 'z-20' : ''
                }`}>{row + 1}</td>
                {Array.from({ length: numCols }, (_, col) => {
                  const key = cellRef(row, col);
                  const cell = cells[key];
                  const isActive = activeCell?.row === row && activeCell?.col === col;
                  const isEditing = editingCell?.row === row && editingCell?.col === col;
                  return (
                    <td
                      key={col}
                      onClick={() => { setActiveCell({ row, col }); if (editingCell) commitEdit(); }}
                      onDoubleClick={() => startEdit(row, col)}
                      onContextMenu={e => handleContextMenu(e, row, col)}
                      className={`border-b border-r border-[#1a1a2e] text-xs px-1.5 py-0.5 cursor-cell transition-colors ${
                        isActive ? 'bg-[#1a1a2e] ring-1 ring-[#ff9900]/50' : 'hover:bg-[#0f0f1e]'
                      } ${isEditing ? 'ring-2 ring-[#ff9900]' : ''} ${
                        cell?.error ? 'text-[#ff3333]' : 'text-[#ccc]'
                      } ${col < frozenCols ? 'sticky left-10 z-10 bg-[#0a0a14]' : ''}`}
                      style={{ width: colWidths[col], minWidth: colWidths[col] }}
                    >
                      {isEditing ? null : (cell ? formatValue(cell.computed, cell.format) : '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-[#0f0f1e] border border-[#1a1a2e] rounded shadow-xl py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(['general', 'number', 'percentage', 'currency', 'date'] as CellFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => setCellFormat(contextMenu.row, contextMenu.col, fmt)}
                className="w-full text-left px-3 py-1 text-xs text-[#ccc] hover:bg-[#1a1a2e] hover:text-[#ff9900]"
              >
                Format: {fmt}
              </button>
            ))}
            <div className="border-t border-[#1a1a2e] my-1" />
            <button onClick={() => { handleCopy(); setContextMenu(null); }}
              className="w-full text-left px-3 py-1 text-xs text-[#ccc] hover:bg-[#1a1a2e] hover:text-[#ff9900]">Copy</button>
            <button onClick={() => { handlePaste(); setContextMenu(null); }}
              className="w-full text-left px-3 py-1 text-xs text-[#ccc] hover:bg-[#1a1a2e] hover:text-[#ff9900]">Paste</button>
          </div>
        </>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#1a1a2e] bg-[#0f0f1e] text-[10px] text-[#555]">
        <span>{numRows}×{numCols} • {Object.keys(cells).length} cells</span>
        <div className="flex gap-2">
          <span>FN: SUM AVG MIN MAX STDEV COUNT IF VLOOKUP RANK</span>
          <span className="text-[#333]">│</span>
          <span>BQL: PX_LAST PX_OPEN PX_HIGH PX_LOW PX_VOLUME PE_RATIO MARKET_CAP</span>
        </div>
      </div>
    </div>
  );
}
