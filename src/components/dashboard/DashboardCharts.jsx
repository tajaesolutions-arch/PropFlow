import { ChartCard } from '../ChartCard.jsx';

export function RevenueCharts() {
  return (
    <div className="chart-grid">
      <ChartCard
        title="Revenue charts need booking data"
        subtitle="Financial reporting uses real booking and accounting records once they exist in the workspace."
      >
        <p className="empty-state">No chart data yet.</p>
      </ChartCard>
    </div>
  );
}

export function OperationsCharts() {
  return (
    <div className="chart-grid">
      <ChartCard
        title="Operations charts need task data"
        subtitle="Charts use real workspace cleaning, maintenance, booking, and property records."
      >
        <p className="empty-state">No chart data yet.</p>
      </ChartCard>
    </div>
  );
}
