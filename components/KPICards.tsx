import type { KPI } from "@/lib/types";

const ACCENT_COLORS = [
  "border-l-[#4F46E5]",
  "border-l-[#10B981]",
  "border-l-[#F59E0B]",
  "border-l-[#EC4899]",
  "border-l-[#06B6D4]",
];

function formatValue(val: number | string): string {
  if (val === "" || val === null || val === undefined) return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

export default function KPICards({ kpis }: { kpis: KPI[] }) {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.metric}
          className={`kpi-card border-l-4 ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`}
        >
          <p className="text-xs text-[#64748B] font-medium mb-1 truncate" title={kpi.metric}>
            {kpi.metric}
          </p>
          <p className="text-2xl font-bold text-white mb-2">{formatValue(kpi.total)}</p>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {(["average", "max", "min"] as const).map((key) =>
              kpi[key] !== "" && kpi[key] !== null && kpi[key] !== undefined ? (
                <div key={key} className="text-center">
                  <p className="text-[#475569] capitalize">{key}</p>
                  <p className="text-[#94A3B8] font-medium">{formatValue(kpi[key])}</p>
                </div>
              ) : null,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
