import React from 'react';
import { ChartCard } from '../ChartCard.jsx';
export function RevenueCharts() { return <div className="chart-grid"><ChartCard title="Revenue charts coming soon" subtitle="Financial reporting is intentionally deferred until real booking and accounting data is connected."><p className="empty-state">No chart data yet.</p></ChartCard></div>; }
export function OperationsCharts() { return <div className="chart-grid"><ChartCard title="Operations charts coming soon" subtitle="Charts will use real workspace cleaning, maintenance, booking, and property records."><p className="empty-state">No chart data yet.</p></ChartCard></div>; }
