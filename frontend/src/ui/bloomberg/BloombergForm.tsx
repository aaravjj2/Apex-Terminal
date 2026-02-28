/**
 * BloombergForm.tsx
 * Bloomberg-style form control library.
 * Input, Select, DateRange, Slider, Checkbox, Radio,
 * Toggle, TagInput, NumberInput, SearchBox, FormGroup,
 * FormSection, CommandPalette, and useForm hook.
 */

import React, { useState, useCallback, useRef, useEffect, createContext, useContext, useMemo } from 'react';

// ─── Shared Styles ─────────────────────────────────────────────────────────────

const BASE_INPUT_STYLE: React.CSSProperties = {
  background: '#0a1628', border: '1px solid #1a2a38', borderRadius: 2,
  color: '#ccc', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

function focusStyle(isFocused: boolean): React.CSSProperties {
  return isFocused ? { borderColor: '#4a9eff', boxShadow: '0 0 0 2px #4a9eff22' } : {};
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BloombergInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  onChange?: (value: string) => void;
}

export const BloombergInput: React.FC<BloombergInputProps> = ({
  label, helperText, errorText, prefix, suffix, onChange, ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const hasError = !!errorText;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', ...focusStyle(focused), borderRadius: 2, border: `1px solid ${hasError ? '#ff4466' : focused ? '#4a9eff' : '#1a2a38'}`, background: '#0a1628' }}>
        {prefix && <span style={{ color: '#555', padding: '0 8px', fontSize: 11, fontFamily: 'monospace', borderRight: '1px solid #1a2a38' }}>{prefix}</span>}
        <input
          {...rest}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
          onChange={e => onChange?.(e.target.value)}
          style={{ ...BASE_INPUT_STYLE, border: 'none', background: 'transparent', boxShadow: 'none', flex: 1 }}
        />
        {suffix && <span style={{ color: '#555', padding: '0 8px', fontSize: 11, fontFamily: 'monospace', borderLeft: '1px solid #1a2a38' }}>{suffix}</span>}
      </div>
      {errorText && <span style={{ color: '#ff4466', fontSize: 9, fontFamily: 'monospace' }}>{errorText}</span>}
      {helperText && !errorText && <span style={{ color: '#444', fontSize: 9, fontFamily: 'monospace' }}>{helperText}</span>}
    </div>
  );
};

// ─── NumberInput ──────────────────────────────────────────────────────────────

export interface BloombergNumberInputProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  helperText?: string;
  errorText?: string;
}

