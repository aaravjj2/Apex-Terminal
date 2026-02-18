/**
 * Options Analytics State Store
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  OptionsChain,
  IVAnalytics,
  VolatilitySkew,
  TermStructure,
  PutCallRatio,
  StrategyAnalysis,
  StrategyTemplate,
} from './types';
import { optionsApi } from './api';

interface OptionsState {
  // Current symbol
  symbol: string | null;
  
  // Options chain data
  chain: OptionsChain | null;
  chainLoading: boolean;
  chainError: string | null;
  
  // IV analytics
  ivAnalytics: IVAnalytics | null;
  ivLoading: boolean;
  ivError: string | null;
  
  // Skew data
  skew: VolatilitySkew | null;
  skewLoading: boolean;
  skewError: string | null;
  selectedExpiration: string | null;
  
  // Term structure
  termStructure: TermStructure | null;
  termStructureLoading: boolean;
  termStructureError: string | null;
  
  // Put/Call ratio
  pcr: PutCallRatio | null;
  pcrLoading: boolean;
  pcrError: string | null;
  
  // Strategy analysis
  strategyTemplates: StrategyTemplate[];
  currentStrategy: StrategyAnalysis | null;
  strategyLoading: boolean;
  strategyError: string | null;
  
  // Actions
  setSymbol: (symbol: string) => void;
  fetchChain: (symbol: string, expiration?: string) => Promise<void>;
  fetchIVAnalytics: (symbol: string) => Promise<void>;
  fetchSkew: (symbol: string, expiration: string) => Promise<void>;
  fetchTermStructure: (symbol: string) => Promise<void>;
  fetchPCR: (symbol: string) => Promise<void>;
  fetchAll: (symbol: string) => Promise<void>;
  loadStrategyTemplates: () => Promise<void>;
  analyzeStrategy: (analysis: StrategyAnalysis) => void;
  setSelectedExpiration: (expiration: string) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  symbol: null,
  chain: null,
  chainLoading: false,
  chainError: null,
  ivAnalytics: null,
  ivLoading: false,
  ivError: null,
  skew: null,
  skewLoading: false,
  skewError: null,
  selectedExpiration: null,
  termStructure: null,
  termStructureLoading: false,
  termStructureError: null,
  pcr: null,
  pcrLoading: false,
  pcrError: null,
  strategyTemplates: [],
  currentStrategy: null,
  strategyLoading: false,
  strategyError: null,
};

export const useOptionsStore = create<OptionsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setSymbol: (symbol) => {
        set({ symbol: symbol.toUpperCase() });
      },

      fetchChain: async (symbol, expiration) => {
        set({ chainLoading: true, chainError: null });
        try {
          const chain = await optionsApi.getChain(symbol, expiration);
          set({ 
            chain, 
            chainLoading: false,
            symbol: symbol.toUpperCase(),
          });
          
          // Auto-select first expiration if none selected
          if (!get().selectedExpiration && chain.expirations.length > 0) {
            set({ selectedExpiration: chain.expirations[0] });
          }
        } catch (error) {
          set({ 
            chainError: error instanceof Error ? error.message : 'Failed to fetch chain',
            chainLoading: false,
          });
        }
      },

      fetchIVAnalytics: async (symbol) => {
        set({ ivLoading: true, ivError: null });
        try {
          const ivAnalytics = await optionsApi.getIVAnalytics(symbol);
          set({ ivAnalytics, ivLoading: false });
        } catch (error) {
          set({
            ivError: error instanceof Error ? error.message : 'Failed to fetch IV analytics',
            ivLoading: false,
          });
        }
      },

      fetchSkew: async (symbol, expiration) => {
        set({ skewLoading: true, skewError: null, selectedExpiration: expiration });
        try {
          const skew = await optionsApi.getSkew(symbol, expiration);
          set({ skew, skewLoading: false });
        } catch (error) {
          set({
            skewError: error instanceof Error ? error.message : 'Failed to fetch skew',
            skewLoading: false,
          });
        }
      },

      fetchTermStructure: async (symbol) => {
        set({ termStructureLoading: true, termStructureError: null });
        try {
          const termStructure = await optionsApi.getTermStructure(symbol);
          set({ termStructure, termStructureLoading: false });
        } catch (error) {
          set({
            termStructureError: error instanceof Error ? error.message : 'Failed to fetch term structure',
            termStructureLoading: false,
          });
        }
      },

      fetchPCR: async (symbol) => {
        set({ pcrLoading: true, pcrError: null });
        try {
          const pcr = await optionsApi.getPutCallRatio(symbol);
          set({ pcr, pcrLoading: false });
        } catch (error) {
          set({
            pcrError: error instanceof Error ? error.message : 'Failed to fetch PCR',
            pcrLoading: false,
          });
        }
      },

      fetchAll: async (symbol) => {
        set({ symbol: symbol.toUpperCase() });
        
        // Fetch all data in parallel
        await Promise.all([
          get().fetchChain(symbol),
          get().fetchIVAnalytics(symbol),
          get().fetchTermStructure(symbol),
          get().fetchPCR(symbol),
        ]);
        
        // Fetch skew for first expiration
        const chain = get().chain;
        if (chain && chain.expirations.length > 0) {
          await get().fetchSkew(symbol, chain.expirations[0]);
        }
      },

      loadStrategyTemplates: async () => {
        try {
          const templates = await optionsApi.getStrategyTemplates();
          set({ strategyTemplates: templates });
        } catch (error) {
          console.error('Failed to load strategy templates:', error);
        }
      },

      analyzeStrategy: (analysis) => {
        set({ currentStrategy: analysis });
      },

      setSelectedExpiration: (expiration) => {
        set({ selectedExpiration: expiration });
        const symbol = get().symbol;
        if (symbol) {
          get().fetchSkew(symbol, expiration);
        }
      },

      clearError: () => {
        set({
          chainError: null,
          ivError: null,
          skewError: null,
          termStructureError: null,
          pcrError: null,
          strategyError: null,
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'options-store' }
  )
);
