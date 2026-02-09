/**
 * ValidationResults — panel showing summary + table of errors/warnings.
 */

import type { ValidationResult } from './types';

interface Props {
  result: ValidationResult | null;
}

export function ValidationResults({ result }: Props) {
  if (!result) return null;

  return (
    <div className="flex flex-col gap-4" data-testid="validation-results">
      {/* Summary banner */}
      <div
        className={`p-4 rounded-lg border ${
          result.valid
            ? 'bg-green-900/20 border-green-700 text-green-400'
            : 'bg-red-900/20 border-red-700 text-red-400'
        }`}
        data-testid="validation-summary"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{result.valid ? '✅' : '❌'}</span>
          <span className="text-lg font-bold">
            {result.valid ? 'Portfolio Valid' : 'Validation Failed'}
          </span>
        </div>
        <div className="text-sm opacity-80">
          {result.total_rows} row{result.total_rows !== 1 ? 's' : ''} •{' '}
          {result.error_count} error{result.error_count !== 1 ? 's' : ''} •{' '}
          {result.warning_count} warning{result.warning_count !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Issues table */}
      {result.issues.length > 0 && (
        <div className="overflow-auto rounded border border-border">
          <table className="w-full text-sm" data-testid="issues-table">
            <thead>
              <tr className="bg-element-bg text-text-secondary">
                <th className="text-left px-3 py-2 w-20">Severity</th>
                <th className="text-left px-3 py-2 w-16">Row</th>
                <th className="text-left px-3 py-2 w-24">Field</th>
                <th className="text-left px-3 py-2 w-40">Code</th>
                <th className="text-left px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {result.issues.map((issue, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-border ${
                    issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}
                >
                  <td className="px-3 py-2 font-medium">
                    {issue.severity === 'error' ? '🔴 Error' : '🟡 Warn'}
                  </td>
                  <td className="px-3 py-2">{issue.row ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{issue.field}</td>
                  <td className="px-3 py-2 font-mono text-xs">{issue.code}</td>
                  <td className="px-3 py-2">{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
