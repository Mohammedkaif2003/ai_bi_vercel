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
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: i * 0.05, 
              duration: 0.5,
              type: "spring",
              stiffness: 100 
            }}
            whileHover={{ 
              y: -5,
              transition: { duration: 0.2 }
            }}
            className="kpi-card group relative overflow-hidden border border-white/5 hover:border-indigo-500/30 transition-colors shadow-2xl hover:shadow-indigo-500/10"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/0 via-indigo-600/0 to-indigo-600/0 group-hover:to-indigo-600/5 transition-all duration-500" />
            
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12">
              <Icon size={64} className="text-indigo-400" />
            </div>
            
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                <Icon size={16} />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors truncate" title={kpi.metric}>
                {kpi.metric}
              </p>
            </div>

            <p className="text-3xl font-bold text-white mb-4 tracking-tight relative z-10 group-hover:scale-105 origin-left transition-transform duration-300">{formatValue(kpi.total)}</p>
            
            <div className="flex flex-wrap items-center gap-y-3 gap-x-4 border-t border-white/[0.05] pt-4 relative z-10">
              {(["average", "max", "min"] as const).map((key) =>
                kpi[key] !== "" && kpi[key] !== null && kpi[key] !== undefined ? (
                  <div key={key} className="min-w-[50px] flex-1">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-0.5 tracking-tighter">
                      {key === "average" ? "AVG" : key}
                    </p>
                    <p className="text-xs text-slate-300 font-bold whitespace-nowrap group-hover:text-white transition-colors">{formatValue(kpi[key])}</p>
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
