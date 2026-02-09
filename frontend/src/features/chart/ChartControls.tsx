import { Maximize2 } from 'lucide-react';
import type { IChartApi } from 'lightweight-charts';

interface ChartControlsProps {
    chartRef: React.MutableRefObject<IChartApi | null>;
}

export const ChartControls = ({ chartRef }: ChartControlsProps) => {
    const handleResetZoom = () => {
        chartRef.current?.timeScale().fitContent();
    };

    return (
        <div className="absolute bottom-20 right-4 z-40 flex flex-col space-y-1">
            <button
                onClick={handleResetZoom}
                className="bg-[#2a2e39] hover:bg-[#363a45] text-gray-200 p-2 rounded border border-[#363a45] transition"
                title="Reset Zoom / Auto-fit"
            >
                <Maximize2 size={16} />
            </button>
        </div>
    );
};
