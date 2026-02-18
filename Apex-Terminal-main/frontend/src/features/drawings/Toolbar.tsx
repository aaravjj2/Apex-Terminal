import { MousePointer2, Maximize, TrendingUp, MoveRight, Minus, ArrowRight, Type } from 'lucide-react';
import { useStore } from '../../state/store.ts';
import type { ToolType } from '../../core/types.ts';

export const Toolbar = () => {
    const { activeTool, setTool } = useStore();

    const tools: { id: ToolType, icon: any, label: string }[] = [
        { id: 'cursor', icon: MousePointer2, label: 'Cursor' },
        { id: 'line', icon: TrendingUp, label: 'Trend Line' },
        { id: 'ray', icon: ArrowRight, label: 'Ray' },
        { id: 'hline', icon: Minus, label: 'Horizontal Line' },
        { id: 'vline', icon: MoveRight, label: 'Vertical Line' },
        { id: 'rect', icon: Maximize, label: 'Rectangle' },
        { id: 'fib', icon: TrendingUp, label: 'Fibonacci' }, // Reusing icon, can replace
        { id: 'text', icon: Type, label: 'Text' },
    ];

    return (
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-lg flex flex-col p-1 space-y-1 z-50">
            {tools.map(t => (
                <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`p-2 rounded hover:bg-[#2a2e39] transition ${activeTool === t.id ? 'text-blue-500 bg-[#2a2e39]' : 'text-gray-400'}`}
                    title={t.label}
                >
                    <t.icon size={20} />
                </button>
            ))}
        </div>
    );
};
