import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  Target, 
  PieChart, 
  Briefcase 
} from "lucide-react";
import type { KPI } from "@/lib/types";

const ICON_MAP: Record<string, any> = {
  revenue: DollarSign,
  sales: TrendingUp,
  customers: Users,
  users: Users,
  orders: Briefcase,
  profit: Activity,
  margin: Target,
  growth: BarChart3,
  default: PieChart
};

function getIcon(metric: string) {
  const key = metric.toLowerCase();
  for (const k in ICON_MAP) {
    if (key.includes(k)) return ICON_MAP[k];
  }
  return ICON_MAP.default;
}

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = getIcon(kpi.metric);
        return (
          <motion.div
            key={kpi.metric}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="kpi-card group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon size={48} className="text-indigo-400" />
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Icon size={16} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider truncate" title={kpi.metric}>
                {kpi.metric}
              </p>
            </div>

            <p className="text-3xl font-bold text-white mb-4 tracking-tight">{formatValue(kpi.total)}</p>
            
            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
              {(["average", "max", "min"] as const).map((key) =>
                kpi[key] !== "" && kpi[key] !== null && kpi[key] !== undefined ? (
                  <div key={key}>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">{key}</p>
                    <p className="text-xs text-slate-300 font-medium">{formatValue(kpi[key])}</p>
                  </div>
                ) : null,
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
