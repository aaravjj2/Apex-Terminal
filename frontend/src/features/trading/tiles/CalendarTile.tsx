/**
 * Calendar Tile - Economic/Earnings calendar
 */

import { useState } from 'react';
import { DollarSign, BarChart2, Mic, FileText } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type EventType = 'earnings' | 'economic' | 'dividend' | 'conference';

interface CalendarEvent {
    id: string;
    date: string;
    time: string;
    title: string;
    type: EventType;
    importance: 'high' | 'medium' | 'low';
    details?: string;
}

const MOCK_EVENTS: CalendarEvent[] = [
    { id: '1', date: 'Today', time: '08:30', title: 'CPI YoY', type: 'economic', importance: 'high', details: 'Expected: 3.2%' },
    { id: '2', date: 'Today', time: '16:00', title: 'AAPL Earnings', type: 'earnings', importance: 'high', details: 'EPS Est: $2.10' },
    { id: '3', date: 'Tomorrow', time: '09:00', title: 'MSFT Earnings', type: 'earnings', importance: 'high', details: 'EPS Est: $2.78' },
    { id: '4', date: 'Tomorrow', time: '10:00', title: 'Fed Chair Speech', type: 'conference', importance: 'high' },
    { id: '5', date: 'Jan 18', time: '08:30', title: 'Jobless Claims', type: 'economic', importance: 'medium' },
    { id: '6', date: 'Jan 19', time: '—', title: 'NVDA Dividend', type: 'dividend', importance: 'low', details: '$0.04/share' },
];

const eventIcons: Record<EventType, React.ReactNode> = {
    earnings: <BarChart2 size={14} className="text-blue-500" />,
    economic: <FileText size={14} className="text-yellow-500" />,
    dividend: <DollarSign size={14} className="text-green-500" />,
    conference: <Mic size={14} className="text-purple-500" />,
};

export function CalendarTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [filter, setFilter] = useState<'all' | EventType>('all');

    const filteredEvents = MOCK_EVENTS.filter(e => 
        filter === 'all' || e.type === filter
    );

    return (
        <div className="h-full flex flex-col">
            {/* Filter */}
            <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
                {(['all', 'earnings', 'economic', 'dividend', 'conference'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-2 py-1 rounded text-xs capitalize whitespace-nowrap",
                            filter === f
                                ? "bg-brand text-white"
                                : "bg-element-bg text-text-secondary hover:text-text"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Events */}
            <div className="flex-1 overflow-y-auto">
                {filteredEvents.map(event => (
                    <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 border-b border-border/50 hover:bg-element-bg cursor-pointer"
                    >
                        <div className="mt-0.5">{eventIcons[event.type]}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text">{event.title}</span>
                                {event.importance === 'high' && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                <span>{event.date}</span>
                                <span>•</span>
                                <span>{event.time}</span>
                            </div>
                            {event.details && (
                                <div className="text-xs text-text-secondary mt-1">{event.details}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
