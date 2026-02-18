/**
 * Incidents Panel
 * Displays active incidents and alerts
 */

import React from 'react';
import { useAutopilotStore } from '../store';
import type { Incident } from '../types';

export const IncidentsPanel: React.FC = () => {
    const { incidents, dismissIncident } = useAutopilotStore();

    if (!incidents || incidents.length === 0) {
        return null;
    }

    const severityColors = {
        error: 'bg-red-900 border-red-700 text-red-200',
        critical: 'bg-red-950 border-red-600 text-red-100 animate-pulse',
        warning: 'bg-yellow-900 border-yellow-700 text-yellow-200',
    };

    const severityIcon = {
        error: '⚠️',
        critical: '🛑',
        warning: '⚠️',
    };

    return (
        <div className="mb-4 space-y-2" data-testid="incidents-panel">
            {incidents.map((incident: Incident, idx: number) => (
                <div
                    key={`${incident.timestamp}-${idx}`}
                    className={`p-3 rounded border flex items-start justify-between ${severityColors[incident.severity] || severityColors.error}`}
                    data-testid={`incident-${idx}`}
                >
                    <div className="flex gap-3">
                        <span className="text-xl">{severityIcon[incident.severity] || '⚠️'}</span>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-wider">
                                {incident.title}
                            </h4>
                            <p className="text-sm opacity-90">{incident.description}</p>
                            <div className="flex gap-2 mt-1 text-xs opacity-75">
                                <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span>{incident.category}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => dismissIncident(idx)}
                        className="text-white opacity-50 hover:opacity-100 px-2"
                        title="Dismiss"
                        data-testid={`dismiss-incident-${idx}`}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
};
