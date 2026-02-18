/**
 * Autopilot Activity Log Component
 * Activity stream with filtering
 */

import React, { useEffect, useState } from 'react';
import { useAutopilotStore } from '../store';
import type { ActivityLogEntry } from '../types';

const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDate = (timestamp: string): string => {
  return new Date(timestamp).toLocaleDateString();
};

interface LogEntryProps {
  entry: ActivityLogEntry;
}

const levelIcons: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
  debug: '🔍',
};

const eventTypeColors: Record<string, string> = {
  cycle_start: 'text-blue-400',
  cycle_complete: 'text-blue-400',
  candidate_generated: 'text-purple-400',
  candidate_selected: 'text-purple-400',
  validation_passed: 'text-green-400',
  validation_failed: 'text-red-400',
  order_submitted: 'text-yellow-400',
  order_filled: 'text-green-400',
  order_rejected: 'text-red-400',
  position_opened: 'text-green-400',
  position_closed: 'text-gray-400',
  exit_signal: 'text-orange-400',
  kill_switch: 'text-red-500',
  error: 'text-red-500',
};

const LogEntry: React.FC<LogEntryProps> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const icon = levelIcons[entry.level] || 'ℹ️';
  const typeColor = eventTypeColors[entry.event_type] || 'text-gray-400';

  return (
    <div 
      className="border-b border-gray-800 hover:bg-gray-850 transition-colors"
      data-testid={`log-entry-${entry.id}`}
    >
      <div 
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-mono">
              {formatTime(entry.timestamp)}
            </span>
            <span className={`font-medium ${typeColor}`}>
              {entry.event_type.replace(/_/g, ' ').toUpperCase()}
            </span>
            {entry.symbol && (
              <span className="px-2 py-0.5 bg-gray-700 rounded text-xs font-mono">
                {entry.symbol}
              </span>
            )}
          </div>
          <p className="text-gray-300 mt-1 truncate">{entry.message}</p>
        </div>
        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <button className="text-gray-500 hover:text-white text-sm">
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>
      
      {expanded && entry.metadata && (
        <div className="px-12 pb-3">
          <pre className="text-xs text-gray-400 bg-gray-800 rounded p-2 overflow-x-auto">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

type EventFilter = 'all' | 'trades' | 'validation' | 'errors';

export const AutopilotActivity: React.FC = () => {
  const { logs = [], isLoading, fetchLogs } = useAutopilotStore();
  const [filter, setFilter] = useState<EventFilter>('all');
  const [limit, setLimit] = useState(50);

  const getEventTypes = (filter: EventFilter): string | undefined => {
    switch (filter) {
      case 'trades':
        return 'order_filled,position_opened,position_closed';
      case 'validation':
        return 'validation_passed,validation_failed';
      case 'errors':
        return 'error,kill_switch';
      default:
        return undefined;
    }
  };

  useEffect(() => {
    fetchLogs({ limit, event_type: getEventTypes(filter) });
  }, [filter, limit, fetchLogs]);

  const handleRefresh = () => {
    fetchLogs({ limit, event_type: getEventTypes(filter) });
  };

  // Group logs by date
  const safeLogs = logs ?? [];
  const groupedLogs = safeLogs.reduce<Record<string, ActivityLogEntry[]>>((acc, log) => {
    const date = formatDate(log.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" data-testid="autopilot-activity">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold" data-testid="activity-log-heading">📋 Activity Log</h2>
        <div className="flex items-center gap-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
            {(['all', 'trades', 'validation', 'errors'] as EventFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                data-testid={`filter-${f}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-gray-700 rounded px-2 py-1 text-sm"
            data-testid="limit-select"
          >
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={200}>200 entries</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            data-testid="refresh-logs"
          >
            {isLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-6 px-4 py-2 bg-gray-800 text-sm">
        <div>
          <span className="text-gray-400">Total Entries:</span>
          <span className="ml-2 font-bold">{logs.length}</span>
        </div>
        <div>
          <span className="text-gray-400">Errors:</span>
          <span className="ml-2 font-bold text-red-400">
            {logs.filter((l) => l.level === 'error').length}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Warnings:</span>
          <span className="ml-2 font-bold text-yellow-400">
            {logs.filter((l) => l.level === 'warning').length}
          </span>
        </div>
      </div>

      {/* Log Stream */}
      <div className="flex-1 overflow-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isLoading ? '⏳ Loading activity...' : 'No activity found'}
          </div>
        ) : (
          Object.entries(groupedLogs).map(([date, entries]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="sticky top-0 bg-gray-850 px-4 py-2 text-sm text-gray-500 font-medium border-b border-gray-700">
                {date}
              </div>
              {/* Entries */}
              {entries.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AutopilotActivity;
