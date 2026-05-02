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
            className="relative overflow-hidden bg-[#0B0F19]/40 backdrop-blur-xl border border-white/5 hover:border-indigo-500/30 transition-all duration-500 shadow-2xl rounded-3xl p-6 group"
          >
            {/* Dynamic Glow Layers */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] group-hover:bg-indigo-500/10 transition-all duration-700 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 blur-[40px] group-hover:bg-purple-500/10 transition-all duration-700 pointer-events-none" />
            
            {/* Top Border Accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-inner">
                  <Icon size={18} />
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] group-hover:text-slate-300 transition-colors truncate max-w-[120px]" title={kpi.metric}>
                  {kpi.metric}
                </p>
              </div>
              <div className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-400/50 transition-colors">
                METRIC.KPI
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-4xl font-black text-white mb-2 tracking-tighter group-hover:scale-[1.02] origin-left transition-transform duration-500">
                {formatValue(kpi.total)}
              </p>
              <div className="w-12 h-1 bg-indigo-500/20 rounded-full group-hover:w-20 group-hover:bg-indigo-500 transition-all duration-500" />
            </div>
            
            <div className="flex flex-wrap items-center gap-y-3 gap-x-6 mt-8 relative z-10">
              {(["average", "max", "min"] as const).map((key) =>
                kpi[key] !== "" && kpi[key] !== null && kpi[key] !== undefined ? (
                  <div key={key} className="flex-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase mb-1 tracking-widest">
                      {key === "average" ? "AVG" : key}
                    </p>
                    <p className="text-sm text-slate-300 font-bold whitespace-nowrap group-hover:text-white transition-colors tabular-nums">{formatValue(kpi[key])}</p>
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
