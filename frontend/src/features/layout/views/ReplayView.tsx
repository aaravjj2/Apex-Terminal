import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
    Calendar, Radio
} from 'lucide-react';
import { Badge } from '../../../ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import { ChartCanvas } from '../../chart/ChartCanvas';
import { ChartHeaderStrip } from '../../chart/ChartHeaderStrip';

import { ReplayControlBar } from '../../replay/ReplayControlBar';

import { useAppStore } from '../../../state/appStore';

// Right dock for replay
function ReplayRightDock() {
    const { parityMismatch } = useAppStore();

    // Derived events from parity status
    const events = [
        { time: 'System', type: 'info', message: 'Replay session active' },
        ...(parityMismatch ? [{ time: 'Alert', type: 'error', message: 'Determinism mismatch detected' }] : [])
    ];

    return (
        <div className="h-full bg-panel-bg border-l border-border flex flex-col">
            <Tabs defaultValue="events" className="flex-1">
                <TabsList className="px-1">
                    <TabsTrigger value="events" icon={<Radio size={14} />}>Events</TabsTrigger>
                    <TabsTrigger value="markers" icon={<Calendar size={14} />}>Markers</TabsTrigger>
                </TabsList>

                <TabsContent value="events">
                    <div className="p-2 space-y-1">
                        {events.map((evt, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 px-2 py-1.5 rounded bg-element-bg text-xs"
                            >
                                <span className="text-text-muted font-mono shrink-0">{evt.time}</span>
                                <Badge
                                    size="sm"
                                    variant={evt.type === 'error' ? 'error' : 'info'}
                                >
                                    {evt.type}
                                </Badge>
                                <span className="text-text">{evt.message}</span>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="markers">
                    <div className="p-4 text-center text-text-secondary text-xs">
                        No markers set. Click on chart to add.
                    </div>
                </TabsContent>
            </Tabs>

            {/* Determinism info */}
            <div className="p-3 border-t border-border">
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Determinism Proof</h4>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Parity Status</span>
                        <Badge variant={parityMismatch ? 'error' : 'success'} size="sm">
                            {parityMismatch ? 'Mismatch' : 'Synced'}
                        </Badge>
                    </div>
                    {/* 
                      In a real scenario we might display the checksum hash here if available in the store
                      For now we simply show the status derived from the backend check
                    */}
                </div>
            </div>
        </div>
    );
}

export function ReplayView() {
    return (
        <div className="h-full flex flex-col bg-background">
            <ReplayControlBar />

            <PanelGroup orientation="horizontal" className="flex-1">
                <Panel defaultSize={75} minSize={40}>
                    <div className="h-full flex flex-col">
                        <ChartHeaderStrip />
                        <div className="flex-1 relative">
                            <ChartCanvas className="absolute inset-0" />
                        </div>
                    </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-replay transition-colors cursor-col-resize" />
                <Panel defaultSize={25} minSize={15} maxSize={40}>
                    <ReplayRightDock />
                </Panel>
            </PanelGroup>
        </div>
    );
}