export const BloombergNumberInput: React.FC<BloombergNumberInputProps> = ({
  label, value, onChange, min = -Infinity, max = Infinity, step = 1, decimals = 2, prefix, suffix, helperText, errorText,
}) => {
  const [focused, setFocused] = useState(false);
  const [inputVal, setInputVal] = useState(value.toFixed(decimals));

  useEffect(() => { if (!focused) setInputVal(value.toFixed(decimals)); }, [value, focused, decimals]);

  function handleChange(s: string) {
    setInputVal(s);
    const n = parseFloat(s);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${errorText ? '#ff4466' : focused ? '#4a9eff' : '#1a2a38'}`, borderRadius: 2, background: '#0a1628' }}>
        {prefix && <span style={{ color: '#555', padding: '0 8px', borderRight: '1px solid #1a2a38', fontSize: 11, fontFamily: 'monospace' }}>{prefix}</span>}
        <button onClick={() => onChange(Math.max(min, value - step))} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '0 6px', fontSize: 14, lineHeight: 1 }}>−</button>
        <input
          type="text" value={inputVal}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setInputVal(value.toFixed(decimals)); }}
          style={{ ...BASE_INPUT_STYLE, border: 'none', background: 'transparent', width: 80, textAlign: 'center' }}
        />
        <button onClick={() => onChange(Math.min(max, value + step))} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '0 6px', fontSize: 14, lineHeight: 1 }}>+</button>
        {suffix && <span style={{ color: '#555', padding: '0 8px', borderLeft: '1px solid #1a2a38', fontSize: 11, fontFamily: 'monospace' }}>{suffix}</span>}
      </div>
      {errorText && <span style={{ color: '#ff4466', fontSize: 9 }}>{errorText}</span>}
      {helperText && !errorText && <span style={{ color: '#444', fontSize: 9 }}>{helperText}</span>}
    </div>
  );
};

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectOption { value: string; label: string; disabled?: boolean; group?: string; }

export interface BloombergSelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  errorText?: string;
}

export const BloombergSelect: React.FC<BloombergSelectProps> = ({
  label, value, onChange, options, placeholder, helperText, errorText,
}) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Group options
  const grouped = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    options.forEach(o => {
      const g = o.group || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    });
    return map;
  }, [options]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }} ref={ref}>
      {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
      <div
        tabIndex={0} onClick={() => setOpen(o => !o)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...BASE_INPUT_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: `1px solid ${errorText ? '#ff4466' : focused || open ? '#4a9eff' : '#1a2a38'}` }}
      >
        <span style={{ color: selected ? '#ccc' : '#555' }}>{selected?.label ?? placeholder ?? 'Select...'}</span>
        <span style={{ color: '#555', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : undefined }}>▾</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: label ? 50 : 34, left: 0, right: 0, background: '#0e1c2e', border: '1px solid #1a2a38', borderRadius: 2, zIndex: 1000, maxHeight: 200, overflowY: 'auto' }}>
          {Array.from(grouped.entries()).map(([group, opts]) => (
            <div key={group}>
              {group && <div style={{ padding: '4px 10px', color: '#444', fontSize: 8, fontFamily: 'monospace', background: '#0a1628' }}>{group.toUpperCase()}</div>}
              {opts.map(o => (
                <div key={o.value} onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                  style={{ padding: '7px 12px', cursor: o.disabled ? 'not-allowed' : 'pointer', background: o.value === value ? '#1a2a44' : 'transparent', color: o.disabled ? '#444' : o.value === value ? '#4a9eff' : '#bbb', fontSize: 11, fontFamily: 'monospace' }}>
                  {o.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {errorText && <span style={{ color: '#ff4466', fontSize: 9 }}>{errorText}</span>}
      {helperText && !errorText && <span style={{ color: '#444', fontSize: 9 }}>{helperText}</span>}
    </div>
  );
};

// ─── Slider ───────────────────────────────────────────────────────────────────

export interface BloombergSliderProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  formatValue?: (v: number) => string;
  color?: string;
}

export const BloombergSlider: React.FC<BloombergSliderProps> = ({
  label, value, onChange, min = 0, max = 100, step = 1, showValue = true, formatValue, color = '#4a9eff',
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 2 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
          {showValue && <span style={{ color: color, fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}>{display}</span>}
        </div>
      )}
      <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: '#0a1628', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, background: color, borderRadius: 2 }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 18 }}
        />
        <div style={{ position: 'absolute', left: `calc(${pct}% - 8px)`, width: 16, height: 16, background: color, borderRadius: '50%', border: '2px solid #060e18', cursor: 'pointer', pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
        <span style={{ color: '#444', fontSize: 8, fontFamily: 'monospace' }}>{formatValue ? formatValue(min) : min}</span>
        <span style={{ color: '#444', fontSize: 8, fontFamily: 'monospace' }}>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
};

// ─── DateRange ─────────────────────────────────────────────────────────────────

export interface DateRange { from: string; to: string; }

export interface BloombergDateRangeProps {
  label?: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: Array<{ label: string; range: DateRange }>;
}

export const BloombergDateRange: React.FC<BloombergDateRangeProps> = ({ label, value, onChange, presets }) => {
  const DEFAULT_PRESETS: Array<{ label: string; range: DateRange }> = [
    { label: '1W', range: { from: daysAgo(7), to: today() } },
    { label: '1M', range: { from: daysAgo(30), to: today() } },
    { label: '3M', range: { from: daysAgo(90), to: today() } },
    { label: 'YTD', range: { from: ytdStart(), to: today() } },
    { label: '1Y', range: { from: daysAgo(365), to: today() } },
    { label: '5Y', range: { from: daysAgo(1825), to: today() } },
  ];
  const allPresets = presets ?? DEFAULT_PRESETS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })}
          style={{ ...BASE_INPUT_STYLE, width: 130 }} />
        <span style={{ color: '#555', fontSize: 10 }}>→</span>
        <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })}
          style={{ ...BASE_INPUT_STYLE, width: 130 }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {allPresets.map((p, i) => (
          <button key={i} onClick={() => onChange(p.range)} style={{
            padding: '2px 8px', background: '#0a1628', border: '1px solid #1a2a38', borderRadius: 2,
            color: '#888', cursor: 'pointer', fontSize: 9, fontFamily: 'monospace',
          }}>{p.label}</button>
        ))}
      </div>
    </div>
  );
};

// ─── Date Helpers ──────────────────────────────────────────────────────────────
function today(): string { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function ytdStart(): string { return `${new Date().getFullYear()}-01-01`; }

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export interface BloombergCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  helperText?: string;
}

export const BloombergCheckbox: React.FC<BloombergCheckboxProps> = ({ label, checked, onChange, disabled, helperText }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
    <div onClick={() => !disabled && onChange(!checked)} style={{
      width: 14, height: 14, borderRadius: 2, border: `1px solid ${checked ? '#4a9eff' : '#1a2a38'}`,
      background: checked ? '#4a9eff' : '#0a1628', flexShrink: 0, marginTop: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && <span style={{ color: '#000', fontSize: 10, lineHeight: 1 }}>✓</span>}
    </div>
    <div>
      <div style={{ color: '#ccc', fontSize: 11, fontFamily: 'monospace' }}>{label}</div>
      {helperText && <div style={{ color: '#444', fontSize: 9, fontFamily: 'monospace' }}>{helperText}</div>}
    </div>
  </label>
);

// ─── Toggle ───────────────────────────────────────────────────────────────────

export interface BloombergToggleProps {
  label?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
  color?: string;
}

export const BloombergToggle: React.FC<BloombergToggleProps> = ({
  label, checked, onChange, disabled, labelOn = 'ON', labelOff = 'OFF', color = '#4a9eff',
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {label && <span style={{ color: '#888', fontSize: 10, fontFamily: 'monospace' }}>{label}</span>}
    <div onClick={() => !disabled && onChange(!checked)} style={{
      width: 36, height: 18, borderRadius: 9, background: checked ? color : '#1a2a38',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2, width: 14, height: 14,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
    <span style={{ color: checked ? color : '#444', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>
      {checked ? labelOn : labelOff}
    </span>
  </div>
);

// ─── TagInput ─────────────────────────────────────────────────────────────────

export interface BloombergTagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  validateTag?: (tag: string) => boolean;
}

export const BloombergTagInput: React.FC<BloombergTagInputProps> = ({
  label, tags, onChange, placeholder = 'Add tag...', maxTags = 20, validateTag,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [focused, setFocused] = useState(false);

  function addTag(val: string) {
    const trimmed = val.trim().toUpperCase();
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return;
    if (validateTag && !validateTag(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputVal('');
  }

  function removeTag(tag: string) { onChange(tags.filter(t => t !== tag)); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); }
    if (e.key === 'Backspace' && !inputVal && tags.length) removeTag(tags[tags.length - 1]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {label && <label style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{label.toUpperCase()}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px', background: '#0a1628', border: `1px solid ${focused ? '#4a9eff' : '#1a2a38'}`, borderRadius: 2, minHeight: 34, alignItems: 'center' }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1a2a44', color: '#4a9eff', fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 2 }}>
            {t}
            <span onClick={() => removeTag(t)} style={{ cursor: 'pointer', color: '#666', fontSize: 11, lineHeight: 1 }}>×</span>
          </span>
        ))}
        <input
          value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); addTag(inputVal); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: '#ccc', fontSize: 11, fontFamily: 'monospace', minWidth: 80, flex: 1 }}
        />
      </div>
    </div>
  );
};

// ─── SearchBox ────────────────────────────────────────────────────────────────

export interface SearchResult { id: string; label: string; category?: string; subtitle?: string; }

export interface BloombergSearchBoxProps {
  placeholder?: string;
  onSearch: (query: string) => SearchResult[] | Promise<SearchResult[]>;
  onSelect: (result: SearchResult) => void;
  minChars?: number;
}

export const BloombergSearchBox: React.FC<BloombergSearchBoxProps> = ({
  placeholder = 'Search...', onSearch, onSelect, minChars = 1,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < minChars) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const r = onSearch(query);
    Promise.resolve(r).then(res => { setResults(res); setOpen(true); setLoading(false); });
  }, [query, minChars]);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <BloombergInput
        value={query} onChange={setQuery} placeholder={placeholder}
        prefix="🔍" suffix={loading ? '⏳' : undefined}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0e1c2e', border: '1px solid #1a2a38', borderRadius: 2, zIndex: 1000, maxHeight: 240, overflowY: 'auto', marginTop: 2 }}>
          {results.map(r => (
            <div key={r.id} onClick={() => { onSelect(r); setQuery(r.label); setOpen(false); }}
              style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #0a1628' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc', fontSize: 11, fontFamily: 'monospace' }}>{r.label}</span>
                {r.category && <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{r.category}</span>}
              </div>
              {r.subtitle && <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{r.subtitle}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── FormGroup ────────────────────────────────────────────────────────────────

export const FormGroup: React.FC<{ label?: string; children: React.ReactNode; row?: boolean; gap?: number }> = ({
  label, children, row = false, gap = 12,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>}
    <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap, flexWrap: row ? 'wrap' : undefined }}>
      {children}
    </div>
  </div>
);

// ─── FormSection ──────────────────────────────────────────────────────────────

export const FormSection: React.FC<{ title: string; subtitle?: string; collapsible?: boolean; children: React.ReactNode }> = ({
  title, subtitle, collapsible = false, children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ background: '#0e1c2e', borderRadius: 4, border: '1px solid #1a2a38', overflow: 'hidden', marginBottom: 12 }}>
      <div onClick={() => collapsible && setCollapsed(c => !c)}
        style={{ padding: '10px 14px', borderBottom: collapsed ? 'none' : '1px solid #1a2a38', cursor: collapsible ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#ccc', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }}>{title}</div>
          {subtitle && <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {collapsible && <span style={{ color: '#555', fontSize: 12 }}>{collapsed ? '▸' : '▾'}</span>}
      </div>
      {!collapsed && <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>}
    </div>
  );
};

// ─── useForm Hook ─────────────────────────────────────────────────────────────

type Validator<T> = (value: T) => string | undefined;
type FieldConfig<T> = { initial: T; validators?: Array<Validator<T>> };
type FormSchema = Record<string, FieldConfig<any>>;
type FormValues<S extends FormSchema> = { [K in keyof S]: S[K]['initial'] };
type FormErrors<S extends FormSchema> = { [K in keyof S]?: string };
type FormTouched<S extends FormSchema> = { [K in keyof S]?: boolean };

export function useForm<S extends FormSchema>(schema: S) {
  type V = FormValues<S>;
  type E = FormErrors<S>;
  type T = FormTouched<S>;

  const [values, setValues] = useState<V>(() =>
    Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.initial])) as V
  );
  const [errors, setErrors] = useState<E>({});
  const [touched, setTouched] = useState<T>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(vals = values): E {
    const errs: E = {};
    for (const [key, config] of Object.entries(schema)) {
      for (const v of config.validators ?? []) {
        const err = v(vals[key]);
        if (err) { (errs as any)[key] = err; break; }
      }
    }
    return errs;
  }

  function set<K extends keyof S>(key: K, value: V[K]) {
    setValues(v => ({ ...v, [key]: value }));
    setTouched(t => ({ ...t, [key]: true }));
    const errs = validate({ ...values, [key]: value });
    setErrors(e => ({ ...e, [key]: (errs as any)[key] }));
  }

  function touch(key: keyof S) { setTouched(t => ({ ...t, [key]: true })); }

  function reset() { setValues(Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.initial])) as V); setErrors({}); setTouched({}); }

  async function handleSubmit(onSubmit: (values: V) => Promise<void> | void) {
    const allTouched = Object.fromEntries(Object.keys(schema).map(k => [k, true])) as T;
    setTouched(allTouched);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try { await onSubmit(values); } finally { setSubmitting(false); }
  }

  const isValid = Object.keys(validate()).length === 0;

  return { values, errors, touched, submitting, isValid, set, touch, reset, handleSubmit, validate };
}

export default BloombergGrid;
