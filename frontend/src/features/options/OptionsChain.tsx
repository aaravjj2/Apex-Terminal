import { useMemo } from 'react';
import { useOptionsStore } from './store';
import type { OptionContract } from './types';

interface OptionsChainProps {
  symbol: string;
  expiration: string;
  underlyingPrice?: number;
}

export const OptionsChain = ({ underlyingPrice }: OptionsChainProps) => {
  const { chain, chainLoading } = useOptionsStore();

  const chainData = useMemo(() => {
    if (!chain || !chain.contracts) return [];

    // Group contracts by strike
    const strikesMap = new Map<number, { strike: number; call?: OptionContract; put?: OptionContract }>();

    chain.contracts.forEach(contract => {
      const strike = contract.strike;
      if (!strikesMap.has(strike)) {
        strikesMap.set(strike, { strike });
      }
      const entry = strikesMap.get(strike)!;
      if (contract.optionType === 'call') {
        entry.call = contract;
      } else {
        entry.put = contract;
      }
    });

    return Array.from(strikesMap.values()).sort((a, b) => a.strike - b.strike);
  }, [chain]);

  const getStrikeHighlight = (strike: number) => {
    if (!underlyingPrice) return '';
    const diff = Math.abs(strike - underlyingPrice) / underlyingPrice;
    if (diff < 0.02) return 'bg-blue-500/20 font-bold';
    return '';
  };

  if (chainLoading && chainData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading options chain...</div>
      </div>
    );
  }

  if (!chainLoading && chainData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-center">
          <p>No options data found for this expiration.</p>
          <p className="text-xs opacity-50">Try selecting a different date or symbol.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800 z-10 shadow-sm">
            <tr>
              <th colSpan={5} className="px-2 py-2 text-center border-r border-gray-700 bg-green-900/10 text-green-400 font-bold">
                CALLS
              </th>
              <th className="px-2 py-2 text-center border-r border-gray-700 font-bold">STRIKE</th>
              <th colSpan={5} className="px-2 py-2 text-center bg-red-900/10 text-red-400 font-bold">
                PUTS
              </th>
            </tr>
            <tr className="text-xxs text-gray-500 border-b border-gray-700">
              <th className="px-1 py-1 text-right border-r border-gray-800">Bid</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">Ask</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">Vol</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">OI</th>
              <th className="px-1 py-1 text-right border-r-2 border-gray-700">IV</th>
              <th className="px-1 py-1 text-center border-r-2 border-gray-700">Price</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">IV</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">Vol</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">OI</th>
              <th className="px-1 py-1 text-right border-r border-gray-800">Bid</th>
              <th className="px-1 py-1 text-right">Ask</th>
            </tr>
          </thead>
          <tbody>
            {chainData.map((row, idx) => {
              const call = row.call;
              const put = row.put;
              const isITMCall = underlyingPrice ? row.strike < underlyingPrice : false;
              const isITMPut = underlyingPrice ? row.strike > underlyingPrice : false;

              return (
                <tr
                  key={row.strike}
                  className={`hover:bg-gray-800 transition-colors border-b border-gray-800/50 ${idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'} ${getStrikeHighlight(row.strike)}`}
                >
                  {/* Calls */}
                  <td className={`px-1 py-1 text-right border-r border-gray-800 ${isITMCall ? 'bg-green-500/5 text-green-300' : 'text-gray-300'}`}>
                    {call?.bid?.toFixed(2) || '-'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 ${isITMCall ? 'bg-green-500/5 text-green-300' : 'text-gray-300'}`}>
                    {call?.ask?.toFixed(2) || '-'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 text-gray-400 ${isITMCall ? 'bg-green-500/5' : ''}`}>
                    {call?.volume || '0'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 text-gray-400 ${isITMCall ? 'bg-green-500/5' : ''}`}>
                    {call?.openInterest || '0'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r-2 border-gray-700 text-gray-400 font-mono ${isITMCall ? 'bg-green-500/5' : ''}`}>
                    {call?.impliedVolatility ? (call.impliedVolatility * 100).toFixed(1) + '%' : '-'}
                  </td>

                  {/* Strike */}
                  <td className="px-1 py-1 text-center font-bold bg-gray-800/50 border-r-2 border-gray-700 text-brand">
                    {row.strike.toFixed(1)}
                  </td>

                  {/* Puts */}
                  <td className={`px-1 py-1 text-right border-r border-gray-800 text-gray-400 font-mono ${isITMPut ? 'bg-red-500/5' : ''}`}>
                    {put?.impliedVolatility ? (put.impliedVolatility * 100).toFixed(1) + '%' : '-'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 text-gray-400 ${isITMPut ? 'bg-red-500/5' : ''}`}>
                    {put?.volume || '0'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 text-gray-400 ${isITMPut ? 'bg-red-500/5' : ''}`}>
                    {put?.openInterest || '0'}
                  </td>
                  <td className={`px-1 py-1 text-right border-r border-gray-800 ${isITMPut ? 'bg-red-500/5 text-red-300' : 'text-gray-300'}`}>
                    {put?.bid?.toFixed(2) || '-'}
                  </td>
                  <td className={`px-1 py-1 text-right ${isITMPut ? 'bg-red-500/5 text-red-300' : 'text-gray-300'}`}>
                    {put?.ask?.toFixed(2) || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
