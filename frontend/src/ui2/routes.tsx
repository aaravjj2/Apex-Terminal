/**
 * UI2 Routes Configuration
 * React Router routes for UI v2 — full feature parity with UI1
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShellUI2 } from './AppShellUI2';
import {
  DashboardUI2,
  TradingUI2,
  ResearchUI2,
  RiskUI2,
  PortfolioUI2,
  OpsUI2,
  AutopilotUI2,
  OrdersUI2,
  AlertsUI2,
  RunsUI2,
  BacktestUI2,
  ReplayUI2,
  SettingsUI2,
} from './pages';

export function UI2Routes() {
  return (
    <Routes>
      <Route path="/" element={<AppShellUI2 />}>
        <Route index element={<Navigate to="/ui2/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardUI2 />} />
        <Route path="trading" element={<TradingUI2 />} />
        <Route path="research" element={<ResearchUI2 />} />
        <Route path="risk" element={<RiskUI2 />} />
        <Route path="portfolio" element={<PortfolioUI2 />} />
        <Route path="orders" element={<OrdersUI2 />} />
        <Route path="backtest" element={<BacktestUI2 />} />
        <Route path="autopilot" element={<AutopilotUI2 />} />
        <Route path="alerts" element={<AlertsUI2 />} />
        <Route path="runs" element={<RunsUI2 />} />
        <Route path="replay" element={<ReplayUI2 />} />
        <Route path="ops" element={<OpsUI2 />} />
        <Route path="settings" element={<SettingsUI2 />} />
      </Route>
    </Routes>
  );
}
