/**
 * PortfolioUpload — drag/drop + file-input CSV upload component.
 */

import { useState, useRef, useCallback } from 'react';

interface Props {
  onFileSelected: (file: File) => void;
  onLoadDemo: () => void;
  disabled?: boolean;
  fileName?: string;
}

export function PortfolioUpload({ onFileSelected, onLoadDemo, disabled, fileName }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith('.csv')) {
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="portfolio-upload">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 p-8
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${dragOver
            ? 'border-brand bg-brand/10 text-brand'
            : 'border-border hover:border-brand/50 text-text-secondary hover:text-text'
          }
          ${disabled ? 'pointer-events-none opacity-50' : ''}
        `}
        data-testid="drop-zone"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm font-medium">
          {fileName ? fileName : 'Drop CSV here or click to browse'}
        </span>
        <span className="text-xs text-text-muted">Accepts .csv files</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInput}
          data-testid="file-input"
        />
      </div>

      {/* Load demo button */}
      <button
        onClick={onLoadDemo}
        disabled={disabled}
        className="px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded text-sm font-medium transition-colors disabled:opacity-50"
        data-testid="load-demo-btn"
      >
        Load Demo Portfolio
      </button>
    </div>
  );
}
